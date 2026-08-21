/**
 * /orgs — platform-wide org registry (compact view; overlaps /accounts which
 * is the richer portfolio dashboard). Server component, live Prisma reads,
 * per-org user + lead counts via groupBy (no N+1). super_admin sees every
 * non-archived org; everyone else is scoped to their own orgId.
 */
import Link from 'next/link';
import { ChevronRight, Building2 } from 'lucide-react';
import { Banner, RegionBadge, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { OrgsRegistryEmpty } from '@/components/PlatformEmptyStates';
import { getSession } from '@/lib/session';
import { isCrossTenantOperator } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface OrgRow {
  id: string;
  slug: string;
  tradingName: string;
  vertical: string;
  regionCode: 'US' | 'AU' | 'SG';
  type: string;
  status: string;
  createdAt: Date;
  users: number;
  leads: number;
}

interface OrgsData {
  rows: OrgRow[];
  error?: string;
}

async function loadOrgs(): Promise<OrgsData> {
  const session = await getSession();
  if (!session) return { rows: [], error: 'no session' };

  try {
    const { db } = await import('@d2d/database');

    const where = isCrossTenantOperator(session)
      ? { status: { not: 'archived' as const }, slug: { not: null } }
      : session.orgId
        ? { id: session.orgId, status: { not: 'archived' as const }, slug: { not: null } }
        : { id: '__no_org__' };

    const orgs = await db.org.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        slug: true,
        tradingName: true,
        vertical: true,
        regionCode: true,
        type: true,
        status: true,
        createdAt: true,
      },
    });
    const orgIds = orgs.map((o) => o.id);

    const [userCounts, leadCounts] = await Promise.all([
      db.user.groupBy({
        by: ['orgId'],
        where: { orgId: { in: orgIds }, status: { not: 'archived' } },
        _count: { _all: true },
      }),
      db.lead.groupBy({
        by: ['orgId'],
        where: { orgId: { in: orgIds } },
        _count: { _all: true },
      }),
    ]);
    const userByOrg = new Map(userCounts.map((r) => [r.orgId, r._count._all]));
    const leadByOrg = new Map(leadCounts.map((r) => [r.orgId, r._count._all]));

    return {
      rows: orgs.map((o) => ({
        id: o.id,
        slug: o.slug ?? o.id,
        tradingName: o.tradingName,
        vertical: o.vertical,
        regionCode: o.regionCode,
        type: o.type,
        status: o.status,
        createdAt: o.createdAt,
        users: userByOrg.get(o.id) ?? 0,
        leads: leadByOrg.get(o.id) ?? 0,
      })),
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[orgs] DB load failed:', err);
    return { rows: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export default async function OrgsPage(): Promise<JSX.Element> {
  const { rows, error } = await loadOrgs();

  if (error) {
    return (
      <PlatformShell pageTitle="Client orgs">
        <div className="space-y-5 max-w-[1280px]">
          <Banner tone="warn">
            <span className="text-[13px]">Could not load orgs: {error}. Refresh to retry.</span>
          </Banner>
        </div>
      </PlatformShell>
    );
  }

  if (rows.length === 0) {
    return (
      <PlatformShell pageTitle="Client orgs">
        <div className="space-y-5 max-w-[1280px]">
          <OrgsRegistryEmpty />
        </div>
      </PlatformShell>
    );
  }

  return (
    <PlatformShell pageTitle="Client orgs">
      <div className="space-y-6 max-w-[1280px]">
        <Section
          title={`${rows.length} client orgs`}
          subtitle="Platform-wide registry — full portfolio KPIs live on Accounts"
          paddedBody={false}
          action={<DataSourceBadge source="live" />}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Org</th>
                <th>Vertical</th>
                <th>Region</th>
                <th>Type</th>
                <th>Users</th>
                <th>Leads</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-ink/5 flex items-center justify-center">
                        <Building2 size={14} className="text-ink" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-ink truncate">
                          {o.tradingName}
                        </div>
                        <div className="text-[11px] text-muted truncate">{o.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-[12px] capitalize text-muted">{o.vertical}</td>
                  <td>
                    <RegionBadge region={o.regionCode} />
                  </td>
                  <td>
                    <span className="tag capitalize">{o.type}</span>
                  </td>
                  <td className="numeric text-[13px]">{o.users}</td>
                  <td className="numeric text-[13px]">{o.leads}</td>
                  <td>
                    <StatusPill tone={o.status === 'active' ? 'success' : 'muted'}>
                      {o.status === 'active' ? 'Active' : o.status}
                    </StatusPill>
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/orgs/${o.slug}`}
                      className="text-soft hover:text-ink transition inline-flex items-center"
                    >
                      <ChevronRight size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
    </PlatformShell>
  );
}
