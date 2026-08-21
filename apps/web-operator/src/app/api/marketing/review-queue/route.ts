/**
 * /api/marketing/review-queue — list draft AdCampaigns awaiting publish.
 *
 * GET   Returns the draft campaigns (with their creatives) for the caller's
 *       org. Tenant-scoped to session.orgId; cross-tenant operators
 *       (super_admin) may target another org via ?orgId=.
 *
 * When NEXT_PUBLIC_API_URL is configured this proxies to the Fastify
 * marketing service's GET /v1/marketing/campaigns?status=draft so the queue
 * reflects persisted state. When it is NOT configured (dev/preview), the
 * route returns { campaigns: [], persisted: false } honestly — it never
 * fabricates a queue against a backend that isn't there.
 */
import type { NextRequest } from 'next/server';
import { forbidden, internal, ok, requireSession, isCrossTenantOperator } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  const url = new URL(req.url);
  const requestedOrgId = url.searchParams.get('orgId');
  let orgId = session.orgId;
  if (requestedOrgId && requestedOrgId !== session.orgId) {
    if (!isCrossTenantOperator(session)) {
      return forbidden('Not permitted to read the review queue for another org');
    }
    orgId = requestedOrgId;
  }

  if (!orgId && !isCrossTenantOperator(session)) {
    return forbidden('No org context for the review queue');
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBase) {
    // Backend not configured in this environment — report honestly. The page
    // falls back to its demo fixtures and flags the source as DEMO DATA.
    return ok({ campaigns: [], persisted: false, orgId });
  }

  const targetUrl = `${apiBase}/v1/marketing/campaigns?status=draft`;
  const cookie = req.headers.get('cookie') ?? '';

  try {
    const upstream = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        cookie,
        // Forward the resolved tenant so a super_admin's ?orgId= override
        // actually reaches the backend. The marketing module reads tenant via
        // the `x-d2d-org` header; without this the override was silently
        // dropped and the upstream fell back to the token's own org.
        ...(orgId ? { 'x-d2d-org': orgId } : {}),
        ...(req.headers.get('x-correlation-id')
          ? { 'x-correlation-id': req.headers.get('x-correlation-id')! }
          : {}),
      },
    });

    const contentType = upstream.headers.get('content-type') ?? '';

    if (!upstream.ok) {
      const body = contentType.includes('json')
        ? await upstream.json()
        : { detail: await upstream.text() };
      return new Response(JSON.stringify(body), {
        status: upstream.status,
        headers: { 'content-type': 'application/problem+json' },
      });
    }

    const result = contentType.includes('json')
      ? ((await upstream.json()) as { campaigns?: unknown[] })
      : { campaigns: [] };
    return ok({ campaigns: result.campaigns ?? [], persisted: true, orgId });
  } catch (err) {
    console.error('[api/marketing/review-queue GET] upstream fetch failed:', err);
    return internal('Marketing review-queue service unavailable');
  }
}
