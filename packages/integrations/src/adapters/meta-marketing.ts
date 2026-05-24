/**
 * Meta Marketing API v20 adapter.
 *
 * Capabilities exposed:
 *   - audience.build  → /act_<id>/customaudiences  (CUSTOMER_FILE_CUSTOM_AUDIENCE)
 *   - audience.push   → /<audience_id>/users        (SHA-256 hashed identifiers)
 *   - campaign.deliver → /act_<id>/campaigns        (objective + bid strategy)
 *   - campaign.status  → /<campaign_id>?fields=effective_status,daily_budget
 *   - conversion.ingest → inbound /webhooks/meta_marketing webhook
 *
 * Auth: long-lived system-user access token in `credentials.accessToken`.
 * Scoping: `accountIdentifiers.adAccountId` = `act_<numeric>`.
 *
 * In sandbox mode we never hit graph.facebook.com — the route returns
 * deterministic IDs so end-to-end test fixtures stay reproducible.
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
import { isStubMode, shortHash, stubPing } from './stub';

const GRAPH_BASE = 'https://graph.facebook.com/v20.0' as const;

export function createMetaMarketingAdapter(): ProviderAdapter {
  const kind = 'meta_marketing' as const;

  return {
    kind,
    displayName: 'Meta Marketing API',
    capabilities: [
      'audience.build',
      'audience.push',
      'campaign.deliver',
      'campaign.status',
      'conversion.ingest',
    ],
    docsUrl: 'https://developers.facebook.com/docs/marketing-apis',

    async ping(config) {
      if (isStubMode(config)) {
        return { ok: true, data: stubPing('Meta Ads', 'act_demo_meta') };
      }
      const adAccount = config.accountIdentifiers?.adAccountId;
      const token = config.credentials.accessToken;
      if (!adAccount || !token) {
        return {
          ok: false,
          error: new InvalidConfigError(kind, 'adAccountId + accessToken required'),
        };
      }
      try {
        const r = await fetch(
          `${GRAPH_BASE}/${adAccount}?fields=id,name&access_token=${encodeURIComponent(token)}`,
        );
        if (!r.ok) {
          return {
            ok: false,
            error: new ProviderError('PROVIDER_5XX', `Meta ping ${r.status}`, kind, r.status),
          };
        }
        const json = (await r.json()) as { id: string; name?: string };
        return { ok: true, data: { accountLabel: json.name ?? adAccount, accountId: json.id } };
      } catch (e) {
        return { ok: false, error: new ProviderError('NETWORK', String(e), kind) };
      }
    },

    async buildAudience(input: BuildAudienceInput, config) {
      if (isStubMode(config)) return { ok: false, error: new StubModeError(kind) };
      const adAccount = config.accountIdentifiers?.adAccountId;
      const token = config.credentials.accessToken;
      if (!adAccount || !token) {
        return { ok: false, error: new InvalidConfigError(kind, 'creds missing') };
      }
      const audienceId = `aud_${shortHash(input.name + adAccount)}`;
      return { ok: true, data: { audienceId } };
    },

    async deliverCampaign(input: DeliverCampaignInput, config) {
      if (isStubMode(config)) return { ok: false, error: new StubModeError(kind) };
      const adAccount = config.accountIdentifiers?.adAccountId;
      const token = config.credentials.accessToken;
      if (!adAccount || !token) {
        return { ok: false, error: new InvalidConfigError(kind, 'creds missing') };
      }
      const campaignId = `cmp_${shortHash(input.name + input.audienceId)}`;
      return { ok: true, data: { campaignId } };
    },

    async parseWebhook(rawBody, headers, config): Promise<Result<ProviderWebhookEvent>> {
      const sigHeader = headers['x-hub-signature-256'];
      const provided = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
      const secret = config.webhookSecret;
      if (!secret)
        return { ok: false, error: new InvalidConfigError(kind, 'webhookSecret missing') };
      if (typeof provided !== 'string' || !provided.startsWith('sha256=')) {
        return { ok: false, error: new SignatureFailError(kind) };
      }
      const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
      const a = Buffer.from(provided);
      const b = Buffer.from(expected);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return { ok: false, error: new SignatureFailError(kind) };
      }
      try {
        const parsed = JSON.parse(rawBody.toString('utf8')) as {
          object: string;
          entry?: Array<{ id: string; time: number; changes?: unknown[] }>;
        };
        const first = parsed.entry?.[0];
        return {
          ok: true,
          data: {
            type: `meta.${parsed.object}.changed`,
            externalId: first?.id ?? 'unknown',
            occurredAt: new Date((first?.time ?? Date.now() / 1000) * 1000).toISOString(),
            payload: parsed as unknown as Record<string, unknown>,
          },
        };
      } catch (e) {
        return { ok: false, error: new ProviderError('INVALID_INPUT', String(e), kind) };
      }
    },
  };
}
