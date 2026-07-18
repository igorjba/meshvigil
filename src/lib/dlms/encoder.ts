/**
 * Minimal DLMS/COSEM encoder — the mirror of the parser.
 *
 * The simulation engine uses this to serialise each meter reading into a real
 * DataNotification frame (HDLC + LLC + APDU + A-XDR). The console then decodes
 * those exact bytes, so the whole "bytes → objects" loop is genuine, not faked.
 */

import { ByteWriter, crc16X25, u16le } from "./bytes";
import { DataType } from "./axdr";
import { ApduTag } from "./cosem";

/** A-XDR length (short form is enough for our frame sizes). */
function axdrLen(w: ByteWriter, len: number): void {
  if (len < 0x80) {
    w.u8(len);
  } else if (len < 0x100) {
    w.u8(0x81).u8(len);
  } else {
    w.u8(0x82).u16(len);
  }
}

export function encOctetString(bytes: Uint8Array | number[]): Uint8Array {
  const arr = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  const w = new ByteWriter().u8(DataType.OctetString);
  axdrLen(w, arr.length);
  return w.concat(arr).toBytes();
}

export function encU32(value: number): Uint8Array {
  return new ByteWriter().u8(DataType.DoubleLongUnsigned).u32(value >>> 0).toBytes();
}

export function encU16(value: number): Uint8Array {
  return new ByteWriter().u8(DataType.LongUnsigned).u16(value & 0xffff).toBytes();
}

export function encI16(value: number): Uint8Array {
  return new ByteWriter().u8(DataType.Long).u16(value & 0xffff).toBytes();
}

export function encI8(value: number): Uint8Array {
  return new ByteWriter().u8(DataType.Integer).u8(value & 0xff).toBytes();
}

export function encEnum(value: number): Uint8Array {
  return new ByteWriter().u8(DataType.Enum).u8(value & 0xff).toBytes();
}

export function encStructure(...members: Uint8Array[]): Uint8Array {
  const w = new ByteWriter().u8(DataType.Structure);
  axdrLen(w, members.length);
  for (const m of members) w.concat(m);
  return w.toBytes();
}

export function encArray(members: Uint8Array[]): Uint8Array {
  const w = new ByteWriter().u8(DataType.Array);
  axdrLen(w, members.length);
  for (const m of members) w.concat(m);
  return w.toBytes();
}

/** scaler_unit ::= structure { integer scaler, enum unit } */
export function encScalerUnit(scaler: number, unit: number): Uint8Array {
  return encStructure(encI8(scaler), encEnum(unit));
}

/** A capture: structure { octet-string(OBIS), value, scaler_unit }. */
export function encCapture(obis: string, value: Uint8Array, scalerUnit?: Uint8Array): Uint8Array {
  const obisBytes = obis.split(".").map((n) => Number.parseInt(n, 10));
  const members = [encOctetString(obisBytes), value];
  if (scalerUnit) members.push(scalerUnit);
  return encStructure(...members);
}

/** Encode a COSEM date-time (12 bytes) from parts. Deviation 0x8000 = unspecified. */
export function encDateTime(parts: {
  year: number;
  month: number;
  day: number;
  dayOfWeek?: number;
  hour: number;
  minute: number;
  second: number;
}): Uint8Array {
  return new ByteWriter()
    .u16(parts.year)
    .u8(parts.month)
    .u8(parts.day)
    .u8(parts.dayOfWeek ?? 0xff)
    .u8(parts.hour)
    .u8(parts.minute)
    .u8(parts.second)
    .u8(0x00) // hundredths
    .u16(0x8000) // deviation: not specified
    .u8(0x00) // clock status
    .toBytes();
}

export interface DataNotificationInput {
  readonly invokeId: number;
  readonly meterId: string; // ascii logical device name
  readonly captures: Uint8Array[]; // from encCapture()
  readonly timestamp?: Uint8Array; // from encDateTime()
  readonly clientAddress?: number;
  readonly serverAddress?: number;
}

/** Encode the DataNotification APDU body (tag + iap + timestamp + notification-body). */
function encDataNotificationApdu(input: DataNotificationInput): Uint8Array {
  const w = new ByteWriter().u8(ApduTag.DataNotification).u32(input.invokeId & 0xffffff);
  if (input.timestamp) {
    w.u8(input.timestamp.length).concat(input.timestamp);
  } else {
    w.u8(0x00); // date-time absent
  }
  const meterId = encOctetString(new TextEncoder().encode(input.meterId));
  const body = encStructure(meterId, encArray(input.captures));
  return w.concat(body).toBytes();
}

/** Encode a single-byte HDLC address (value 0..127). */
function encAddress(value: number): number {
  return ((value & 0x7f) << 1) | 0x01;
}

export interface FrameOptions {
  readonly clientAddress?: number;
  readonly serverAddress?: number;
  readonly control?: number;
  /** LLC direction: response (E6 E7 00) or command (E6 E6 00). */
  readonly direction?: "command" | "response";
}

/**
 * Wrap an APDU in LLC + HDLC (type 3) with correct HCS/FCS. Produces the exact
 * on-the-wire bytes the parser consumes. This is the one place that assembles a
 * frame, so HCS/FCS are always computed over the right regions.
 */
export function frameApdu(apdu: Uint8Array, opts: FrameOptions = {}): Uint8Array {
  const llc = opts.direction === "command" ? [0xe6, 0xe6, 0x00] : [0xe6, 0xe7, 0x00];
  const info = new ByteWriter().concat(llc).concat(apdu).toBytes();

  const dest = encAddress(opts.clientAddress ?? 1);
  const src = encAddress(opts.serverAddress ?? 17);
  const control = opts.control ?? 0x13; // default: UI frame, P/F set — unsolicited push

  // format.length counts the format field through the FCS, inclusive.
  const length = 2 + 1 + 1 + 1 + 2 + info.length + 2;
  const formatField = (0xa << 12) | (length & 0x07ff);

  const header = new ByteWriter().u16(formatField).u8(dest).u8(src).u8(control).toBytes();
  const hcs = crc16X25(header);

  const beforeFcs = new ByteWriter().concat(header).push(...u16le(hcs)).concat(info).toBytes();
  const fcs = crc16X25(beforeFcs);

  return new ByteWriter()
    .u8(0x7e)
    .concat(beforeFcs)
    .push(...u16le(fcs))
    .u8(0x7e)
    .toBytes();
}

/** Encode + frame a DataNotification push in one call. */
export function frameDataNotification(input: DataNotificationInput): Uint8Array {
  return frameApdu(encDataNotificationApdu(input), {
    ...(input.clientAddress !== undefined ? { clientAddress: input.clientAddress } : {}),
    ...(input.serverAddress !== undefined ? { serverAddress: input.serverAddress } : {}),
  });
}

/** Encode a GET-Response (normal) carrying one data value. */
export function encGetResponseNormal(invokeId: number, value: Uint8Array): Uint8Array {
  return new ByteWriter()
    .u8(ApduTag.GetResponse)
    .u8(0x01) // response type: normal
    .u8((invokeId & 0x0f) | 0xc0) // invoke-id-and-priority: confirmed, high
    .u8(0x00) // Get-Data-Result choice: data
    .concat(value)
    .toBytes();
}
