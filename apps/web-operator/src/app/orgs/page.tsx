/**
 * /orgs — operator-level client org registry.
 *
 * Server component. Reads directly from the shared Prisma client (same
 * pattern as /accounts + /overview). Falls back to the ORGS fixture when
 * the DB is unreachable so the demo never blanks.
 *
 * Authorization:
 *   - super_admin: all non-archived client orgs
 *   - everyone else: scoped to their own orgId
 */
import Link from 'next/link';
import { ChevronRight, Building2, Database, AlertTriangle } from 'lucide-react';
import { Money, RegionBadge, Section, StatusPill } from '@d2d/ui-web';
import { OperatorShell } from '@/components/OperatorShell';
import { ORGS } from '@/lib/fixtures';
import { getSession } from '@/lib/session';
import { isCrossTenantOperator } from '@/lib/api-helpers';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── types ──────────────────────────────────────────────────────────────────

interface OrgRow {
  id: string;
  name: string;
  slug: string | null;
  vertical: string;
  region: 'US' | 'AU' | 'SG';
  plan: string;
  knockers: number;
  conversionsMTD: number;
  revenueCentsMTD: bigint;
  health: 'healthy' | 'attention';
}

interface OrgsData {
  orgs: OrgRow[];
  source: 'database' | 'fixture-fallback';
  error?: string;
}

// ─── data loader ────────────────────────────────────────────────────────────

async function loadOrgs(): Promise<OrgsData> {
  const session = await getSession();
  if (!session) {
    return { orgs: [], source: 'fixture-fallback', error: 'no session' };
  }

  try {
    const { db } = await import('@d2d/database');

    const where = isCrossTenantOperator(session)
      ? { type: 'client' as const, status: { not: 'archived' as const } }
      : session.orgId
        ? { id: session.orgId, type: 'client' as const, status: { not: 'archived' as const } }
        : { id: '__no_org__' };

    const orgs = await db.org.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        slug: true,
        legalName: true,
        tradingName: true,
        vertical: true,
        regionCode: true,
        status: true,
        billing: {
          select: {
            platformFeeMonthlyCents: true,
            doorRakePercent: true,
            insideSalesRakePercent: true,
            retargetingRakePercent: true,
            currency: true,
          },
        },
      },
    });

    // MTD conversions per org — single grouped query.
    const mtdStart = new Date();
    mtdStart.setDate(1);
    mtdStart.setHours(0, 0, 0, 0);

    const orgIds = orgs.map((o) => o.id);

    const convAgg = await db.conversion.groupBy({
      by: ['orgId'],
      where: { orgId: { in: orgIds }, signedAt: { gte: mtdStart } },
      _count: { _all: true },
      _sum: { amountCents: true },
    });

    const convByOrg = new Map(
      convAgg.map((r) => [
        r.orgId,
        { count: r._count._all, revenueCents: r._sum.amountCents ?? 0n },
      ]),
    );

    // knocker count per org
    const knockerCounts = await db.user.groupBy({
      by: ['orgId'],
      where: { orgId: { in: orgIds }, role: 'knocker', status: 'active' },
      _count: { _all: true },
    });
    const knockerByOrg = new Map(knockerCounts.map((r) => [r.orgId, r._count._all]));

    const orgRows: OrgRow[] = orgs.map((o) => {
      const conv = convByOrg.get(o.id) ?? { count: 0, revenueCents: 0n };
      // Fixture loan for cosmetic plan / health until a Plan model exists.
      const fixture = o.slug ? ORGS.find((f) => f.slug === o.slug) : undefined;
      return {
        id: o.id,
        name: o.legalName,
        slug: o.slug,
        vertical: o.vertical,
        region: (o.regionCode === 'AU' ? 'AU' : o.regionCode === 'SG' ? 'SG' : 'US') as
          | 'US'
          | 'AU'
          | 'SG',
        plan: fixture?.plan ?? 'Growth',
        knockers: knockerByOrg.get(o.id) ?? 0,
        conversionsMTD: conv.count,
        revenueCentsMTD: conv.revenueCents,
        health: (fixture?.health ?? 'healthy') as 'healthy' | 'attention',
      };
    });

    return { orgs: orgRows, source: 'database' };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[orgs] DB load failed, falling back to fixture:', err);
    return {
      orgs: ORGS.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        vertical: o.vertical,
        region: o.region as 'US' | 'AU' | 'SG',
        plan: o.plan,
        knockers: o.knockers,
        conversionsMTD: o.conversionsMTD,
        revenueCentsMTD: o.revenueCentsMTD,
        health: o.health as 'healthy' | 'attention',
      })),
      source: 'fixture-fallback',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── page ────────────────────────────────────────────────────────────────────

export default async function OrgsPage(): Promise<JSX.Element> {
  const session = await getSession();
  if (!session) redirect('/login?next=/orgs');

  const { orgs, source, error } = await loadOrgs();

  return (
    <OperatorShell pageTitle="Client orgs">
      <div className="space-y-6 max-w-[1280px]">
        <Section
          title={`${orgs.length} client orgs`}
          subtitle="Pilot-Charlie launches Sept 15. Two adjacent trials onboarded for product validation."
          paddedBody={false}
          action={
            <span
              className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold ${source === 'database' ? 'text-success' : 'text-warn'}`}
              title={error ?? (source === 'database' ? 'Loaded from Postgres' : 'Fixture fallback')}
            >
              {source === 'database' ? (
                <>
                  <Database size={10} /> Live
                </>
              ) : (
                <>
                  <AlertTriangle size={10} /> Fixture
                </>
              )}
            </span>
          }
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Org</th>
                <th>Vertical</th>
                <th>Region</th>
                <th>Plan</th>
                <th>Knockers</th>
                <th>MTD conv.</th>
                <th>MTD revenue</th>
                <th>Health</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orgs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center text-[13px] text-muted py-6">
                    No client orgs yet.
                  </td>
                </tr>
              ) : (
                orgs.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-ink/5 flex items-center justify-center">
                          <Building2 size={14} className="text-ink" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-ink truncate">{o.name}</div>
                          <div className="text-[11px] text-muted truncate">{o.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-[12px] capitalize text-muted">{o.vertical}</td>
                    <td>
                      <RegionBadge region={o.region} />
                    </td>
                    <td>
                      <span className="tag">{o.plan}</span>
                    </td>
                    <td className="numeric text-[13px]">{o.knockers}</td>
                    <td className="numeric text-[13px]">{o.conversionsMTD.toLocaleString()}</td>
                    <td>
                      <Money cents={o.revenueCentsMTD} region="US" />
                    </td>
                    <td>
                      <StatusPill tone={o.health === 'healthy' ? 'success' : 'warn'}>
                        {o.health === 'healthy' ? 'Healthy' : 'Attention'}
                      </StatusPill>
                    </td>
                    <td className="text-right">
                      {o.slug === 'pilot-charlie' && (
                        <Link
                          href={`/orgs/${o.slug}`}
                          className="text-soft hover:text-ink transition inline-flex items-center"
                        >
                          <ChevronRight size={16} />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Section>
      </div>
    </OperatorShell>
  );
}
