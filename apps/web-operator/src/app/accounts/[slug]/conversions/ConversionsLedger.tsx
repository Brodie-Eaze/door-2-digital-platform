'use client';

import { Money, Section, StatusPill } from '@d2d/ui-web';
import { ATTRIBUTION_LABEL, type AttributionSource } from '@d2d/ui-tokens/taxonomy';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { toast } from '@/components/Toaster';

const FREQ_LABEL: Record<string, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
  'one-off': 'One-off',
};

const ATTRIBUTION_TONE: Record<AttributionSource, 'success' | 'info' | 'warn' | 'muted'> = {
  door: 'success',
  inside_sales: 'info',
  retargeting: 'warn',
  other: 'muted',
};

const PAYMENT_TONE: Record<string, 'success' | 'warn' | 'danger'> = {
  cleared: 'success',
  pending: 'warn',
  declined: 'danger',
};

function timeAgo(iso: string, now = new Date()): string {
  const diff = (now.getTime() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

/** Stable FNV-1a hex digest — deterministic per row id, never random-per-render. */
function auditHash(id: string): string {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

interface LedgerRow {
  id: string;
  capturedAt: string;
  donorName: string;
  donorEmailMasked: string;
  amountCents: bigint;
  frequency: string;
  attribution: AttributionSource;
  repInitials: string;
  territory: string;
  paymentStatus: string;
}

export function ConversionsLedger({
  rows,
  region,
  ledgerTotalCents,
}: {
  rows: LedgerRow[];
  region: 'US' | 'AU';
  ledgerTotalCents: bigint;
}): JSX.Element {
  return (
    <Section
      title={`Recent ledger · ${rows.length} entries`}
      subtitle="Reverse-chronological · click any row for the full audit chain"
      action={
        <div className="flex items-center gap-3">
          <DataSourceBadge source="live" />
          <span className="text-[11px] text-muted numeric">
            Total visible:{' '}
            <Money cents={ledgerTotalCents} region={region} className="!text-[12px]" />
          </span>
        </div>
      }
      paddedBody={false}
    >
      <div className="px-5 pt-3 -mb-1">
        <p className="text-[11px] text-muted">
          Live from Postgres — full audit-chain drill-down lands in Phase 1.2
        </p>
      </div>
      <div className="max-h-[760px] overflow-y-auto">
        <table className="tbl">
          <thead className="sticky top-0 bg-surface z-10">
            <tr>
              <th>When</th>
              <th>Donor / customer</th>
              <th>Amount</th>
              <th>Frequency</th>
              <th>Attribution</th>
              <th>Rep</th>
              <th>Territory</th>
              <th>Payment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr
                key={c.id}
                onClick={() =>
                  toast.info(
                    `Audit chain for ${c.donorName} — entry #${auditHash(c.id)}. Full chain view lands in Phase 1.2.`,
                  )
                }
                className="cursor-pointer"
              >
                <td className="text-[11px] text-muted numeric">{timeAgo(c.capturedAt)}</td>
                <td>
                  <div className="text-[13px] text-ink">{c.donorName}</div>
                  <div className="text-[10px] text-muted mono">{c.donorEmailMasked}</div>
                </td>
                <td>
                  <Money cents={c.amountCents} region={region} />
                </td>
                <td className="text-[12px] text-muted">{FREQ_LABEL[c.frequency]}</td>
                <td>
                  <StatusPill tone={ATTRIBUTION_TONE[c.attribution]}>
                    {ATTRIBUTION_LABEL[c.attribution]}
                  </StatusPill>
                </td>
                <td>
                  <span className="mono">{c.repInitials}</span>
                </td>
                <td className="text-[12px] text-muted">{c.territory}</td>
                <td>
                  <StatusPill tone={PAYMENT_TONE[c.paymentStatus]!}>
                    {c.paymentStatus[0]!.toUpperCase() + c.paymentStatus.slice(1)}
                  </StatusPill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
