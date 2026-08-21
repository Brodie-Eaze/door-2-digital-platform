import { EmptyState, Money, Section, StatusPill } from '@d2d/ui-web';
import { PortalShell } from '@/components/PortalShell';
import { invoiceLabel, invoiceTone } from '@/lib/status';
import { apiFetch, getSession, wireCents, type InvoicePublic, type PageResponse } from '@/lib/api';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function fmtPeriod(inv: InvoicePublic): string {
  return new Date(inv.periodStart).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export default async function InvoicesPage(): Promise<JSX.Element> {
  const { user, org } = await getSession();
  const invoicePage = await apiFetch<PageResponse<InvoicePublic>>('/billing/invoices?limit=50');
  const invoices = invoicePage.data;

  return (
    <PortalShell
      pageTitle="Invoices"
      orgName={org.tradingName}
      userName={`${user.givenName} ${user.familyName}`}
      userEmail={user.email}
      userRole={user.role}
    >
      <div className="space-y-6 max-w-[1100px]">
        <Section title="All invoices" paddedBody={invoices.length === 0}>
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
                    <th>Created</th>
                    <th className="text-right">Total</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="font-medium">{fmtPeriod(inv)}</td>
                      <td className="text-muted">{fmtDate(inv.createdAt)}</td>
                      <td className="text-right mono font-medium">
                        <Money cents={wireCents(inv.totalCents)} region={org.regionCode} />
                      </td>
                      <td>
                        <StatusPill tone={invoiceTone(inv.status)}>
                          {invoiceLabel(inv.status)}
                        </StatusPill>
                      </td>
                      <td className="text-right">
                        <a
                          href={`/invoices/${inv.id}`}
                          className="text-[12px] text-accent hover:underline"
                        >
                          View
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <div className="card p-4">
          <div className="text-xs text-muted mb-3 uppercase tracking-wider">Billing contact</div>
          <div className="text-sm space-y-1">
            <div className="font-medium">Door 2 Digital · Accounts Receivable</div>
            <div className="text-muted">billing@door2digital.io</div>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
