import './print.css';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Money, StatusPill } from '@d2d/ui-web';
import { PortalShell } from '@/components/PortalShell';
import { PrintButton } from '@/components/PrintButton';
import { invoiceLabel, invoiceTone } from '@/lib/status';
import { apiFetch, getSession, isApiErrorStatus, wireCents, type InvoicePublic } from '@/lib/api';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
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
    month: 'long',
    timeZone: 'UTC',
  });
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element> {
  const { id } = await params;
  const { user, org } = await getSession();

  let invoice: InvoicePublic;
  try {
    invoice = await apiFetch<InvoicePublic>(`/billing/invoices/${id}`);
  } catch (err) {
    if (isApiErrorStatus(err, 404)) notFound();
    throw err;
  }

  return (
    <PortalShell
      pageTitle={`Invoice · ${fmtPeriod(invoice)}`}
      orgName={org.tradingName}
      userName={`${user.givenName} ${user.familyName}`}
      userEmail={user.email}
      userRole={user.role}
    >
      <div className="max-w-[860px] mx-auto space-y-4">
        {/* Screen-only controls */}
        <div className="no-print flex items-center justify-between">
          <Link
            href="/invoices"
            className="text-[13px] text-muted hover:text-ink inline-flex items-center gap-1.5"
          >
            <ArrowLeft size={14} aria-hidden /> All invoices
          </Link>
          <PrintButton label="Download PDF" />
        </div>

        {/* The invoice document */}
        <article className="card card-pad print-sheet">
          {/* Header */}
          <header className="flex flex-wrap items-start justify-between gap-6 pb-6 border-b border-line">
            <div>
              <div className="text-[17px] font-semibold text-ink tracking-tight">
                Door 2 Digital
              </div>
              <div className="mt-1 text-[12px] text-muted leading-relaxed">
                D2D Operations, Inc.
                <br />
                billing@door2digital.io
                <br />
                United States
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-soft">
                Invoice
              </div>
              <div className="mt-1 text-[15px] font-semibold text-ink mono">{invoice.id}</div>
              <div className="mt-2">
                <StatusPill tone={invoiceTone(invoice.status)}>
                  {invoiceLabel(invoice.status)}
                </StatusPill>
              </div>
            </div>
          </header>

          {/* Meta grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 py-6 border-b border-line">
            <div>
              <div className="h-section">Billed to</div>
              <div className="mt-1 text-[13px] font-medium text-ink">{org.legalName}</div>
              <div className="text-[12px] text-muted">{user.email}</div>
            </div>
            <div>
              <div className="h-section">Period</div>
              <div className="mt-1 text-[13px] text-ink">{fmtPeriod(invoice)}</div>
              <div className="text-[12px] text-muted">
                {fmtDate(invoice.periodStart)} – {fmtDate(invoice.periodEnd)}
              </div>
            </div>
            <div>
              <div className="h-section">Created</div>
              <div className="mt-1 text-[13px] text-ink">{fmtDate(invoice.createdAt)}</div>
            </div>
            <div>
              <div className="h-section">Sent / paid</div>
              <div className="mt-1 text-[13px] text-ink">{fmtDate(invoice.sentAt)}</div>
              {invoice.paidAt && (
                <div className="text-[12px] text-success">Paid {fmtDate(invoice.paidAt)}</div>
              )}
            </div>
          </div>

          {/* Line items — rendered directly from the API's line-item rows,
              whatever kinds the billing engine produced this period. */}
          <table className="tbl mt-2">
            <thead>
              <tr>
                <th>Description</th>
                <th className="text-right">Conversions</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((li) => (
                <tr key={li.id}>
                  <td>
                    <div className="font-medium text-ink">{li.description}</div>
                    <div className="text-[11px] text-muted mono">{li.kind}</div>
                  </td>
                  <td className="text-right numeric">{li.conversionCount || '—'}</td>
                  <td className="text-right">
                    <Money cents={wireCents(li.amountCents)} region={org.regionCode} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-line">
                <td colSpan={2} className="text-right font-semibold text-ink text-[15px]">
                  Total due
                </td>
                <td className="text-right font-semibold text-ink text-[15px]">
                  <Money cents={wireCents(invoice.totalCents)} region={org.regionCode} />
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Footer notes */}
          <div className="mt-6 pt-5 border-t border-line text-[11px] text-muted leading-relaxed">
            <p>
              Figures are computed from settled conversions in the period plus the flat monthly
              platform fee. All amounts in {invoice.currency}.
            </p>
            <p className="mt-2">
              The net amount remitted to {org.tradingName} for this period is shown on the{' '}
              <Link href="/payouts" className="text-accent hover:underline">
                payout statement
              </Link>
              .
            </p>
          </div>
        </article>
      </div>
    </PortalShell>
  );
}
