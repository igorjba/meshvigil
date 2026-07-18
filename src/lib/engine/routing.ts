/**
 * Mesh reconvergence: shortest-path routing from the head-end over the currently
 * up links. Run every tick, this is what makes the network visibly "heal" after
 * a collector dies or the RF degrades — routes recompute and hop counts shift.
 *
 * Cost model: each hop costs `1 / quality`, so the router prefers fewer hops but
 * will take an extra hop to avoid a weak link — exactly the trade a real RPL/AODV
 * objective function makes.
 */

import type { MeshLink, MeshNode } from "./types";

const HEADEND_ID = "HE-01";

interface Adjacency {
  readonly to: string;
  readonly cost: number;
  readonly rssi: number;
  readonly linkId: string;
}

function buildAdjacency(links: MeshLink[]): Map<string, Adjacency[]> {
  const adj = new Map<string, Adjacency[]>();
  const add = (from: string, to: string, link: MeshLink) => {
    const cost = 1 / Math.max(link.quality, 0.05);
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from)!.push({ to, cost, rssi: link.rssi, linkId: link.id });
  };
  for (const link of links) {
    if (!link.up) continue;
    add(link.a, link.b, link);
    add(link.b, link.a, link);
  }
  return adj;
}

export interface RoutingResult {
  /** Distinct network partitions that still contain infrastructure (1 = healthy). */
  readonly partitions: number;
  /** Meters with no route to the head-end. */
  readonly unreachable: number;
}

/**
 * Recompute every node's route to the head-end in place and return partition
 * stats. Uses Dijkstra with a binary-heap-free approach (fine for these sizes).
 */
export function reconverge(
  nodes: Record<string, MeshNode>,
  links: MeshLink[],
): RoutingResult {
  const adj = buildAdjacency(links);
  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const prevLink = new Map<string, string>();

  const ids = Object.keys(nodes);
  for (const id of ids) dist.set(id, Number.POSITIVE_INFINITY);
  dist.set(HEADEND_ID, 0);

  const visited = new Set<string>();
  // Simple O(V^2) selection loop — V is small and this stays allocation-light.
  for (let n = 0; n < ids.length; n++) {
    let u: string | null = null;
    let best = Number.POSITIVE_INFINITY;
    for (const id of ids) {
      if (visited.has(id)) continue;
      const d = dist.get(id)!;
      if (d < best) {
        best = d;
        u = id;
      }
    }
    if (u === null || best === Number.POSITIVE_INFINITY) break;
    visited.add(u);

    for (const edge of adj.get(u) ?? []) {
      if (visited.has(edge.to)) continue;
      const nd = best + edge.cost;
      if (nd < dist.get(edge.to)!) {
        dist.set(edge.to, nd);
        prev.set(edge.to, u);
        prevLink.set(edge.to, edge.linkId);
      }
    }
  }

  // Reset link routing flags before re-marking.
  for (const link of links) link.onRoute = false;
  const linkById = new Map(links.map((l) => [l.id, l]));

  let unreachable = 0;
  for (const id of ids) {
    const node = nodes[id]!;
    if (id === HEADEND_ID) {
      node.nextHop = null;
      node.hopCount = 0;
      node.route = [];
      node.rssi = 0;
      continue;
    }
    const reachable = dist.get(id)! < Number.POSITIVE_INFINITY;
    if (!reachable) {
      node.nextHop = null;
      node.hopCount = Number.POSITIVE_INFINITY;
      node.route = [];
      node.rssi = 0;
      if (node.status !== "offline") node.status = "unreachable";
      if (node.kind === "meter") unreachable++;
      continue;
    }

    const { path, hops, hopRssi } = tracePath(id, prev, prevLink, linkById, nodes);
    node.nextHop = prev.get(id) ?? null;
    node.hopCount = hops;
    node.route = path;
    node.rssi = hopRssi;
    if (node.status === "unreachable") node.status = "online";
    for (const linkId of pathLinks(id, prev, prevLink)) {
      const link = linkById.get(linkId);
      if (link) link.onRoute = true;
    }
  }

  return { partitions: countPartitions(nodes, links), unreachable };
}

function tracePath(
  start: string,
  prev: Map<string, string>,
  prevLink: Map<string, string>,
  linkById: Map<string, MeshLink>,
  nodes: Record<string, MeshNode>,
): { path: string[]; hops: number; hopRssi: number } {
  const path: string[] = [start];
  let hops = 0;
  let cur = start;
  const firstLinkId = prevLink.get(start);
  const hopRssi = firstLinkId ? (linkById.get(firstLinkId)?.rssi ?? 0) : 0;
  while (prev.has(cur)) {
    const next = prev.get(cur)!;
    path.push(next);
    hops++;
    cur = next;
    if (hops > Object.keys(nodes).length) break; // cycle guard
  }
  return { path, hops, hopRssi };
}

function pathLinks(start: string, prev: Map<string, string>, prevLink: Map<string, string>): string[] {
  const out: string[] = [];
  let cur = start;
  let guard = 0;
  while (prev.has(cur)) {
    const linkId = prevLink.get(cur);
    if (linkId) out.push(linkId);
    cur = prev.get(cur)!;
    if (guard++ > 10_000) break;
  }
  return out;
}

/** Union-find over up links; count components holding the head-end or a collector. */
function countPartitions(nodes: Record<string, MeshNode>, links: MeshLink[]): number {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    while (parent.get(x) !== root) {
      const next = parent.get(x)!;
      parent.set(x, root);
      x = next;
    }
    return root;
  };
  const union = (a: string, b: string) => {
    parent.set(find(a), find(b));
  };

  for (const id of Object.keys(nodes)) parent.set(id, id);
  for (const link of links) {
    if (link.up) union(link.a, link.b);
  }

  const infra = new Set<string>();
  for (const node of Object.values(nodes)) {
    if (node.status === "offline") continue;
    if (node.kind === "collector" || node.kind === "headend") {
      infra.add(find(node.id));
    }
  }
  return Math.max(1, infra.size);
}
