/**
 * OBIS (OBject Identification System, IEC 62056-61) codes.
 *
 * An OBIS code is six value groups A-B:C.D.E.F that name what a register in a
 * meter actually represents. This module turns the six raw bytes into a stable
 * string id and, where we know it, a human label + engineering unit.
 */

export interface ObisCode {
  /** The six raw value groups A, B, C, D, E, F. */
  readonly groups: readonly [number, number, number, number, number, number];
  /** Canonical dotted form, e.g. "1.0.1.8.0.255". */
  readonly id: string;
  /** IEC reduced form, e.g. "1-0:1.8.0*255". */
  readonly reduced: string;
}

export interface ObisDefinition {
  readonly id: string;
  readonly label: string;
  readonly unit?: string;
  /** Rough class of value, used by the UI to pick a formatter/icon. */
  readonly kind: "energy" | "power" | "voltage" | "current" | "clock" | "identity" | "quality" | "other";
}

/** Media (value group A) — the physical domain the register belongs to. */
export const OBIS_MEDIA: Record<number, string> = {
  0: "Abstract",
  1: "Electricity",
  4: "Heat cost allocator",
  5: "Cooling",
  6: "Heat",
  7: "Gas",
  8: "Water (cold)",
  9: "Water (hot)",
};

export function toObisCode(groups: Uint8Array | readonly number[]): ObisCode {
  if (groups.length !== 6) {
    throw new Error(`OBIS code needs exactly 6 groups, got ${groups.length}`);
  }
  const g = Array.from(groups) as [number, number, number, number, number, number];
  return {
    groups: g,
    id: g.join("."),
    reduced: `${g[0]}-${g[1]}:${g[2]}.${g[3]}.${g[4]}*${g[5]}`,
  };
}

/**
 * A curated catalogue of the OBIS codes this simulator emits and the most
 * commonly encountered standard registers. Not exhaustive — real meters expose
 * hundreds — but every entry here is a genuine, standard-defined code.
 */
const CATALOG: Record<string, Omit<ObisDefinition, "id">> = {
  "1.0.1.8.0.255": { label: "Active energy import (+A), total", unit: "kWh", kind: "energy" },
  "1.0.2.8.0.255": { label: "Active energy export (-A), total", unit: "kWh", kind: "energy" },
  "1.0.3.8.0.255": { label: "Reactive energy import (+R), total", unit: "kvarh", kind: "energy" },
  "1.0.1.8.1.255": { label: "Active energy import, tariff 1", unit: "kWh", kind: "energy" },
  "1.0.1.8.2.255": { label: "Active energy import, tariff 2", unit: "kWh", kind: "energy" },
  "1.0.1.7.0.255": { label: "Instantaneous active power (+P)", unit: "W", kind: "power" },
  "1.0.2.7.0.255": { label: "Instantaneous active power (-P)", unit: "W", kind: "power" },
  "1.0.32.7.0.255": { label: "Instantaneous voltage, L1", unit: "V", kind: "voltage" },
  "1.0.52.7.0.255": { label: "Instantaneous voltage, L2", unit: "V", kind: "voltage" },
  "1.0.72.7.0.255": { label: "Instantaneous voltage, L3", unit: "V", kind: "voltage" },
  "1.0.31.7.0.255": { label: "Instantaneous current, L1", unit: "A", kind: "current" },
  "1.0.51.7.0.255": { label: "Instantaneous current, L2", unit: "A", kind: "current" },
  "1.0.71.7.0.255": { label: "Instantaneous current, L3", unit: "A", kind: "current" },
  "1.0.14.7.0.255": { label: "Frequency", unit: "Hz", kind: "quality" },
  "1.0.13.7.0.255": { label: "Instantaneous power factor", kind: "quality" },
  "0.0.1.0.0.255": { label: "Clock", kind: "clock" },
  "0.0.96.1.0.255": { label: "Device ID 1 (serial number)", kind: "identity" },
  "0.0.96.1.1.255": { label: "Device ID 2 (equipment identifier)", kind: "identity" },
  "0.0.42.0.0.255": { label: "COSEM logical device name", kind: "identity" },
  "0.0.96.3.10.255": { label: "Disconnect control — output state", kind: "other" },
  "0.0.96.7.0.255": { label: "Number of power failures", kind: "quality" },
  // Vendor/abstract range used here for link telemetry surfaced over COSEM.
  "0.0.96.240.0.255": { label: "RF received signal strength (RSSI)", unit: "dBm", kind: "quality" },
  "0.0.96.240.1.255": { label: "Mesh hop count to head-end", unit: "hops", kind: "quality" },
};

export function describeObis(code: ObisCode | string): ObisDefinition {
  const id = typeof code === "string" ? code : code.id;
  const known = CATALOG[id];
  if (known) return { id, ...known };
  return { id, label: `Unknown register ${id}`, kind: "other" };
}

export function isKnownObis(id: string): boolean {
  return id in CATALOG;
}

/** Public, immutable view of the catalogue for docs / the reference panel. */
export function listKnownObis(): ObisDefinition[] {
  return Object.entries(CATALOG).map(([id, def]) => ({ id, ...def }));
}
