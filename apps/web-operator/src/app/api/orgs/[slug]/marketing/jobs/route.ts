/**
 * GET /api/orgs/[slug]/marketing/jobs — this account's ContentGenerationJob
 * history, newest first. Backs the Generator page's pipeline counters (a job
 * IS the brief → compose → variation → review → publish pipeline unit — there
 * is no separate pipeline-stage model) and gives the honest per-provider
 * "calls today" the Integrations tile shows.
 *
 * Capped at 100 rows — this is a recent-activity feed, not an export.
 * Tenant scope: resolveAccountOrg pins the read to the slug's Org.
 */
import { db } from '@d2d/database';
import { internal, ok, requireSession, resolveAccountOrg } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_JOBS = 100;

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
    const jobs = await db.contentGenerationJob.findMany({
      where: { orgId: org.id },
      orderBy: { createdAt: 'desc' },
      take: MAX_JOBS,
      select: {
        id: true,
        providerKind: true,
        capability: true,
        status: true,
        costCents: true,
        modelId: true,
        safetyScanResult: true,
        c2paManifestId: true,
        createdAt: true,
        completedAt: true,
        errorCode: true,
        errorMessage: true,
        providerConnection: { select: { displayName: true, kind: true } },
      },
    });

    return ok({
      orgId: org.id,
      jobs,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/orgs/:slug/marketing/jobs GET] failed:', err);
    return internal('Failed to load content-generation jobs');
  }
}
