/**
 * SLA computation — the numbers a utility actually reports on: availability,
 * read-success rate, and MTTR. Derived purely from the current state and the
 * cumulative counters the tick loop maintains.
 */

import type { MeshNode, SimState, SlaMetrics } from "./types";

/** The metrics of a converged, fault-free network — the pre-tick baseline. */
export function emptySla(): SlaMetrics {
  return {
    availability: 1,
    readSuccessRate: 1,
    mttrTicks: 0,
    unreachable: 0,
    readsDelivered: 0,
    readsExpected: 0,
    partitions: 1,
  };
}

export function computeSla(state: SimState, partitions: number): SlaMetrics {
  const meters = Object.values(state.nodes).filter((n) => n.kind === "meter");
  const total = meters.length || 1;
  const reachable = meters.filter(isReachable).length;
  const unreachable = total - reachable;

  const mttrTicks = state.outageDurationCount > 0 ? state.outageDurationSum / state.outageDurationCount : 0;

  return {
    availability: reachable / total,
    readSuccessRate: state.readsExpected > 0 ? state.readsDelivered / state.readsExpected : 1,
    mttrTicks: Number(mttrTicks.toFixed(1)),
    unreachable,
    readsDelivered: state.readsDelivered,
    readsExpected: state.readsExpected,
    partitions,
  };
}

function isReachable(node: MeshNode): boolean {
  return node.status !== "offline" && node.status !== "unreachable" && Number.isFinite(node.hopCount);
}

/** Convert a per-tick MTTR into wall-clock seconds for display. */
export function mttrSeconds(sla: SlaMetrics, tickMs: number): number {
  return Number(((sla.mttrTicks * tickMs) / 1000).toFixed(1));
}
