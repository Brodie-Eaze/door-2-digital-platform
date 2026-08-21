/**
 * GET /api/orgs/[slug]/marketing/creatives — this account's Creative rows for
 * the Marketing Studio Library + Brand-safety surfaces.
 *
 * safetyScanResult is returned as-is (opaque JSON from the moderation
 * adapter) — brand-safety renders it directly rather than inventing a
 * separate score/rule-pack model that doesn't exist in the schema.
 *
 * Capped at 200 rows. Tenant scope: resolveAccountOrg pins the read to the
 * slug's Org.
 */
import { db } from '@d2d/database';
import { internal, ok, requireSession, resolveAccountOrg } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_CREATIVES = 200;

export async function GET(
  _req: Request,
  { params: paramsPromise }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const params = await paramsPromise;
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  const orgOrErr = await resolveAccountOrg(params.slug, session);
  if (orgOrErr instanceof Response) return orgOrErr;
  const org = orgOrErr;

  try {
    const creatives = await db.creative.findMany({
      where: { orgId: org.id },
      orderBy: { createdAt: 'desc' },
      take: MAX_CREATIVES,
      select: {
        id: true,
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
      },
    });

    return ok({
      orgId: org.id,
      creatives,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/orgs/:slug/marketing/creatives GET] failed:', err);
    return internal('Failed to load creatives');
  }
}
