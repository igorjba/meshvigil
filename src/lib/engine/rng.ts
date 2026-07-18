/**
 * Deterministic pseudo-random number generation.
 *
 * The whole simulation is a pure function of (seed, tick, chaos events). To keep
 * that promise, no code anywhere may call Math.random(); every stochastic draw
 * comes from a `Rng` seeded from the run seed and the current tick, so a replay
 * with the same inputs produces byte-identical output.
 */

/** mulberry32 — small, fast, good-enough distribution for a simulation. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a hash of a string → 32-bit seed, so string ids seed reproducibly. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mix two 32-bit seeds into one (for deriving a per-tick stream from a run seed). */
export function mixSeed(a: number, b: number): number {
  let h = (a ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (b >>> 0), 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** Ergonomic wrapper over a raw generator. */
export class Rng {
  private readonly next: () => number;

  constructor(seed: number) {
    this.next = mulberry32(seed >>> 0);
  }

  /** [0, 1). */
  float(): number {
    return this.next();
  }

  /** [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Integer in [min, max]. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Approximately-normal jitter via the sum of uniforms (mean 0, given spread). */
  jitter(spread: number): number {
    return (this.next() + this.next() + this.next() - 1.5) * (spread / 1.5);
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]!;
  }
}
