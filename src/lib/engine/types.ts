/** Shared types for the deterministic mesh simulation. */

export type NodeKind = "meter" | "collector" | "headend";

/** A node's health as the console sees it. */
export type NodeStatus = "online" | "degraded" | "offline" | "unreachable";

export interface NodePosition {
  /** Normalised layout coordinates in [0, 1] — the canvas scales them. */
  readonly x: number;
  readonly y: number;
}

export interface MeshNode extends NodePosition {
  readonly id: string;
  readonly kind: NodeKind;
  readonly label: string;
  status: NodeStatus;
  /** Next hop toward the head-end, or null when unreachable. */
  nextHop: string | null;
  /** Hop count to the head-end; Number.POSITIVE_INFINITY when unreachable. */
  hopCount: number;
  /** Resolved path of node ids from this node to the head-end. */
  route: string[];
  /** RSSI (dBm) on the link to `nextHop`. */
  rssi: number;
}

export interface MeshLink {
  readonly id: string;
  readonly a: string;
  readonly b: string;
  /** Euclidean distance in layout units, cached at build time. */
  readonly distance: number;
  /** 0..1 link quality after path loss + current noise floor. */
  quality: number;
  /** RSSI (dBm) for this link under current conditions. */
  rssi: number;
  /** False when administratively cut (killed link) or an endpoint is offline. */
  up: boolean;
  /** True while this link is part of some node's active route (for rendering). */
  onRoute: boolean;
  /**
   * Head-end ↔ collector backhaul (cellular/fibre). Always-on and immune to RF
   * range and noise — only an offline endpoint takes it down. This is why the
   * network stays partition-tolerant at the infrastructure layer.
   */
  backhaul: boolean;
}

/** Per-meter accumulating state that persists across ticks. */
export interface MeterAccount {
  /** Active energy import register (+A) in watt-hours. */
  energyWh: number;
  /** Baseline load in watts, the centre of the consumption profile. */
  baseLoadW: number;
  /** Tick of the last successful read. */
  lastReadTick: number;
  /** Consecutive ticks this meter has been unreachable (drives MTTR). */
  outageTicks: number;
}

export type ChaosKind =
  | "kill-collector"
  | "kill-node"
  | "kill-link"
  | "degrade-rf"
  | "partition"
  | "restore";

export interface ChaosCommand {
  readonly kind: ChaosKind;
  readonly targetId?: string;
  /** For degrade-rf: extra noise floor in dB. For partition: x split position. */
  readonly magnitude?: number;
}

export type EventLevel = "info" | "warn" | "error" | "success";

export interface SimEvent {
  readonly tick: number;
  readonly level: EventLevel;
  readonly code: string;
  readonly message: string;
  readonly nodeId?: string;
}

export interface Reading {
  readonly meterId: string;
  readonly tick: number;
  readonly energyWh: number;
  readonly powerW: number;
  readonly voltageV: number;
  readonly currentA: number;
  readonly rssi: number;
  readonly hopCount: number;
  /** The real DLMS DataNotification frame carrying this reading, as hex. */
  readonly frameHex: string;
}

export interface SlaMetrics {
  /** Fraction of meters with a valid route to the head-end (0..1). */
  readonly availability: number;
  /** Delivered reads / expected reads since start (0..1). */
  readonly readSuccessRate: number;
  /** Mean time to recovery across resolved outages, in ticks. */
  readonly mttrTicks: number;
  /** Meters currently unreachable. */
  readonly unreachable: number;
  /** Rolling count of reads delivered. */
  readonly readsDelivered: number;
  readonly readsExpected: number;
  /** Number of distinct network partitions right now (1 = fully converged). */
  readonly partitions: number;
}

export interface RfConfig {
  /** Transmit power in dBm. */
  readonly txPower: number;
  /** Receiver sensitivity in dBm — links below this are down. */
  readonly sensitivity: number;
  /** Baseline noise floor in dBm; chaos raises it. */
  noiseFloor: number;
  /** Reference path-loss exponent. */
  readonly pathLossExponent: number;
  /** Maximum RF range in layout units. */
  readonly range: number;
}

export interface SimConfig {
  readonly seed: number;
  readonly meterCount: number;
  readonly collectorCount: number;
  /** Milliseconds of simulated time per tick (for latency/SLA math). */
  readonly tickMs: number;
  /** A meter attempts a read every `readIntervalTicks` ticks. */
  readonly readIntervalTicks: number;
  readonly rf: RfConfig;
}

export interface SimState {
  readonly config: SimConfig;
  tick: number;
  nodes: Record<string, MeshNode>;
  links: MeshLink[];
  accounts: Record<string, MeterAccount>;
  rf: RfConfig;
  /** Ids that chaos has administratively taken offline. */
  downedNodes: string[];
  /** Link ids that chaos has cut. */
  cutLinks: string[];
  /** Cumulative SLA counters. */
  readsDelivered: number;
  readsExpected: number;
  /** Sum and count of resolved outage durations, for MTTR. */
  outageDurationSum: number;
  outageDurationCount: number;
}

/** What a single tick produces for the outside world. */
export interface TickResult {
  readonly state: SimState;
  readonly readings: Reading[];
  readonly events: SimEvent[];
  readonly sla: SlaMetrics;
}

/** A compact, transferable snapshot for the UI / persistence. */
export interface Snapshot {
  readonly tick: number;
  readonly seed: number;
  readonly nodes: MeshNode[];
  readonly links: MeshLink[];
  readonly sla: SlaMetrics;
  readonly noiseFloor: number;
}
