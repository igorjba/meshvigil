import { describe, expect, it } from "vitest";
import { ByteReader, hexToBytes } from "./bytes";
import { decodeAxdr } from "./axdr";
import { decodeApdu } from "./cosem";
import { decodeHdlc } from "./hdlc";
import { frameApdu } from "./encoder";
import { parseFrame } from "./parser";
import { describeObis, listKnownObis, OBIS_MEDIA, toObisCode } from "./obis";

function axdr(bytes: number[]) {
  return decodeAxdr(new ByteReader(Uint8Array.from(bytes)));
}

function apdu(bytes: number[]) {
  return decodeApdu(new ByteReader(Uint8Array.from(bytes)));
}

describe("A-XDR data types", () => {
  it("decodes scalar types across widths and signs", () => {
    expect(axdr([0x03, 0x01]).value).toBe(true); // boolean
    expect(axdr([0x0f, 0xff]).value).toBe(-1); // integer (int8)
    expect(axdr([0x11, 0xff]).value).toBe(255); // unsigned
    expect(axdr([0x10, 0xff, 0xff]).value).toBe(-1); // long (int16)
    expect(axdr([0x12, 0x01, 0x00]).value).toBe(256); // long-unsigned
    expect(axdr([0x16, 0x2a]).value).toBe(42); // enum
    expect(axdr([0x0d, 0x09]).value).toBe(9); // bcd
    expect(axdr([0x05, 0xff, 0xff, 0xff, 0xff]).value).toBe(-1); // double-long
    expect(axdr([0x06, 0x00, 0x00, 0x01, 0x00]).value).toBe(256); // double-long-unsigned
  });

  it("decodes 64-bit and floating types", () => {
    expect(axdr([0x15, 0, 0, 0, 0, 0, 0, 0, 1]).value).toBe(1n); // long64-unsigned
    expect(axdr([0x14, 255, 255, 255, 255, 255, 255, 255, 255]).value).toBe(-1n); // long64
    expect(axdr([0x17, 0x42, 0x28, 0x00, 0x00]).value).toBeCloseTo(42, 3); // float32
    expect(axdr([0x18, 0x40, 0x45, 0, 0, 0, 0, 0, 0]).value).toBeCloseTo(42, 3); // float64
  });

  it("decodes strings, bit-strings, dates and times", () => {
    expect(axdr([0x0a, 0x02, 0x41, 0x42]).value).toBe("AB"); // visible-string
    expect(axdr([0x0c, 0x02, 0x41, 0x42]).value).toBe("AB"); // utf8-string
    expect(axdr([0x04, 0x04, 0xa0]).value).toBe("1010"); // bit-string, 4 bits
    expect(axdr([0x1a, 0x07, 0xe4, 0x01, 0x01, 0xff, 0xff]).type).toBe("Date");
    expect(axdr([0x1b, 0x0c, 0x1e, 0x00, 0x00]).type).toBe("Time");
  });

  it("decodes nested arrays and rejects unknown tags", () => {
    const arr = axdr([0x01, 0x02, 0x11, 0x01, 0x11, 0x02]); // array of 2 unsigned
    expect(arr.items).toHaveLength(2);
    expect(() => axdr([0x77])).toThrow();
  });
});

describe("COSEM APDUs", () => {
  it("decodes a GET-Response carrying a data-access-result error", () => {
    const a = apdu([0xc4, 0x01, 0x81, 0x01, 0x02]);
    expect(a.name).toBe("GetResponse");
    expect(a.accessError).toBe("temporary-failure");
  });

  it("notes a GET-Response with a datablock instead of decoding it", () => {
    const a = apdu([0xc4, 0x02, 0x81]);
    expect(a.note).toMatch(/block/i);
  });

  it("decodes a DataNotification without a timestamp", () => {
    const a = apdu([0x0f, 0x00, 0x00, 0x00, 0x01, 0x00, 0x11, 0x2a]);
    expect(a.name).toBe("DataNotification");
    expect(a.timestampHex).toBeUndefined();
    expect(a.data?.value).toBe(42);
  });

  it("identifies association and exception APDUs", () => {
    expect(apdu([0x60, 0x1d, 0xa1]).note).toMatch(/ACSE/);
    expect(apdu([0x61, 0x29]).note).toMatch(/ACSE/);
    expect(apdu([0xd8, 0x01, 0x02]).note).toMatch(/service-error/);
    expect(apdu([0xc2, 0x00]).name).toBe("EventNotificationRequest");
    expect(apdu([0x99, 0x00]).name).toMatch(/Unknown/);
  });
});

describe("HDLC control frames", () => {
  const control = (byte: number) => decodeHdlc(frameApdu(Uint8Array.from([0x11, 0x2a]), { control: byte })).control;

  it("classifies I, S and U frames", () => {
    expect(control(0x10).type).toBe("I");
    expect(control(0x11).name).toMatch(/receive ready/i); // RR
    expect(control(0x93).name).toMatch(/SNRM/);
    expect(control(0x73).name).toMatch(/UA/);
    expect(control(0x53).name).toMatch(/DISC/);
  });

  it("flags a corrupt FCS without throwing", () => {
    const good = frameApdu(Uint8Array.from([0x11, 0x2a]));
    const bad = good.slice();
    const i = bad.length - 3; // a byte just before the closing flag/FCS
    bad[i] = (bad[i] ?? 0) ^ 0xff;
    const parsed = parseFrame(bad);
    expect(parsed.hdlc.fcs.ok).toBe(false);
    expect(parsed.ok).toBe(false);
  });
});

describe("OBIS catalogue", () => {
  it("exposes media, reduced form and a non-empty catalogue", () => {
    expect(OBIS_MEDIA[1]).toBe("Eletricidade");
    expect(toObisCode(hexToBytes("0100010800FF")).id).toBe("1.0.1.8.0.255");
    expect(listKnownObis().length).toBeGreaterThan(10);
    expect(describeObis("9.9.9.9.9.9").label).toMatch(/desconhecido/i);
    expect(() => toObisCode([1, 2, 3])).toThrow();
  });
});
