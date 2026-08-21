import { EmptyState, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { PortalShell } from '@/components/PortalShell';
import { invoiceLabel, invoiceTone } from '@/lib/status';
import {
  apiFetch,
  getSession,
  sumWireCents,
  wireCents,
  type InvoicePublic,
  type PageResponse,
} from '@/lib/api';

function fmtPeriod(inv: InvoicePublic): string {
  return new Date(inv.periodStart).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export default async function DashboardPage(): Promise<JSX.Element> {
  const { user, org } = await getSession();
  const [invoicePage] = await Promise.all([
    apiFetch<PageResponse<InvoicePublic>>('/billing/invoices?limit=5'),
  ]);
  const invoices = invoicePage.data;
  const currentInvoice = invoices[0] ?? null;
  const outstandingCents = sumWireCents(
    invoices.filter((i) => i.status === 'sent'),
    (i) => i.totalCents,
  );

  return (
    <PortalShell
      pageTitle="Dashboard"
      orgName={org.tradingName}
      userName={`${user.givenName} ${user.familyName}`}
      userEmail={user.email}
      userRole={user.role}
    >
      <div className="space-y-6">
        <Section title="This month at a glance">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Current invoice"
              value={
                currentInvoice ? (
                  <Money cents={wireCents(currentInvoice.totalCents)} region={org.regionCode} />
                ) : (
                  '—'
                )
              }
              hint={currentInvoice ? fmtPeriod(currentInvoice) : 'no invoices yet'}
              animate={false}
            />
            <KpiCard
              label="Outstanding"
              value={<Money cents={outstandingCents} region={org.regionCode} />}
              hint="sent, unpaid"
              animate={false}
            />
            <KpiCard label="Vertical" value={org.vertical} hint={org.regionCode} />
            <KpiCard label="Status" value={org.status} hint={org.brandCode} />
          </div>
        </Section>

        <Section title="Recent invoices" paddedBody={invoices.length === 0}>
          {invoices.length === 0 ? (
            <EmptyState
              title="No invoices yet"
              description="Invoices appear here once D2D generates the first billing period for your account."
            />
          ) : (
            <div className="tbl-wrapper">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th className="text-right">Platform fee</th>
                    <th className="text-right">Rake</th>
                    <th className="text-right">Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const rake =
                      wireCents(inv.doorRakeCents) +
                      wireCents(inv.insideSalesRakeCents) +
                      wireCents(inv.retargetingRakeCents);
                    return (
                      <tr key={inv.id}>
                        <td className="font-medium">
                          <a href={`/invoices/${inv.id}`} className="hover:text-accent">
                            {fmtPeriod(inv)}
                          </a>
                        </td>
                        <td className="text-right mono">
                          <Money cents={wireCents(inv.platformFeeCents)} region={org.regionCode} />
                        </td>
                        <td className="text-right mono">
                          <Money cents={rake} region={org.regionCode} />
                        </td>
                        <td className="text-right mono font-medium">
                          <Money cents={wireCents(inv.totalCents)} region={org.regionCode} />
                        </td>
                        <td>
                          <StatusPill tone={invoiceTone(inv.status)}>
                            {invoiceLabel(inv.status)}
                          </StatusPill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </PortalShell>
  );
}
