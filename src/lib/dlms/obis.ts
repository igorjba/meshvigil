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
  0: "Abstrato",
  1: "Eletricidade",
  4: "Rateio de calor",
  5: "Refrigeracao",
  6: "Calor",
  7: "Gas",
  8: "Agua (fria)",
  9: "Agua (quente)",
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
  "1.0.1.8.0.255": { label: "Energia ativa importada (+A), total", unit: "kWh", kind: "energy" },
  "1.0.2.8.0.255": { label: "Energia ativa exportada (-A), total", unit: "kWh", kind: "energy" },
  "1.0.3.8.0.255": { label: "Energia reativa importada (+R), total", unit: "kvarh", kind: "energy" },
  "1.0.1.8.1.255": { label: "Energia ativa importada, tarifa 1", unit: "kWh", kind: "energy" },
  "1.0.1.8.2.255": { label: "Energia ativa importada, tarifa 2", unit: "kWh", kind: "energy" },
  "1.0.1.7.0.255": { label: "Potencia ativa instantanea (+P)", unit: "W", kind: "power" },
  "1.0.2.7.0.255": { label: "Potencia ativa instantanea (-P)", unit: "W", kind: "power" },
  "1.0.32.7.0.255": { label: "Tensao instantanea, L1", unit: "V", kind: "voltage" },
  "1.0.52.7.0.255": { label: "Tensao instantanea, L2", unit: "V", kind: "voltage" },
  "1.0.72.7.0.255": { label: "Tensao instantanea, L3", unit: "V", kind: "voltage" },
  "1.0.31.7.0.255": { label: "Corrente instantanea, L1", unit: "A", kind: "current" },
  "1.0.51.7.0.255": { label: "Corrente instantanea, L2", unit: "A", kind: "current" },
  "1.0.71.7.0.255": { label: "Corrente instantanea, L3", unit: "A", kind: "current" },
  "1.0.14.7.0.255": { label: "Frequencia", unit: "Hz", kind: "quality" },
  "1.0.13.7.0.255": { label: "Fator de potencia instantaneo", kind: "quality" },
  "0.0.1.0.0.255": { label: "Relogio", kind: "clock" },
  "0.0.96.1.0.255": { label: "ID do dispositivo 1 (numero de serie)", kind: "identity" },
  "0.0.96.1.1.255": { label: "ID do dispositivo 2 (identificador do equipamento)", kind: "identity" },
  "0.0.42.0.0.255": { label: "Nome logico do dispositivo COSEM", kind: "identity" },
  "0.0.96.3.10.255": { label: "Controle de corte — estado da saida", kind: "other" },
  "0.0.96.7.0.255": { label: "Numero de quedas de energia", kind: "quality" },
  // Faixa abstrata/vendor usada aqui para telemetria do enlace exposta via COSEM.
  "0.0.96.240.0.255": { label: "Forca do sinal de radio recebido (RSSI)", unit: "dBm", kind: "quality" },
  "0.0.96.240.1.255": { label: "Saltos na malha ate a central", unit: "saltos", kind: "quality" },
};

export function describeObis(code: ObisCode | string): ObisDefinition {
  const id = typeof code === "string" ? code : code.id;
  const known = CATALOG[id];
  if (known) return { id, ...known };
  return { id, label: `Registrador desconhecido ${id}`, kind: "other" };
}

export function isKnownObis(id: string): boolean {
  return id in CATALOG;
}

/** Public, immutable view of the catalogue for docs / the reference panel. */
export function listKnownObis(): ObisDefinition[] {
  return Object.entries(CATALOG).map(([id, def]) => ({ id, ...def }));
}
