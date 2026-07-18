/**
 * HDLC framing for DLMS/COSEM (IEC 62056-46, "type 3" frames).
 *
 * Layout between the 0x7E flags:
 *   format(2) | dest-addr(1..4) | src-addr(1..4) | control(1) | [HCS(2)] | info | FCS(2)
 *
 * The HCS covers the header; the FCS covers the whole frame. Both are
 * CRC-16/X.25 stored little-endian. We verify them and report the result
 * instead of throwing, so a corrupt-on-the-wire frame is still inspectable.
 */

import { ByteParseError, ByteReader, bytesToHex, crc16X25, type Span } from "./bytes";

export interface HdlcAddress {
  readonly value: number;
  readonly bytes: number;
  readonly hex: string;
}

export interface HdlcControl {
  readonly raw: number;
  readonly type: "I" | "S" | "U";
  readonly name: string;
  readonly pollFinal: boolean;
  readonly sendSeq?: number;
  readonly recvSeq?: number;
}

export interface HdlcFrame {
  readonly span: Span;
  readonly format: {
    readonly type: number;
    readonly segmented: boolean;
    readonly length: number;
  };
  readonly destination: HdlcAddress;
  readonly source: HdlcAddress;
  readonly control: HdlcControl;
  readonly hcs?: { readonly stored: number; readonly computed: number; readonly ok: boolean; readonly span: Span };
  readonly fcs: { readonly stored: number; readonly computed: number; readonly ok: boolean; readonly span: Span };
  /** LLC + APDU bytes (the payload handed to the COSEM layer). */
  readonly information?: { readonly span: Span; readonly bytes: Uint8Array };
  readonly llc?: { readonly span: Span; readonly hex: string; readonly direction: "command" | "response" | "unknown" };
}

const FLAG = 0x7e;

function readAddress(r: ByteReader): HdlcAddress {
  const start = r.offset;
  let value = 0;
  let count = 0;
  for (;;) {
    const b = r.u8();
    count++;
    value = (value << 7) | (b >> 1);
    if (b & 0x01) break;
    if (count >= 4) throw new ByteParseError("HDLC address longer than 4 bytes", start);
  }
  return { value, bytes: count, hex: `0x${value.toString(16)}` };
}

function decodeControl(raw: number): HdlcControl {
  const pollFinal = (raw & 0x10) !== 0;
  if ((raw & 0x01) === 0) {
    // I-frame: RRR P/F SSS 0
    return { raw, type: "I", name: "I (information)", pollFinal, recvSeq: (raw >> 5) & 0x07, sendSeq: (raw >> 1) & 0x07 };
  }
  if ((raw & 0x03) === 0x01) {
    // S-frame: RRR P/F SS 01
    const supervisory = (raw >> 2) & 0x03;
    const name = ["RR (receive ready)", "RNR (receive not ready)", "REJ (reject)", "SREJ (selective reject)"][supervisory]!;
    return { raw, type: "S", name, pollFinal, recvSeq: (raw >> 5) & 0x07 };
  }
  // U-frame: MMM P/F MM 11 — mask out the P/F bit to match on the modifier bits.
  const uCode = raw & 0xec;
  const U_FRAMES: Record<number, string> = {
    0x93: "SNRM (set normal response mode)",
    0x83: "SNRM",
    0x73: "UA (unnumbered acknowledge)",
    0x63: "UA",
    0x53: "DISC (disconnect)",
    0x43: "DISC",
    0x1f: "FRMR (frame reject)",
    0x0f: "FRMR",
    0x03: "UI (unnumbered information)",
    0x13: "UI",
  };
  return { raw, type: "U", name: U_FRAMES[raw] ?? U_FRAMES[uCode] ?? `U-frame (0x${raw.toString(16)})`, pollFinal };
}

function classifyLlc(bytes: Uint8Array): "command" | "response" | "unknown" {
  if (bytes.length < 3) return "unknown";
  if (bytes[0] === 0xe6 && bytes[1] === 0xe6) return "command";
  if (bytes[0] === 0xe6 && bytes[1] === 0xe7) return "response";
  return "unknown";
}

/**
 * Decode a single HDLC frame. `buf` must start at the opening flag; trailing
 * bytes after the closing flag are ignored (a real link is a byte stream).
 */
export function decodeHdlc(buf: Uint8Array): HdlcFrame {
  const r = new ByteReader(buf);
  const opening = r.u8();
  if (opening !== FLAG) throw new ByteParseError(`expected opening flag 0x7E, got 0x${opening.toString(16)}`, 0);

  const frameStart = r.offset; // first byte after the opening flag (format field)
  const fmt = r.u16();
  const format = { type: (fmt >> 12) & 0x0f, segmented: (fmt & 0x0800) !== 0, length: fmt & 0x07ff };

  const destination = readAddress(r);
  const source = readAddress(r);
  const control = decodeControl(r.u8());

  // Total frame length (per format field) counts from the format field through
  // the FCS, i.e. `format.length` bytes starting at frameStart.
  const frameEnd = frameStart + format.length; // offset just past the FCS
  const fcsStart = frameEnd - 2;

  let hcs: HdlcFrame["hcs"];
  let information: HdlcFrame["information"];
  let llc: HdlcFrame["llc"];

  const hasInfo = fcsStart > r.offset; // bytes remain between control and FCS → header has HCS + info
  if (hasInfo) {
    const hcsSpan = r.span();
    // The header region ends where the HCS begins (the span's start offset).
    const hcsComputed = crc16X25(buf.subarray(frameStart, hcsSpan.end().offset));
    const hcsStored = r.u8() | (r.u8() << 8);
    hcs = { stored: hcsStored, computed: hcsComputed, ok: hcsStored === hcsComputed, span: hcsSpan.end() };

    const infoSpan = r.span();
    const infoBytes = r.bytes(fcsStart - r.offset);
    information = { span: infoSpan.end(), bytes: infoBytes };
    const direction = classifyLlc(infoBytes);
    if (direction !== "unknown") {
      llc = { span: { offset: infoSpan.end().offset, length: 3 }, hex: bytesToHex(infoBytes.subarray(0, 3)), direction };
    }
  }

  const fcsSpan = r.span();
  const fcsStored = r.u8() | (r.u8() << 8);
  const fcsComputed = crc16X25(buf.subarray(frameStart, fcsStart));
  const fcs = { stored: fcsStored, computed: fcsComputed, ok: fcsStored === fcsComputed, span: fcsSpan.end() };

  const closing = r.u8();
  if (closing !== FLAG) throw new ByteParseError(`expected closing flag 0x7E, got 0x${closing.toString(16)}`, r.offset - 1);

  return {
    span: { offset: 0, length: r.offset },
    format,
    destination,
    source,
    control,
    ...(hcs ? { hcs } : {}),
    fcs,
    ...(information ? { information } : {}),
    ...(llc ? { llc } : {}),
  };
}

/** The LLC payload (APDU) with its 3-byte LLC header stripped, if present. */
export function apduFromFrame(frame: HdlcFrame): Uint8Array | undefined {
  if (!frame.information) return undefined;
  const bytes = frame.information.bytes;
  return frame.llc ? bytes.subarray(3) : bytes;
}
