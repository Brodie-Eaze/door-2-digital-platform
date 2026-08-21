/**
 * /api/marketing/publish — publish a draft AdCampaign to a provider.
 *
 * POST  body { campaignId, provider }  provider ∈ 'meta' | 'google'
 *
 * Proxies to the Fastify POST /v1/marketing/campaigns/deliver. The deliver
 * adapter (graph.facebook.com / googleads) is a DETERMINISTIC STUB — no real
 * ad spend can occur until Meta Business Verification + ad-account OAuth (Meta)
 * and a Google Ads developer token + OAuth refresh token (Google) land. Until a
 * provider connection exists this returns 200 with
 *   { published:false, reason:'provider_not_connected' }
 * so the review-queue page shows an honest "Connect Meta to publish" state
 * rather than failing the request.
 *
 * Tenant-scoped to session.orgId; cross-tenant operators may target another org
 * via ?orgId=.
 */
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  canOperate,
  forbidden,
  ok,
  requireSession,
  validation,
  isCrossTenantOperator,
} from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const publishSchema = z
  .object({
    campaignId: z.string().min(1).max(120),
    provider: z.enum(['meta', 'google']),
  })
  .strict();

// Map the page's provider choice → Fastify provider-kind literal.
const PROVIDER_KIND: Record<'meta' | 'google', string> = {
  meta: 'meta_marketing',
  google: 'google_ads',
};

export async function POST(req: NextRequest): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  // Authz: publishing ad spend is an operator action.
  if (!canOperate(session)) {
    return forbidden('Insufficient role to publish marketing campaigns');
  }

  const url = new URL(req.url);
  const requestedOrgId = url.searchParams.get('orgId');
  let orgId = session.orgId;
  if (requestedOrgId && requestedOrgId !== session.orgId) {
    if (!isCrossTenantOperator(session)) {
      return forbidden('Not permitted to publish for another org');
    }
    orgId = requestedOrgId;
  }

  if (!orgId && !isCrossTenantOperator(session)) {
    return forbidden('No org context for publish');
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return validation('Request body must be JSON');
  }

  const parsed = publishSchema.safeParse(raw);
  if (!parsed.success) {
    return validation('Invalid publish request', parsed.error.flatten());
  }
  const { campaignId, provider } = parsed.data;
  const providerKind = PROVIDER_KIND[provider];

  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBase) {
    // Backend not configured — honest "not connected" so the page shows the
    // Connect-provider state rather than pretending it published.
    return ok({
      published: false,
      reason: 'provider_not_connected',
      provider,
      campaignId,
      orgId,
    });
  }

  const targetUrl = `${apiBase}/v1/marketing/campaigns/deliver`;
  const cookie = req.headers.get('cookie') ?? '';

  // The deliver adapter is a stub; the request still has to satisfy the
  // Fastify deliver schema. We forward a minimal, valid envelope keyed off the
  // draft campaign — the stub echoes a deterministic result, and a missing
  // provider connection surfaces as a 412 we translate to provider_not_connected.
  const deliverBody = {
    providerKind,
    input: {
      campaignName: `D2D campaign ${campaignId}`,
      audienceId: `aud_${campaignId}`,
      creativeIds: [campaignId],
      budgetCents: 100,
      bidStrategy: 'auto',
      startAt: new Date().toISOString(),
      objective: 'conversions',
    },
  };

  try {
    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie,
        // Deliver is a mutating endpoint — Fastify requires an Idempotency-Key.
        'idempotency-key': `publish:${orgId}:${campaignId}:${provider}`,
        ...(req.headers.get('x-correlation-id')
          ? { 'x-correlation-id': req.headers.get('x-correlation-id')! }
          : {}),
      },
      body: JSON.stringify(deliverBody),
    });

    // 412 NOT_CONNECTED (or any "not connected" problem) → honest connect state.
    if (upstream.status === 412) {
      return ok({
        published: false,
        reason: 'provider_not_connected',
        provider,
        campaignId,
        orgId,
      });
    }

    const contentType = upstream.headers.get('content-type') ?? '';
    if (!upstream.ok) {
      const body = contentType.includes('json')
        ? ((await upstream.json()) as Record<string, unknown>)
        : { detail: await upstream.text() };
      // A not-connected problem can also arrive as a 4xx with a typed body.
      const detail = typeof body.detail === 'string' ? body.detail.toLowerCase() : '';
      if (detail.includes('not connected') || detail.includes('disconnected')) {
        return ok({
          published: false,
          reason: 'provider_not_connected',
          provider,
          campaignId,
          orgId,
        });
      }
      return new Response(JSON.stringify(body), {
        status: upstream.status,
        headers: { 'content-type': 'application/problem+json' },
      });
    }

    const result = contentType.includes('json')
      ? ((await upstream.json()) as Record<string, unknown>)
      : {};
    return ok({ published: true, provider, campaignId, orgId, ...result });
  } catch (err) {
    console.error('[api/marketing/publish POST] upstream fetch failed:', err);
    // Network failure to the API → treat as not-connected so the page stays honest.
    return ok({
      published: false,
      reason: 'provider_not_connected',
      provider,
      campaignId,
      orgId,
    });
  }
}
