/**
 * HeyGen — AI avatar UGC.
 *
 *   POST https://api.heygen.com/v2/video/generate
 *     header: X-Api-Key: <apiKey>
 *     body:   { video_inputs: [{ character, voice, background }], dimension }
 *
 * Always async — returns `data.video_id`. Caller polls
 * `GET /v1/video_status.get?video_id=<id>`. We stage that polling inside
 * `apps/api/src/workers/content-generate.worker.ts`.
 *
 * Use case in D2D: brand-safe avatar saying the canvasser's elevator pitch
 * — replayed back to retargeting viewers who already met a knocker in real
 * life. Trust transfer from doorstep → re-ad → conversion.
 */

import { InvalidConfigError, ProviderError } from '../errors';
import type {
  GenerateAvatarInput,
  GenerateAvatarOutput,
  JobStatus,
  ProviderAdapter,
  ProviderConfig,
  Result,
} from '../types';
import { fetchWithTimeout, guardProduction, stubAvatar, stubJobStatus, stubPing } from './stub';

const HEYGEN_BASE_V2 = 'https://api.heygen.com/v2' as const;
const HEYGEN_BASE_V1 = 'https://api.heygen.com/v1' as const;
const HEYGEN_TIMEOUT_MS = 30_000 as const;

export function createHeyGenAdapter(): ProviderAdapter {
  const kind = 'heygen_avatar' as const;

  return {
    kind,
    displayName: 'HeyGen',
    capabilities: ['creative.generate.avatar'],
    docsUrl: 'https://docs.heygen.com',

    async ping(config) {
      const g = guardProduction(config, kind);
      if (!g.ok) return g;
      if (g.stub) {
        return { ok: true, data: stubPing('HeyGen', 'hg_demo') };
      }
      const apiKey = config.credentials.apiKey;
      if (!apiKey) {
        return { ok: false, error: new InvalidConfigError(kind, 'apiKey required') };
      }
      const rr = await fetchWithTimeout(kind, `${HEYGEN_BASE_V1}/user/remaining_quota`, {
        headers: { 'x-api-key': apiKey },
      });
      if (!rr.ok) return rr;
      const r = rr.data;
      if (!r.ok) {
        return {
          ok: false,
          error: new ProviderError('PROVIDER_5XX', `HeyGen ${r.status}`, kind, r.status),
        };
      }
      const json = (await r.json()) as { data?: { remaining_quota?: number } };
      const remaining = json.data?.remaining_quota ?? 0;
      return {
        ok: true,
        data: { accountLabel: `HeyGen (quota ${remaining})`, accountId: 'hg' },
      };
    },

    async generateAvatar(
      input: GenerateAvatarInput,
      config: ProviderConfig,
    ): Promise<Result<GenerateAvatarOutput>> {
      const g = guardProduction(config, kind);
      if (!g.ok) return g;
      if (g.stub) {
        return { ok: true, data: stubAvatar(input.script, 150) };
      }
      const apiKey = config.credentials.apiKey;
      if (!apiKey) {
        return { ok: false, error: new InvalidConfigError(kind, 'apiKey required') };
      }
      const rr = await fetchWithTimeout(
        kind,
        `${HEYGEN_BASE_V2}/video/generate`,
        {
          method: 'POST',
          headers: { 'x-api-key': apiKey, 'content-type': 'application/json' },
          body: JSON.stringify({
            video_inputs: [
              {
                character: { type: 'avatar', avatar_id: input.avatarId },
                voice: { type: 'text', input_text: input.script, voice_id: input.voiceId },
                background: input.background
                  ? { type: 'color', value: input.background }
                  : { type: 'color', value: '#ffffff' },
              },
            ],
            dimension: { width: 1280, height: 720 },
          }),
        },
        HEYGEN_TIMEOUT_MS,
      );
      if (!rr.ok) return rr;
      const r = rr.data;
      if (!r.ok) {
        return {
          ok: false,
          error: new ProviderError('PROVIDER_5XX', `HeyGen ${r.status}`, kind, r.status),
        };
      }
      const json = (await r.json()) as { data: { video_id: string } };
      return {
        ok: true,
        data: {
          jobId: json.data.video_id,
          estimatedReadyAt: new Date(Date.now() + 150_000).toISOString(),
        },
      };
    },

    async pollJob(
      jobId: string,
      config: ProviderConfig,
      createdAtMs?: number,
    ): Promise<Result<JobStatus>> {
      const g = guardProduction(config, kind);
      if (!g.ok) return g;
      if (g.stub) {
        const s = stubJobStatus(jobId, createdAtMs);
        return { ok: true, data: s };
      }
      const apiKey = config.credentials.apiKey;
      if (!apiKey) {
        return { ok: false, error: new InvalidConfigError(kind, 'apiKey required') };
      }
      const rr = await fetchWithTimeout(
        kind,
        `${HEYGEN_BASE_V1}/video_status.get?video_id=${encodeURIComponent(jobId)}`,
        { headers: { 'x-api-key': apiKey } },
      );
      if (!rr.ok) return rr;
      const r = rr.data;
      if (!r.ok) {
        return {
          ok: false,
          error: new ProviderError('PROVIDER_5XX', `HeyGen ${r.status}`, kind, r.status),
        };
      }
      const json = (await r.json()) as {
        data?: { status?: string; video_url?: string; error?: { message?: string } };
      };
      const st = json.data?.status;
      // HeyGen: pending | processing | completed | failed
      if (st === 'completed') {
        return {
          ok: true,
          data: { status: 'ready', output: { url: json.data?.video_url } },
        };
      }
      if (st === 'failed') {
        return {
          ok: true,
          data: { status: 'failed', error: json.data?.error?.message ?? 'unknown' },
        };
      }
      return { ok: true, data: { status: 'running' } };
    },
  };
}
