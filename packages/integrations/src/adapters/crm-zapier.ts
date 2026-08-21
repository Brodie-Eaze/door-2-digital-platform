/**
 * Zapier CRM adapter — pushes D2D lead + conversion events to a Zapier webhook URL.
 *
 * Config shape:
 *   credentials.webhookUrl  — the Zapier webhook URL (e.g. https://hooks.zapier.com/hooks/catch/...)
 *   credentials.signingSecret — optional HMAC-SHA256 signing secret; if set, adds
 *     D2D-Signature header so Zapier Zaps can validate origin.
 *
 * Zapier then routes the event to Salesforce/HubSpot/Pipedrive/Airtable/etc.
 * — the operator's choice, zero code on our side per target CRM.
 *
 * In stub/sandbox mode: returns a fake externalId without making network calls.
 * In production mode: POST JSON to credentials.webhookUrl with HMAC signature header.
 */

import { createHmac } from 'node:crypto';
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

const ZAPIER_TIMEOUT_MS = 10_000 as const;

/**
 * Validate an operator-supplied webhook URL before we POST PII to it.
 * Zapier webhooks are caller-controlled, so this is an SSRF surface: we only
 * allow https URLs to a real (non-loopback / non-internal) host. Returns the
 * parsed URL or an error.
 */
function validateWebhookUrl(kind: string, raw: string | undefined): Result<URL> {
  if (!raw || raw.length < 10) {
    return { ok: false, error: new InvalidConfigError(kind, 'credentials.webhookUrl is required') };
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return {
      ok: false,
      error: new InvalidConfigError(kind, 'credentials.webhookUrl is malformed'),
    };
  }
  if (url.protocol !== 'https:') {
    return {
      ok: false,
      error: new InvalidConfigError(kind, 'credentials.webhookUrl must be https'),
    };
  }
  const host = url.hostname.toLowerCase();
  const blocked =
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host.endsWith('.localhost') ||
    host.endsWith('.internal') ||
    host.endsWith('.local') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === '[::1]';
  if (blocked) {
    return {
      ok: false,
      error: new InvalidConfigError(kind, 'credentials.webhookUrl resolves to a blocked host'),
    };
  }
  return { ok: true, data: url };
}

export function createCrmZapierAdapter(): ProviderAdapter {
  const kind = 'crm_zapier' as const;

  async function postToZapier<T extends { externalId: string; externalUrl?: string }>(
    config: ProviderConfig,
    eventType: string,
    id: string,
    payload: Record<string, unknown>,
    stubId: string,
  ): Promise<Result<T>> {
    const g = guardProduction(config, kind);
    if (!g.ok) return g;
    if (g.stub) {
      return { ok: true, data: { externalId: `zapier_stub_${shortHash(stubId)}` } as T };
    }

    const v = validateWebhookUrl(kind, config.credentials.webhookUrl);
    if (!v.ok) return v;
    const webhookUrl = v.data.toString();

    const body = JSON.stringify({ event: eventType, ...payload, _d2d_id: id });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const signingSecret = config.credentials.signingSecret;
    if (signingSecret) {
      const sig = createHmac('sha256', signingSecret).update(body).digest('hex');
      headers['D2D-Signature'] = `sha256=${sig}`;
    }

    const r = await fetchWithTimeout(
      kind,
      webhookUrl,
      { method: 'POST', headers, body },
      ZAPIER_TIMEOUT_MS,
    );
    if (!r.ok) return r;
    const res = r.data;
    if (!res.ok) {
      return {
        ok: false,
        error: new ProviderError(
          'PROVIDER_5XX',
          `Zapier webhook returned ${res.status}`,
          kind,
          res.status,
        ),
      };
    }
    // Zapier returns {"status":"success","id":"<id>"} on success.
    const json = (await res.json().catch(() => ({}))) as { id?: string; request_id?: string };
    const externalId = json.id ?? json.request_id ?? `zapier_${shortHash(id + Date.now())}`;
    return { ok: true, data: { externalId } as T };
  }

  return {
    kind,
    displayName: 'Zapier Webhook',
    capabilities: ['crm.lead.push', 'crm.conversion.push'],
    docsUrl: 'https://zapier.com/apps/webhook/integrations',

    async ping(config) {
      const g = guardProduction(config, kind);
      if (!g.ok) return g;
      if (g.stub) {
        return { ok: true, data: stubPing('Zapier', 'zapier_stub') };
      }
      const v = validateWebhookUrl(kind, config.credentials.webhookUrl);
      if (!v.ok) return v;
      // We never GET a Zapier catch-hook (it would fire the Zap); validating the
      // URL shape + host is the strongest non-destructive credential check.
      const tail = v.data.toString().slice(-12);
      return { ok: true, data: { accountLabel: `Zapier Webhook · configured`, accountId: tail } };
    },

    async pushLead(input: PushLeadInput, config: ProviderConfig): Promise<Result<PushLeadOutput>> {
      return postToZapier<PushLeadOutput>(
        config,
        'lead.created',
        input.leadId,
        {
          leadId: input.leadId,
          orgId: input.orgId,
          givenName: input.givenName,
          familyName: input.familyName,
          // PII transmitted only when caller explicitly passes plaintext fields.
          ...(input.email !== undefined && { email: input.email }),
          ...(input.phone !== undefined && { phone: input.phone }),
          status: input.status,
          ...(input.sourceTerritoryId !== undefined && {
            sourceTerritoryId: input.sourceTerritoryId,
          }),
          ...(input.knockedAt !== undefined && { knockedAt: input.knockedAt }),
          ...(input.notes !== undefined && { notes: input.notes }),
        },
        input.leadId,
      );
    },

    async pushConversion(
      input: PushConversionInput,
      config: ProviderConfig,
    ): Promise<Result<PushConversionOutput>> {
      return postToZapier<PushConversionOutput>(
        config,
        'conversion.created',
        input.conversionId,
        {
          conversionId: input.conversionId,
          orgId: input.orgId,
          ...(input.leadId !== undefined && { leadId: input.leadId }),
          type: input.type,
          amountCents: input.amountCents,
          attributionSource: input.attributionSource,
          convertedAt: input.convertedAt,
        },
        input.conversionId,
      );
    },
  };
}
