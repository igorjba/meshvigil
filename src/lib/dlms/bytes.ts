/**
 * Low-level byte helpers for the DLMS/COSEM codec.
 *
 * Everything here is deliberately dependency-free and side-effect-free so the
 * same code runs in the browser, in a Web Worker, in Node (Vitest) and on the
 * edge without polyfills.
 */

/** A contiguous region of the source buffer, used to link bytes to fields. */
export interface Span {
  /** Byte offset from the start of the decoded buffer. */
  readonly offset: number;
  /** Length in bytes. */
  readonly length: number;
}

export class ByteParseError extends Error {
  constructor(
    message: string,
    readonly offset: number,
  ) {
    super(`${message} (at byte ${offset})`);
    this.name = "ByteParseError";
  }
}

/** Parse a hex string ("7E A0 21" / "7ea021" / "0x7e...") into bytes. */
export function hexToBytes(input: string): Uint8Array {
  const cleaned = input.replace(/0x/gi, "").replace(/[\s:,-]/g, "");
  if (cleaned.length % 2 !== 0) {
    throw new ByteParseError("hex string has an odd number of nibbles", 0);
  }
  if (!/^[0-9a-fA-F]*$/.test(cleaned)) {
    throw new ByteParseError("hex string contains non-hex characters", 0);
  }
  const out = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array | number[], separator = " "): string {
  const arr = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  let out = "";
  for (let i = 0; i < arr.length; i++) {
    out += arr[i]!.toString(16).padStart(2, "0").toUpperCase();
    if (separator && i < arr.length - 1) out += separator;
  }
  return out;
}

/**
 * Forward-only cursor over a Uint8Array. Every read advances the cursor and is
 * bounds-checked, so a truncated frame fails loudly instead of reading garbage.
 */
export class ByteReader {
  private pos = 0;

  constructor(
    private readonly buf: Uint8Array,
    private readonly base = 0,
  ) {}

  /** Absolute offset (including the base) of the cursor. */
  get offset(): number {
    return this.base + this.pos;
  }

  get remaining(): number {
    return this.buf.length - this.pos;
  }

  get done(): boolean {
    return this.pos >= this.buf.length;
  }

  private ensure(n: number): void {
    if (this.pos + n > this.buf.length) {
      throw new ByteParseError(
        `unexpected end of data: need ${n} byte(s), ${this.remaining} left`,
        this.offset,
      );
    }
  }

  peek(): number {
    this.ensure(1);
    return this.buf[this.pos]!;
  }

  u8(): number {
    this.ensure(1);
    return this.buf[this.pos++]!;
  }

  i8(): number {
    return (this.u8() << 24) >> 24;
  }

  u16(): number {
    return (this.u8() << 8) | this.u8();
  }

  i16(): number {
    return (this.u16() << 16) >> 16;
  }

  u32(): number {
    // `>>> 0` keeps the result in the unsigned 32-bit range.
    return ((this.u16() << 16) | this.u16()) >>> 0;
  }

  i32(): number {
    return (this.u16() << 16) | this.u16();
  }

  u64(): bigint {
    let v = 0n;
    for (let i = 0; i < 8; i++) v = (v << 8n) | BigInt(this.u8());
    return v;
  }

  i64(): bigint {
    const v = this.u64();
    return v >= 1n << 63n ? v - (1n << 64n) : v;
  }

  f32(): number {
    this.ensure(4);
    const view = new DataView(this.buf.buffer, this.buf.byteOffset + this.pos, 4);
    this.pos += 4;
    return view.getFloat32(0, false);
  }

  f64(): number {
    this.ensure(8);
    const view = new DataView(this.buf.buffer, this.buf.byteOffset + this.pos, 8);
    this.pos += 8;
    return view.getFloat64(0, false);
  }

  bytes(n: number): Uint8Array {
    this.ensure(n);
    const slice = this.buf.subarray(this.pos, this.pos + n);
    this.pos += n;
    return slice;
  }

  /** Mark the current offset and return a span once `end()` is called. */
  span(): { end: () => Span } {
    const start = this.offset;
    return { end: () => ({ offset: start, length: this.offset - start }) };
  }
}

/**
 * CRC-16/X.25 (a.k.a. FCS-16), used by the HDLC layer of IEC 62056-46.
 * poly=0x1021 reflected, init=0xFFFF, xorout=0xFFFF, refin/refout=true.
 */
export function crc16X25(data: Uint8Array): number {
  let crc = 0xffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0x8408 : crc >>> 1;
    }
  }
  return (~crc & 0xffff) >>> 0;
}

/** Encode a 16-bit value little-endian, as HDLC stores the FCS/HCS. */
export function u16le(value: number): [number, number] {
  return [value & 0xff, (value >>> 8) & 0xff];
}

/** Growable byte buffer for the encoder side of the codec. */
export class ByteWriter {
  private chunks: number[] = [];

  get length(): number {
    return this.chunks.length;
  }

  u8(v: number): this {
    this.chunks.push(v & 0xff);
    return this;
  }

  u16(v: number): this {
    return this.u8(v >>> 8).u8(v);
  }

  u32(v: number): this {
    return this.u8(v >>> 24).u8(v >>> 16).u8(v >>> 8).u8(v);
  }

  push(...bytes: number[]): this {
    for (const b of bytes) this.chunks.push(b & 0xff);
    return this;
  }

  concat(bytes: Uint8Array | number[]): this {
    for (const b of bytes) this.chunks.push(b & 0xff);
    return this;
  }

  toBytes(): Uint8Array {
    return Uint8Array.from(this.chunks);
  }
}
