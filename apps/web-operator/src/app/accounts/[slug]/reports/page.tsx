import { redirect } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { db } from '@d2d/database';
import { Banner, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { ReportsEmpty } from '@/components/AccountEmptyStates';
import { BuildReportButton, SavedReportCard } from './ReportActions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function tenureLabel(days: number): string {
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}yr`;
}

export default async function ReportsPage({
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

  const [everConversionCount, everKnockCount] = await Promise.all([
    db.conversion.count({ where: { orgId: org.id } }),
    db.knock.count({ where: { orgId: org.id } }),
  ]);
  if (everConversionCount === 0 && everKnockCount === 0) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Reports">
        <div className="space-y-5 max-w-[1400px]">
          <ReportsEmpty slug={params.slug} accountName={org.tradingName} />
        </div>
      </AccountShell>
    );
  }

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const mtdStart = new Date();
  mtdStart.setUTCDate(1);
  mtdStart.setUTCHours(0, 0, 0, 0);
  const fourteenDaysAgo = new Date(todayStart);
  fourteenDaysAgo.setUTCDate(fourteenDaysAgo.getUTCDate() - 13);

  const [mtdAgg, billing, attrMtd, commissionAgg, knockersToday, conv14d] = await Promise.all([
    db.conversion.aggregate({
      where: { orgId: org.id, signedAt: { gte: mtdStart } },
      _count: { _all: true },
      _sum: { amountCents: true },
    }),
    db.orgBilling.findUnique({
      where: { orgId: org.id },
      select: { doorRakePercent: true, insideSalesRakePercent: true, retargetingRakePercent: true },
    }),
    db.conversion.groupBy({
      by: ['attributionSource'],
      where: { orgId: org.id, signedAt: { gte: mtdStart } },
      _count: { _all: true },
      _sum: { amountCents: true },
    }),
    db.commission.aggregate({
      where: { orgId: org.id, periodStart: { lte: new Date() }, periodEnd: { gte: mtdStart } },
      _sum: { amountCents: true },
    }),
    db.knock.groupBy({
      by: ['userId'],
      where: { orgId: org.id, capturedAt: { gte: todayStart } },
      _count: { _all: true },
    }),
    db.conversion.findMany({
      where: { orgId: org.id, signedAt: { gte: fourteenDaysAgo } },
      select: { signedAt: true },
    }),
  ]);

  const conversionsMTD = mtdAgg._count._all;
  const revenueCentsMTD = mtdAgg._sum.amountCents ?? 0n;
  const commissionAccruedCents = commissionAgg._sum.amountCents ?? 0n;
  const avgDealCents = conversionsMTD > 0 ? revenueCentsMTD / BigInt(conversionsMTD) : 0n;

  const doorRake = billing ? Number(billing.doorRakePercent) : 15;
  const insideRake = billing ? Number(billing.insideSalesRakePercent) : 10;
  const retargRake = billing ? Number(billing.retargetingRakePercent) : 5;

  const attrBySource = new Map(attrMtd.map((r) => [r.attributionSource, r]));
  const attrBars = (
    [
      { src: 'Door', key: 'door' as const, rake: doorRake, color: 'bg-success' },
      { src: 'Inside sales', key: 'inside_sales' as const, rake: insideRake, color: 'bg-accent' },
      { src: 'Retargeting', key: 'retargeting' as const, rake: retargRake, color: 'bg-accent/60' },
    ] as const
  ).map((row) => {
    const r = attrBySource.get(row.key);
    const value = r?._sum.amountCents ?? 0n;
    const rakeAmt = (value * BigInt(Math.round(row.rake * 100))) / 10000n;
    return { ...row, count: r?._count._all ?? 0, value, rakeAmt };
  });
  const maxVal = attrBars.reduce((m, r) => (r.value > m ? r.value : m), 0n);

  // Top knockers today — knock + conversion counts + revenue, joined by userId.
  const knockerIds = knockersToday.map((r) => r.userId).filter((id): id is string => !!id);
  const [users, convToday] =
    knockerIds.length > 0
      ? await Promise.all([
          db.user.findMany({
            where: { id: { in: knockerIds }, orgId: org.id },
            select: { id: true, givenName: true, familyName: true, createdAt: true },
          }),
          db.conversion.groupBy({
            by: ['knockerId'],
            where: { orgId: org.id, knockerId: { in: knockerIds }, signedAt: { gte: todayStart } },
            _count: { _all: true },
            _sum: { amountCents: true },
          }),
        ])
      : [[], []];
  const userMap = new Map(users.map((u) => [u.id, u]));
  const convTodayMap = new Map(convToday.map((r) => [r.knockerId, r]));
  const knocksTodayMap = new Map(knockersToday.map((r) => [r.userId, r._count._all]));

  const topKnockers = knockerIds
    .map((id) => {
      const u = userMap.get(id);
      const c = convTodayMap.get(id);
      const knocksT = knocksTodayMap.get(id) ?? 0;
      const convT = c?._count._all ?? 0;
      return {
        id,
        initials: u
          ? `${u.givenName.charAt(0)}${u.familyName.charAt(0) ?? ''}`.toUpperCase()
          : '??',
        name: u
          ? `${u.givenName} ${u.familyName ? `${u.familyName.charAt(0)}.` : ''}`.trim()
          : 'Knocker',
        tenureDays: u
          ? Math.max(0, Math.floor((Date.now() - u.createdAt.getTime()) / (24 * 60 * 60 * 1000)))
          : 0,
        knocksToday: knocksT,
        conversionsToday: convT,
        revenueCentsToday: c?._sum.amountCents ?? 0n,
      };
    })
    .sort((a, b) => b.conversionsToday - a.conversionsToday)
    .slice(0, 8);

  // 14-day conversion trend, daily buckets.
  const dayBuckets = new Map<string, number>();
  for (let d = 0; d < 14; d++) {
    const date = new Date(fourteenDaysAgo);
    date.setUTCDate(date.getUTCDate() + d);
    dayBuckets.set(date.toISOString().slice(0, 10), 0);
  }
  for (const c of conv14d) {
    const day = c.signedAt.toISOString().slice(0, 10);
    dayBuckets.set(day, (dayBuckets.get(day) ?? 0) + 1);
  }
  const trend14d = [...dayBuckets.entries()].map(([iso, value]) => ({
    iso,
    weekday: new Date(iso).toLocaleDateString('en-US', { weekday: 'short' }),
    value,
  }));

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Reports">
      <div className="space-y-5 max-w-[1500px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Sparkles size={13} className="text-accent" /> Every report can be scheduled to email
            weekly or piped to Slack via webhook.
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="MTD revenue" value={<Money cents={revenueCentsMTD} region={region} />} />
          <KpiCard label="MTD conv." value={conversionsMTD.toLocaleString()} />
          <KpiCard label="Avg deal size" value={<Money cents={avgDealCents} region={region} />} />
          <KpiCard
            label="Commission accrued"
            value={<Money cents={commissionAccruedCents} region={region} />}
            hint="platform rake · pre-payout"
          />
        </div>

        <Section title="Conversion attribution · MTD" subtitle="Where the conversions came from">
          <div className="space-y-3">
            {attrBars.map((row) => {
              const pct = maxVal > 0n ? Number((row.value * 10000n) / maxVal) / 100 : 0;
              return (
                <div key={row.src} className="flex items-center gap-3">
                  <div className="w-28 text-[13px] text-ink">{row.src}</div>
                  <div className="flex-1 h-10 bg-paper rounded relative overflow-hidden border border-line2">
                    <div className={`h-full ${row.color}`} style={{ width: `${pct}%` }} />
                    <div className="absolute inset-0 flex items-center px-3 text-[12px] gap-3">
                      <span className="text-ink font-semibold numeric">
                        {row.count.toLocaleString()}
                      </span>
                      <span className="text-muted">·</span>
                      <span className="text-ink numeric">
                        <Money cents={row.value} region={region} />
                      </span>
                      <span className="text-muted">GMV</span>
                      <div className="flex-1" />
                      <span className="text-success font-semibold numeric">
                        D2D rake {row.rake}% · <Money cents={row.rakeAmt} region={region} />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Section title="Top Knockers · today" paddedBody={false}>
            {topKnockers.length === 0 ? (
              <div className="px-5 py-8 text-center text-[12px] text-soft">
                No field activity yet today
              </div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Knocker</th>
                    <th>Tenure</th>
                    <th>Knocks</th>
                    <th>Conv.</th>
                    <th>Rate</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topKnockers.map((k) => {
                    const rate = k.knocksToday > 0 ? (k.conversionsToday / k.knocksToday) * 100 : 0;
                    return (
                      <tr key={k.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="mono">{k.initials}</span>
                            <span className="text-[13px] text-ink">{k.name}</span>
                          </div>
                        </td>
                        <td className="numeric text-[12px] text-muted">
                          {tenureLabel(k.tenureDays)}
                        </td>
                        <td className="numeric text-[13px]">{k.knocksToday.toLocaleString()}</td>
                        <td className="numeric text-[13px]">{k.conversionsToday}</td>
                        <td>
                          <StatusPill tone={rate > 18 ? 'success' : rate > 10 ? 'info' : 'muted'}>
                            {rate.toFixed(1)}%
                          </StatusPill>
                        </td>
                        <td>
                          <Money cents={k.revenueCentsToday} region={region} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Section>

          <Section
            title="Pipeline velocity by stage"
            subtitle="Median time per stage — awaiting stage-transition tracking"
          >
            <div className="px-1 py-6 text-center text-[12px] text-soft">
              Not yet available. This needs stage-transition timestamps (LeadActivity) that
              aren&apos;t captured yet — no placeholder numbers shown.
            </div>
          </Section>
        </div>

        <Section
          title="14-day conversion trend"
          subtitle={`${org.tradingName} · daily conversions from Postgres`}
        >
          <SimpleBarChart data={trend14d} label={`${org.tradingName} · daily conversions`} />
        </Section>

        <Section
          title="Saved reports"
          subtitle="Scheduled to email · click to view"
          action={
            <>
              <DataSourceBadge source="live" />
              <BuildReportButton />
            </>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { title: 'Conversion attribution · weekly', schedule: 'Every Monday 09:00' },
              { title: 'Commission accrual by Knocker', schedule: 'Fortnightly · payroll day' },
              { title: 'CPA by marketing channel', schedule: 'Weekly · Tue 09:00' },
              { title: 'Lead-to-close cycle time', schedule: 'Monthly · 1st' },
              { title: 'Pipeline velocity', schedule: 'Weekly · Fri 17:00' },
              { title: 'Cohort retention (donors)', schedule: 'Monthly · 1st' },
            ].map((r) => (
              <SavedReportCard
                key={r.title}
                title={r.title}
                schedule={r.schedule}
                last="Not run yet"
              />
            ))}
          </div>
        </Section>
      </div>
    </AccountShell>
  );
}

/**
 * Hand-rolled bar chart — no external deps.
 */
function SimpleBarChart({
  data,
  label,
}: {
  data: { iso: string; weekday: string; value: number }[];
  label: string;
}): JSX.Element {
  const max = Math.max(...data.map((p) => p.value), 1);
  return (
    <div className="w-full">
      <div className="flex gap-1 items-end" style={{ height: 200 }}>
        {data.map((p) => {
          const h = (p.value / max) * 100;
          const isWeekend = p.weekday === 'Sat' || p.weekday === 'Sun';
          return (
            <div
              key={p.iso}
              className="flex-1 flex flex-col items-center justify-end h-full"
              title={`${p.iso} · ${p.weekday} · ${p.value.toLocaleString()}`}
            >
              <div className="text-[9px] text-muted numeric mb-1">{p.value}</div>
              <div
                className={`w-full rounded-t ${isWeekend ? 'bg-accent/40' : 'bg-accent'}`}
                style={{ height: `${h}%` }}
              />
              <div className="text-[9px] text-soft mt-1">{p.weekday[0]}</div>
            </div>
          );
        })}
      </div>
      <div className="text-[10px] text-soft text-center mt-2 numeric">{label}</div>
    </div>
  );
}
