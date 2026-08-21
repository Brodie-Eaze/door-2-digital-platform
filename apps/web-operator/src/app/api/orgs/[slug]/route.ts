/**
 * GET /api/orgs/[slug] — minimal org identity, client-fetchable.
 *
 * W3 fix: several 'use client' account pages (territories, live-map,
 * marketing-studio) resolved account identity from the static `ACCOUNTS`
 * fixture (`@/lib/accounts`) via `getAccount(slug)`. For any real org NOT in
 * that 4-account demo fixture, `getAccount()` returns undefined and those
 * pages short-circuited straight to an empty state — never attempting their
 * live fetch. A real org's real data was silently hidden behind a fixture
 * gate. This route lets those pages resolve identity for ANY real org
 * (`db.org` by slug, tenant-scoped via resolveAccountOrg — same pattern as
 * every sibling /api/orgs/[slug]/* route) instead of only the 4 seeded ones.
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
    const detail = await db.org.findUnique({
      where: { id: org.id },
      select: { vertical: true, legalName: true },
    });
    return ok({
      id: org.id,
      slug: org.slug,
      tradingName: org.tradingName,
      legalName: detail?.legalName ?? org.tradingName,
      regionCode: org.regionCode,
      vertical: detail?.vertical ?? null,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/orgs/:slug GET] failed:', err);
    return internal('Failed to load org');
  }
}
