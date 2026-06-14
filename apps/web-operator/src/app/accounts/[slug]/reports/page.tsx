/**
 * /accounts/[slug]/reports — attribution + revenue analytics for a single account.
 *
 * Server component. Reads live MTD conversion aggregates from Prisma for
 * the KPI rail + attribution breakdown. The 14-day bar chart and pipeline
 * velocity sections remain seed-driven until a time-series aggregation model
 * exists. Falls back to full fixture when the DB is unreachable.
 *
 * TODO(M5): 14d revenue time-series needs a ConversionDailySummary
 * materialised view or equivalent — no backing aggregation table yet.
 * TODO(M5): Pipeline velocity needs a LeadActivity duration model.
 *
 * Authorization: cross-tenant operators see any slug; org-scoped sessions
 * are pinned to their own org's slug.
 */
import { BarChart3, Download, Sparkles, ChevronRight, Database, AlertTriangle } from 'lucide-react';
import { Banner, Button, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { ReportsEmpty, FirstRunBanner } from '@/components/AccountEmptyStates';
import { getAccount } from '@/lib/accounts';
import { seedFor } from '@/lib/seed';
import { rollupFor } from '@/lib/seed/kpis';
import { firstRunSnapshot } from '@/lib/first-run';
import { getSession } from '@/lib/session';
import { isCrossTenantOperator } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── types ──────────────────────────────────────────────────────────────────

interface ReportsData {
  conversionsMTD: number;
  revenueCentsMTD: bigint;
  doorCount: number;
  insideCount: number;
  retargCount: number;
  doorRevenue: bigint;
  insideRevenue: bigint;
  retargRevenue: bigint;
  source: 'database' | 'fixture-fallback';
  error?: string;
}

// ─── data loader ────────────────────────────────────────────────────────────

async function loadReports(slug: string): Promise<ReportsData> {
  const session = await getSession();
  if (!session) {
    return {
      conversionsMTD: 0,
      revenueCentsMTD: 0n,
      doorCount: 0,
      insideCount: 0,
      retargCount: 0,
      doorRevenue: 0n,
      insideRevenue: 0n,
      retargRevenue: 0n,
      source: 'fixture-fallback',
      error: 'no session',
    };
  }

  try {
    const { db } = await import('@d2d/database');

    const org = await db.org.findFirst({
      where: { slug },
      select: { id: true },
    });
    if (!org) throw new Error(`org with slug '${slug}' not found`);

    if (!isCrossTenantOperator(session) && session.orgId !== org.id) {
      throw new Error('tenant scope violation');
    }

    const mtdStart = new Date();
    mtdStart.setDate(1);
    mtdStart.setHours(0, 0, 0, 0);

    const convAgg = await db.conversion.groupBy({
      by: ['attributionSource'],
      where: { orgId: org.id, signedAt: { gte: mtdStart } },
      _count: { _all: true },
      _sum: { amountCents: true },
    });

    let doorCount = 0,
      insideCount = 0,
      retargCount = 0;
    let doorRevenue = 0n,
      insideRevenue = 0n,
      retargRevenue = 0n;
    let totalMTD = 0;
    let totalRevCents = 0n;

    for (const row of convAgg) {
      const c = row._count._all;
      const r = row._sum.amountCents ?? 0n;
      totalMTD += c;
      totalRevCents += r;
      if (row.attributionSource === 'door') {
        doorCount = c;
        doorRevenue = r;
      } else if (row.attributionSource === 'inside_sales') {
        insideCount = c;
        insideRevenue = r;
      } else if (row.attributionSource === 'retargeting') {
        retargCount = c;
        retargRevenue = r;
      }
    }

    return {
      conversionsMTD: totalMTD,
      revenueCentsMTD: totalRevCents,
      doorCount,
      insideCount,
      retargCount,
      doorRevenue,
      insideRevenue,
      retargRevenue,
      source: 'database',
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[reports/${slug}] DB load failed, falling back to fixture:`, err);
    const seed = seedFor(slug);
    const rollup = rollupFor(slug);
    const ledgerByAttr = seed.conversions.reduce(
      (acc, c) => {
        acc[c.attribution] = (acc[c.attribution] ?? 0) + 1;
        return acc;
      },
      { door: 0, inside_sales: 0, retargeting: 0, other: 0 } as Record<string, number>,
    );
    const total =
      (ledgerByAttr.door ?? 0) + (ledgerByAttr.inside_sales ?? 0) + (ledgerByAttr.retargeting ?? 0);
    const doorShare = total > 0 ? (ledgerByAttr.door ?? 0) / total : 0;
    const insideShare = total > 0 ? (ledgerByAttr.inside_sales ?? 0) / total : 0;
    const retargShare = total > 0 ? (ledgerByAttr.retargeting ?? 0) / total : 0;

    return {
      conversionsMTD: rollup.conversionsMTD,
      revenueCentsMTD: rollup.revenueCentsMTD,
      doorCount: Math.round(rollup.conversionsMTD * doorShare),
      insideCount: Math.round(rollup.conversionsMTD * insideShare),
      retargCount: Math.round(rollup.conversionsMTD * retargShare),
      doorRevenue: BigInt(Math.round(Number(rollup.revenueCentsMTD) * doorShare)),
      insideRevenue: BigInt(Math.round(Number(rollup.revenueCentsMTD) * insideShare)),
      retargRevenue: BigInt(Math.round(Number(rollup.revenueCentsMTD) * retargShare)),
      source: 'fixture-fallback',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── page ────────────────────────────────────────────────────────────────────

export default async function ReportsPage({
  params,
}: {
  params: { slug: string };
}): Promise<JSX.Element> {
  const account = getAccount(params.slug);
  const firstRun = firstRunSnapshot(params.slug);
  if (!account || firstRun.isFirstRun) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Reports">
        <div className="space-y-5 max-w-[1400px]">
          {firstRun.isFirstRun && (
            <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          )}
          <ReportsEmpty slug={params.slug} accountName={firstRun.accountName} />
        </div>
      </AccountShell>
    );
  }

  const {
    conversionsMTD,
    revenueCentsMTD,
    doorCount,
    insideCount,
    retargCount,
    doorRevenue,
    insideRevenue,
    retargRevenue,
    source,
    error,
  } = await loadReports(params.slug);

  // Seed rollup still drives the 14d chart and deltas until those are DB-backed.
  // TODO(M5): 14d chart needs ConversionDailySummary view — no backing table yet.
  const seed = seedFor(params.slug);
  const rollup = rollupFor(params.slug);
  const region = account.region === 'AU' ? 'AU' : 'US';

  // Attribution bars — prefer live data.
  const doorRake = (doorRevenue * 15n) / 100n;
  const insideRake = (insideRevenue * 10n) / 100n;
  const retargRake = (retargRevenue * 5n) / 100n;
  const blendedRake = doorRake + insideRake + retargRake;

  // CPA — implied ~12% of GMV as marketing spend.
  const impliedSpendCents = (revenueCentsMTD * 12n) / 100n;
  const blendedCpaCents = conversionsMTD > 0 ? impliedSpendCents / BigInt(conversionsMTD) : 0n;

  // Top knockers from seed until per-rep live leaderboard is DB-backed.
  // TODO(M5): top-knockers leaderboard needs per-rep live aggregation query.
  const topKnockers = [...seed.knockers]
    .filter((k) => k.status !== 'offline')
    .sort((a, b) => b.conversionsToday - a.conversionsToday)
    .slice(0, 8);

  const attrBars = [
    {
      src: 'Door',
      count: doorCount,
      value: doorRevenue,
      rake: 15,
      rakeAmt: doorRake,
      color: 'bg-success',
    },
    {
      src: 'Inside sales',
      count: insideCount,
      value: insideRevenue,
      rake: 10,
      rakeAmt: insideRake,
      color: 'bg-accent',
    },
    {
      src: 'Retargeting',
      count: retargCount,
      value: retargRevenue,
      rake: 5,
      rakeAmt: retargRake,
      color: 'bg-accent/60',
    },
  ];
  const maxVal = attrBars.reduce((m, r) => (r.value > m ? r.value : m), 0n);

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Reports">
      <div className="space-y-5 max-w-[1500px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sparkles size={13} className="text-accent" /> Every report can be scheduled to email
              weekly or piped to Slack via webhook.
            </span>
            {source === 'database' ? (
              <span className="inline-flex items-center gap-1 text-success text-[10px] uppercase tracking-wider font-semibold ml-4 shrink-0">
                <Database size={10} /> Live
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 text-warn text-[10px] uppercase tracking-wider font-semibold ml-4 shrink-0"
                title={error}
              >
                <AlertTriangle size={10} /> Fixture
              </span>
            )}
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="MTD revenue"
            value={<Money cents={revenueCentsMTD} region={region} />}
            delta="+18.2%"
            deltaTone="positive"
          />
          <KpiCard
            label="MTD conv."
            value={conversionsMTD.toLocaleString()}
            delta="+12%"
            deltaTone="positive"
          />
          <KpiCard
            label="Blended CPA"
            value={<Money cents={blendedCpaCents} region={region} />}
            delta="-12%"
            deltaTone="positive"
          />
          <KpiCard
            label="Commission accrued"
            value={<Money cents={blendedRake} region={region} />}
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
          <Section title={`Top Knockers · today`} paddedBody={false}>
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
                  const tenure =
                    k.tenureDays < 30
                      ? `${k.tenureDays}d`
                      : k.tenureDays < 365
                        ? `${Math.round(k.tenureDays / 30)}mo`
                        : `${(k.tenureDays / 365).toFixed(1)}yr`;
                  return (
                    <tr key={k.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="mono">{k.initials}</span>
                          <span className="text-[13px] text-ink">{k.name}</span>
                        </div>
                      </td>
                      <td className="numeric text-[12px] text-muted">{tenure}</td>
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
          </Section>

          <Section title="Pipeline velocity by stage" subtitle="Median time per stage · last 30d">
            {/* TODO(M5): pipeline velocity needs LeadActivity duration model — no backing table yet */}
            <div className="space-y-3">
              {[
                { stage: 'New → Contacted', days: 0.3, prev: 0.5 },
                { stage: 'Contacted → Qualified', days: 1.2, prev: 1.4 },
                { stage: 'Qualified → Appointment', days: 0.8, prev: 1.1 },
                { stage: 'Appointment → Converted', days: 1.4, prev: 2.0 },
              ].map((s) => (
                <div key={s.stage} className="flex items-center gap-3">
                  <div className="flex-1 text-[12px] text-ink">{s.stage}</div>
                  <div className="w-40 h-5 bg-paper rounded border border-line2 relative overflow-hidden">
                    <div
                      className="h-full bg-accent"
                      style={{ width: `${(s.days / 2.5) * 100}%` }}
                    />
                    <div className="absolute inset-0 flex items-center px-2 text-[11px] font-semibold text-ink numeric">
                      {s.days}d
                    </div>
                  </div>
                  <span className="text-[11px] text-success numeric w-12 text-right">
                    -{(s.prev - s.days).toFixed(1)}d
                  </span>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <Section
          title="14-day conversion trend"
          subtitle="Weekday peaks · weekend trough · trend +2.2% WoW"
        >
          {/* TODO(M5): replace with ConversionDailySummary query once view is created */}
          <SimpleBarChart
            data={rollup.conversions14d}
            label={`${account.shortName} · daily conversions`}
          />
        </Section>

        <Section
          title="Saved reports"
          subtitle="Scheduled to email · click to view"
          action={
            <Button variant="primary" size="sm" leftIcon={<BarChart3 size={13} />}>
              Build report
            </Button>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                title: 'Conversion attribution · weekly',
                schedule: 'Every Monday 09:00',
                last: 'Mon May 19',
              },
              {
                title: 'Commission accrual by Knocker',
                schedule: 'Fortnightly · payroll day',
                last: 'May 16',
              },
              { title: 'CPA by marketing channel', schedule: 'Weekly · Tue 09:00', last: 'May 20' },
              { title: 'Lead-to-close cycle time', schedule: 'Monthly · 1st', last: 'May 1' },
              { title: 'Pipeline velocity', schedule: 'Weekly · Fri 17:00', last: 'May 16' },
              { title: 'Cohort retention (donors)', schedule: 'Monthly · 1st', last: 'May 1' },
            ].map((r) => (
              <div
                key={r.title}
                className="card card-pad hover:shadow-md transition cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[13px] font-semibold text-ink">{r.title}</div>
                    <div className="text-[11px] text-muted mt-0.5">{r.schedule}</div>
                  </div>
                  <ChevronRight size={14} className="text-soft" />
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px]">
                  <span className="text-muted">Last run {r.last}</span>
                  <button className="text-accent font-medium hover:underline flex items-center gap-1">
                    <Download size={11} /> CSV
                  </button>
                </div>
              </div>
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
