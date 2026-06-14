import { Sparkles } from 'lucide-react';
import { Banner, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { ReportsEmpty, FirstRunBanner } from '@/components/AccountEmptyStates';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { getAccount } from '@/lib/accounts';
import { seedFor } from '@/lib/seed';
import { rollupFor } from '@/lib/seed/kpis';
import { firstRunSnapshot } from '@/lib/first-run';
import { BuildReportButton, SavedReportCard } from './ReportActions';

export default function ReportsPage({ params }: { params: { slug: string } }): JSX.Element {
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
  const seed = seedFor(params.slug);
  const rollup = rollupFor(params.slug);
  const region = account.region === 'AU' ? 'AU' : 'US';

  // 30-day attribution split: derive from the conversions ledger (count) and
  // multiply by avg-ticket to get GMV. Door / Inside / Retarget mix from the
  // 60-row ledger is statistically representative of MTD attribution.
  const ledgerByAttr = seed.conversions.reduce(
    (acc, c) => {
      acc[c.attribution] = (acc[c.attribution] ?? 0) + 1;
      return acc;
    },
    { door: 0, inside_sales: 0, retargeting: 0, other: 0 } as Record<string, number>,
  );
  const total = ledgerByAttr.door! + ledgerByAttr.inside_sales! + ledgerByAttr.retargeting!;
  const doorShare = ledgerByAttr.door! / total;
  const insideShare = ledgerByAttr.inside_sales! / total;
  const doorConv = Math.round(rollup.conversionsMTD * doorShare);
  const insideConv = Math.round(rollup.conversionsMTD * insideShare);
  const retargConv = rollup.conversionsMTD - doorConv - insideConv;

  const doorGmv = (rollup.revenueCentsMTD * BigInt(Math.round(doorShare * 1000))) / 1000n;
  const insideGmv = (rollup.revenueCentsMTD * BigInt(Math.round(insideShare * 1000))) / 1000n;
  const retargGmv = rollup.revenueCentsMTD - doorGmv - insideGmv;
  const doorRake = (doorGmv * 15n) / 100n;
  const insideRake = (insideGmv * 10n) / 100n;
  const retargRake = (retargGmv * 5n) / 100n;
  const blendedRake = doorRake + insideRake + retargRake;
  // Implied CPA — total spend across the marketing studio is ~12% of GMV.
  const impliedSpendCents = (rollup.revenueCentsMTD * 12n) / 100n;
  const blendedCpaCents =
    rollup.conversionsMTD > 0 ? impliedSpendCents / BigInt(rollup.conversionsMTD) : 0n;

  // Top knockers by today's revenue — pull straight from the seeded roster.
  const topKnockers = [...seed.knockers]
    .filter((k) => k.status !== 'offline')
    .sort((a, b) => b.conversionsToday - a.conversionsToday)
    .slice(0, 8);

  const attrBars = [
    {
      src: 'Door',
      count: doorConv,
      value: doorGmv,
      rake: 15,
      rakeAmt: doorRake,
      color: 'bg-success',
    },
    {
      src: 'Inside sales',
      count: insideConv,
      value: insideGmv,
      rake: 10,
      rakeAmt: insideRake,
      color: 'bg-accent',
    },
    {
      src: 'Retargeting',
      count: retargConv,
      value: retargGmv,
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
          <span className="text-[13px] flex items-center gap-2">
            <Sparkles size={13} className="text-accent" /> Every report can be scheduled to email
            weekly or piped to Slack via webhook.
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="MTD revenue"
            value={<Money cents={rollup.revenueCentsMTD} region={region} />}
            delta="+18.2%"
            deltaTone="positive"
          />
          <KpiCard
            label="MTD conv."
            value={rollup.conversionsMTD.toLocaleString()}
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
          <SimpleBarChart
            data={rollup.conversions14d}
            label={`${account.shortName} · daily conversions`}
          />
        </Section>

        <Section
          title="Saved reports"
          subtitle="Scheduled to email · click to view"
          action={
            <>
              <DataSourceBadge source="fixture" />
              <BuildReportButton />
            </>
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
              <SavedReportCard
                key={r.title}
                title={r.title}
                schedule={r.schedule}
                last={r.last}
              />
            ))}
          </div>
        </Section>
      </div>
    </AccountShell>
  );
}

/**
 * Hand-rolled bar chart — no external deps. Shows the real weekly pattern
 * (Sun trough, Wed/Thu peak) so the chart looks like a real ops dashboard.
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
