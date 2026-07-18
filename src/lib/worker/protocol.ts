/**
 * The typed contract between the UI thread and the simulation Web Worker.
 *
 * Keeping this in its own module (imported by both sides) means the compiler
 * enforces that every message the worker sends is a message the client knows how
 * to handle, and vice versa — no `any` at the thread boundary.
 */

import type { ChaosCommand, Reading, SimConfig, SimEvent, Snapshot } from "../engine";

/** Messages the UI thread sends into the worker. */
export type WorkerCommand =
  | { readonly type: "init"; readonly config: SimConfig }
  | { readonly type: "start"; readonly ticksPerSecond: number }
  | { readonly type: "pause" }
  | { readonly type: "step" }
  | { readonly type: "setSpeed"; readonly ticksPerSecond: number }
  | { readonly type: "chaos"; readonly command: ChaosCommand }
  | { readonly type: "reseed"; readonly config: SimConfig }
  | { readonly type: "dispose" };

/** Messages the worker emits back to the UI thread. */
export type WorkerMessage =
  | { readonly type: "ready" }
  | { readonly type: "started" }
  | { readonly type: "paused" }
  | {
      readonly type: "tick";
      readonly snapshot: Snapshot;
      readonly readings: Reading[];
      readonly events: SimEvent[];
    }
  | { readonly type: "error"; readonly message: string };

export const MAX_READINGS_PER_MESSAGE = 64;
