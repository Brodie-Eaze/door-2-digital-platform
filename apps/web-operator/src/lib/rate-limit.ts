/**
 * In-memory sliding-window rate limiter.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠️  SINGLE-PROCESS ONLY — read before trusting this in production.
 * ─────────────────────────────────────────────────────────────────────────
 * State lives in a module-level `Map` inside ONE Node process. It is correct
 * and sufficient for:
 *   - local dev
 *   - single-replica preview deploys
 *   - any deployment where the route always lands on the same instance.
 *
 * It is NOT correct for a horizontally-scaled production deployment: with N
 * replicas an attacker gets N× the budget (each replica counts independently),
 * and counters reset on every cold start / redeploy. A multi-replica brute-
 * force floor requires a shared store with atomic increments + TTL, e.g.
 * Upstash Redis (`@upstash/ratelimit`) or Cloudflare's rate-limiting binding.
 * That swap is the honest humanGated item — the call sites here keep the same
 * `{ ok, retryAfterMs }` contract, so the only change is the backing store.
 *
 * Algorithm: true sliding window over timestamps (not fixed buckets), so a
 * burst at a window boundary cannot double the effective rate. Each key keeps
 * the timestamps of its recent hits; on each call we evict anything older than
 * `windowMs`, then admit iff the surviving count is below `limit`.
 *
 * Memory: bounded by (active keys × limit) timestamps. A lazy sweep evicts
 * fully-expired keys on access, and a periodic sweep (unref'd, so it never
 * keeps the process alive) reclaims idle keys.
 */

interface Bucket {
  /** Epoch-ms timestamps of admitted hits within the current window. */
  hits: number[];
}

const BUCKETS = new Map<string, Bucket>();

/** Periodically drop keys whose entire window has elapsed. */
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let sweeper: ReturnType<typeof setInterval> | null = null;

function ensureSweeper(windowMsHint: number): void {
  if (sweeper) return;
  sweeper = setInterval(() => {
    const cutoffBase = Date.now();
    for (const [key, bucket] of BUCKETS) {
      // A bucket is dead once its newest hit is older than the largest window
      // we've plausibly seen. We don't track per-key windows, so use the hint
      // generously; stale keys are cheap to keep one extra cycle.
      const newest = bucket.hits[bucket.hits.length - 1] ?? 0;
      if (cutoffBase - newest > windowMsHint) BUCKETS.delete(key);
    }
  }, SWEEP_INTERVAL_MS);
  // Do not let the sweeper hold the event loop open (Node-only API; guarded).
  if (typeof sweeper.unref === 'function') sweeper.unref();
}

export interface RateLimitResult {
  /** True when the request is within budget and should proceed. */
  ok: boolean;
  /** Milliseconds until the caller may retry. 0 when `ok` is true. */
  retryAfterMs: number;
  /** Remaining hits in the current window after this call (0 when blocked). */
  remaining: number;
  /** The configured ceiling, echoed back for response headers. */
  limit: number;
}

/**
 * Record one hit against `key` and report whether it is within budget.
 *
 * @param key      Caller-chosen identity (email, IP, `${ip}:${route}`…). Hash
 *                 or namespace upstream if the raw value is sensitive.
 * @param limit    Max admitted hits per window. Must be ≥ 1.
 * @param windowMs Sliding window length in ms. Must be > 0.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const safeLimit = Math.max(1, Math.floor(limit));
  const safeWindow = Math.max(1, Math.floor(windowMs));
  const now = Date.now();
  const cutoff = now - safeWindow;

  ensureSweeper(safeWindow);

  let bucket = BUCKETS.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    BUCKETS.set(key, bucket);
  }

  // Evict hits that have aged out of the window (sliding window core).
  if (bucket.hits.length > 0) {
    let firstLive = 0;
    while (firstLive < bucket.hits.length && bucket.hits[firstLive]! <= cutoff) firstLive++;
    if (firstLive > 0) bucket.hits.splice(0, firstLive);
  }

  if (bucket.hits.length >= safeLimit) {
    // Blocked: the oldest live hit determines when a slot frees up.
    const oldest = bucket.hits[0]!;
    const retryAfterMs = Math.max(0, oldest + safeWindow - now);
    return { ok: false, retryAfterMs, remaining: 0, limit: safeLimit };
  }

  bucket.hits.push(now);
  return {
    ok: true,
    retryAfterMs: 0,
    remaining: Math.max(0, safeLimit - bucket.hits.length),
    limit: safeLimit,
  };
}

/**
 * Test/maintenance helper — clear all counters. NOT used in request paths.
 * Exposed so unit tests can isolate cases without leaking state between them.
 */
export function __resetRateLimitStore(): void {
  BUCKETS.clear();
}
