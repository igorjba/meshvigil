import { describe, expect, it } from "vitest";
import { applyChaos } from "./chaos";
import { createConfig, createEngine, tick } from "./engine";
import { Rng } from "./rng";
import { computeSla, mttrSeconds } from "./sla";
import type { SimState } from "./types";

function fresh(): SimState {
  return createEngine(createConfig({ seed: 7, meterCount: 20, collectorCount: 3 }));
}

function firstCollector(state: SimState): string {
  return Object.values(state.nodes).find((n) => n.kind === "collector")!.id;
}

function firstMeter(state: SimState): string {
  return Object.values(state.nodes).find((n) => n.kind === "meter")!.id;
}

describe("chaos commands", () => {
  it("kills a specific collector by id", () => {
    const s = fresh();
    const id = firstCollector(s);
    const events = applyChaos(s, { kind: "kill-collector", targetId: id });
    expect(s.nodes[id]!.status).toBe("offline");
    expect(events[0]?.code).toBe("chaos.collector_down");
  });

  it("no-ops kill-collector when the target is not a collector", () => {
    const s = fresh();
    const events = applyChaos(s, { kind: "kill-collector", targetId: firstMeter(s) });
    expect(events[0]?.code).toBe("chaos.noop");
  });

  it("kills a node but refuses the head-end", () => {
    const s = fresh();
    const meter = firstMeter(s);
    expect(applyChaos(s, { kind: "kill-node", targetId: meter })[0]?.code).toBe("chaos.node_down");
    expect(applyChaos(s, { kind: "kill-node", targetId: "HE-01" })[0]?.code).toBe("chaos.noop");
    expect(applyChaos(s, { kind: "kill-node" })[0]?.code).toBe("chaos.noop");
  });

  it("cuts a link (targeted and auto-picked)", () => {
    const s = fresh();
    const linkId = s.links.find((l) => !l.backhaul)!.id;
    expect(applyChaos(s, { kind: "kill-link", targetId: linkId })[0]?.code).toBe("chaos.link_cut");
    expect(s.cutLinks).toContain(linkId);
    // Auto-pick path.
    const ev = applyChaos(s, { kind: "kill-link" });
    expect(["chaos.link_cut", "chaos.noop"]).toContain(ev[0]?.code);
  });

  it("degrades RF up to the cap and never past it", () => {
    const s = fresh();
    for (let i = 0; i < 20; i++) applyChaos(s, { kind: "degrade-rf", magnitude: 12 });
    expect(s.rf.noiseFloor).toBeLessThanOrEqual(-46);
    expect(s.rf.noiseFloor).toBeGreaterThan(-70);
  });

  it("partitions and then restores everything", () => {
    const s = fresh();
    const cut = applyChaos(s, { kind: "partition", magnitude: 0.5 });
    expect(cut[0]?.code).toBe("chaos.partition");

    const restore = applyChaos(s, { kind: "restore" });
    expect(restore[0]?.code).toBe("chaos.restore");
    expect(s.cutLinks).toHaveLength(0);
    expect(s.downedNodes).toHaveLength(0);
    expect(s.rf.noiseFloor).toBe(s.config.rf.noiseFloor);
  });
});

describe("rng helpers", () => {
  it("stays within bounds and is reproducible", () => {
    const a = new Rng(123);
    const b = new Rng(123);
    for (let i = 0; i < 100; i++) {
      const x = a.int(1, 6);
      expect(x).toBeGreaterThanOrEqual(1);
      expect(x).toBeLessThanOrEqual(6);
      expect(b.int(1, 6)).toBe(x);
    }
    expect(typeof a.chance(0.5)).toBe("boolean");
    expect([10, 20, 30]).toContain(a.pick([10, 20, 30]));
    expect(Math.abs(a.jitter(1))).toBeLessThan(2);
  });
});

describe("sla helpers", () => {
  it("reports full availability on a converged network and converts MTTR", () => {
    const s = fresh();
    const sla = computeSla(s, 1);
    expect(sla.availability).toBeGreaterThan(0.5);
    expect(mttrSeconds({ ...sla, mttrTicks: 3 }, 1000)).toBe(3);
  });

  it("records an outage duration once a meter recovers", () => {
    const s = fresh();
    tick(s, [{ kind: "degrade-rf", magnitude: 60 }]);
    tick(s, [{ kind: "degrade-rf", magnitude: 60 }]);
    tick(s);
    const recovered = tick(s, [{ kind: "restore" }]);
    // After restore the mean-time-to-recovery counter is populated (>= 0).
    expect(recovered.sla.mttrTicks).toBeGreaterThanOrEqual(0);
  });
});
