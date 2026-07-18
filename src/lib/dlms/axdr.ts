/**
 * A-XDR decoding of COSEM data (the `Data` CHOICE from IEC 62056-6-2).
 *
 * Every value is TLV-ish: a one-byte type tag, an optional A-XDR length, then
 * the payload. Arrays and structures nest, so this decoder is recursive and
 * records the byte span of each node for the hex inspector.
 */

import { ByteParseError, type ByteReader, bytesToHex, type Span } from "./bytes";

export const DataType = {
  NullData: 0x00,
  Array: 0x01,
  Structure: 0x02,
  Boolean: 0x03,
  BitString: 0x04,
  DoubleLong: 0x05,
  DoubleLongUnsigned: 0x06,
  OctetString: 0x09,
  VisibleString: 0x0a,
  Utf8String: 0x0c,
  Bcd: 0x0d,
  Integer: 0x0f,
  Long: 0x10,
  Unsigned: 0x11,
  LongUnsigned: 0x12,
  CompactArray: 0x13,
  Long64: 0x14,
  Long64Unsigned: 0x15,
  Enum: 0x16,
  Float32: 0x17,
  Float64: 0x18,
  DateTime: 0x19,
  Date: 0x1a,
  Time: 0x1b,
} as const;

export type DataTypeName = keyof typeof DataType;

const TYPE_NAME = new Map<number, DataTypeName>(
  Object.entries(DataType).map(([name, tag]) => [tag, name as DataTypeName]),
);

export interface AxdrNode {
  readonly type: DataTypeName | "Unknown";
  readonly tag: number;
  readonly span: Span;
  /** Decoded JS value: number | bigint | boolean | string | null | AxdrNode[]. */
  readonly value: AxdrValue;
  /** Present for octet-string / bit-string: the raw bytes as hex. */
  readonly hex?: string;
  /** Children for array / structure. */
  readonly items?: AxdrNode[];
}

export type AxdrValue =
  | number
  | bigint
  | boolean
  | string
  | null
  | AxdrNode[];

/** A-XDR length: short form (<0x80) or long form (0x8n + n length bytes). */
export function readAxdrLength(r: ByteReader): number {
  const first = r.u8();
  if (first < 0x80) return first;
  const numBytes = first & 0x7f;
  if (numBytes === 0 || numBytes > 4) {
    throw new ByteParseError(`unsupported A-XDR length form 0x${first.toString(16)}`, r.offset);
  }
  let len = 0;
  for (let i = 0; i < numBytes; i++) len = (len << 8) | r.u8();
  return len >>> 0;
}

/** Decode a COSEM date-time (12 bytes) into an ISO-ish string. */
function decodeDateTime(bytes: Uint8Array): string {
  if (bytes.length !== 12) return bytesToHex(bytes);
  const year = (bytes[0]! << 8) | bytes[1]!;
  const [, , month, day, , hour, minute, second] = bytes;
  const notSpecified = (v: number, wildcard = 0xff) => (v === wildcard ? "--" : String(v).padStart(2, "0"));
  const yr = year === 0xffff ? "----" : String(year).padStart(4, "0");
  const dev = (bytes[9]! << 8) | bytes[10]!;
  const tz = dev === 0x8000 ? "" : formatDeviation(dev);
  return `${yr}-${notSpecified(month!)}-${notSpecified(day!)} ${notSpecified(hour!)}:${notSpecified(minute!)}:${notSpecified(second!)}${tz}`;
}

