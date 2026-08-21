/**
 * /api/accounts/list — the accounts a caller may switch between, live from
 * Prisma. Cross-tenant operators (super_admin) get every non-archived org;
 * an org-scoped caller gets only their own. Feeds the AccountSwitcher, so it
 * never shows a fixture fleet the caller can't actually reach.
 *
 * Deliberately minimal (slug/name/region/vertical/avatar) — the switcher used
 * to show fabricated roster/health/plan badges; those are dropped rather than
 * invented.
 */
import { db } from '@d2d/database';
import { internal, isCrossTenantOperator, ok, requireSession } from '@/lib/api-helpers';
import { avatarBgFor } from '@/lib/account-color';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface AccountListItem {
  slug: string;
  name: string;
  region: string;
  vertical: string;
  avatarBg: string;
}

export async function GET(): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  const where = isCrossTenantOperator(session)
    ? { status: { not: 'archived' as const }, slug: { not: null } }
    : session.orgId
      ? { id: session.orgId, slug: { not: null } }
      : { id: '__no_org__' };

  try {
    const orgs = await db.org.findMany({
      where,
      orderBy: { tradingName: 'asc' },
      select: { slug: true, tradingName: true, regionCode: true, vertical: true },
      take: 500,
    });

    const items: AccountListItem[] = orgs
      .filter((o): o is typeof o & { slug: string } => Boolean(o.slug))
      .map((o) => ({
        slug: o.slug,
        name: o.tradingName,
        region: o.regionCode,
        vertical: o.vertical,
        avatarBg: avatarBgFor(o.slug),
      }));
    return ok({ accounts: items });
  } catch (err) {
    console.error('[api/accounts/list GET] failed:', err);
    return internal('Failed to load accounts');
  }
}
