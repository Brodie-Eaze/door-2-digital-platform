/**
 * Deterministic seeded RNG for demo seeds.
 *
 * Pilot-Charlie-scale fixtures (200+ knockers, 5K conversions/mo, 14-day
 * history) need to look organic but render the same data on every reload —
 * otherwise reconciliation across views collapses ("/command-centre says
 * 5,247 conversions, but /accounts/hope-forward/conversions shows 5,189").
 *
 * Implementation: mulberry32, the simplest 32-bit RNG that produces a
 * uniformly distributed sequence with no correlation between adjacent
 * outputs. Sufficient for fixtures; do NOT use for anything that touches
 * money in production.
 *
 * FIXTURE — not real PII. All names/addresses/phones are synthetic.
 */

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Pick a random element. */
  pick<T>(arr: readonly T[]): T;
  /** Pick `count` distinct elements (or all if count exceeds length). */
  sample<T>(arr: readonly T[], count: number): T[];
  /** Bernoulli — return true with probability p. */
  bool(p?: number): boolean;
  /** Box-Muller standard normal sample. */
  normal(mean?: number, stdev?: number): number;
}

/**
 * 32-bit FNV-1a hash of an arbitrary string. Used to seed the RNG from a
 * stable per-account label (e.g. `hope-forward:leads:2026-W21`) so that
 * fixture data is reproducible across hot reloads, server restarts, and
 * SSR/CSR boundaries.
 */
function hashSeed(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Ensure non-zero, otherwise mulberry32 stalls at 0.
  return h >>> 0 || 0xdeadbeef;
}

/**
 * Build a deterministic RNG seeded by the given key. Pass an account slug or
 * any other tenant-scoped identifier; data generated will be reproducible
 * across requests for that key.
 */
export function makeRng(seed: string | number): Rng {
  let state = typeof seed === 'number' ? seed >>> 0 || 0xdeadbeef : hashSeed(seed);

  function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function int(min: number, max: number): number {
    if (max < min) return min;
    return Math.floor(next() * (max - min + 1)) + min;
  }

  function pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('rng.pick: empty array');
    return arr[int(0, arr.length - 1)]!;
  }

  function sample<T>(arr: readonly T[], count: number): T[] {
    if (count >= arr.length) return [...arr];
    const out: T[] = [];
    const used = new Set<number>();
    while (out.length < count) {
      const idx = int(0, arr.length - 1);
      if (used.has(idx)) continue;
      used.add(idx);
      out.push(arr[idx]!);
    }
    return out;
  }

  function bool(p = 0.5): boolean {
    return next() < p;
  }

  function normal(mean = 0, stdev = 1): number {
    // Box-Muller: two uniforms → one standard normal.
    const u1 = Math.max(next(), 1e-9);
    const u2 = next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stdev;
  }

  return { next, int, pick, sample, bool, normal };
}
