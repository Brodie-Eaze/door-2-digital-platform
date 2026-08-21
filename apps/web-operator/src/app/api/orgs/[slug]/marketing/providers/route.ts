/**
 * GET /api/orgs/[slug]/marketing/providers — this account's ad/AI provider
 * connections for the Marketing Studio Integrations + Generator surfaces.
 *
 * Returns every ProviderConnection for the org plus today's job volume/cost
 * per provider (derived from ContentGenerationJob — the only place calls and
 * spend are actually recorded). credentialsVault and webhookSecretHash are
 * never selected — PII-vault pointers and signing secrets never leave the
 * server. Mirrors the sibling account BFF routes: requireSession →
 * resolveAccountOrg → Prisma, scoped, RFC 7807 errors.
 */
import { db } from '@d2d/database';
import { internal, ok, requireSession, resolveAccountOrg } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    const [providers, orgDetail, todayJobs] = await Promise.all([
      db.providerConnection.findMany({
        where: { orgId: org.id },
        orderBy: { connectedAt: 'desc' },
        select: {
          id: true,
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
        },
      }),
      db.org.findUnique({ where: { id: org.id }, select: { vertical: true } }),
      db.contentGenerationJob.groupBy({
        by: ['providerConnectionId'],
        where: { orgId: org.id, createdAt: { gte: startOfToday } },
        _count: { _all: true },
        _sum: { costCents: true },
      }),
    ]);

    const todayByProvider = new Map(
      todayJobs.map((j) => [
        j.providerConnectionId,
        { callsToday: j._count._all, costCentsToday: j._sum.costCents ?? 0n },
      ]),
    );

    return ok({
      orgId: org.id,
      org: {
        tradingName: org.tradingName,
        regionCode: org.regionCode,
        vertical: orgDetail?.vertical ?? null,
      },
      providers: providers.map((p) => ({
        ...p,
        callsToday: todayByProvider.get(p.id)?.callsToday ?? 0,
        costCentsToday: todayByProvider.get(p.id)?.costCentsToday ?? 0n,
      })),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/orgs/:slug/marketing/providers GET] failed:', err);
    return internal('Failed to load marketing providers');
  }
}
