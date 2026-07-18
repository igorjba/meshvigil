/** Public surface of the deterministic mesh simulation engine. */

export {
  DEFAULT_CONFIG,
  createConfig,
  createEngine,
  tick,
  run,
  snapshot,
} from "./engine";
export { DEFAULT_RF, buildTopology, rssiForDistance } from "./topology";
export { reconverge } from "./routing";
export { computeSla, emptySla, mttrSeconds } from "./sla";
export { Rng, mulberry32, hashString, mixSeed } from "./rng";
export type {
  NodeKind,
  NodeStatus,
  MeshNode,
  MeshLink,
  MeterAccount,
  ChaosKind,
  ChaosCommand,
  EventLevel,
  SimEvent,
  Reading,
  SlaMetrics,
  RfConfig,
  SimConfig,
  SimState,
  TickResult,
  Snapshot,
} from "./types";
