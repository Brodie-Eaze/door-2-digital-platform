import { Banner, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { OrgShell } from '@/components/OrgShell';
import { apiFetch, wireCents, type CommissionsResponse } from '@/lib/api';

function shortId(id: string): string {
  return id.slice(-6).toUpperCase();
}

function statusTone(status: string): 'info' | 'success' | 'muted' {
  if (status === 'accrued') return 'info';
  if (status === 'paid') return 'success';
  return 'muted';
}

export default async function CommissionsPage(): Promise<JSX.Element> {
  const commissionPage = await apiFetch<CommissionsResponse>('/commissions');
  const commissions = commissionPage.commissions;
  const accrued = commissions.filter((commission) => commission.status === 'accrued').length;
  const included = commissions.filter((commission) => commission.status === 'included').length;
  const paid = commissions.filter((commission) => commission.status === 'paid').length;

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
            label="Total listed"
            value={<Money cents={wireCents(commissionPage.totalCents)} region="US" />}
            animate={false}
          />
          <KpiCard label="Accrued rows" value={accrued} animate={false} />
          <KpiCard label="Included rows" value={included} animate={false} />
          <KpiCard label="Paid rows" value={paid} animate={false} />
        </div>

        <Section
          title="Commission accruals"
          subtitle="Latest commission rows from the org ledger"
          paddedBody={false}
        >
          {commissions.length === 0 ? (
            <div className="text-[12px] text-muted p-5">
              No commissions yet — they appear when knocks or conversions accrue payouts.
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Period</th>
                  <th>Conversion</th>
                  <th>Payout batch</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((commission) => (
                  <tr key={commission.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="mono">{shortId(commission.userId)}</span>
                        <span className="text-[13px] text-ink">
                          User {shortId(commission.userId)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="tag">{commission.type.replace('_', ' ')}</span>
                    </td>
                    <td className="font-semibold">
                      <Money cents={wireCents(commission.amountCents)} region="US" />
                    </td>
                    <td className="numeric text-[12px] text-muted">
                      {new Date(commission.periodStart).toISOString().slice(0, 10)} ·{' '}
                      {new Date(commission.periodEnd).toISOString().slice(0, 10)}
                    </td>
                    <td>
                      {commission.conversionId ? (
                        <span className="mono">{shortId(commission.conversionId)}</span>
                      ) : (
                        <span className="text-soft">—</span>
                      )}
                    </td>
                    <td>
                      {commission.payoutBatchId ? (
                        <span className="tag">{shortId(commission.payoutBatchId)}</span>
                      ) : (
                        <span className="text-soft">—</span>
                      )}
                    </td>
                    <td>
                      <StatusPill tone={statusTone(commission.status)}>
                        {commission.status}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
        {commissionPage.nextCursor && (
          <div className="text-[11px] text-muted">
            More commissions are available after this first page.
          </div>
        )}
      </div>
    </OrgShell>
  );
}
