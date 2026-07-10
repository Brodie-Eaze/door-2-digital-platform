import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { PortalShell } from '@/components/PortalShell';
import { invoiceLabel, invoiceTone } from '@/lib/status';
import {
  BILLING_PERIODS,
  CLIENT,
  PLATFORM_FEE_CENTS,
  fmtDate,
  invoiceTotalCents,
  totalRakeCents,
} from '@/lib/portal-data';

export default function InvoicesPage(): JSX.Element {
  const outstanding = BILLING_PERIODS.filter((p) => p.status !== 'paid').reduce(
    (sum, p) => sum + invoiceTotalCents(p),
    0n,
  );
  const lifetime = BILLING_PERIODS.reduce((sum, p) => sum + invoiceTotalCents(p), 0n);
  const paidCount = BILLING_PERIODS.filter((p) => p.status === 'paid').length;

  return (
    <PortalShell pageTitle="Invoices">
      <div className="space-y-6 max-w-[1400px]">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            label="Outstanding"
            value={<Money cents={outstanding} region={CLIENT.region} />}
            hint="open + overdue"
            animate={false}
          />
          <KpiCard
            label="Billed to date"
            value={<Money cents={lifetime} region={CLIENT.region} />}
            hint={`${BILLING_PERIODS.length} periods`}
            animate={false}
          />
          <KpiCard label="Paid on time" value={paidCount} hint="periods settled" />
        </div>

        <Section
          title="All invoices"
          subtitle="Each invoice is the flat platform fee plus per-bucket rake on the period's conversions."
          paddedBody={false}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Period</th>
                <th>Issued</th>
                <th>Due</th>
                <th className="text-right">Platform fee</th>
                <th className="text-right">Rake</th>
                <th className="text-right">Total</th>
                <th className="text-right">Status</th>
                <th className="text-right" />
              </tr>
            </thead>
            <tbody>
              {BILLING_PERIODS.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link
                      href={`/invoices/${p.id}`}
                      className="font-medium text-ink hover:text-accent"
                    >
                      {p.label}
                    </Link>
                    <div className="text-[11px] text-muted mono">{p.id}</div>
                  </td>
                  <td className="text-muted">{fmtDate(p.issuedAt)}</td>
                  <td className="text-muted">{fmtDate(p.dueAt)}</td>
                  <td className="text-right">
                    <Money cents={PLATFORM_FEE_CENTS} region={CLIENT.region} />
                  </td>
                  <td className="text-right">
                    <Money cents={totalRakeCents(p)} region={CLIENT.region} />
                  </td>
                  <td className="text-right font-semibold text-ink">
                    <Money cents={invoiceTotalCents(p)} region={CLIENT.region} />
                  </td>
                  <td className="text-right">
                    <StatusPill tone={invoiceTone(p.status)}>{invoiceLabel(p.status)}</StatusPill>
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/invoices/${p.id}`}
                      className="text-accent hover:text-accentStrong inline-flex"
                      aria-label={`Open ${p.label} invoice`}
                    >
                      <ArrowRight size={15} aria-hidden />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
    </PortalShell>
  );
}
