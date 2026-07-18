/**
 * Synthetic telemetry generation. Every reading a meter emits is serialised into
 * a genuine DLMS/COSEM DataNotification frame via the codec, so the bytes shown
 * in the inspector are the same bytes the "meter" produced — no mock data path.
 */

import {
  bytesToHex,
  DlmsUnit,
  encCapture,
  encDateTime,
  encI16,
  encScalerUnit,
  encU16,
  encU32,
  frameDataNotification,
} from "../dlms";
import type { Rng } from "./rng";
import type { MeshNode, MeterAccount, Reading, SimState } from "./types";


/** A smooth diurnal load factor in [0.4, 1.3] driven by the tick clock. */
function diurnalFactor(tick: number, readIntervalTicks: number): number {
  const ticksPerDay = readIntervalTicks * 96; // 96 read slots per simulated day
  const phase = (2 * Math.PI * (tick % ticksPerDay)) / ticksPerDay;
  // Two humps (morning + evening) with a daytime plateau.
  return 0.85 + 0.3 * Math.sin(phase - Math.PI / 2) + 0.15 * Math.sin(2 * phase);
}

export interface TelemetrySample {
  readonly reading: Reading;
}

interface ReadingScalars {
  readonly energyWh: number;
  readonly powerW: number;
  readonly voltageV: number;
  readonly currentA: number;
  readonly rssi: number;
  readonly hopCount: number;
}

/** Produce one reading for a meter, advancing its accumulating energy register. */
export function sampleMeter(state: SimState, node: MeshNode, account: MeterAccount, rng: Rng): Reading {
  const degraded = node.status === "degraded" || state.rf.noiseFloor > -90;
  const load = account.baseLoadW * diurnalFactor(state.tick, state.config.readIntervalTicks);
  const powerW = Math.max(0, Math.round(load + rng.jitter(load * 0.12)));

  const tickHours = state.config.tickMs / 3_600_000;
  account.energyWh += powerW * tickHours * state.config.readIntervalTicks;
  account.lastReadTick = state.tick;

  const voltageV = 230 + rng.jitter(degraded ? 8 : 3);
  const scalars: ReadingScalars = {
    energyWh: Math.round(account.energyWh),
    powerW,
    voltageV: Number(voltageV.toFixed(1)),
    currentA: Number((powerW / Math.max(voltageV, 1)).toFixed(2)),
    rssi: Math.round(node.rssi + rng.jitter(2)),
    hopCount: Number.isFinite(node.hopCount) ? node.hopCount : 0,
  };

  return {
    meterId: node.id,
    tick: state.tick,
    ...scalars,
    frameHex: bytesToHex(encodeReadingFrame(state, node, scalars)),
  };
}

/** Serialise a reading into a real DLMS DataNotification frame. */
function encodeReadingFrame(state: SimState, node: MeshNode, s: ReadingScalars): Uint8Array {
  const now = new Date(Date.UTC(2026, 0, 1) + state.tick * state.config.tickMs);
  const timestamp = encDateTime({
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    day: now.getUTCDate(),
    hour: now.getUTCHours(),
    minute: now.getUTCMinutes(),
    second: now.getUTCSeconds(),
  });

  const captures = [
    encCapture("1.0.1.8.0.255", encU32(s.energyWh), encScalerUnit(0, DlmsUnit.Wh)),
    encCapture("1.0.1.7.0.255", encU32(s.powerW), encScalerUnit(0, DlmsUnit.W)),
    encCapture("1.0.32.7.0.255", encU16(Math.round(s.voltageV * 10)), encScalerUnit(-1, DlmsUnit.V)),
    encCapture("1.0.31.7.0.255", encU16(Math.round(s.currentA * 100)), encScalerUnit(-2, DlmsUnit.A)),
    encCapture("0.0.96.240.0.255", encI16(s.rssi)),
    encCapture("0.0.96.240.1.255", encU16(s.hopCount)),
  ];

  return frameDataNotification({ invokeId: state.tick & 0xffffff, meterId: node.id, timestamp, captures, serverAddress: 17 });
}
