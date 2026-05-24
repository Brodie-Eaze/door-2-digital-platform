/**
 * Generic stub adapter — returns deterministic placeholder data without
 * touching the network. Used as a building block by every real adapter
 * when `config.mode === 'sandbox'` or no credentials are present.
 *
 * Adapters never use this directly as their `kind`; they call its helpers
 * to produce consistent stub responses (matching IDs, costs, hashes).
 */

import { createHash } from 'node:crypto';
import type {
  GenerateAvatarOutput,
  GenerateImageOutput,
  GenerateTextOutput,
  GenerateVideoOutput,
  ProviderConfig,
} from '../types';

/** True when the adapter should produce a stub response rather than a real call. */
export function isStubMode(config: ProviderConfig): boolean {
  if (config.mode === 'sandbox') return true;
  if (!config.credentials || Object.keys(config.credentials).length === 0) return true;
  // Empty-string credentials count as missing.
  const anyReal = Object.values(config.credentials).some((v) => v && v.length > 4);
  return !anyReal;
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
