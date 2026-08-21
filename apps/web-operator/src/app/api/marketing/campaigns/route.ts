/**
 * /api/marketing/campaigns — list AdCampaign rows with their Creatives.
 *
 * GET  Returns AdCampaigns for the caller's org (cross-tenant operators with
 *      no ?orgId= see every org's campaigns — the platform-wide Marketing
 *      Studio surface). Optional ?status= filters to a single status.
 *
 * Feeds the Campaigns page (all statuses) and Retargeting (campaigns whose
 * `audienceJson` is non-empty). /api/marketing/review-queue already covers
 * the draft-only HQ review-queue proxy to Fastify — this route reads AdCampaign
 * directly via Prisma so the Campaigns page reflects true DB state even before
 * NEXT_PUBLIC_API_URL is configured.
 *
 * Empty-table contract: no rows → { campaigns: [], updatedAt } (200, never an
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

  const status = req.nextUrl.searchParams.get('status');

  try {
    const rows = await db.adCampaign.findMany({
      where: { ...orgFilter, ...(status ? { status } : {}) },
      select: {
        id: true,
        orgId: true,
        campaignId: true,
        adAccountId: true,
        provider: true,
        objective: true,
        audienceJson: true,
        budgetCents: true,
        status: true,
        externalCampaignId: true,
        startedAt: true,
        endedAt: true,
        createdAt: true,
        org: { select: { tradingName: true } },
        adAccount: { select: { provider: true, externalId: true, status: true } },
        creatives: {
          select: {
            id: true,
            type: true,
            assetKey: true,
            prompt: true,
            costCents: true,
            approvedAt: true,
            c2paManifestId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const campaigns = rows.map((r) => ({
      id: r.id,
      orgId: r.orgId,
      account: r.org.tradingName,
      campaignId: r.campaignId,
      adAccountId: r.adAccountId,
      adAccount: r.adAccount,
      provider: r.provider,
      objective: r.objective,
      audienceJson: r.audienceJson,
      budgetCents: r.budgetCents,
      status: r.status,
      externalCampaignId: r.externalCampaignId,
      startedAt: r.startedAt,
      endedAt: r.endedAt,
      createdAt: r.createdAt,
      creatives: r.creatives,
    }));

    return ok({ campaigns, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[api/marketing/campaigns GET] failed:', err);
    return internal('Failed to load campaigns');
  }
}
