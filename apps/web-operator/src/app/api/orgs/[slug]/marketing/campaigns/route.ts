/**
 * GET /api/orgs/[slug]/marketing/campaigns — this account's AdCampaign rows
 * for the Marketing Studio Campaigns + Retargeting surfaces.
 *
 * AdCampaign has no impressions/clicks/conversions/ROAS fields — the schema
 * only tracks budgetCents, status, and audienceJson (retargeting's only real
 * audience data). Callers must not invent performance metrics from this
 * payload; render what's here honestly.
 *
 * Optional ?status= filter (draft | active | paused | ended). Capped at 100
 * rows. Tenant scope: resolveAccountOrg pins the read to the slug's Org.
 */
import type { NextRequest } from 'next/server';
import { db } from '@d2d/database';
import { internal, ok, requireSession, resolveAccountOrg } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_CAMPAIGNS = 100;

export async function GET(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const params = await paramsPromise;
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  const orgOrErr = await resolveAccountOrg(params.slug, session);
  if (orgOrErr instanceof Response) return orgOrErr;
  const org = orgOrErr;

  const status = new URL(req.url).searchParams.get('status');

  try {
    const campaigns = await db.adCampaign.findMany({
      where: { orgId: org.id, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: MAX_CAMPAIGNS,
      select: {
        id: true,
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
        adAccount: { select: { provider: true, externalId: true, status: true } },
        creatives: {
          select: { id: true, type: true, assetKey: true, prompt: true, c2paManifestId: true },
        },
      },
    });

    return ok({
      orgId: org.id,
      campaigns,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/orgs/:slug/marketing/campaigns GET] failed:', err);
    return internal('Failed to load campaigns');
  }
}
