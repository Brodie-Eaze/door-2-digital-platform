import { PartnerShell } from '@/components/PartnerShell';
import { Section, KpiCard, StatusPill, Money } from '@d2d/ui-web';
import { INVOICES, CONVERSION_SUMMARY, STATE_CLEARANCES, PAYOUT_STATEMENTS } from '@/lib/fixtures';

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function DashboardPage() {
  const latestInvoice = INVOICES[0]!;
  const latestPayout = PAYOUT_STATEMENTS[0]!;
  const cleared = STATE_CLEARANCES.filter((s) => s.status === 'cleared').length;
  const pending = STATE_CLEARANCES.filter((s) => s.status === 'pending').length;
  const totalConversions = CONVERSION_SUMMARY.reduce((a, c) => a + c.value, 0);

  return (
    <PartnerShell pageTitle="Dashboard">
      <div className="space-y-6">
        <Section title="This month at a glance">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Current invoice"
              value={formatCents(latestInvoice.totalCents)}
              hint={latestInvoice.period}
            />
            <KpiCard
              label="Total conversions"
              value={totalConversions.toLocaleString()}
              hint="May 2026"
            />
            <KpiCard
              label="States cleared"
              value={`${cleared} / ${cleared + pending}`}
              hint={`${pending} pending approval`}
            />
            <KpiCard
              label="Last payout"
              value={formatCents(latestPayout.totalCents)}
              hint={latestPayout.period}
            />
          </div>
        </Section>

        <Section title="Recent invoices">
          <div className="tbl-wrapper">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Issued</th>
                  <th>Due</th>
                  <th className="text-right">Platform fee</th>
                  <th className="text-right">Rake</th>
                  <th className="text-right">Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {INVOICES.map((inv) => {
                  const rake =
                    inv.doorRakeCents + inv.insideSalesRakeCents + inv.retargetingRakeCents;
                  return (
                    <tr key={inv.id}>
                      <td className="font-medium">{inv.period}</td>
                      <td className="text-muted">{inv.issuedDate}</td>
                      <td className="text-muted">{inv.dueDate}</td>
                      <td className="text-right mono">{formatCents(inv.platformFeeCents)}</td>
                      <td className="text-right mono">{formatCents(rake)}</td>
                      <td className="text-right mono font-medium">{formatCents(inv.totalCents)}</td>
                      <td>
                        <StatusPill tone={inv.status === 'outstanding' ? 'warn' : 'success'}>
                          {inv.status === 'outstanding' ? 'Outstanding' : 'Paid'}
                        </StatusPill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Conversion breakdown — May 2026">
          <div className="grid grid-cols-3 gap-4">
            {CONVERSION_SUMMARY.map((cs) => (
              <div key={cs.label} className="card p-4">
                <div className="text-muted text-xs mb-1">{cs.label}</div>
                <div className="text-2xl font-semibold mono">{cs.value.toLocaleString()}</div>
                <div className="text-muted text-xs mt-1">{cs.rake}% rake bucket</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Compliance — state clearances">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {STATE_CLEARANCES.map((sc) => (
              <div key={sc.code} className="card p-3 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="mono font-semibold text-sm">{sc.code}</span>
                  <StatusPill
                    tone={
                      sc.status === 'cleared'
                        ? 'success'
                        : sc.status === 'pending'
                          ? 'warn'
                          : sc.status === 'expired'
                            ? 'danger'
                            : 'muted'
                    }
                  >
                    {sc.status === 'cleared'
                      ? 'Cleared'
                      : sc.status === 'pending'
                        ? 'Pending'
                        : sc.status === 'expired'
                          ? 'Expired'
                          : 'Not filed'}
                  </StatusPill>
                </div>
                <div className="text-muted text-xs truncate">{sc.state}</div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </PartnerShell>
  );
}
