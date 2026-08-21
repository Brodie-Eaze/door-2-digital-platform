import { redirect } from 'next/navigation';
import { db } from '@d2d/database';
import { KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { REP_STATUS_LABEL, REP_STATUS_TONE, type RepStatus } from '@d2d/ui-tokens/taxonomy';
import { AccountShell } from '@/components/AccountShell';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { KnockersEmpty } from '@/components/AccountEmptyStates';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function tenureLabel(days: number): string {
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}yr`;
}

export default async function KnockersPage({
  params: paramsPromise,
}: {
  params: Promise<{ slug: string }>;
}): Promise<JSX.Element> {
  const params = await paramsPromise;

  const org = await db.org.findUnique({
    where: { slug: params.slug },
    select: { id: true, tradingName: true, regionCode: true },
  });
  if (!org) redirect('/accounts');

  const region = org.regionCode === 'AU' ? 'AU' : 'US';

  const knockers = await db.user.findMany({
    where: { orgId: org.id, role: 'knocker', status: { not: 'archived' } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, givenName: true, familyName: true, status: true, createdAt: true },
  });

  if (knockers.length === 0) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Knockers">
        <div className="space-y-5 max-w-[1400px]">
          <KnockersEmpty slug={params.slug} accountName={org.tradingName} />
        </div>
      </AccountShell>
    );
  }

  const ids = knockers.map((k) => k.id);
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [openSessions, knocksToday, knocksLifetime, convToday, convLifetime, territoriesToday] =
    await Promise.all([
      db.knockSession.findMany({
        where: {
          orgId: org.id,
          userId: { in: ids },
          startedAt: { gte: todayStart },
          endedAt: null,
        },
        select: { userId: true },
      }),
      db.knock.groupBy({
        by: ['userId'],
        where: { orgId: org.id, userId: { in: ids }, capturedAt: { gte: todayStart } },
        _count: { _all: true },
      }),
      db.knock.groupBy({
        by: ['userId'],
        where: { orgId: org.id, userId: { in: ids } },
        _count: { _all: true },
      }),
      db.conversion.groupBy({
        by: ['knockerId'],
        where: { orgId: org.id, knockerId: { in: ids }, signedAt: { gte: todayStart } },
        _count: { _all: true },
        _sum: { amountCents: true },
      }),
      db.conversion.groupBy({
        by: ['knockerId'],
        where: { orgId: org.id, knockerId: { in: ids } },
        _count: { _all: true },
      }),
      db.knock.groupBy({
        by: ['userId', 'territoryId'],
        where: { orgId: org.id, userId: { in: ids }, capturedAt: { gte: todayStart } },
        _count: { _all: true },
      }),
    ]);

  const activeUserIds = new Set(openSessions.map((s) => s.userId));
  const knocksTodayMap = new Map(knocksToday.map((r) => [r.userId, r._count._all]));
  const knocksLifetimeMap = new Map(knocksLifetime.map((r) => [r.userId, r._count._all]));
  const convTodayMap = new Map(convToday.map((r) => [r.knockerId, r._count._all]));
  const revenueTodayMap = new Map(convToday.map((r) => [r.knockerId, r._sum.amountCents ?? 0n]));
  const convLifetimeMap = new Map(convLifetime.map((r) => [r.knockerId, r._count._all]));

  // Top territory today per knocker — pick the highest-count row per userId.
  const topTerritoryByUser = new Map<string, { territoryId: string; count: number }>();
  for (const row of territoriesToday) {
    if (!row.userId || !row.territoryId) continue;
    const cur = topTerritoryByUser.get(row.userId);
    if (!cur || row._count._all > cur.count) {
      topTerritoryByUser.set(row.userId, { territoryId: row.territoryId, count: row._count._all });
    }
  }
  const territoryIds = [...new Set([...topTerritoryByUser.values()].map((v) => v.territoryId))];
  const territories =
    territoryIds.length > 0
      ? await db.territory.findMany({
          where: { id: { in: territoryIds } },
          select: { id: true, name: true },
        })
      : [];
  const territoryNameMap = new Map(territories.map((t) => [t.id, t.name]));

  const rows = knockers.map((k) => {
    // Live 2-state status: an open KnockSession today means active field work;
    // anything else is honestly reported as offline (no idle/break/training
    // signal exists yet — those need shift + break-clock data to compute).
    const status: RepStatus = activeUserIds.has(k.id) ? 'active' : 'offline';
    const knocksT = knocksTodayMap.get(k.id) ?? 0;
    const convT = convTodayMap.get(k.id) ?? 0;
    const knocksL = knocksLifetimeMap.get(k.id) ?? 0;
    const convL = convLifetimeMap.get(k.id) ?? 0;
    const topTerritory = topTerritoryByUser.get(k.id);
    return {
      id: k.id,
      initials: `${k.givenName.charAt(0)}${k.familyName.charAt(0) ?? ''}`.toUpperCase(),
      name: `${k.givenName} ${k.familyName ? `${k.familyName.charAt(0)}.` : ''}`.trim(),
      tenureDays: Math.max(
        0,
        Math.floor((Date.now() - k.createdAt.getTime()) / (24 * 60 * 60 * 1000)),
      ),
      territory: topTerritory ? (territoryNameMap.get(topTerritory.territoryId) ?? '—') : '—',
      status,
      knocks: knocksT,
      conversions: convT,
      convRate: knocksL > 0 ? (convL / knocksL) * 100 : 0,
      revenueCents: revenueTodayMap.get(k.id) ?? 0n,
    };
  });

  const active = rows.filter((n) => n.status === 'active');
  const totalRev = rows.reduce((s, n) => s + n.revenueCents, 0n);
  const totalKnocks = rows.reduce((s, n) => s + n.knocks, 0);

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Knockers">
      <div className="space-y-6 max-w-[1400px]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="Roster"
            value={rows.length.toLocaleString()}
            hint={`${active.length} active now`}
          />
          <KpiCard label="On shift" value={active.length.toLocaleString()} hint="open session" />
          <KpiCard label="Knocks today" value={totalKnocks.toLocaleString()} />
          <KpiCard label="Revenue today" value={<Money cents={totalRev} region={region} />} />
        </div>

        <Section
          title={`Roster · ${rows.length} knockers`}
          subtitle="Sorted by today's conversions · tenure from invite date"
          paddedBody={false}
          action={<DataSourceBadge source="live" />}
        >
          <div className="max-h-[800px] overflow-y-auto">
            <table className="tbl">
              <thead className="sticky top-0 bg-surface z-10">
                <tr>
                  <th>Knocker</th>
                  <th>Tenure</th>
                  <th>Territory</th>
                  <th>Status</th>
                  <th>Knocks</th>
                  <th>Conv.</th>
                  <th>Today rate</th>
                  <th>Lifetime rate</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {[...rows]
                  .sort((a, b) => b.conversions - a.conversions)
                  .map((n) => {
                    const todayRate = n.knocks > 0 ? (n.conversions / n.knocks) * 100 : 0;
                    return (
                      <tr key={n.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="mono">{n.initials}</span>
                            <span className="text-[13px] text-ink">{n.name}</span>
                          </div>
                        </td>
                        <td className="text-[12px] text-muted numeric">
                          {tenureLabel(n.tenureDays)}
                        </td>
                        <td className="text-[12px] text-muted">{n.territory}</td>
                        <td>
                          <StatusPill tone={REP_STATUS_TONE[n.status]}>
                            {REP_STATUS_LABEL[n.status]}
                          </StatusPill>
                        </td>
                        <td className="numeric text-[13px]">{n.knocks}</td>
                        <td className="numeric text-[13px]">{n.conversions}</td>
                        <td className="numeric text-[13px]">
                          {n.knocks > 0 ? (
                            `${todayRate.toFixed(1)}%`
                          ) : (
                            <span className="text-soft">—</span>
                          )}
                        </td>
                        <td className="numeric text-[12px] text-muted">{n.convRate.toFixed(1)}%</td>
                        <td>
                          <Money cents={n.revenueCents} region={region} emptyAsDash />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </AccountShell>
  );
}
