import { Banner, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { OrgShell } from '@/components/OrgShell';
import { COMMISSIONS } from '@/lib/fixtures';

export default function CommissionsPage(): JSX.Element {
  const totalCommissions = COMMISSIONS.reduce((sum, c) => sum + c.totalCents, 0n);

  return (
    <OrgShell pageTitle="Commissions">
      <div className="space-y-6 max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px]">
            D2D never auto-debits per <code className="kbd">ADR-0019</code>. Payout batches generate
            a NACHA/CSV instruction file → ops downloads and executes manually in the banking app.
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Accrued today"
            value={<Money cents={totalCommissions} region="US" />}
            delta="+22.4%"
            deltaTone="positive"
          />
          <KpiCard label="Active plans" value="3" hint="Charity-Standard, Lead, Override" />
          <KpiCard label="Next payout" value="PAY-2026-05A" hint="2026-06-01" />
          <KpiCard label="Disputes open" value="0" />
        </div>

        <Section
          title="Today's accruals"
          subtitle="Base ($1/knock) + per-conversion bonus ($10) + lead-by-knocker bonus ($30)"
          paddedBody={false}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Knocker</th>
                <th>Base (knocks)</th>
                <th>Conversions</th>
                <th>Total accrued</th>
                <th>Payout batch</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {COMMISSIONS.map((c) => (
                <tr key={c.knocker}>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="mono">{c.initials}</span>
                      <span className="text-[13px] text-ink">{c.knocker}</span>
                    </div>
                  </td>
                  <td>
                    <Money cents={c.baseCents} region="US" />
                  </td>
                  <td>
                    <Money cents={c.conversionsCents} region="US" />
                  </td>
                  <td className="font-semibold">
                    <Money cents={c.totalCents} region="US" />
                  </td>
                  <td>
                    <span className="tag">{c.payoutBatch}</span>
                  </td>
                  <td>
                    <StatusPill tone="info">Accrued</StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
    </OrgShell>
  );
}
