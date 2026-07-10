import './print.css';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Money, StatusPill } from '@d2d/ui-web';
import { PortalShell } from '@/components/PortalShell';
import { PrintButton } from '@/components/PrintButton';
import { invoiceLabel, invoiceTone } from '@/lib/status';
import {
  BILLING_PERIODS,
  BUCKET_DESCRIPTION,
  BUCKET_LABEL,
  CLIENT,
  PLATFORM_FEE_CENTS,
  RAKE_BPS,
  type AttributionBucket,
  bucketRake,
  fmtDate,
  invoiceTotalCents,
  totalRakeCents,
} from '@/lib/portal-data';

const BUCKETS: AttributionBucket[] = ['door', 'insideSales', 'retargeting'];

export function generateStaticParams(): { id: string }[] {
  return BILLING_PERIODS.map((p) => ({ id: p.id }));
}

export const dynamicParams = false;

export default function InvoiceDetailPage({ params }: { params: { id: string } }): JSX.Element {
  const period = BILLING_PERIODS.find((p) => p.id === params.id);
  if (!period) notFound();

  const rake = bucketRake(period);

  return (
    <PortalShell pageTitle={`Invoice · ${period.label}`}>
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
              <div className="mt-1 text-[15px] font-semibold text-ink mono">{period.id}</div>
              <div className="mt-2">
                <StatusPill tone={invoiceTone(period.status)}>
                  {invoiceLabel(period.status)}
                </StatusPill>
              </div>
            </div>
          </header>

          {/* Meta grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 py-6 border-b border-line">
            <div>
              <div className="h-section">Billed to</div>
              <div className="mt-1 text-[13px] font-medium text-ink">{CLIENT.legalName}</div>
              <div className="text-[12px] text-muted">{CLIENT.portalContact.email}</div>
            </div>
            <div>
              <div className="h-section">Period</div>
              <div className="mt-1 text-[13px] text-ink">{period.label}</div>
              <div className="text-[12px] text-muted">
                {fmtDate(period.periodStart)} – {fmtDate(period.periodEnd)}
              </div>
            </div>
            <div>
              <div className="h-section">Issued</div>
              <div className="mt-1 text-[13px] text-ink">{fmtDate(period.issuedAt)}</div>
            </div>
            <div>
              <div className="h-section">Due</div>
              <div className="mt-1 text-[13px] text-ink">{fmtDate(period.dueAt)}</div>
              {period.paidAt && (
                <div className="text-[12px] text-success">Paid {fmtDate(period.paidAt)}</div>
              )}
            </div>
          </div>

          {/* Line items */}
          <table className="tbl mt-2">
            <thead>
              <tr>
                <th>Description</th>
                <th className="text-right">Conversions</th>
                <th className="text-right">Gross</th>
                <th className="text-right">Rate</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div className="font-medium text-ink">Platform fee</div>
                  <div className="text-[11px] text-muted">Monthly access to the D2D platform.</div>
                </td>
                <td className="text-right text-muted">—</td>
                <td className="text-right text-muted">—</td>
                <td className="text-right text-muted">flat</td>
                <td className="text-right">
                  <Money cents={PLATFORM_FEE_CENTS} region={CLIENT.region} />
                </td>
              </tr>
              {BUCKETS.map((b) => (
                <tr key={b}>
                  <td>
                    <div className="font-medium text-ink">{BUCKET_LABEL[b]} rake</div>
                    <div className="text-[11px] text-muted">{BUCKET_DESCRIPTION[b]}</div>
                  </td>
                  <td className="text-right numeric">{period.buckets[b].count}</td>
                  <td className="text-right">
                    <Money cents={period.buckets[b].grossCents} region={CLIENT.region} />
                  </td>
                  <td className="text-right numeric text-muted">{RAKE_BPS[b] / 100}%</td>
                  <td className="text-right">
                    <Money cents={rake[b]} region={CLIENT.region} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="text-right text-muted">
                  Rake subtotal
                </td>
                <td className="text-right">
                  <Money cents={totalRakeCents(period)} region={CLIENT.region} />
                </td>
              </tr>
              <tr>
                <td colSpan={4} className="text-right text-muted">
                  Platform fee
                </td>
                <td className="text-right">
                  <Money cents={PLATFORM_FEE_CENTS} region={CLIENT.region} />
                </td>
              </tr>
              <tr className="border-t-2 border-line">
                <td colSpan={4} className="text-right font-semibold text-ink text-[15px]">
                  Total due
                </td>
                <td className="text-right font-semibold text-ink text-[15px]">
                  <Money cents={invoiceTotalCents(period)} region={CLIENT.region} />
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Footer notes */}
          <div className="mt-6 pt-5 border-t border-line text-[11px] text-muted leading-relaxed">
            <p>
              Rake is charged per the engagement contract: door-closed {RAKE_BPS.door / 100}%,
              inside-sales {RAKE_BPS.insideSales / 100}%, retargeting {RAKE_BPS.retargeting / 100}%
              of gross conversion value, plus a{' '}
              <Money cents={PLATFORM_FEE_CENTS} region={CLIENT.region} /> monthly platform fee. All
              figures are computed from settled conversions in the period.
            </p>
            <p className="mt-2">
              The net amount remitted to {CLIENT.tradingName} for this period is shown on the{' '}
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
