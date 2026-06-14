'use client';

import { useState } from 'react';
import { PartnerShell } from '@/components/PartnerShell';
import { Section, StatusPill } from '@d2d/ui-web';
import { Download, FileText } from 'lucide-react';
import { INVOICES, type InvoiceFixture } from '@/lib/fixtures';

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function InvoiceDetail({ inv }: { inv: InvoiceFixture }) {
  const rake = inv.doorRakeCents + inv.insideSalesRakeCents + inv.retargetingRakeCents;
  return (
    <div className="card p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-muted text-xs uppercase tracking-wider mb-1">Invoice</div>
          <div className="font-semibold text-lg">{inv.period}</div>
          <div className="mono text-xs text-muted mt-0.5">{inv.id}</div>
        </div>
        <StatusPill tone={inv.status === 'outstanding' ? 'warn' : 'success'}>
          {inv.status === 'outstanding' ? 'Outstanding' : 'Paid'}
        </StatusPill>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-muted text-xs mb-1">Issued</div>
          <div>{inv.issuedDate}</div>
        </div>
        <div>
          <div className="text-muted text-xs mb-1">Due</div>
          <div>{inv.dueDate}</div>
        </div>
      </div>

      <div className="border-t border-line pt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Platform fee (monthly)</span>
          <span className="mono">{formatCents(inv.platformFeeCents)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Door-closed rake (15%)</span>
          <span className="mono">{formatCents(inv.doorRakeCents)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Inside-sales rake (10%)</span>
          <span className="mono">{formatCents(inv.insideSalesRakeCents)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Retargeting rake (5%)</span>
          <span className="mono">{formatCents(inv.retargetingRakeCents)}</span>
        </div>
        <div className="flex justify-between border-t border-line pt-2 font-semibold">
          <span>Total</span>
          <span className="mono">{formatCents(inv.totalCents)}</span>
        </div>
      </div>

      <button
        className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
        onClick={() =>
          alert(`PDF download for ${inv.id} — wired to /v1/billing/invoices/${inv.id}/pdf`)
        }
      >
        <Download size={14} />
        Download PDF
      </button>
    </div>
  );
}

export default function InvoicesPage() {
  const [selectedId, setSelectedId] = useState<string>(INVOICES[0]!.id);
  const selected = INVOICES.find((i) => i.id === selectedId) ?? INVOICES[0]!;

  return (
    <PartnerShell pageTitle="Invoices">
      <div className="flex gap-6 items-start">
        {/* Left: invoice list */}
        <div className="w-72 flex-shrink-0 space-y-2">
          {INVOICES.map((inv) => (
            <button
              key={inv.id}
              onClick={() => setSelectedId(inv.id)}
              className={`w-full text-left card p-4 hover:border-accent/50 transition-colors ${selectedId === inv.id ? 'border-accent' : ''}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <FileText size={14} className="text-muted" />
                <span className="font-medium text-sm">{inv.period}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="mono text-sm">${(inv.totalCents / 100).toLocaleString()}</span>
                <StatusPill tone={inv.status === 'outstanding' ? 'warn' : 'success'}>
                  {inv.status === 'outstanding' ? 'Outstanding' : 'Paid'}
                </StatusPill>
              </div>
            </button>
          ))}
        </div>

        {/* Right: detail */}
        <div className="flex-1">
          <InvoiceDetail inv={selected} />

          <div className="mt-4 card p-4">
            <div className="text-xs text-muted mb-3 uppercase tracking-wider">Billing contact</div>
            <div className="text-sm space-y-1">
              <div className="font-medium">Door 2 Digital · Accounts Receivable</div>
              <div className="text-muted">billing@door2digital.io</div>
              <div className="text-muted text-xs mt-2">
                Wire transfer details on invoice PDF. All amounts in USD. Net 14 terms.
              </div>
            </div>
          </div>
        </div>
      </div>
    </PartnerShell>
  );
}
