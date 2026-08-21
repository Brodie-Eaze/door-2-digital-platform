/**
 * /api/marketing/creatives — list Creative rows (Creative Library, Brand
 * safety, and the overview's "recently approved" rail).
 *
 * GET  Returns the most recent 200 creatives for the caller's org
 *      (cross-tenant operators with no ?orgId= see every org's creatives —
 *      the platform-wide Marketing Studio surface). Optional
 *      ?approved=true|false filters to approvedAt-not-null / approvedAt-null.
 *
 * `safetyScanResult` is a real JSON column — forwarded as-is so the page can
 * render whatever shape the safety scanner actually wrote, instead of a
 * fabricated "brand-safety score" concept that has no backing model.
 *
 * Empty-table contract: no rows → { creatives: [], updatedAt } (200, never
 * an error) so the page renders its empty state instead of fabricating tiles.
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

  const approvedParam = req.nextUrl.searchParams.get('approved');
  const approvedFilter =
    approvedParam === 'true'
      ? { approvedAt: { not: null } }
      : approvedParam === 'false'
        ? { approvedAt: null }
        : {};

  try {
    const rows = await db.creative.findMany({
      where: { ...orgFilter, ...approvedFilter },
      select: {
        id: true,
        orgId: true,
        type: true,
        assetKey: true,
        prompt: true,
        model: true,
        modelVersion: true,
        costCents: true,
        safetyScanResult: true,
        c2paManifestId: true,
        approvedAt: true,
        approvedBy: true,
        createdAt: true,
        org: { select: { tradingName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const creatives = rows.map((r) => ({
      id: r.id,
      orgId: r.orgId,
      account: r.org.tradingName,
      type: r.type,
      assetKey: r.assetKey,
      prompt: r.prompt,
      model: r.model,
      modelVersion: r.modelVersion,
      costCents: r.costCents,
      safetyScanResult: r.safetyScanResult,
      c2paManifestId: r.c2paManifestId,
      approvedAt: r.approvedAt,
      approvedBy: r.approvedBy,
      createdAt: r.createdAt,
    }));

    return ok({ creatives, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[api/marketing/creatives GET] failed:', err);
    return internal('Failed to load creatives');
  }
}