function formatDeviation(dev: number): string {
  // 16-bit signed minutes from UTC.
  const minutes = dev >= 0x8000 ? dev - 0x10000 : dev;
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  return ` UTC${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/**
 * Decode one A-XDR data value at the reader's cursor.
 *
 * `depth` guards against a hostile/corrupt frame with pathological nesting.
 */
export function decodeAxdr(r: ByteReader, depth = 0): AxdrNode {
  if (depth > 32) {
    throw new ByteParseError("A-XDR nesting too deep", r.offset);
  }
  const mark = r.span();
  const tag = r.u8();

  switch (tag) {
    case DataType.NullData:
      return { type: "NullData", tag, value: null, span: mark.end() };

    case DataType.Boolean:
      return { type: "Boolean", tag, value: r.u8() !== 0, span: mark.end() };

    case DataType.Integer:
      return { type: "Integer", tag, value: r.i8(), span: mark.end() };
    case DataType.Unsigned:
      return { type: "Unsigned", tag, value: r.u8(), span: mark.end() };
    case DataType.Enum:
      return { type: "Enum", tag, value: r.u8(), span: mark.end() };
    case DataType.Long:
      return { type: "Long", tag, value: r.i16(), span: mark.end() };
    case DataType.LongUnsigned:
      return { type: "LongUnsigned", tag, value: r.u16(), span: mark.end() };
    case DataType.DoubleLong:
      return { type: "DoubleLong", tag, value: r.i32(), span: mark.end() };
    case DataType.DoubleLongUnsigned:
      return { type: "DoubleLongUnsigned", tag, value: r.u32(), span: mark.end() };
    case DataType.Long64:
      return { type: "Long64", tag, value: r.i64(), span: mark.end() };
    case DataType.Long64Unsigned:
      return { type: "Long64Unsigned", tag, value: r.u64(), span: mark.end() };
    case DataType.Float32:
      return { type: "Float32", tag, value: r.f32(), span: mark.end() };
    case DataType.Float64:
      return { type: "Float64", tag, value: r.f64(), span: mark.end() };

    case DataType.OctetString: {
      const len = readAxdrLength(r);
      const raw = r.bytes(len);
      return { type: "OctetString", tag, value: bytesToHex(raw), hex: bytesToHex(raw), span: mark.end() };
    }
    case DataType.VisibleString:
    case DataType.Utf8String: {
      const len = readAxdrLength(r);
      const raw = r.bytes(len);
      return {
        type: tag === DataType.VisibleString ? "VisibleString" : "Utf8String",
        tag,
        value: new TextDecoder(tag === DataType.Utf8String ? "utf-8" : "latin1").decode(raw),
        hex: bytesToHex(raw),
        span: mark.end(),
      };
    }
    case DataType.BitString: {
      // Length is a bit count; round up to whole bytes.
      const bits = readAxdrLength(r);
      const raw = r.bytes(Math.ceil(bits / 8));
      let str = "";
      for (const b of raw) str += b.toString(2).padStart(8, "0");
      return { type: "BitString", tag, value: str.slice(0, bits), hex: bytesToHex(raw), span: mark.end() };
    }
    case DataType.Bcd: {
      return { type: "Bcd", tag, value: r.u8(), span: mark.end() };
    }

    case DataType.DateTime: {
      const raw = r.bytes(12);
      return { type: "DateTime", tag, value: decodeDateTime(raw), hex: bytesToHex(raw), span: mark.end() };
    }
    case DataType.Date: {
      const raw = r.bytes(5);
      return { type: "Date", tag, value: bytesToHex(raw), hex: bytesToHex(raw), span: mark.end() };
    }
    case DataType.Time: {
      const raw = r.bytes(4);
      return { type: "Time", tag, value: bytesToHex(raw), hex: bytesToHex(raw), span: mark.end() };
    }

    case DataType.Array:
    case DataType.Structure:
    case DataType.CompactArray: {
      const count = readAxdrLength(r);
      const items: AxdrNode[] = [];
      for (let i = 0; i < count; i++) items.push(decodeAxdr(r, depth + 1));
      return { type: TYPE_NAME.get(tag)!, tag, value: items, items, span: mark.end() };
    }

    default:
      throw new ByteParseError(`unsupported A-XDR data type 0x${tag.toString(16).padStart(2, "0")}`, mark.end().offset);
  }
}

/** Flatten an A-XDR node to a compact primitive for display/JSON. */
export function axdrToPrimitive(node: AxdrNode): unknown {
  if (node.items) return node.items.map(axdrToPrimitive);
  if (typeof node.value === "bigint") return node.value.toString();
  return node.value;
}
