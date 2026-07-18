import { describe, expect, it } from "vitest";
import {
  ByteReader,
  bytesToHex,
  crc16X25,
  decodeAxdr,
  describeObis,
  hexToBytes,
  isKnownObis,
  parseFrame,
  toObisCode,
} from "./index";
import {
  encCapture,
  encDateTime,
  encScalerUnit,
  encU16,
  encU32,
  frameDataNotification,
} from "./encoder";
import { SAMPLE_FRAMES } from "./samples";

describe("byte utilities", () => {
  it("parses hex with assorted separators", () => {
    expect(Array.from(hexToBytes("7E A0:21-0x03"))).toEqual([0x7e, 0xa0, 0x21, 0x03]);
  });

  it("rejects odd-length and non-hex input", () => {
    expect(() => hexToBytes("7E A")).toThrow();
    expect(() => hexToBytes("ZZ")).toThrow();
  });

  it("round-trips bytes to hex", () => {
    expect(bytesToHex([0x00, 0xff, 0x10])).toBe("00 FF 10");
  });

  it("reads signed and unsigned integers correctly", () => {
    const r = new ByteReader(hexToBytes("FF 80 00 FF FF FF"));
    expect(r.i8()).toBe(-1);
    expect(r.i16()).toBe(-32768 + 0); // 0x80 0x00 = -32768
  });
});

describe("CRC-16/X.25", () => {
  it("matches the known check value for '123456789'", () => {
    // The canonical CRC-16/X.25 check for the ASCII string "123456789" is 0x906E.
    const data = new TextEncoder().encode("123456789");
    expect(crc16X25(data)).toBe(0x906e);
  });
});

describe("A-XDR decoding", () => {
  it("decodes a double-long-unsigned", () => {
    const node = decodeAxdr(new ByteReader(encU32(1234567)));
    expect(node.type).toBe("DoubleLongUnsigned");
    expect(node.value).toBe(1234567);
  });

  it("decodes a nested structure", () => {
    const node = decodeAxdr(new ByteReader(encScalerUnit(-1, 35)));
    expect(node.type).toBe("Structure");
    expect(node.items).toHaveLength(2);
    expect(node.items?.[0]?.value).toBe(-1);
    expect(node.items?.[1]?.value).toBe(35);
  });

  it("decodes a COSEM date-time to a readable string", () => {
    const node = decodeAxdr(new ByteReader(new Uint8Array([0x19, ...encDateTime({ year: 2026, month: 7, day: 17, hour: 14, minute: 5, second: 30 })])));
    expect(node.type).toBe("DateTime");
    expect(node.value).toContain("2026-07-17 14:05:30");
  });

  it("throws on an unsupported data tag", () => {
    expect(() => decodeAxdr(new ByteReader(new Uint8Array([0x7f])))).toThrow();
  });
});

describe("OBIS catalogue", () => {
  it("builds a canonical id and reduced form", () => {
    const code = toObisCode([1, 0, 1, 8, 0, 255]);
    expect(code.id).toBe("1.0.1.8.0.255");
    expect(code.reduced).toBe("1-0:1.8.0*255");
  });

  it("describes a known register", () => {
    expect(describeObis("1.0.1.8.0.255").label).toMatch(/Active energy import/i);
    expect(isKnownObis("1.0.1.8.0.255")).toBe(true);
    expect(isKnownObis("9.9.9.9.9.9")).toBe(false);
  });
});

describe("full frame parsing", () => {
  it("parses every valid sample frame with good CRCs", () => {
    for (const sample of SAMPLE_FRAMES) {
      const parsed = parseFrame(sample.hex);
      if (sample.id === "corrupt") {
        expect(parsed.ok).toBe(false);
        expect(parsed.errors.join(" ")).toMatch(/FCS/i);
      } else {
        expect(parsed.hdlc.fcs.ok, `${sample.id} FCS`).toBe(true);
        if (parsed.hdlc.hcs) expect(parsed.hdlc.hcs.ok, `${sample.id} HCS`).toBe(true);
      }
    }
  });

  it("extracts the energy reading from the energy push", () => {
    const energy = SAMPLE_FRAMES.find((s) => s.id === "energy")!;
    const parsed = parseFrame(energy.hex);
    expect(parsed.apdu?.name).toBe("DataNotification");
    expect(parsed.readings).toHaveLength(1);
    expect(parsed.readings[0]?.obis).toBe("1.0.1.8.0.255");
    expect(parsed.readings[0]?.value).toBe(1234567);
    expect(parsed.readings[0]?.unit).toBe("Wh");
  });

  it("extracts all four registers from the multi-register push", () => {
    const multi = SAMPLE_FRAMES.find((s) => s.id === "multi")!;
    const parsed = parseFrame(multi.hex);
    expect(parsed.readings.map((r) => r.obis)).toEqual([
      "1.0.1.8.0.255",
      "1.0.32.7.0.255",
      "1.0.31.7.0.255",
      "1.0.1.7.0.255",
    ]);
    // Voltage encoded as 2301 with scaler -1 → 230.1 V.
    const voltage = parsed.readings.find((r) => r.obis === "1.0.32.7.0.255");
    expect(voltage?.value).toBeCloseTo(230.1, 5);
    expect(voltage?.unit).toBe("V");
  });

  it("produces a sorted, non-empty field map for the inspector", () => {
    const parsed = parseFrame(SAMPLE_FRAMES[0]!.hex);
    expect(parsed.fields.length).toBeGreaterThan(4);
    const offsets = parsed.fields.map((f) => f.span.offset);
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
  });
});

describe("encoder ↔ parser round-trip", () => {
  it("survives a range of register values", () => {
    for (const value of [0, 1, 255, 65535, 1_000_000, 4_294_967_295]) {
      const frame = frameDataNotification({
        invokeId: 7,
        meterId: "MTR-RT",
        captures: [encCapture("1.0.1.8.0.255", encU32(value), encScalerUnit(0, 30))],
      });
      const parsed = parseFrame(frame);
      expect(parsed.ok).toBe(true);
      expect(parsed.readings[0]?.value).toBe(value);
    }
  });

  it("keeps the meter id and invoke id intact", () => {
    const frame = frameDataNotification({
      invokeId: 0x0abcde,
      meterId: "MTR-ROUNDTRIP",
      captures: [encCapture("1.0.32.7.0.255", encU16(2300), encScalerUnit(-1, 35))],
    });
    const parsed = parseFrame(frame);
    expect(parsed.apdu?.invokeId).toBe(0x0abcde);
  });
});

describe("robustness", () => {
  it("throws a helpful error on a truncated frame", () => {
    expect(() => parseFrame("7E A0")).toThrow();
  });

  it("rejects a frame without an opening flag", () => {
    expect(() => parseFrame("00 A0 21")).toThrow(/opening flag/i);
  });
});
