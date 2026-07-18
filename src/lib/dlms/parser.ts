/**
 * Top-level DLMS/COSEM decode: raw bytes → a structured, inspectable frame.
 *
 * This is the orchestration layer that walks HDLC → LLC → APDU → A-XDR and then
 * lifts the recognisable register readings (OBIS + value + scaler/unit) out of
 * the payload so both humans and the SLA panel can consume them.
 */

import { type AxdrNode, DataType, axdrToPrimitive } from "./axdr";
import { ByteParseError, ByteReader, bytesToHex, hexToBytes, type Span } from "./bytes";
import { type CosemApdu, decodeApdu } from "./cosem";
import { apduFromFrame, decodeHdlc, type HdlcFrame } from "./hdlc";
import { describeObis, toObisCode } from "./obis";
import { UNIT_SYMBOL } from "./units";

export type FieldGroup = "hdlc" | "llc" | "apdu" | "data";

export interface ParsedField {
  readonly name: string;
  readonly span: Span;
  readonly hex: string;
  readonly value?: string;
  readonly description?: string;
  readonly group: FieldGroup;
}

export interface Reading {
  readonly obis: string;
  readonly label: string;
  readonly value: number | string;
  readonly unit?: string;
  readonly kind: string;
}

export interface ParsedFrame {
  /** True when every CRC in the frame checks out. */
  readonly ok: boolean;
  readonly hdlc: HdlcFrame;
  readonly apdu?: CosemApdu;
  readonly readings: Reading[];
  readonly fields: ParsedField[];
  readonly errors: string[];
  readonly totalBytes: number;
}

function scaleValue(raw: number, scaler: number): number {
  const scaled = raw * 10 ** scaler;
  // Avoid float noise like 12345.000000001 from the pow().
  return Number(scaled.toFixed(Math.max(0, -scaler)));
}

/**
 * A COSEM "capture" structure we recognise: { octet-string(OBIS), value, [scaler_unit] }.
 * Returns a Reading when the shape matches, otherwise null.
 */
function readingFromStructure(node: AxdrNode): Reading | null {
  if (node.type !== "Structure" || !node.items || node.items.length < 2) return null;
  const [first, valueNode, third] = node.items;
  if (!first || first.type !== "OctetString" || typeof first.value !== "string") return null;

  const obisBytes = hexToBytes(first.value);
  if (obisBytes.length !== 6) return null;
  const obis = toObisCode(obisBytes);
  const def = describeObis(obis);

  if (valueNode === undefined) return null;
  const primitive = axdrToPrimitive(valueNode);
  if (typeof primitive === "object" && primitive !== null) return null; // not a scalar reading

  let value: number | string = primitive as number | string;
  let unit = def.unit;

  // Optional scaler_unit: Structure { integer scaler, enum unit }.
  if (third && third.type === "Structure" && third.items && third.items.length === 2) {
    const [scalerNode, unitNode] = third.items;
    if (scalerNode && unitNode && typeof scalerNode.value === "number" && typeof value === "number") {
      value = scaleValue(value, scalerNode.value);
      if (typeof unitNode.value === "number") unit = UNIT_SYMBOL[unitNode.value] ?? def.unit;
    }
  }

  return { obis: obis.id, label: def.label, value, kind: def.kind, ...(unit ? { unit } : {}) };
}

/** Recursively harvest every recognisable register reading from a data tree. */
function collectReadings(node: AxdrNode | undefined, out: Reading[]): void {
  if (!node) return;
  const direct = readingFromStructure(node);
  if (direct) {
    out.push(direct);
    return; // a capture structure is a leaf as far as readings go
  }
  if (node.items) for (const child of node.items) collectReadings(child, out);
}

function pushDataFields(node: AxdrNode, fields: ParsedField[], obisHint?: string): void {
  if (node.items) {
    // If this looks like a capture structure, label its OBIS child.
    const reading = readingFromStructure(node);
    for (const child of node.items) {
      pushDataFields(child, fields, reading?.obis);
    }
    return;
  }
  const isObis = obisHint && node.type === "OctetString" && node.hex?.replace(/ /g, "").length === 12;
  fields.push({
    group: "data",
    name: isObis ? `OBIS ${obisHint}` : node.type,
    span: node.span,
    hex: node.hex ?? "",
    value: node.hex ? undefined : String(node.value),
    ...(isObis ? { description: describeObis(obisHint!).label } : {}),
  });
}

