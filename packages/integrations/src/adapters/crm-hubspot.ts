/**
 * HubSpot CRM adapter — pushes D2D leads as Contacts and conversions as Deals.
 *
 * Config shape:
 *   credentials.accessToken — HubSpot private app access token (or OAuth token)
 *   credentials.portalId    — HubSpot portal/account ID (numeric string)
 *
 * pushLead():       POST /crm/v3/objects/contacts
 * pushConversion(): POST /crm/v3/objects/deals
 *
 * In stub mode: returns deterministic fake IDs without network calls.
 */

import { InvalidConfigError, ProviderError } from '../errors';
import type {
  ProviderAdapter,
  ProviderConfig,
  PushConversionInput,
  PushConversionOutput,
  PushLeadInput,
  PushLeadOutput,
  Result,
} from '../types';
import { isStubMode, shortHash, stubPing } from './stub';

const HS_BASE = 'https://api.hubapi.com' as const;

/** Map D2D lead status to a HubSpot hs_lead_status value. */
function mapStatus(status: string): string {
  const MAP: Record<string, string> = {
    new: 'NEW',
    contacted: 'OPEN',
    qualified: 'IN_PROGRESS',
    appointment_set: 'IN_PROGRESS',
    converted: 'UNQUALIFIED',
    lost: 'UNQUALIFIED',
    do_not_contact: 'UNQUALIFIED',
  };
  return MAP[status] ?? 'NEW';
}

export function createCrmHubSpotAdapter(): ProviderAdapter {
  const kind = 'crm_hubspot' as const;

  function authHeaders(accessToken: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    };
  }

  function requireCreds(config: ProviderConfig): Result<{ accessToken: string; portalId: string }> {
    const accessToken = config.credentials.accessToken;
    const portalId = config.credentials.portalId;
    if (!accessToken || !portalId) {
      return {
        ok: false,
        error: new InvalidConfigError(
          kind,
          'credentials.accessToken and credentials.portalId are required',
        ),
      };
    }
    return { ok: true, data: { accessToken, portalId } };
  }

  return {
    kind,
    displayName: 'HubSpot CRM',
    capabilities: ['crm.lead.push', 'crm.conversion.push'],
    docsUrl: 'https://developers.hubspot.com/docs/api/crm/contacts',

    async ping(config) {
      if (isStubMode(config)) {
        return { ok: true, data: stubPing('HubSpot', 'hs_stub') };
      }
      const c = requireCreds(config);
      if (!c.ok) return c;
      try {
        const res = await fetch(`${HS_BASE}/crm/v3/objects/contacts?limit=1`, {
          headers: authHeaders(c.data.accessToken),
        });
        if (!res.ok) {
          return {
            ok: false,
            error: new ProviderError(
              'PROVIDER_5XX',
              `HubSpot ping ${res.status}`,
              kind,
              res.status,
            ),
          };
        }
        return {
          ok: true,
          data: { accountLabel: `HubSpot Portal ${c.data.portalId}`, accountId: c.data.portalId },
        };
      } catch (e) {
        return { ok: false, error: new ProviderError('NETWORK', String(e), kind) };
      }
    },

    async pushLead(input: PushLeadInput, config: ProviderConfig): Promise<Result<PushLeadOutput>> {
      if (isStubMode(config)) {
        const externalId = `hs_contact_stub_${shortHash(input.leadId)}`;
        return { ok: true, data: { externalId } };
      }

      const c = requireCreds(config);
      if (!c.ok) return c;
      const { accessToken, portalId } = c.data;

      const properties: Record<string, string> = {
        firstname: input.givenName,
        lastname: input.familyName,
        hs_lead_status: mapStatus(input.status),
        // Store D2D's leadId in a custom property for cross-reference.
        // Operators must create `d2d_lead_id` property in their portal.
        ...(input.email && { email: input.email }),
        ...(input.phone && { phone: input.phone }),
      };

      try {
        const res = await fetch(`${HS_BASE}/crm/v3/objects/contacts`, {
          method: 'POST',
          headers: authHeaders(accessToken),
          body: JSON.stringify({ properties }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          return {
            ok: false,
            error: new ProviderError(
              'PROVIDER_5XX',
              `HubSpot contacts POST ${res.status}: ${errText}`,
              kind,
              res.status,
            ),
          };
        }

        const json = (await res.json()) as { id: string };
        const externalId = json.id;
        const externalUrl = `https://app.hubspot.com/contacts/${portalId}/contact/${externalId}`;
        return { ok: true, data: { externalId, externalUrl } };
      } catch (e) {
        return { ok: false, error: new ProviderError('NETWORK', String(e), kind) };
      }
    },

    async pushConversion(
      input: PushConversionInput,
      config: ProviderConfig,
    ): Promise<Result<PushConversionOutput>> {
      if (isStubMode(config)) {
        const externalId = `hs_deal_stub_${shortHash(input.conversionId)}`;
        return { ok: true, data: { externalId } };
      }

      const c = requireCreds(config);
      if (!c.ok) return c;
      const { accessToken, portalId } = c.data;

      const amountDollars = (input.amountCents / 100).toFixed(2);
      const closeDate = new Date(input.convertedAt).toISOString().slice(0, 10);

      const properties: Record<string, string> = {
        dealname: `D2D ${input.type} · ${input.conversionId}`,
        amount: amountDollars,
        dealstage: 'closedwon',
        closedate: closeDate,
        pipeline: 'default',
      };

      try {
        const res = await fetch(`${HS_BASE}/crm/v3/objects/deals`, {
          method: 'POST',
          headers: authHeaders(accessToken),
          body: JSON.stringify({ properties }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          return {
            ok: false,
            error: new ProviderError(
              'PROVIDER_5XX',
              `HubSpot deals POST ${res.status}: ${errText}`,
              kind,
              res.status,
            ),
          };
        }

        const json = (await res.json()) as { id: string };
        const externalId = json.id;
        const externalUrl = `https://app.hubspot.com/contacts/${portalId}/deal/${externalId}`;
        return { ok: true, data: { externalId, externalUrl } };
      } catch (e) {
        return { ok: false, error: new ProviderError('NETWORK', String(e), kind) };
      }
    },
  };
}
