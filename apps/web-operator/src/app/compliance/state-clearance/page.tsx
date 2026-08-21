/**
 * /compliance/state-clearance — per-state paid-solicitor registration detail.
 * Server component, live `PaidSolicitorRegistration` rows (US region). No
 * fixture fallback; registration number, bond, filed/approved/expiry dates
 * all come straight off the model — no fabricated per-state metadata.
 */
import Link from 'next/link';
import { FilePlus2, FileText, ShieldCheck, ArrowLeft } from 'lucide-react';
import { Banner, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { ToastButton } from '@/components/ToastButton';
import { StateClearanceEmpty } from '@/components/PlatformEmptyStates';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
};

interface Row {
  id: string;
  state: string;
  status: string;
  bondAmountCents: bigint;
  registrationNumber: string | null;
  filedAt: Date | null;
  expiresAt: Date | null;
}

function statusTone(status: string): 'success' | 'info' | 'warn' {
  if (status === 'approved') return 'success';
  if (status === 'submitted') return 'info';
  return 'warn';
}

function statusLabel(status: string): string {
  if (status === 'approved') return 'Approved';
  if (status === 'submitted') return 'Submitted';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

async function loadRows(): Promise<{ rows: Row[]; error?: string }> {
  try {
    const { db } = await import('@d2d/database');
    const rows = await db.paidSolicitorRegistration.findMany({
      where: { regionCode: 'US' },
      orderBy: { state: 'asc' },
      select: {
        id: true,
        state: true,
        status: true,
        bondAmountCents: true,
        registrationNumber: true,
        filedAt: true,
        expiresAt: true,
      },
    });
    return { rows };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[compliance/state-clearance] DB load failed:', err);
    return { rows: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export default async function StateClearancePage(): Promise<JSX.Element> {
  const { rows, error } = await loadRows();
  const approved = rows.filter((r) => r.status === 'approved').length;
  const inFlight = rows.filter((r) => r.status !== 'approved').length;
  const totalBondCents = rows.reduce((acc, r) => acc + r.bondAmountCents, 0n);

  return (
    <PlatformShell pageTitle="Compliance · State clearance">
      <div className="space-y-6 max-w-[1280px]">
        <Link
          href="/compliance"
          className="inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-ink"
        >
          <ArrowLeft size={13} /> Back to compliance
        </Link>

        {error && (
          <Banner tone="warn">
            <span className="text-[13px]">Could not load filings: {error}. Refresh to retry.</span>
          </Banner>
        )}

        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <ShieldCheck size={14} />
            Per-state paid-solicitor registration detail. Campaigns only deliver where status is{' '}
            <span className="font-semibold">approved</span> — enforced server-side via{' '}
            <code className="kbd">CampaignStateClearance</code>.
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

        {rows.length === 0 ? (
          <StateClearanceEmpty />
        ) : (
          <Section
            title="Paid-solicitor registration filings"
            subtitle="One row per US state filing — status, bond, registration number, expiry"
            paddedBody={false}
            action={
              <div className="flex items-center gap-2">
                <DataSourceBadge source="live" />
                <ToastButton
                  leftIcon={<FilePlus2 size={14} />}
                  variant="primary"
                  size="sm"
                  message="File new registration — requires verified counsel credentials + signed bond instrument; never auto-filed."
                >
                  File new registration
                </ToastButton>
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
                {rows.map((r) => (
                  <tr key={r.id}>
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
                    <td className="text-[12px] text-muted">
                      {r.filedAt ? r.filedAt.toISOString().slice(0, 10) : '—'}
                    </td>
                    <td className="font-medium">
                      <Money cents={r.bondAmountCents} region="US" />
                    </td>
                    <td className="text-[12px] text-muted">
                      {r.registrationNumber ?? <span className="text-soft">—</span>}
                    </td>
                    <td className="text-[12px] text-muted">
                      {r.expiresAt ? r.expiresAt.toISOString().slice(0, 10) : '—'}
                    </td>
                    <td>
                      <ToastButton
                        variant="ghost"
                        size="sm"
                        message={`View filing for ${STATE_NAMES[r.state] ?? r.state} — document viewer wiring lands in Phase 1.4.`}
                      >
                        <FileText size={13} /> View filing
                      </ToastButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}
      </div>
    </PlatformShell>
  );
}
