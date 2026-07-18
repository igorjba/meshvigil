/**
 * Bridge between the simulation worker and the Zustand store. One controller
 * owns one Worker; it translates store intent into WorkerCommands and worker
 * messages into store updates. Kept out of React so the worker survives
 * re-renders and Fast Refresh.
 */

import { createConfig, type ChaosCommand, type SimConfig } from "@/lib/engine";
import { useSimStore } from "@/store/simStore";
import type { WorkerCommand, WorkerMessage } from "./protocol";

export class SimulationController {
  private worker: Worker | null = null;
  private config: SimConfig;

  constructor() {
    const { seed, meterCount, collectorCount } = useSimStore.getState();
    this.config = createConfig({ seed, meterCount, collectorCount });
  }

  private send(cmd: WorkerCommand): void {
    this.worker?.postMessage(cmd);
  }

  start(): void {
    if (this.worker) return;
    this.worker = new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module" });
    this.worker.addEventListener("message", this.onMessage);
    this.worker.addEventListener("error", this.onError);
    this.send({ type: "init", config: this.config });
  }

  private onMessage = (ev: MessageEvent<WorkerMessage>): void => {
    const store = useSimStore.getState();
    const msg = ev.data;
    switch (msg.type) {
      case "ready":
        store.setConnected(true);
        break;
      case "started":
        store.setRunning(true);
        break;
      case "paused":
        store.setRunning(false);
        break;
      case "tick":
        store.ingestTick(msg.snapshot, msg.readings, msg.events);
        break;
      case "error":
        store.setRunning(false);
        console.error("[sim worker]", msg.message);
        break;
    }
  };

  private onError = (ev: ErrorEvent): void => {
    console.error("[sim worker] fatal", ev.message);
    useSimStore.getState().setRunning(false);
  };

  play(): void {
    this.send({ type: "start", ticksPerSecond: useSimStore.getState().ticksPerSecond });
  }

  pause(): void {
    this.send({ type: "pause" });
  }

  step(): void {
    this.send({ type: "step" });
  }

  setSpeed(ticksPerSecond: number): void {
    useSimStore.getState().setTicksPerSecond(ticksPerSecond);
    this.send({ type: "setSpeed", ticksPerSecond });
  }

  injectChaos(command: ChaosCommand): void {
    this.send({ type: "chaos", command });
  }

  reseed(overrides: { seed?: number; meterCount?: number; collectorCount?: number }): void {
    const store = useSimStore.getState();
    store.setConfig(overrides);
    store.reset();
    const { seed, meterCount, collectorCount } = useSimStore.getState();
    this.config = createConfig({ seed, meterCount, collectorCount });
    this.send({ type: "reseed", config: this.config });
    if (store.running) this.play();
  }

  dispose(): void {
    this.send({ type: "dispose" });
    this.worker?.removeEventListener("message", this.onMessage);
    this.worker?.removeEventListener("error", this.onError);
    this.worker?.terminate();
    this.worker = null;
    useSimStore.getState().setConnected(false);
  }
}

let singleton: SimulationController | null = null;

/** Lazily create the process-wide controller (browser only). */
export function getController(): SimulationController {
  if (!singleton) singleton = new SimulationController();
  return singleton;
}
