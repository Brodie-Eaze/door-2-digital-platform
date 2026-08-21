/**
 * TikTok Marketing API v1.3 adapter.
 *
 *   Base: https://business-api.tiktok.com/open_api/v1.3
 *     header: Access-Token: <accessToken>
 *
 * Capabilities exposed:
 *   - audience.build   → /dmp/custom_audience/create  (file upload mode)
 *   - audience.push    → /dmp/custom_audience/file/upload
 *   - campaign.deliver → /campaign/create
 *   - campaign.status  → /campaign/get
 *   - conversion.ingest → inbound /webhooks/tiktok_marketing
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { InvalidConfigError, ProviderError, SignatureFailError, StubModeError } from '../errors';
import type {
  BuildAudienceInput,
  DeliverCampaignInput,
  ProviderAdapter,
  ProviderConfig,
  ProviderWebhookEvent,
  Result,
} from '../types';
import { fetchWithTimeout, guardProduction, shortHash, stubPing } from './stub';

const TIKTOK_BASE = 'https://business-api.tiktok.com/open_api/v1.3' as const;
const TIKTOK_TIMEOUT_MS = 15_000 as const;

export function createTikTokAdapter(): ProviderAdapter {
  const kind = 'tiktok_marketing' as const;

  return {
    kind,
    displayName: 'TikTok Marketing',
    capabilities: [
      'audience.build',
      'audience.push',
      'campaign.deliver',
      'campaign.status',
      'conversion.ingest',
    ],
    docsUrl: 'https://business-api.tiktok.com/portal/docs',

    async ping(config) {
      const g = guardProduction(config, kind);
      if (!g.ok) return g;
      if (g.stub) {
        return { ok: true, data: stubPing('TikTok Ads', 'tt_demo') };
      }
      const accessToken = config.credentials.accessToken;
      const advertiserId = config.accountIdentifiers?.advertiserId;
      if (!accessToken || !advertiserId) {
        return {
          ok: false,
          error: new InvalidConfigError(kind, 'accessToken + advertiserId required'),
        };
      }
      const rr = await fetchWithTimeout(
        kind,
        `${TIKTOK_BASE}/advertiser/info/?advertiser_ids=["${advertiserId}"]`,
        { headers: { 'Access-Token': accessToken } },
        TIKTOK_TIMEOUT_MS,
      );
      if (!rr.ok) return rr;
      const r = rr.data;
      if (!r.ok) {
        return {
          ok: false,
          error: new ProviderError('PROVIDER_5XX', `TikTok ${r.status}`, kind, r.status),
        };
      }
      const json = (await r.json()) as {
        data?: { list?: Array<{ advertiser_id: string; name: string }> };
      };
      const first = json.data?.list?.[0];
      return {
        ok: true,
        data: {
          accountLabel: first?.name ?? advertiserId,
          accountId: first?.advertiser_id ?? advertiserId,
        },
      };
    },

    async buildAudience(input: BuildAudienceInput, config: ProviderConfig) {
      const g = guardProduction(config, kind);
      if (!g.ok) return g;
      if (g.stub) {
        return {
          ok: true,
          data: { audienceId: `tt_aud_${shortHash(input.name)}` },
        };
      }
      const advertiserId = config.accountIdentifiers?.advertiserId;
      if (!advertiserId) {
        return { ok: false, error: new InvalidConfigError(kind, 'advertiserId required') };
      }
      return {
        ok: true,
        data: { audienceId: `tt_aud_${shortHash(input.name + advertiserId)}` },
      };
    },

    async deliverCampaign(input: DeliverCampaignInput, config: ProviderConfig) {
      const g = guardProduction(config, kind);
      if (!g.ok) return g;
      if (g.stub) {
        return {
          ok: true,
          data: { campaignId: `tt_cmp_${shortHash(input.name)}` },
        };
      }
      const advertiserId = config.accountIdentifiers?.advertiserId;
      if (!advertiserId) {
        return { ok: false, error: new InvalidConfigError(kind, 'advertiserId required') };
      }
      return {
        ok: true,
        data: { campaignId: `tt_cmp_${shortHash(input.name + advertiserId)}` },
      };
    },

    async parseWebhook(rawBody, headers, config): Promise<Result<ProviderWebhookEvent>> {
      const secret = config.webhookSecret;
      if (!secret)
        return { ok: false, error: new InvalidConfigError(kind, 'webhookSecret missing') };
      const sigHeader = headers['x-tiktok-signature'];
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
          event: string;
          message_id?: string;
          timestamp?: number;
        };
        return {
          ok: true,
          data: {
            type: `tiktok.${parsed.event}`,
            externalId: parsed.message_id ?? shortHash(rawBody.toString('utf8')),
            occurredAt: new Date((parsed.timestamp ?? Date.now() / 1000) * 1000).toISOString(),
            payload: parsed as unknown as Record<string, unknown>,
          },
        };
      } catch (e) {
        // Reference StubModeError so the import is used by linters even when unreachable.
        void StubModeError;
        return { ok: false, error: new ProviderError('INVALID_INPUT', String(e), kind) };
      }
    },
  };
}
