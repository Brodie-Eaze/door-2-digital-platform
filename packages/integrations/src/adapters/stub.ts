/**
 * Generic stub adapter — returns deterministic placeholder data without
 * touching the network. Used as a building block by every real adapter
 * when `config.mode === 'sandbox'` or no credentials are present.
 *
 * Adapters never use this directly as their `kind`; they call its helpers
 * to produce consistent stub responses (matching IDs, costs, hashes).
 */

import { createHash } from 'node:crypto';
import { CredentialsRequiredError, ProviderError, ProviderTimeoutError } from '../errors';
import type {
  GenerateAvatarOutput,
  GenerateImageOutput,
  GenerateTextOutput,
  GenerateVideoOutput,
  ProviderConfig,
  Result,
} from '../types';

/** Default per-call timeout for outbound provider HTTP. */
export const DEFAULT_TIMEOUT_MS = 10_000 as const;

/**
 * Resolved operating posture for a provider config.
 *   - `stub`             → sandbox/dev: serve deterministic placeholder data.
 *   - `live`             → production with real credentials: hit the network.
 *   - `needs_credentials`→ production but creds are missing/blank: FAIL CLOSED.
 *
 * The third state is the whole point of this refactor. Previously a production
 * connection with empty creds collapsed into `stub`, silently serving fake
 * success in a prod context. Now it surfaces explicitly.
 */
export type ProviderPosture = 'stub' | 'live' | 'needs_credentials';

/** True when at least one credential value is present and non-trivial. */
export function hasRealCredentials(config: ProviderConfig): boolean {
  if (!config.credentials || Object.keys(config.credentials).length === 0) return false;
  // Empty-string / whitespace / obvious-placeholder credentials count as missing.
  return Object.values(config.credentials).some(
    (v) => typeof v === 'string' && v.trim().length > 4,
  );
}

/**
 * Resolve a config to its operating posture.
 *
 * Rules:
 *   - mode === 'production' + real creds  → 'live'
 *   - mode === 'production' + no creds    → 'needs_credentials'  (fail closed)
 *   - mode !== 'production' (sandbox/unset)→ 'stub' regardless of creds
 */
export function resolveProviderPosture(config: ProviderConfig): ProviderPosture {
  if (config.mode === 'production') {
    return hasRealCredentials(config) ? 'live' : 'needs_credentials';
  }
  return 'stub';
}

/**
 * True when the adapter should produce a stub response rather than a real call.
 *
 * IMPORTANT: this returns `false` in production. It is only `true` for
 * sandbox/dev. In production with missing creds it returns `false` so the
 * adapter falls through to its real path, where `requireProductionCreds` (or
 * the adapter's own credential guard) fails closed. Callers that want to fail
 * fast on the missing-creds case should branch on `resolveProviderPosture`
 * directly via `guardProduction`.
 */
export function isStubMode(config: ProviderConfig): boolean {
  return resolveProviderPosture(config) === 'stub';
}

/**
 * Fail-closed guard for adapter entrypoints. Returns:
 *   - `{ stub: true }`             → caller should serve stub data
 *   - `{ stub: false }`            → caller should run the real (live) path
 *   - `{ error }` (Result.error)   → production + missing creds: return this
 *
 * Usage at the top of every adapter method:
 *   const g = guardProduction(config, kind);
 *   if (!g.ok) return g;              // fail closed in prod
 *   if (g.stub) return { ok: true, data: stub... };
 */
export function guardProduction(
  config: ProviderConfig,
  kind: string,
): { ok: true; stub: boolean } | { ok: false; error: ProviderError } {
  const posture = resolveProviderPosture(config);
  if (posture === 'needs_credentials') {
    return { ok: false, error: new CredentialsRequiredError(kind) };
  }
  return { ok: true, stub: posture === 'stub' };
}

/**
 * Timeout-bounded `fetch`. Every outbound provider call MUST go through this —
 * a bare `await fetch(...)` has no timeout and can hang a request forever.
 * Maps an abort into a typed `ProviderTimeoutError` and any other transport
 * failure into a typed `ProviderError('NETWORK')`, so callers never see a raw
 * throw.
 */
export async function fetchWithTimeout(
  kind: string,
  url: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Result<Response>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return { ok: true, data: res };
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      return { ok: false, error: new ProviderTimeoutError(kind, timeoutMs) };
    }
    return { ok: false, error: new ProviderError('NETWORK', String(e), kind) };
  } finally {
    clearTimeout(timer);
  }
}

/** Hash any string to a stable 12-char hex id. */
export function shortHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 12);
}

/** Build a deterministic stub-mode label for ping() responses. */
export function stubAccountLabel(providerName: string): string {
  return `Sandbox · ${providerName}`;
}

export function stubText(prompt: string, modelId: string, costCents = 1): GenerateTextOutput {
  return {
    text: `[stub:${modelId}] ${prompt.slice(0, 220)}`,
    modelId,
    costCents,
    promptHash: shortHash(prompt),
    seed: 42,
    c2paManifestId: `c2pa-stub-${shortHash(prompt).slice(0, 8)}`,
    safetyScanResult: 'pass',
  };
}

export function stubImage(
  prompt: string,
  modelId: string,
  count: number,
  costCents = 4,
): GenerateImageOutput {
  const base = shortHash(prompt);
  return {
    images: Array.from({ length: Math.max(1, count) }, (_, i) => ({
      url: `https://stub.d2d.io/img/${modelId}/${base}-${i}.png`,
      costCents,
      modelId,
      seed: 1000 + i,
      c2paManifestId: `c2pa-stub-${base}-${i}`,
    })),
  };
}

export function stubVideo(prompt: string, etaSec = 90): GenerateVideoOutput {
  const id = shortHash(prompt);
  return {
    jobId: `job_stub_${id}`,
    estimatedReadyAt: new Date(Date.now() + etaSec * 1000).toISOString(),
  };
}

export function stubAvatar(script: string, etaSec = 120): GenerateAvatarOutput {
  const id = shortHash(script);
  return {
    jobId: `job_stub_${id}`,
    estimatedReadyAt: new Date(Date.now() + etaSec * 1000).toISOString(),
  };
}

/** Helper for adapter ping() when running in stub mode. */
export function stubPing(
  providerName: string,
  accountId = 'act_demo',
): {
  accountLabel: string;
  accountId: string;
} {
  return { accountLabel: stubAccountLabel(providerName), accountId };
}

/**
 * Stub-mode job poller — returns `ready` once `STUB_READY_AFTER_MS` (default
 * 30s) has elapsed since the job was created. The marketing service tracks
 * `createdAt` per job in Postgres and forwards `createdAtMs` so the adapter
 * doesn't need to maintain its own state.
 */
export const STUB_READY_AFTER_MS = 30_000 as const;

export function stubJobStatus(
  jobId: string,
  createdAtMs: number | undefined,
  now: number = Date.now(),
): {
  status: 'running' | 'ready';
  output?: { jobId: string; readyAt: string };
} {
  if (createdAtMs === undefined) {
    return { status: 'running' };
  }
  const ageMs = now - createdAtMs;
  if (ageMs >= STUB_READY_AFTER_MS) {
    return {
      status: 'ready',
      output: {
        jobId,
        readyAt: new Date(createdAtMs + STUB_READY_AFTER_MS).toISOString(),
      },
    };
  }
  return { status: 'running' };
}
