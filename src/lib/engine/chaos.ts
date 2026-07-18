/**
 * Chaos injection. Each command mutates the world in a targeted way; the tick
 * loop then reconverges routing and surfaces the fallout.
 */

import type { ChaosCommand, MeshLink, MeshNode, SimEvent, SimState } from "./types";

const MAX_NOISE_FLOOR = -46; // dBm — degrading toward this progressively kills weaker links

function event(state: SimState, level: SimEvent["level"], code: string, message: string, nodeId?: string): SimEvent {
  return { tick: state.tick, level, code, message, ...(nodeId ? { nodeId } : {}) };
}

function firstOnlineCollector(state: SimState): MeshNode | undefined {
  return Object.values(state.nodes).find((n) => n.kind === "collector" && n.status !== "offline");
}

function takeNodeOffline(state: SimState, node: MeshNode): void {
  node.status = "offline";
  if (!state.downedNodes.includes(node.id)) state.downedNodes.push(node.id);
  for (const link of state.links) {
    if (link.a === node.id || link.b === node.id) link.up = false;
  }
}

/** Apply one chaos command, returning the events it generated. */
export function applyChaos(state: SimState, cmd: ChaosCommand): SimEvent[] {
  switch (cmd.kind) {
    case "kill-collector": {
      const target = cmd.targetId ? state.nodes[cmd.targetId] : firstOnlineCollector(state);
      if (!target || target.kind !== "collector") {
        return [event(state, "warn", "chaos.noop", "No online collector to fail")];
      }
      takeNodeOffline(state, target);
      return [event(state, "error", "chaos.collector_down", `${target.label} (${target.id}) forced offline`, target.id)];
    }

    case "kill-node": {
      const target = cmd.targetId ? state.nodes[cmd.targetId] : undefined;
      if (!target || target.kind === "headend") {
        return [event(state, "warn", "chaos.noop", "Invalid node target")];
      }
      takeNodeOffline(state, target);
      return [event(state, "error", "chaos.node_down", `${target.label} (${target.id}) forced offline`, target.id)];
    }

    case "kill-link": {
      const link = cmd.targetId ? state.links.find((l) => l.id === cmd.targetId) : pickBusiestLink(state.links);
      if (!link) return [event(state, "warn", "chaos.noop", "No link to cut")];
      if (!state.cutLinks.includes(link.id)) state.cutLinks.push(link.id);
      link.up = false;
      return [event(state, "warn", "chaos.link_cut", `Link ${link.id} cut`)];
    }

    case "degrade-rf": {
      const step = cmd.magnitude ?? 12;
      state.rf.noiseFloor = Math.min(MAX_NOISE_FLOOR, state.rf.noiseFloor + step);
      return [
        event(state, "warn", "chaos.rf_degraded", `RF noise floor raised to ${state.rf.noiseFloor} dBm`),
      ];
    }

    case "partition": {
      // Cut every link crossing a vertical split line → two islands.
      const split = cmd.magnitude ?? 0.5;
      let cut = 0;
      for (const link of state.links) {
        const a = state.nodes[link.a]!;
        const b = state.nodes[link.b]!;
        if (a.kind === "headend" || b.kind === "headend") continue;
        if (a.x < split !== b.x < split) {
          link.up = false;
          if (!state.cutLinks.includes(link.id)) state.cutLinks.push(link.id);
          cut++;
        }
      }
      return [event(state, "error", "chaos.partition", `Network partitioned — ${cut} cross-links severed`)];
    }

    case "restore": {
      state.downedNodes = [];
      state.cutLinks = [];
      state.rf.noiseFloor = state.config.rf.noiseFloor;
      for (const node of Object.values(state.nodes)) {
        if (node.status === "offline" || node.status === "unreachable") node.status = "online";
      }
      return [event(state, "success", "chaos.restore", "All faults cleared — network restoring")];
    }

    default:
      return [event(state, "warn", "chaos.unknown", `Unknown chaos command`)];
  }
}

function pickBusiestLink(links: MeshLink[]): MeshLink | undefined {
  // Cutting a route-bearing link forces the most visible reconvergence.
  return links.find((l) => l.onRoute && l.up) ?? links.find((l) => l.up);
}
