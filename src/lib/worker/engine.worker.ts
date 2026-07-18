/// <reference lib="webworker" />
/**
 * Simulation host. Owns the SimState, advances it on a timer, and streams
 * snapshots back to the UI. It runs on the client, so there is no server process
 * to host and no Vercel function timeout to hit. The engine itself is pure; this
 * file is the only stateful, timer-driven part of the system.
 */

import { createEngine, emptySla, snapshot, tick, type ChaosCommand, type SimConfig, type SimState } from "../engine";
import { MAX_READINGS_PER_MESSAGE, type WorkerCommand, type WorkerMessage } from "./protocol";

const ctx = self as unknown as DedicatedWorkerGlobalScope;

let state: SimState | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let ticksPerSecond = 2;

function post(message: WorkerMessage): void {
  ctx.postMessage(message);
}

function stopTimer(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

function advance(commands: ChaosCommand[] = []): void {
  if (!state) return;
  try {
    const result = tick(state, commands);
    post({
      type: "tick",
      snapshot: snapshot(result.state, result.sla),
      readings: result.readings.slice(0, MAX_READINGS_PER_MESSAGE),
      events: result.events,
    });
  } catch (err) {
    stopTimer();
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
}

function startTimer(): void {
  stopTimer();
  const intervalMs = Math.max(30, Math.round(1000 / ticksPerSecond));
  timer = setInterval(() => advance(), intervalMs);
  post({ type: "started" });
}

function init(config: SimConfig): void {
  stopTimer();
  state = createEngine(config);
  // Emit an initial frame so the UI renders the converged topology immediately.
  post({ type: "tick", snapshot: snapshot(state, emptySla()), readings: [], events: [] });
  post({ type: "ready" });
}

ctx.addEventListener("message", (ev: MessageEvent<WorkerCommand>) => {
  const cmd = ev.data;
  switch (cmd.type) {
    case "init":
      init(cmd.config);
      break;
    case "reseed":
      init(cmd.config);
      break;
    case "start":
      ticksPerSecond = cmd.ticksPerSecond;
      startTimer();
      break;
    case "pause":
      stopTimer();
      post({ type: "paused" });
      break;
    case "step":
      advance();
      break;
    case "setSpeed":
      ticksPerSecond = cmd.ticksPerSecond;
      if (timer !== null) startTimer();
      break;
    case "chaos":
      advance([cmd.command]);
      break;
    case "dispose":
      stopTimer();
      state = null;
      break;
    default:
      post({ type: "error", message: `unknown command` });
  }
});
