/**
 * UI-facing simulation store. The worker owns the authoritative SimState; this
 * store holds the derived, render-ready projection (latest snapshot + rolling
 * buffers of readings and events) that React components subscribe to.
 */

import { create } from "zustand";
import type { Reading, SimEvent, SlaMetrics, Snapshot } from "@/lib/engine";

const MAX_READINGS = 160;
const MAX_EVENTS = 120;

export interface SimStore {
  connected: boolean;
  running: boolean;
  ticksPerSecond: number;

  seed: number;
  meterCount: number;
  collectorCount: number;

  snapshot: Snapshot | null;
  sla: SlaMetrics | null;
  readings: Reading[];
  events: SimEvent[];

  selectedNodeId: string | null;
  /** Frame the DLMS inspector is currently focused on (hex). */
  pinnedFrameHex: string | null;

  // --- mutations (called by the controller / UI) ---
  ingestTick: (snapshot: Snapshot, readings: Reading[], events: SimEvent[]) => void;
  setConnected: (v: boolean) => void;
  setRunning: (v: boolean) => void;
  setTicksPerSecond: (v: number) => void;
  setConfig: (cfg: { seed?: number; meterCount?: number; collectorCount?: number }) => void;
  selectNode: (id: string | null) => void;
  pinFrame: (hex: string | null) => void;
  reset: () => void;
}

export const useSimStore = create<SimStore>((set) => ({
  connected: false,
  running: false,
  ticksPerSecond: 2,

  seed: 1337,
  meterCount: 48,
  collectorCount: 4,

  snapshot: null,
  sla: null,
  readings: [],
  events: [],

  selectedNodeId: null,
  pinnedFrameHex: null,

  ingestTick: (snapshot, readings, events) =>
    set((s) => ({
      snapshot,
      sla: snapshot.sla,
      readings: readings.length ? [...readings.slice().reverse(), ...s.readings].slice(0, MAX_READINGS) : s.readings,
      events: events.length ? [...events.slice().reverse(), ...s.events].slice(0, MAX_EVENTS) : s.events,
    })),

  setConnected: (connected) => set({ connected }),
  setRunning: (running) => set({ running }),
  setTicksPerSecond: (ticksPerSecond) => set({ ticksPerSecond }),
  setConfig: (cfg) => set((s) => ({ ...s, ...cfg })),
  selectNode: (selectedNodeId) => set({ selectedNodeId }),
  pinFrame: (pinnedFrameHex) => set({ pinnedFrameHex }),
  reset: () => set({ snapshot: null, sla: null, readings: [], events: [], selectedNodeId: null, pinnedFrameHex: null }),
}));
