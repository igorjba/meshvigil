/**
 * Deterministic topology generation and the RF link model.
 *
 * Nodes are laid out reproducibly from the seed: a head-end at the top, a row of
 * collectors across the field, and meters clustered into neighbourhoods around
 * the collectors (the way real AMI deployments actually look). Links follow a
 * log-distance path-loss model, so RSSI and link quality are physical, not
 * random noise.
 */

import { Rng, hashString } from "./rng";
import type { MeshLink, MeshNode, RfConfig, SimConfig } from "./types";

export const DEFAULT_RF: RfConfig = {
  txPower: 14, // dBm, typical sub-GHz mesh radio
  sensitivity: -95, // dBm
  noiseFloor: -100, // dBm baseline
  pathLossExponent: 2.8,
  // Short RF range so the mesh is genuinely multi-hop and clusters are distinct:
  // a meter reaches its own neighbourhood, not every collector. Collector→head-end
  // uses always-on backhaul instead, so killing a collector or degrading RF
  // strands part of a neighbourhood and visibly moves the SLA.
  range: 0.19,
};

const REF_DISTANCE = 0.05;
const REF_LOSS = 55; // dB at REF_DISTANCE
const MIN_SNR = 3; // dB — below this a link is unusable

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Log-distance path loss → RSSI in dBm for a given separation. */
export function rssiForDistance(d: number, rf: RfConfig): number {
  const dd = Math.max(d, REF_DISTANCE / 4);
  const loss = REF_LOSS + 10 * rf.pathLossExponent * Math.log10(dd / REF_DISTANCE);
  return Math.round(rf.txPower - loss);
}

/** Recompute a link's RSSI / quality / up-state under the current RF conditions. */
export function refreshLinkRf(link: MeshLink, rf: RfConfig, endpointsUp: boolean): void {
  if (link.backhaul) {
    // Backhaul is a wired/cellular path: immune to RF noise, up unless an endpoint is down.
    link.up = endpointsUp;
    link.quality = 1;
    link.rssi = -55;
    return;
  }
  const rssi = rssiForDistance(link.distance, rf);
  const snr = rssi - rf.noiseFloor;
  link.rssi = rssi;
  link.quality = clamp01((snr - MIN_SNR) / 40);
  link.up = endpointsUp && rssi >= rf.sensitivity && snr >= MIN_SNR;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export interface Topology {
  nodes: Record<string, MeshNode>;
  links: MeshLink[];
}

function newNode(id: string, kind: MeshNode["kind"], label: string, x: number, y: number): MeshNode {
  return {
    id,
    kind,
    label,
    x: clamp01(x),
    y: clamp01(y),
    status: "online",
    nextHop: null,
    hopCount: Number.POSITIVE_INFINITY,
    route: [],
    rssi: 0,
  };
}

/** Build the full node set + candidate links for a run. Pure in `config`. */
export function buildTopology(config: SimConfig): Topology {
  const rng = new Rng(hashString(`topology:${config.seed}`));
  const nodes: Record<string, MeshNode> = {};

  const headend = newNode("HE-01", "headend", "Head-End", 0.5, 0.07);
  nodes[headend.id] = headend;

  // Collectors span the full width, well separated, a little below the head-end.
  const collectors: MeshNode[] = [];
  for (let i = 0; i < config.collectorCount; i++) {
    const frac = config.collectorCount === 1 ? 0.5 : i / (config.collectorCount - 1);
    const x = 0.1 + frac * 0.8 + rng.jitter(0.03);
    const y = 0.26 + rng.jitter(0.04);
    const node = newNode(`COL-${String(i + 1).padStart(2, "0")}`, "collector", `Collector ${i + 1}`, x, y);
    collectors.push(node);
    nodes[node.id] = node;
  }

  // Meters sit in a compact disc around their home collector, biased downward.
  for (let i = 0; i < config.meterCount; i++) {
    const home = collectors[i % collectors.length]!;
    const radius = 0.05 + Math.abs(rng.jitter(0.11));
    const angle = rng.range(0, Math.PI * 2);
    const x = home.x + Math.cos(angle) * radius;
    const y = home.y + 0.09 + Math.abs(Math.sin(angle)) * radius;
    const node = newNode(`MTR-${String(i + 1).padStart(4, "0")}`, "meter", `Meter ${i + 1}`, x, y);
    nodes[node.id] = node;
  }

  return { nodes, links: buildLinks(nodes, config.rf) };
}

function makeLink(a: MeshNode, b: MeshNode, backhaul: boolean): MeshLink {
  return {
    id: `${a.id}~${b.id}`,
    a: a.id,
    b: b.id,
    distance: distance(a, b),
    quality: backhaul ? 1 : 0,
    rssi: backhaul ? -55 : 0,
    up: backhaul,
    onRoute: false,
    backhaul,
  };
}

/**
 * Build the link set: always-on backhaul from each collector to the head-end,
 * plus range-limited RF links across the mesh (meter↔meter, meter↔collector).
 */
export function buildLinks(nodes: Record<string, MeshNode>, rf: RfConfig): MeshLink[] {
  const list = Object.values(nodes);
  const links: MeshLink[] = [];

  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!;
      const b = list[j]!;
      const headendInvolved = a.kind === "headend" || b.kind === "headend";

      if (headendInvolved) {
        // Head-end only connects to collectors, via always-on backhaul.
        if (a.kind === "collector" || b.kind === "collector") links.push(makeLink(a, b, true));
        continue;
      }

      if (distance(a, b) > rf.range) continue;
      const link = makeLink(a, b, false);
      refreshLinkRf(link, rf, true);
      links.push(link);
    }
  }
  return links;
}
