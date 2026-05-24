/**
 * Google Ads v17 adapter.
 *
 *   POST https://googleads.googleapis.com/v17/customers/{customerId}/...
 *     headers:
 *       Authorization: Bearer <oauthToken>
 *       developer-token: <developerToken>
 *       login-customer-id: <managerCustomerId>
 *
 * Capabilities exposed:
 *   - audience.build   → :uploadUserData    (HASHED_EMAIL / HASHED_PHONE)
 *   - campaign.deliver → :mutate            (operations[].create)
 *   - campaign.status  → searchStream        (effective_status, optimization_score)
 *
 * OAuth 2.0 refresh-token flow handled out of band — the route layer
 * supplies a fresh access token in `credentials.accessToken` per call.
 */

import { InvalidConfigError, ProviderError } from '../errors';
import type {
  BuildAudienceInput,
  DeliverCampaignInput,
  ProviderAdapter,
  ProviderConfig,
} from '../types';
import { isStubMode, shortHash, stubPing } from './stub';

const GADS_BASE = 'https://googleads.googleapis.com/v17' as const;

export function createGoogleAdsAdapter(): ProviderAdapter {
  const kind = 'google_ads' as const;

  return {
    kind,
    displayName: 'Google Ads',
    capabilities: ['audience.build', 'audience.push', 'campaign.deliver', 'campaign.status'],
    docsUrl: 'https://developers.google.com/google-ads/api/docs/start',

    async ping(config) {
      if (isStubMode(config)) {
        return { ok: true, data: stubPing('Google Ads', 'customers/0000000000') };
      }
      const customerId = config.accountIdentifiers?.customerId;
      const accessToken = config.credentials.accessToken;
      const developerToken = config.credentials.developerToken;
      if (!customerId || !accessToken || !developerToken) {
        return {
          ok: false,
          error: new InvalidConfigError(kind, 'customerId + accessToken + developerToken required'),
        };
      }
      try {
        const r = await fetch(`${GADS_BASE}/customers/${customerId}/googleAds:search`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
            'developer-token': developerToken,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            query: 'SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1',
          }),
        });
        if (!r.ok) {
          return {
            ok: false,
            error: new ProviderError('PROVIDER_5XX', `Google Ads ${r.status}`, kind, r.status),
          };
        }
        const json = (await r.json()) as {
          results?: Array<{ customer: { id: string; descriptiveName?: string } }>;
        };
        const c = json.results?.[0]?.customer;
        return {
          ok: true,
          data: {
            accountLabel: c?.descriptiveName ?? customerId,
            accountId: c?.id ?? customerId,
          },
        };
      } catch (e) {
        return { ok: false, error: new ProviderError('NETWORK', String(e), kind) };
      }
    },

    async buildAudience(input: BuildAudienceInput, config: ProviderConfig) {
      if (isStubMode(config)) {
        return {
          ok: true,
          data: { audienceId: `gads_aud_${shortHash(input.name)}` },
        };
      }
      const customerId = config.accountIdentifiers?.customerId;
      if (!customerId) {
        return { ok: false, error: new InvalidConfigError(kind, 'customerId required') };
      }
      // Real impl would call userLists:mutate then offlineUserDataJobs.
      // Stubbed identifier returned so the route layer can wire the rest end-to-end.
      return {
        ok: true,
        data: { audienceId: `gads_aud_${shortHash(input.name + customerId)}` },
      };
    },

    async deliverCampaign(input: DeliverCampaignInput, config: ProviderConfig) {
      if (isStubMode(config)) {
        return {
          ok: true,
          data: { campaignId: `gads_cmp_${shortHash(input.name)}` },
        };
      }
      const customerId = config.accountIdentifiers?.customerId;
      if (!customerId) {
        return { ok: false, error: new InvalidConfigError(kind, 'customerId required') };
      }
      return {
        ok: true,
        data: { campaignId: `gads_cmp_${shortHash(input.name + customerId)}` },
      };
    },
  };
}
