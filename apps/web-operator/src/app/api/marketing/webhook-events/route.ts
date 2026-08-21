/**
 * /api/marketing/webhook-events — list ProviderWebhookEvent rows.
 *
 * GET  Returns the most recent 50 inbound provider webhook events for the
 *      caller's org (cross-tenant operators with no ?orgId= see every org's
 *      events — the platform-wide Marketing Studio surface). Feeds the
 *      Integrations page's "Webhook receivers" log.
 *
 * `payloadJson` is deliberately NEVER forwarded — inbound webhook bodies
 * (e.g. `meta.lead.created`) can carry lead PII. The receivers table only
 * needs provider, event type, signature outcome, and timing.
 *
 * Empty-table contract: no rows → { events: [], updatedAt } (200, never an
 * error) so the page renders its empty state instead of fabricating rows.
 */
import type { NextRequest } from 'next/server';
import { db } from '@d2d/database';
import { forbidden, internal, isCrossTenantOperator, ok, requireSession } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  const orgFilter = isCrossTenantOperator(session)
    ? req.nextUrl.searchParams.get('orgId')
      ? { orgId: req.nextUrl.searchParams.get('orgId')! }
      : {}
    : session.orgId
      ? { orgId: session.orgId }
      : null;

  if (orgFilter === null) {
    return forbidden('No org context');
  }

  try {
    const rows = await db.providerWebhookEvent.findMany({
      where: orgFilter,
      select: {
        id: true,
        orgId: true,
        providerKind: true,
        eventType: true,
        externalId: true,
        occurredAt: true,
        verifiedSignature: true,
        receivedAt: true,
        processedAt: true,
        org: { select: { tradingName: true } },
      },
      orderBy: { receivedAt: 'desc' },
      take: 50,
    });

    const events = rows.map((r) => ({
      id: r.id,
      orgId: r.orgId,
      account: r.org.tradingName,
      providerKind: r.providerKind,
      eventType: r.eventType,
      externalId: r.externalId,
      occurredAt: r.occurredAt,
      verifiedSignature: r.verifiedSignature,
      receivedAt: r.receivedAt,
      processedAt: r.processedAt,
    }));

    return ok({ events, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[api/marketing/webhook-events GET] failed:', err);
    return internal('Failed to load webhook events');
  }
}
