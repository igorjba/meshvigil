import { bench, describe } from "vitest";
import { createConfig, createEngine, tick } from "./engine";

// Steady-state throughput: how many ticks/second the engine can advance for a
// fixed world. Each bench keeps ticking the same engine forward, which is what
// the Web Worker does in production.

describe("engine tick throughput", () => {
  const small = createEngine(createConfig({ seed: 1, meterCount: 48, collectorCount: 4 }));
  bench("48 meters · 4 collectors", () => {
    tick(small);
  });

  const large = createEngine(createConfig({ seed: 2, meterCount: 200, collectorCount: 8 }));
  bench("200 meters · 8 collectors", () => {
    tick(large);
  });
});
