/**
 * /api/marketing/jobs — list ContentGenerationJob rows.
 *
 * GET  Returns the most recent 100 generation jobs for the caller's org
 *      (cross-tenant operators with no ?orgId= see every org's jobs — the
 *      platform-wide Marketing Studio surface). Feeds the overview page's
 *      "Recent jobs" table, the Generate page's job history, and the
 *      Integrations page's "Outbound jobs" log (every dispatched call to a
 *      provider adapter is persisted as a ContentGenerationJob row).
 *
 * `inputJson`/`outputJson` are arbitrary per-provider payloads that may carry
 * a free-text brief — we forward them as-is since they originate from the
 * operator's own brief, not third-party PII.
 *
 * Empty-table contract: no rows → { jobs: [], updatedAt } (200, never an
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
    const rows = await db.contentGenerationJob.findMany({
      where: orgFilter,
      select: {
        id: true,
        orgId: true,
        providerKind: true,
        capability: true,
        status: true,
        costCents: true,
        modelId: true,
        inputJson: true,
        createdAt: true,
        completedAt: true,
        errorCode: true,
        errorMessage: true,
        org: { select: { tradingName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const jobs = rows.map((r) => ({
      id: r.id,
      orgId: r.orgId,
      account: r.org.tradingName,
      providerKind: r.providerKind,
      capability: r.capability,
      status: r.status,
      costCents: r.costCents,
      modelId: r.modelId,
      inputJson: r.inputJson,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
      errorCode: r.errorCode,
      errorMessage: r.errorMessage,
    }));

    return ok({ jobs, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[api/marketing/jobs GET] failed:', err);
    return internal('Failed to load generation jobs');
  }
}
