/**
 * Higgsfield video adapter.
 *
 * Higgsfield offers a job/poll API for short-form social video generation
 * — particularly strong on motion + camera-control prompts for TikTok/Reels.
 *
 *   POST /v1/jobs               body: { prompt, durationSec, aspectRatio }
 *   GET  /v1/jobs/{id}          → { status: queued|running|ready|failed, url? }
 *   POST /v1/webhooks/verify    HMAC-SHA256 of body with `webhookSecret`
 *
 * Auth: API key in `credentials.apiKey` (header `x-api-key`).
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { InvalidConfigError, ProviderError, SignatureFailError } from '../errors';
import type {
  GenerateVideoInput,
  JobStatus,
  ProviderAdapter,
  ProviderConfig,
  ProviderWebhookEvent,
  Result,
} from '../types';
import { fetchWithTimeout, guardProduction, stubJobStatus, stubPing, stubVideo } from './stub';

const HIGGSFIELD_BASE = 'https://api.higgsfield.ai/v1' as const;
const HIGGSFIELD_TIMEOUT_MS = 30_000 as const;

export function createHiggsfieldAdapter(): ProviderAdapter {
  const kind = 'higgsfield' as const;

  return {
    kind,
    displayName: 'Higgsfield',
    capabilities: ['creative.generate.video'],
    docsUrl: 'https://docs.higgsfield.ai',

    async ping(config) {
      const g = guardProduction(config, kind);
      if (!g.ok) return g;
      if (g.stub) {
        return { ok: true, data: stubPing('Higgsfield', 'hf_demo') };
      }
      const apiKey = config.credentials.apiKey;
      if (!apiKey) {
        return { ok: false, error: new InvalidConfigError(kind, 'apiKey required') };
      }
      const rr = await fetchWithTimeout(kind, `${HIGGSFIELD_BASE}/account`, {
        headers: { 'x-api-key': apiKey },
      });
      if (!rr.ok) return rr;
      const r = rr.data;
      if (!r.ok) {
        return {
          ok: false,
          error: new ProviderError('PROVIDER_5XX', `Higgsfield ping ${r.status}`, kind, r.status),
        };
      }
      const json = (await r.json()) as { id: string; email?: string };
      return {
        ok: true,
        data: { accountLabel: json.email ?? json.id, accountId: json.id },
      };
    },

    async generateVideo(input: GenerateVideoInput, config: ProviderConfig) {
      const g = guardProduction(config, kind);
      if (!g.ok) return g;
      if (g.stub) {
        return { ok: true, data: stubVideo(input.prompt, 120) };
      }
      const apiKey = config.credentials.apiKey;
      if (!apiKey) {
        return { ok: false, error: new InvalidConfigError(kind, 'apiKey required') };
      }
      const rr = await fetchWithTimeout(
        kind,
        `${HIGGSFIELD_BASE}/jobs`,
        {
          method: 'POST',
          headers: { 'x-api-key': apiKey, 'content-type': 'application/json' },
          body: JSON.stringify({
            prompt: input.prompt,
            duration_sec: input.durationSec,
            aspect_ratio: input.aspectRatio,
            style_ref: input.styleRef,
          }),
        },
        HIGGSFIELD_TIMEOUT_MS,
      );
      if (!rr.ok) return rr;
      const r = rr.data;
      if (!r.ok) {
        return {
          ok: false,
          error: new ProviderError('PROVIDER_5XX', `Higgsfield ${r.status}`, kind, r.status),
        };
      }
      const json = (await r.json()) as { id: string; estimated_ready_at?: string };
      return {
        ok: true,
        data: {
          jobId: json.id,
          estimatedReadyAt: json.estimated_ready_at ?? new Date(Date.now() + 120_000).toISOString(),
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
      const rr = await fetchWithTimeout(kind, `${HIGGSFIELD_BASE}/jobs/${jobId}`, {
        headers: { 'x-api-key': apiKey },
      });
      if (!rr.ok) return rr;
      const r = rr.data;
      if (!r.ok) {
        return {
          ok: false,
          error: new ProviderError('PROVIDER_5XX', `Higgsfield ${r.status}`, kind, r.status),
        };
      }
      const json = (await r.json()) as { status: string; url?: string; error?: string };
      // Higgsfield: queued | running | ready | failed
      if (json.status === 'ready') {
        return { ok: true, data: { status: 'ready', output: { url: json.url } } };
      }
      if (json.status === 'failed') {
        return { ok: true, data: { status: 'failed', error: json.error ?? 'unknown' } };
      }
      return { ok: true, data: { status: 'running' } };
    },

    async parseWebhook(rawBody, headers, config): Promise<Result<ProviderWebhookEvent>> {
      const secret = config.webhookSecret;
      if (!secret) {
        return { ok: false, error: new InvalidConfigError(kind, 'webhookSecret missing') };
      }
      const sigHeader = headers['x-higgsfield-signature'];
      const provided = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
      if (typeof provided !== 'string') {
        return { ok: false, error: new SignatureFailError(kind) };
      }
      const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
      const a = Buffer.from(provided);
      const b = Buffer.from(expected);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return { ok: false, error: new SignatureFailError(kind) };
      }
      try {
        const parsed = JSON.parse(rawBody.toString('utf8')) as {
          job_id: string;
          status: string;
          ready_at?: string;
          url?: string;
        };
        return {
          ok: true,
          data: {
            type: `higgsfield.video.${parsed.status}`,
            externalId: parsed.job_id,
            occurredAt: parsed.ready_at ?? new Date().toISOString(),
            payload: parsed as unknown as Record<string, unknown>,
          },
        };
      } catch (e) {
        return { ok: false, error: new ProviderError('INVALID_INPUT', String(e), kind) };
      }
    },
  };
}
