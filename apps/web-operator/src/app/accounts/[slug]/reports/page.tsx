import { BarChart3, Download, Sparkles, ChevronRight } from 'lucide-react';
import { Banner, Button, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';

export default function ReportsPage({ params }: { params: { slug: string } }): JSX.Element {
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
            value={<Money cents={1_605_240_00n} region="US" />}
            delta="+18.2%"
            deltaTone="positive"
          />
          <KpiCard label="MTD conv." value="4,831" delta="+12%" deltaTone="positive" />
          <KpiCard
            label="Blended CPA"
            value={<Money cents={158_00n} region="US" />}
            delta="-12%"
            deltaTone="positive"
          />
          <KpiCard
            label="Commission accrued"
            value={<Money cents={48_220_00n} region="US" />}
            hint="pre-payout"
          />
        </div>

        <Section
          title="Conversion attribution · last 30 days"
          subtitle="Where the conversions came from"
        >
          <div className="space-y-3">
            {[
              {
                src: 'Door',
                count: 3140,
                value: 942_240_00n,
                rake: 15,
                rakeAmt: 141_336_00n,
                color: 'bg-success',
              },
              {
                src: 'Inside sales',
                count: 1180,
                value: 472_320_00n,
                rake: 10,
                rakeAmt: 47_232_00n,
                color: 'bg-accent',
              },
              {
                src: 'Retargeting',
                count: 511,
                value: 190_680_00n,
                rake: 5,
                rakeAmt: 9_534_00n,
                color: 'bg-accent/60',
              },
            ].map((row) => {
              const max = 942_240_00n;
              const pct = (Number(row.value) / Number(max)) * 100;
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
                        <Money cents={row.value} region="US" />
                      </span>
                      <span className="text-muted">GMV</span>
                      <div className="flex-1" />
                      <span className="text-success font-semibold numeric">
                        D2D rake {row.rake}% · <Money cents={row.rakeAmt} region="US" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Section title="Top Knockers (revenue · last 30d)" paddedBody={false}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Knocker</th>
                  <th>Knocks</th>
                  <th>Conv.</th>
                  <th>Rate</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { i: 'JM', n: 'Jordan Mosley', k: 1840, c: 612, r: 33.3, v: 184_320_00n },
                  { i: 'JD', n: 'Jada Davis', k: 1920, c: 440, r: 22.9, v: 132_440_00n },
                  { i: 'AR', n: 'Aaliyah Reed', k: 1560, c: 360, r: 23.1, v: 108_220_00n },
                  { i: 'TM', n: 'Tomás Mendez', k: 1480, c: 280, r: 18.9, v: 84_160_00n },
                  { i: 'KP', n: 'Kim Park', k: 1420, c: 300, r: 21.1, v: 92_180_00n },
                ].map((k) => (
                  <tr key={k.i}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="mono">{k.i}</span>
                        <span className="text-[13px] text-ink">{k.n}</span>
                      </div>
                    </td>
                    <td className="numeric text-[13px]">{k.k.toLocaleString()}</td>
                    <td className="numeric text-[13px]">{k.c}</td>
                    <td>
                      <StatusPill tone={k.r > 25 ? 'success' : 'info'}>{k.r}%</StatusPill>
                    </td>
                    <td>
                      <Money cents={k.v} region="US" />
                    </td>
                  </tr>
                ))}
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
