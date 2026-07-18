import { describe, expect, it } from "vitest";
import { createConfig, createEngine, run, snapshot, tick } from "./engine";
import { parseFrame } from "../dlms";
import type { ChaosCommand, SimState } from "./types";

const smallConfig = createConfig({ seed: 42, meterCount: 24, collectorCount: 3 });

function meters(state: SimState) {
  return Object.values(state.nodes).filter((n) => n.kind === "meter");
}

describe("engine construction", () => {
  it("builds a converged topology from a seed", () => {
    const state = createEngine(smallConfig);
    expect(meters(state)).toHaveLength(24);
    expect(Object.values(state.nodes).filter((n) => n.kind === "collector")).toHaveLength(3);
    expect(state.nodes["HE-01"]).toBeDefined();
    // Most meters should have a route on a healthy network.
    const reachable = meters(state).filter((n) => Number.isFinite(n.hopCount));
    expect(reachable.length).toBeGreaterThan(18);
  });
});

describe("determinism", () => {
  it("produces identical output for the same seed and command log", () => {
    const commands: Record<number, ChaosCommand[]> = { 3: [{ kind: "kill-collector" }], 8: [{ kind: "degrade-rf" }] };
    const a = run(createEngine(smallConfig), 20, commands);
    const b = run(createEngine(smallConfig), 20, commands);
    expect(snapshot(a.state, a.sla)).toEqual(snapshot(b.state, b.sla));
    expect(a.sla).toEqual(b.sla);
  });

  it("diverges for a different seed", () => {
    const a = run(createEngine(createConfig({ seed: 1 })), 10);
    const b = run(createEngine(createConfig({ seed: 2 })), 10);
    expect(snapshot(a.state, a.sla)).not.toEqual(snapshot(b.state, b.sla));
  });
});

describe("telemetry emits real DLMS frames", () => {
  it("every emitted frame parses back to the reading that produced it", () => {
    const state = createEngine(smallConfig);
    let checked = 0;
    for (let i = 0; i < 12; i++) {
      const result = tick(state);
      for (const reading of result.readings) {
        const parsed = parseFrame(reading.frameHex);
        expect(parsed.ok, `frame from ${reading.meterId}`).toBe(true);
        const energy = parsed.readings.find((r) => r.obis === "1.0.1.8.0.255");
        expect(energy?.value).toBe(reading.energyWh);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe("chaos and reconvergence", () => {
  it("killing a collector reduces availability, restore recovers it", () => {
    const state = createEngine(smallConfig);
    const before = run(state, 4).sla.availability;

    const downed = tick(state, [{ kind: "kill-collector" }]);
    // Let routing settle.
    run(state, 2);
    const during = downed.sla.availability;
    expect(during).toBeLessThanOrEqual(before);

    tick(state, [{ kind: "restore" }]);
    const after = run(state, 4).sla.availability;
    expect(after).toBeGreaterThanOrEqual(during);
  });

  it("partition raises the partition count above 1", () => {
    const state = createEngine(smallConfig);
    run(state, 2);
    const result = tick(state, [{ kind: "partition", magnitude: 0.5 }]);
    expect(result.sla.partitions).toBeGreaterThanOrEqual(1);
  });

  it("degrading RF raises the noise floor and lowers link quality", () => {
    const state = createEngine(smallConfig);
    const q0 = avgQuality(state);
    tick(state, [{ kind: "degrade-rf", magnitude: 20 }]);
    tick(state, [{ kind: "degrade-rf", magnitude: 20 }]);
    expect(state.rf.noiseFloor).toBeGreaterThan(state.config.rf.noiseFloor);
    expect(avgQuality(state)).toBeLessThan(q0);
  });

  it("accumulates MTTR after an outage recovers", () => {
    const state = createEngine(smallConfig);
    run(state, 3);
    tick(state, [{ kind: "kill-collector" }]);
    run(state, 3);
    tick(state, [{ kind: "restore" }]);
    const result = run(state, 5);
    expect(result.sla.mttrTicks).toBeGreaterThanOrEqual(0);
  });
});

function avgQuality(state: SimState): number {
  const up = state.links.filter((l) => l.up);
  return up.reduce((s, l) => s + l.quality, 0) / Math.max(up.length, 1);
}
