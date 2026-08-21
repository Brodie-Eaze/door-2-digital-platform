/**
 * /api/marketing/providers — list ProviderConnection rows (Integrations page).
 *
 * GET  Returns every provider connection for the caller's org (cross-tenant
 *      operators with no ?orgId= get every org's connections — this is the
 *      platform-wide Marketing Studio surface, mirrors /api/activity's
 *      orgFilter pattern).
 *
 * Never ships `credentialsVault` or `webhookSecretHash` to the browser — both
 * are PII-vault-backed secrets. Everything else on ProviderConnection is safe
 * operational metadata (status, mode, last ping, account label).
 *
 * Empty-table contract: no rows → { providers: [], updatedAt } (200, never an
 * error) so the page renders its empty state instead of fabricating cards.
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
    const rows = await db.providerConnection.findMany({
      where: orgFilter,
      select: {
        id: true,
        orgId: true,
        kind: true,
        displayName: true,
        mode: true,
        status: true,
        accountLabel: true,
        accountId: true,
        lastPingAt: true,
        lastPingStatus: true,
        lastPingError: true,
        connectedAt: true,
        disconnectedAt: true,
        org: { select: { tradingName: true } },
      },
      orderBy: { connectedAt: 'desc' },
    });

    const providers = rows.map((r) => ({
      id: r.id,
      orgId: r.orgId,
      account: r.org.tradingName,
      kind: r.kind,
      displayName: r.displayName,
      mode: r.mode,
      status: r.status,
      accountLabel: r.accountLabel,
      accountId: r.accountId,
      lastPingAt: r.lastPingAt,
      lastPingStatus: r.lastPingStatus,
      lastPingError: r.lastPingError,
      connectedAt: r.connectedAt,
      disconnectedAt: r.disconnectedAt,
    }));

    return ok({ providers, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[api/marketing/providers GET] failed:', err);
    return internal('Failed to load provider connections');
  }
}
