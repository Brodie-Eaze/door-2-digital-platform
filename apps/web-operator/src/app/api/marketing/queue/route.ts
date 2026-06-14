/**
 * /api/marketing/queue — send approved creative variants to the review queue.
 *
 * POST  Accepts { variantIds: string[] } and enqueues those variants for
 *       human review. Tenant-scoped to the caller's session.orgId; cross-tenant
 *       operators (super_admin) may target another org via ?orgId=.
 *
 * When NEXT_PUBLIC_API_URL is configured this proxies to the Fastify marketing
 * service so the queue is persisted server-side. When it is NOT configured
 * (dev/preview), the route still validates + tenant-scopes the request and
 * returns a deterministic { queued } count so the operator gets honest
 * feedback rather than a dead button — it never silently fakes a write to a
 * backend that isn't there (the response carries `persisted: false`).
 */
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { canOperate, forbidden, internal, ok, requireSession, validation } from '@/lib/api-helpers';
import { isCrossTenantOperator } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const queueSchema = z.object({
  variantIds: z.array(z.string().min(1).max(120)).min(1).max(50),
});

export async function POST(req: NextRequest): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  // Authz: queuing creatives for review is an operator action.
  if (!canOperate(session)) {
    return forbidden('Insufficient role to queue marketing creatives');
  }

  // Resolve the target org. Default to the caller's own org; only cross-tenant
  // operators may target another org via ?orgId=.
  const url = new URL(req.url);
  const requestedOrgId = url.searchParams.get('orgId');
  let orgId = session.orgId;
  if (requestedOrgId && requestedOrgId !== session.orgId) {
    if (!isCrossTenantOperator(session)) {
      return forbidden('Not permitted to queue creatives for another org');
    }
    orgId = requestedOrgId;
  }

  if (!orgId && !isCrossTenantOperator(session)) {
    return forbidden('No org context for marketing queue');
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return validation('Request body must be JSON');
  }

  const parsed = queueSchema.safeParse(raw);
  if (!parsed.success) {
    return validation('Invalid queue request', parsed.error.flatten());
  }

  // De-dupe defensively so a double-click can't double-count.
  const variantIds = Array.from(new Set(parsed.data.variantIds));

  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBase) {
    // Backend not configured in this environment — validate + scope + report
    // honestly. persisted:false tells the caller this did not hit a durable store.
    return ok({ queued: variantIds.length, persisted: false, orgId });
  }

  const targetUrl = `${apiBase}/v1/marketing/creatives/queue`;
  const cookie = req.headers.get('cookie') ?? '';

  try {
    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie,
        ...(req.headers.get('x-correlation-id')
          ? { 'x-correlation-id': req.headers.get('x-correlation-id')! }
          : {}),
      },
      body: JSON.stringify({ variantIds, orgId, requestedByUserId: session.userId }),
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
      ? ((await upstream.json()) as Record<string, unknown>)
      : { queued: variantIds.length };
    return ok({ queued: variantIds.length, persisted: true, orgId, ...result });
  } catch (err) {
    console.error('[api/marketing/queue POST] upstream fetch failed:', err);
    return internal('Marketing queue service unavailable');
  }
}
