'use client';

import { FilePlus2, FileText, ShieldCheck, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Banner, Button, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { toast } from '@/components/Toaster';
import { STATE_CLEARANCE } from '@/lib/fixtures';

const STATE_NAMES: Record<string, string> = {
  TX: 'Texas',
  FL: 'Florida',
  GA: 'Georgia',
  AZ: 'Arizona',
  CA: 'California',
  NY: 'New York',
  IL: 'Illinois',
  NC: 'North Carolina',
  CO: 'Colorado',
  OH: 'Ohio',
};

// Plausible filing metadata layered on the canonical fixture so this drill-down
// shows the full registration record (number / expiry) the parent matrix omits.
const FILING_META: Record<string, { registrationNo: string | null; expiresAt: string | null }> = {
  TX: { registrationNo: 'TX-PS-2026-04481', expiresAt: '2027-04-18' },
  FL: { registrationNo: 'FL-CH-58213', expiresAt: '2027-04-22' },
  GA: { registrationNo: 'GA-PSE-11907', expiresAt: '2027-05-01' },
  AZ: { registrationNo: 'AZ-SOL-30654', expiresAt: '2027-05-08' },
  CA: { registrationNo: null, expiresAt: null },
  NY: { registrationNo: null, expiresAt: null },
  IL: { registrationNo: null, expiresAt: null },
  NC: { registrationNo: null, expiresAt: null },
  CO: { registrationNo: null, expiresAt: null },
  OH: { registrationNo: null, expiresAt: null },
};

function statusTone(status: string): 'success' | 'info' | 'warn' {
  if (status === 'approved') return 'success';
  if (status === 'submitted') return 'info';
  return 'warn';
}

function statusLabel(status: string): string {
  if (status === 'approved') return 'Approved';
  if (status === 'submitted') return 'Submitted';
  return 'Pending';
}

export default function StateClearancePage(): JSX.Element {
  const rows = STATE_CLEARANCE;
  const approved = rows.filter((r) => r.status === 'approved').length;
  const inFlight = rows.filter((r) => r.status !== 'approved').length;
  const totalBondCents = rows.reduce((acc, r) => acc + r.bondCents, 0n);

  return (
    <PlatformShell pageTitle="Compliance · State clearance">
      <div className="space-y-6 max-w-[1280px]">
        <Link
          href="/compliance"
          className="inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-ink"
        >
          <ArrowLeft size={13} /> Back to compliance
        </Link>

        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <ShieldCheck size={14} />
            Per-state paid-solicitor registration detail. Campaigns only deliver where status is{' '}
            <span className="font-semibold">approved</span> — enforced server-side via{' '}
            <code className="kbd">CampaignStateClearance</code>.{' '}
            <span className="text-muted">Demo data — live wiring lands in Phase 1.4.</span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="States approved"
            value={`${approved} / ${rows.length}`}
            hint="filed set"
          />
          <KpiCard label="Filings in flight" value={inFlight} hint="counsel-managed" />
          <KpiCard
            label="Surety bonds posted"
            value={<Money cents={totalBondCents} region="US" />}
            hint="aggregate across states"
          />
          <KpiCard label="Renewals < 90d" value="0" hint="auto-tracked from expiry" />
        </div>

        <Section
          title="Paid-solicitor registration filings"
          subtitle="One row per US state filing — status, bond, registration number, expiry"
          paddedBody={false}
          action={
            <div className="flex items-center gap-2">
              <DataSourceBadge source="fixture" />
              <Button
                leftIcon={<FilePlus2 size={14} />}
                variant="primary"
                size="sm"
                onClick={() =>
                  toast.info(
                    'File new registration — requires verified counsel credentials + signed bond instrument; never auto-filed.',
                  )
                }
              >
                File new registration
              </Button>
            </div>
          }
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>State</th>
                <th>Status</th>
                <th>Filed</th>
                <th>Surety bond</th>
                <th>Registration #</th>
                <th>Expiry</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const meta = FILING_META[r.state] ?? { registrationNo: null, expiresAt: null };
                const filedDate =
                  (r as { approvedAt?: string; filedAt?: string }).approvedAt ??
                  (r as { filedAt?: string }).filedAt ??
                  '—';
                return (
                  <tr key={r.state}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="mono !w-7 !h-5 !text-[10px]">{r.state}</span>
                        <span className="text-[13px] text-ink">
                          {STATE_NAMES[r.state] ?? r.state}
                        </span>
                      </div>
                    </td>
                    <td>
                      <StatusPill tone={statusTone(r.status)}>{statusLabel(r.status)}</StatusPill>
                    </td>
                    <td className="text-[12px] text-muted">{filedDate}</td>
                    <td className="font-medium">
                      <Money cents={r.bondCents} region="US" />
                    </td>
                    <td className="text-[12px] text-muted">
                      {meta.registrationNo ?? <span className="text-soft">—</span>}
                    </td>
                    <td className="text-[12px] text-muted">
                      {meta.expiresAt ?? <span className="text-soft">—</span>}
                    </td>
                    <td>
                      <button
                        className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline"
                        onClick={() =>
                          toast.info(
                            `View filing for ${STATE_NAMES[r.state] ?? r.state} — document viewer wiring lands in Phase 1.4.`,
                          )
                        }
                      >
                        <FileText size={13} /> View filing
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>
      </div>
    </PlatformShell>
  );
}
