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
import { InvalidConfigError, ProviderError, SignatureFailError, StubModeError } from '../errors';
import type {
  GenerateVideoInput,
  ProviderAdapter,
  ProviderConfig,
  ProviderWebhookEvent,
  Result,
} from '../types';
import { isStubMode, stubPing, stubVideo } from './stub';

const HIGGSFIELD_BASE = 'https://api.higgsfield.ai/v1' as const;

export function createHiggsfieldAdapter(): ProviderAdapter {
  const kind = 'higgsfield' as const;

  return {
    kind,
    displayName: 'Higgsfield',
    capabilities: ['creative.generate.video'],
    docsUrl: 'https://docs.higgsfield.ai',

    async ping(config) {
      if (isStubMode(config)) {
        return { ok: true, data: stubPing('Higgsfield', 'hf_demo') };
      }
      const apiKey = config.credentials.apiKey;
      if (!apiKey) {
        return { ok: false, error: new InvalidConfigError(kind, 'apiKey required') };
      }
      try {
        const r = await fetch(`${HIGGSFIELD_BASE}/account`, {
          headers: { 'x-api-key': apiKey },
        });
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
      } catch (e) {
        return { ok: false, error: new ProviderError('NETWORK', String(e), kind) };
      }
    },

    async generateVideo(input: GenerateVideoInput, config: ProviderConfig) {
      if (isStubMode(config)) {
        return { ok: true, data: stubVideo(input.prompt, 120) };
      }
      const apiKey = config.credentials.apiKey;
      if (!apiKey) {
        return { ok: false, error: new InvalidConfigError(kind, 'apiKey required') };
      }
      try {
        const r = await fetch(`${HIGGSFIELD_BASE}/jobs`, {
          method: 'POST',
          headers: { 'x-api-key': apiKey, 'content-type': 'application/json' },
          body: JSON.stringify({
            prompt: input.prompt,
            duration_sec: input.durationSec,
            aspect_ratio: input.aspectRatio,
            style_ref: input.styleRef,
          }),
        });
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
            estimatedReadyAt:
              json.estimated_ready_at ?? new Date(Date.now() + 120_000).toISOString(),
          },
        };
      } catch (e) {
        return { ok: false, error: new ProviderError('NETWORK', String(e), kind) };
      }
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
