import { Banner, KpiCard, Money, Section } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';

export default function ReportsPage({ params }: { params: { slug: string } }): JSX.Element {
  return (
    <AccountShell accountSlug={params.slug} pageTitle="Reports">
      <div className="space-y-6 max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px]">
            Conversion attribution · commission accrual · CPA by channel · cohort retention.
            Schedule any report to email weekly.
          </span>
        </Banner>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="MTD revenue"
            value={<Money cents={1_605_240_00n} region="US" />}
            delta="+18.2%"
            deltaTone="positive"
          />
          <KpiCard label="Conv. attributed" value="4,831" delta="+12%" deltaTone="positive" />
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
          title="Reports"
          subtitle="Click any to drill in — full implementation lands Phase 1.4"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              'Conversions by attribution',
              'Commission accrual by Noctua',
              'CPA by marketing channel',
              'Lead-to-close cycle time',
              'Pipeline velocity',
              'Cohort retention',
            ].map((r) => (
              <div key={r} className="card card-pad hover:shadow-md transition cursor-pointer">
                <div className="text-[13px] font-semibold text-ink">{r}</div>
                <div className="text-[11px] text-muted mt-1">Last 30 days · auto-refresh</div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </AccountShell>
  );
}
