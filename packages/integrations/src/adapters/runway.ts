/**
 * Runway Gen-3 video adapter — b-roll, scene fills, motion shots.
 *
 *   POST https://api.dev.runwayml.com/v1/image_to_video
 *     headers: Authorization: Bearer <apiKey>, X-Runway-Version: 2024-11-06
 *
 * Runway is strict async — we always get back a task id and poll
 * `GET /v1/tasks/{id}` until status is `SUCCEEDED` (or `FAILED`).
 * This adapter records the task id as `jobId` and returns; the workers
 * domain polls.
 */

import { InvalidConfigError, ProviderError } from '../errors';
import type {
  GenerateVideoInput,
  GenerateVideoOutput,
  JobStatus,
  ProviderAdapter,
  ProviderConfig,
  Result,
} from '../types';
import { isStubMode, stubJobStatus, stubPing, stubVideo } from './stub';

const RUNWAY_BASE = 'https://api.dev.runwayml.com/v1' as const;
const RUNWAY_VERSION = '2024-11-06' as const;

export function createRunwayAdapter(): ProviderAdapter {
  const kind = 'runway_video' as const;

  return {
    kind,
    displayName: 'Runway Gen-3',
    capabilities: ['creative.generate.video'],
    docsUrl: 'https://docs.dev.runwayml.com',

    async ping(config) {
      if (isStubMode(config)) {
        return { ok: true, data: stubPing('Runway Gen-3', 'rw_demo') };
      }
      const apiKey = config.credentials.apiKey;
      if (!apiKey) {
        return { ok: false, error: new InvalidConfigError(kind, 'apiKey required') };
      }
      try {
        // Use organization endpoint to verify credentials.
        const r = await fetch(`${RUNWAY_BASE}/organization`, {
          headers: { authorization: `Bearer ${apiKey}`, 'x-runway-version': RUNWAY_VERSION },
        });
        if (!r.ok) {
          return {
            ok: false,
            error: new ProviderError('PROVIDER_5XX', `Runway ${r.status}`, kind, r.status),
          };
        }
        const json = (await r.json()) as { id: string; name?: string };
        return {
          ok: true,
          data: { accountLabel: json.name ?? json.id, accountId: json.id },
        };
      } catch (e) {
        return { ok: false, error: new ProviderError('NETWORK', String(e), kind) };
      }
    },

    async generateVideo(
      input: GenerateVideoInput,
      config: ProviderConfig,
    ): Promise<Result<GenerateVideoOutput>> {
      if (isStubMode(config)) {
        return { ok: true, data: stubVideo(input.prompt, 180) };
      }
      const apiKey = config.credentials.apiKey;
      if (!apiKey) {
        return { ok: false, error: new InvalidConfigError(kind, 'apiKey required') };
      }
      try {
        const r = await fetch(`${RUNWAY_BASE}/image_to_video`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'x-runway-version': RUNWAY_VERSION,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gen3a_turbo',
            prompt_text: input.prompt,
            duration: input.durationSec,
            ratio:
              input.aspectRatio === '16:9'
                ? '1280:768'
                : input.aspectRatio === '9:16'
                  ? '768:1280'
                  : '1024:1024',
          }),
        });
        if (!r.ok) {
          return {
            ok: false,
            error: new ProviderError('PROVIDER_5XX', `Runway ${r.status}`, kind, r.status),
          };
        }
        const json = (await r.json()) as { id: string };
        return {
          ok: true,
          data: {
            jobId: json.id,
            estimatedReadyAt: new Date(Date.now() + input.durationSec * 20_000).toISOString(),
          },
        };
      } catch (e) {
        return { ok: false, error: new ProviderError('NETWORK', String(e), kind) };
      }
    },

    async pollJob(
      jobId: string,
      config: ProviderConfig,
      createdAtMs?: number,
    ): Promise<Result<JobStatus>> {
      if (isStubMode(config)) {
        const s = stubJobStatus(jobId, createdAtMs);
        return { ok: true, data: s };
      }
      const apiKey = config.credentials.apiKey;
      if (!apiKey) {
        return { ok: false, error: new InvalidConfigError(kind, 'apiKey required') };
      }
      try {
        const r = await fetch(`${RUNWAY_BASE}/tasks/${jobId}`, {
          headers: { authorization: `Bearer ${apiKey}`, 'x-runway-version': RUNWAY_VERSION },
        });
        if (!r.ok) {
          return {
            ok: false,
            error: new ProviderError('PROVIDER_5XX', `Runway ${r.status}`, kind, r.status),
          };
        }
        const json = (await r.json()) as {
          status: string;
          output?: unknown;
          failure?: string;
        };
        // Runway: PENDING | RUNNING | SUCCEEDED | FAILED | THROTTLED | CANCELLED
        const upper = json.status?.toUpperCase?.();
        if (upper === 'SUCCEEDED') {
          return { ok: true, data: { status: 'ready', output: json.output } };
        }
        if (upper === 'FAILED' || upper === 'CANCELLED') {
          return {
            ok: true,
            data: { status: 'failed', error: json.failure ?? json.status },
          };
        }
        return { ok: true, data: { status: 'running' } };
      } catch (e) {
        return { ok: false, error: new ProviderError('NETWORK', String(e), kind) };
      }
    },
  };
}
