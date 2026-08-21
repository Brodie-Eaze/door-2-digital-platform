/**
 * Salesforce REST API adapter — pushes D2D leads as Lead sObjects and
 * conversions as Opportunity sObjects.
 *
 * Config shape:
 *   credentials.instanceUrl  — e.g. https://yourorg.salesforce.com
 *   credentials.accessToken  — OAuth bearer token (user manages OAuth flow;
 *                              token stored encrypted in PII vault)
 *
 * pushLead():       POST /services/data/v59.0/sobjects/Lead
 * pushConversion(): POST /services/data/v59.0/sobjects/Opportunity
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
import { fetchWithTimeout, guardProduction, shortHash, stubPing } from './stub';

const SF_API_VERSION = 'v59.0' as const;
const SF_TIMEOUT_MS = 10_000 as const;

export function createCrmSalesforceAdapter(): ProviderAdapter {
  const kind = 'crm_salesforce' as const;

  function requireCreds(
    config: ProviderConfig,
  ): Result<{ instanceUrl: string; accessToken: string }> {
    const instanceUrl = (config.credentials.instanceUrl ?? '').replace(/\/$/, '');
    const accessToken = config.credentials.accessToken;
    if (!instanceUrl || !accessToken) {
      return {
        ok: false,
        error: new InvalidConfigError(
          kind,
          'credentials.instanceUrl and credentials.accessToken are required',
        ),
      };
    }
    return { ok: true, data: { instanceUrl, accessToken } };
  }

  function authHeaders(accessToken: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    };
  }

  function sfUrl(instanceUrl: string, sobject: string): string {
    return `${instanceUrl}/services/data/${SF_API_VERSION}/sobjects/${sobject}`;
  }

  return {
    kind,
    displayName: 'Salesforce CRM',
    capabilities: ['crm.lead.push', 'crm.conversion.push'],
    docsUrl: 'https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/',

    async ping(config) {
      const g = guardProduction(config, kind);
      if (!g.ok) return g;
      if (g.stub) {
        return { ok: true, data: stubPing('Salesforce', 'sf_stub') };
      }
      const c = requireCreds(config);
      if (!c.ok) return c;
      const r = await fetchWithTimeout(
        kind,
        `${c.data.instanceUrl}/services/data/${SF_API_VERSION}/`,
        { headers: authHeaders(c.data.accessToken) },
        SF_TIMEOUT_MS,
      );
      if (!r.ok) return r;
      const res = r.data;
      if (!res.ok) {
        return {
          ok: false,
          error: new ProviderError(
            'PROVIDER_5XX',
            `Salesforce ping ${res.status}`,
            kind,
            res.status,
          ),
        };
      }
      const host = new URL(c.data.instanceUrl).hostname;
      return {
        ok: true,
        data: { accountLabel: `Salesforce · ${host}`, accountId: host },
      };
    },

    async pushLead(input: PushLeadInput, config: ProviderConfig): Promise<Result<PushLeadOutput>> {
      const g = guardProduction(config, kind);
      if (!g.ok) return g;
      if (g.stub) {
        const externalId = `sf_lead_stub_${shortHash(input.leadId)}`;
        return { ok: true, data: { externalId } };
      }

      const c = requireCreds(config);
      if (!c.ok) return c;
      const { instanceUrl, accessToken } = c.data;

      const body: Record<string, string> = {
        FirstName: input.givenName,
        LastName: input.familyName,
        Status: 'New',
        LeadSource: 'Door to Door',
        // Salesforce Lead requires Company — use a sentinel for D2D generated leads.
        Company: 'D2D Lead',
        ...(input.email && { Email: input.email }),
        ...(input.phone && { Phone: input.phone }),
      };

      const r = await fetchWithTimeout(
        kind,
        sfUrl(instanceUrl, 'Lead'),
        {
          method: 'POST',
          headers: authHeaders(accessToken),
          body: JSON.stringify(body),
        },
        SF_TIMEOUT_MS,
      );
      if (!r.ok) return r;
      const res = r.data;

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return {
          ok: false,
          error: new ProviderError(
            'PROVIDER_5XX',
            `Salesforce Lead POST ${res.status}: ${errText}`,
            kind,
            res.status,
          ),
        };
      }

      const json = (await res.json()) as { id: string };
      const externalId = json.id;
      const externalUrl = `${instanceUrl}/lightning/r/Lead/${externalId}/view`;
      return { ok: true, data: { externalId, externalUrl } };
    },

    async pushConversion(
      input: PushConversionInput,
      config: ProviderConfig,
    ): Promise<Result<PushConversionOutput>> {
      const g = guardProduction(config, kind);
      if (!g.ok) return g;
      if (g.stub) {
        const externalId = `sf_opp_stub_${shortHash(input.conversionId)}`;
        return { ok: true, data: { externalId } };
      }

      const c = requireCreds(config);
      if (!c.ok) return c;
      const { instanceUrl, accessToken } = c.data;

      const amountDollars = (input.amountCents / 100).toFixed(2);
      const closeDate = new Date(input.convertedAt).toISOString().slice(0, 10);

      const body = {
        Name: `D2D ${input.type} · ${input.conversionId}`,
        Amount: amountDollars,
        StageName: 'Closed Won',
        CloseDate: closeDate,
      };

      const r = await fetchWithTimeout(
        kind,
        sfUrl(instanceUrl, 'Opportunity'),
        {
          method: 'POST',
          headers: authHeaders(accessToken),
          body: JSON.stringify(body),
        },
        SF_TIMEOUT_MS,
      );
      if (!r.ok) return r;
      const res = r.data;

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return {
          ok: false,
          error: new ProviderError(
            'PROVIDER_5XX',
            `Salesforce Opportunity POST ${res.status}: ${errText}`,
            kind,
            res.status,
          ),
        };
      }

      const json = (await res.json()) as { id: string };
      const externalId = json.id;
      const externalUrl = `${instanceUrl}/lightning/r/Opportunity/${externalId}/view`;
      return { ok: true, data: { externalId, externalUrl } };
    },
  };
}
