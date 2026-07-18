/**
 * DLMS unit enumeration (IEC 62056-6-2 `unit`). Single source of truth for both
 * directions of the codec: the encoder names a unit, the decoder resolves a code
 * back to its symbol. Add a unit here and both sides pick it up.
 */

export const DlmsUnit = {
  W: 27,
  VA: 28,
  var: 29,
  Wh: 30,
  VAh: 31,
  varh: 32,
  A: 33,
  V: 35,
  Hz: 44,
  none: 255,
} as const;

export type DlmsUnitName = keyof typeof DlmsUnit;

/** code → display symbol (empty for the dimensionless `none`). */
export const UNIT_SYMBOL: Record<number, string> = Object.fromEntries(
  Object.entries(DlmsUnit).map(([name, code]) => [code, name === "none" ? "" : name]),
);