function buildFrameFields(frame: HdlcFrame): ParsedField[] {
  const f: ParsedField[] = [];
  const add = (name: string, span: Span, group: FieldGroup, value?: string, description?: string) =>
    f.push({ name, span, group, hex: "", ...(value ? { value } : {}), ...(description ? { description } : {}) });

  add("Format field", { offset: 1, length: 2 }, "hdlc", `len=${frame.format.length}`, frame.format.segmented ? "segmented" : undefined);
  add("Destination address", { offset: 3, length: frame.destination.bytes }, "hdlc", frame.destination.hex, "server / upper");
  add("Source address", { offset: 3 + frame.destination.bytes, length: frame.source.bytes }, "hdlc", frame.source.hex, "client / lower");
  add("Control", { offset: 3 + frame.destination.bytes + frame.source.bytes, length: 1 }, "hdlc", `0x${frame.control.raw.toString(16)}`, frame.control.name);
  if (frame.hcs) add("HCS", frame.hcs.span, "hdlc", frame.hcs.ok ? "valid" : "INVALID", "header check sequence");
  if (frame.llc) add("LLC header", frame.llc.span, "llc", frame.llc.hex, frame.llc.direction);
  add("FCS", frame.fcs.span, "hdlc", frame.fcs.ok ? "valid" : "INVALID", "frame check sequence");
  return f;
}

/** Decode a DLMS/COSEM frame from a hex string or raw bytes. */
export function parseFrame(input: string | Uint8Array): ParsedFrame {
  const bytes = typeof input === "string" ? hexToBytes(input) : input;
  const errors: string[] = [];

  const hdlc = decodeHdlc(bytes);
  if (hdlc.hcs && !hdlc.hcs.ok) errors.push("HCS mismatch — header may be corrupt");
  if (!hdlc.fcs.ok) errors.push("FCS mismatch — frame may be corrupt");

  const fields = buildFrameFields(hdlc);
  const readings: Reading[] = [];
  let apdu: CosemApdu | undefined;

  const apduBytes = apduFromFrame(hdlc);
  if (apduBytes && apduBytes.length > 0) {
    try {
      apdu = decodeApdu(new ByteReader(apduBytes, hdlc.information!.span.offset + (hdlc.llc ? 3 : 0)));
      fields.push({
        group: "apdu",
        name: apdu.name,
        span: { offset: apdu.span.offset, length: 1 },
        hex: `0x${apdu.tag.toString(16).padStart(2, "0")}`,
        ...(apdu.note ? { description: apdu.note } : {}),
      });
      if (apdu.data) {
        collectReadings(apdu.data, readings);
        pushDataFields(apdu.data, fields);
      }
      if (apdu.accessError) errors.push(`data-access-result: ${apdu.accessError}`);
    } catch (err) {
      errors.push(err instanceof ByteParseError ? err.message : `APDU decode failed: ${String(err)}`);
    }
  }

  return {
    ok: errors.length === 0,
    hdlc,
    ...(apdu ? { apdu } : {}),
    readings,
    fields: fields.sort((a, b) => a.span.offset - b.span.offset),
    errors,
    totalBytes: bytes.length,
  };
}

/** Convenience: parse and stringify to a readable JSON-ish object (for tests/UI). */
export function parseToObject(input: string | Uint8Array): Record<string, unknown> {
  const p = parseFrame(input);
  return {
    ok: p.ok,
    frame: {
      dest: p.hdlc.destination.hex,
      src: p.hdlc.source.hex,
      control: p.hdlc.control.name,
      fcs: p.hdlc.fcs.ok ? "valid" : "invalid",
    },
    apdu: p.apdu ? { type: p.apdu.name, invokeId: p.apdu.invokeId } : null,
    readings: p.readings,
    errors: p.errors,
  };
}

export { DataType, bytesToHex, hexToBytes };
