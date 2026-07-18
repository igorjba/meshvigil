/**
 * The tick engine. `createEngine` builds a world from a seed; `tick` advances it
 * by one step as a pure function of (state, chaos commands). Determinism matters:
 * replaying the same seed and command log yields the same frames, routes and SLA,
 * which keeps the simulation testable and lets a browser and a server snapshot
 * agree without a live connection.
 */

import { applyChaos } from "./chaos";
import { Rng, hashString, mixSeed } from "./rng";
import { reconverge } from "./routing";
import { computeSla } from "./sla";
import { sampleMeter } from "./telemetry";
import { buildTopology, DEFAULT_RF, refreshLinkRf } from "./topology";
import type {
  ChaosCommand,
  MeshNode,
  Reading,
  SimConfig,
  SimEvent,
  SimState,
  Snapshot,
  TickResult,
} from "./types";

export const DEFAULT_CONFIG: SimConfig = {
  seed: 1337,
  meterCount: 48,
  collectorCount: 4,
  tickMs: 1000,
  readIntervalTicks: 5,
  rf: DEFAULT_RF,
};

export function createConfig(overrides: Partial<SimConfig> = {}): SimConfig {
  return { ...DEFAULT_CONFIG, ...overrides, rf: { ...DEFAULT_RF, ...overrides.rf } };
}

/** Build a fresh, converged world. */
export function createEngine(config: SimConfig = DEFAULT_CONFIG): SimState {
  const { nodes, links } = buildTopology(config);
  const accounts: SimState["accounts"] = {};
  const rng = new Rng(hashString(`accounts:${config.seed}`));

  for (const node of Object.values(nodes)) {
    if (node.kind !== "meter") continue;
    accounts[node.id] = {
      energyWh: Math.round(rng.range(500_000, 5_000_000)),
      baseLoadW: Math.round(rng.range(180, 1400)),
      lastReadTick: -1,
      outageTicks: 0,
    };
  }

  const state: SimState = {
    config,
    tick: 0,
    nodes,
    links,
    accounts,
    rf: { ...config.rf },
    downedNodes: [],
    cutLinks: [],
    readsDelivered: 0,
    readsExpected: 0,
    outageDurationSum: 0,
    outageDurationCount: 0,
  };

  refreshAllLinks(state);
  reconverge(state.nodes, state.links);
  refreshNodeHealth(state);
  return state;
}

function refreshAllLinks(state: SimState): void {
  const cut = new Set(state.cutLinks);
  const down = new Set(state.downedNodes);
  for (const link of state.links) {
    const endpointsUp = !cut.has(link.id) && !down.has(link.a) && !down.has(link.b);
    refreshLinkRf(link, state.rf, endpointsUp);
  }
}

/** A meter reads on the ticks where (tick + its stagger offset) hits the interval. */
function readsThisTick(node: MeshNode, tick: number, interval: number): boolean {
  if (tick === 0) return false;
  const offset = hashString(node.id) % interval;
  return (tick + offset) % interval === 0;
}

/** Classify online/degraded from route quality after reconvergence. */
function refreshNodeHealth(state: SimState): void {
  for (const node of Object.values(state.nodes)) {
    if (node.status === "offline") continue;
    if (!Number.isFinite(node.hopCount)) {
      if (node.kind === "meter") node.status = "unreachable";
      continue;
    }
    node.status = node.rssi < -85 || node.rssi === 0 && node.kind !== "headend" ? "degraded" : "online";
    if (node.kind === "headend") node.status = "online";
  }
}

/** Advance the world by one tick. Mutates and returns `state` for cheap reuse. */
export function tick(state: SimState, commands: ChaosCommand[] = []): TickResult {
  state.tick += 1;
  const events: SimEvent[] = [];

  for (const cmd of commands) {
    events.push(...applyChaos(state, cmd));
  }

  refreshAllLinks(state);
  const routing = reconverge(state.nodes, state.links);
  refreshNodeHealth(state);

  const readings: Reading[] = [];
  const interval = state.config.readIntervalTicks;

  for (const node of Object.values(state.nodes)) {
    if (node.kind !== "meter") continue;
    if (!readsThisTick(node, state.tick, interval)) continue;

    const account = state.accounts[node.id]!;
    state.readsExpected += 1;
    const reachable = Number.isFinite(node.hopCount) && node.status !== "offline";

    if (reachable) {
      const rng = new Rng(mixSeed(mixSeed(state.config.seed, state.tick), hashString(node.id)));
      readings.push(sampleMeter(state, node, account, rng));
      state.readsDelivered += 1;
    }
  }

  trackOutages(state, events);

  const sla = computeSla(state, routing.partitions);
  return { state, readings, events, sla };
}

/** Update per-meter outage counters and emit recovery events (feeds MTTR). */
function trackOutages(state: SimState, events: SimEvent[]): void {
  for (const node of Object.values(state.nodes)) {
    if (node.kind !== "meter") continue;
    const account = state.accounts[node.id]!;
    const down = node.status === "unreachable" || node.status === "offline";

    if (down) {
      account.outageTicks += 1;
    } else if (account.outageTicks > 0) {
      state.outageDurationSum += account.outageTicks;
      state.outageDurationCount += 1;
      events.push({
        tick: state.tick,
        level: "success",
        code: "mesh.recovered",
        message: `${node.label} rejoined after ${account.outageTicks} tick(s)`,
        nodeId: node.id,
      });
      account.outageTicks = 0;
    }
  }
}

/** Produce a compact, structured snapshot for the UI / persistence. */
export function snapshot(state: SimState, sla: TickResult["sla"]): Snapshot {
  return {
    tick: state.tick,
    seed: state.config.seed,
    nodes: Object.values(state.nodes).map((n) => ({ ...n })),
    links: state.links.map((l) => ({ ...l })),
    sla,
    noiseFloor: state.rf.noiseFloor,
  };
}

/** Run N ticks and return the final result — handy for tests and seeding. */
export function run(state: SimState, ticks: number, commandsByTick: Record<number, ChaosCommand[]> = {}): TickResult {
  let last: TickResult = { state, readings: [], events: [], sla: computeSla(state, 1) };
  for (let i = 0; i < ticks; i++) {
    last = tick(state, commandsByTick[state.tick + 1] ?? []);
  }
  return last;
}
