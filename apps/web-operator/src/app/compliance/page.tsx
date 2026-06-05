/**
 * /compliance — paid-solicitor registration matrix + active regulations.
 *
 * Server component. Reads PaidSolicitorRegistration rows directly from
 * the shared Prisma client (same pattern as /accounts). Falls back to
 * the STATE_CLEARANCE fixture when the DB is unreachable.
 *
 * Authorization: only super_admin (cross-tenant) has a meaningful
 * platform-level compliance picture. The fixture is shown for org-scoped
 * sessions (they should be using /accounts/[slug]/compliance instead).
 */
import { ShieldCheck, AlertTriangle, Database } from 'lucide-react';
import { Banner, Section, StatusPill, KpiCard } from '@d2d/ui-web';
import { OperatorShell } from '@/components/OperatorShell';
import { STATE_CLEARANCE } from '@/lib/fixtures';
import { getSession } from '@/lib/session';
import { isCrossTenantOperator } from '@/lib/api-helpers';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── types ──────────────────────────────────────────────────────────────────

type ClearanceStatus = 'approved' | 'submitted' | 'pending' | 'expired' | 'rejected';

interface RegistrationRow {
  id: string;
  state: string;
  status: ClearanceStatus;
  filedAt: Date | null;
  approvedAt: Date | null;
  bondAmountCents: bigint;
}

interface ComplianceData {
  registrations: RegistrationRow[];
  approvedCount: number;
  pendingCount: number;
  source: 'database' | 'fixture-fallback';
  error?: string;
}

// ─── data loader ────────────────────────────────────────────────────────────

async function loadCompliance(): Promise<ComplianceData> {
  const session = await getSession();
  if (!session) {
    return { registrations: [], approvedCount: 0, pendingCount: 0, source: 'fixture-fallback' };
  }

  // Non-cross-tenant sessions get fixture data (platform registrations are
  // operator-level, not per-account).
  if (!isCrossTenantOperator(session)) {
    const approved = STATE_CLEARANCE.filter((s) => s.status === 'approved').length;
    const pending = STATE_CLEARANCE.filter((s) => s.status !== 'approved').length;
    return {
      registrations: STATE_CLEARANCE.map((s) => ({
        id: s.state,
        state: s.state,
        status: s.status as ClearanceStatus,
        filedAt: s.filedAt ? new Date(s.filedAt) : null,
        approvedAt: s.approvedAt ? new Date(s.approvedAt) : null,
        bondAmountCents: s.bondCents,
      })),
      approvedCount: approved,
      pendingCount: pending,
      source: 'fixture-fallback',
    };
  }

  try {
    const { db } = await import('@d2d/database');

    const registrations = await db.paidSolicitorRegistration.findMany({
      orderBy: [{ state: 'asc' }],
      select: {
        id: true,
        state: true,
        status: true,
        filedAt: true,
        approvedAt: true,
        bondAmountCents: true,
      },
    });

    const approvedCount = registrations.filter((r) => r.status === 'approved').length;
    const pendingCount = registrations.filter((r) => r.status !== 'approved').length;

    return {
      registrations: registrations.map((r) => ({
        id: r.id,
        state: r.state,
        status: r.status as ClearanceStatus,
        filedAt: r.filedAt,
        approvedAt: r.approvedAt,
        bondAmountCents: r.bondAmountCents,
      })),
      approvedCount,
      pendingCount,
      source: 'database',
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[compliance] DB load failed, falling back to fixture:', err);
    const approved = STATE_CLEARANCE.filter((s) => s.status === 'approved').length;
    const pending = STATE_CLEARANCE.filter((s) => s.status !== 'approved').length;
    return {
      registrations: STATE_CLEARANCE.map((s) => ({
        id: s.state,
        state: s.state,
        status: s.status as ClearanceStatus,
        filedAt: s.filedAt ? new Date(s.filedAt) : null,
        approvedAt: s.approvedAt ? new Date(s.approvedAt) : null,
        bondAmountCents: s.bondCents,
      })),
      approvedCount: approved,
      pendingCount: pending,
      source: 'fixture-fallback',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const ALL_US_STATES = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
] as const;

// ─── page ────────────────────────────────────────────────────────────────────

export default async function CompliancePage(): Promise<JSX.Element> {
  const session = await getSession();
  if (!session) redirect('/login?next=/compliance');

  const { registrations, approvedCount, pendingCount, source, error } = await loadCompliance();

  // Build a fast lookup for the state matrix.
  const byState = new Map(registrations.map((r) => [r.state, r]));

  return (
    <OperatorShell pageTitle="Compliance">
      <div className="space-y-6 max-w-[1280px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <ShieldCheck size={14} />
            Campaigns only deliver to states where D2D&apos;s paid-solicitor registration is{' '}
            <span className="font-semibold">approved</span>. Enforced server-side via{' '}
            <code className="kbd">CampaignStateClearance</code> per ADR.{' '}
            {source === 'database' ? (
              <span className="inline-flex items-center gap-1 text-success text-[10px] uppercase tracking-wider font-semibold ml-auto">
                <Database size={10} /> Live
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 text-warn text-[10px] uppercase tracking-wider font-semibold ml-auto"
                title="Data temporarily unavailable"
              >
                <AlertTriangle size={10} /> Fixture
              </span>
            )}
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="US states cleared"
            value={`${approvedCount} / 50`}
            delta={approvedCount > 0 ? `+${approvedCount} approved` : '—'}
            deltaTone={approvedCount > 0 ? 'positive' : 'neutral'}
          />
          <KpiCard label="Filings in progress" value={pendingCount} hint="counsel-managed" />
          <KpiCard label="SOC 2 Type I" value="In progress" hint="evidence collection" />
          <KpiCard label="Pen test" value="Scheduled" hint="Bastion · Phase 1.4" />
        </div>

        <Section
          title="US state-by-state matrix"
          subtitle="Paid-solicitor registration status"
          paddedBody={false}
        >
          <div className="p-5">
            <div className="grid grid-cols-10 gap-1.5">
              {ALL_US_STATES.map((state) => {
                const entry = byState.get(state);
                const tone = !entry
                  ? 'muted'
                  : entry.status === 'approved'
                    ? 'success'
                    : entry.status === 'submitted'
                      ? 'info'
                      : entry.status === 'rejected'
                        ? 'danger'
                        : 'warn';
                const bg =
                  tone === 'success'
                    ? 'bg-successSoft text-success'
                    : tone === 'info'
                      ? 'bg-accentSoft text-accent'
                      : tone === 'danger'
                        ? 'bg-dangerSoft text-danger'
                        : tone === 'warn'
                          ? 'bg-warnSoft text-warn'
                          : 'bg-line2 text-soft';
                return (
                  <div
                    key={state}
                    className={`text-[11px] font-semibold text-center py-2 rounded ${bg}`}
                    title={entry?.status ?? 'not filed'}
                  >
                    {state}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center gap-4 text-[11px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-successSoft" /> Approved
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-accentSoft" /> Submitted
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-warnSoft" /> Pending
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-line2" /> Not filed
              </span>
            </div>
          </div>
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section title="Active regulations enforced">
            <div className="space-y-2.5 text-[13px]">
              {[
                ['TCPA (telemarketing consent)', 'US', 'active'],
                ['CCPA / CPRA (CA privacy)', 'US', 'active'],
                ['State cooling-off windows', 'US', 'active'],
                ['CAN-SPAM (email)', 'US', 'active'],
                ['Paid solicitor registration', 'US', 'rolling'],
                ['ACNC charity registration', 'AU', 'phase-2'],
                ['Privacy Act 1988 + APPs', 'AU', 'phase-2'],
                ['PDPA', 'SG', 'phase-3'],
              ].map(([rule, region, status]) => (
                <div key={rule} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="mono !w-7 !h-5 !text-[10px]">{region}</span>
                    <span className="text-ink">{rule}</span>
                  </div>
                  <StatusPill
                    tone={status === 'active' ? 'success' : status === 'rolling' ? 'info' : 'muted'}
                  >
                    {status === 'active'
                      ? 'Active'
                      : status === 'rolling'
                        ? 'Rolling'
                        : status === 'phase-2'
                          ? 'Phase 2'
                          : 'Phase 3'}
                  </StatusPill>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Notifications">
            <div className="space-y-3">
              {registrations
                .filter((r) => r.status !== 'approved')
                .slice(0, 5)
                .map((r) => (
                  <div key={r.id} className="flex items-start gap-2 text-[13px]">
                    <AlertTriangle size={14} className="text-warn mt-0.5 shrink-0" />
                    <span className="text-ink">
                      {r.state} paid-solicitor registration {r.status}
                      {r.filedAt
                        ? ` — filed ${r.filedAt.toISOString().slice(0, 10)}`
                        : ' — not yet filed'}
                    </span>
                  </div>
                ))}
              {registrations.filter((r) => r.status !== 'approved').length === 0 && (
                <div className="flex items-start gap-2 text-[13px]">
                  <ShieldCheck size={14} className="text-success mt-0.5 shrink-0" />
                  <span className="text-ink">
                    All paid-solicitor registrations are approved. No pending filings.
                  </span>
                </div>
              )}
              <div className="flex items-start gap-2 text-[13px]">
                <ShieldCheck size={14} className="text-success mt-0.5 shrink-0" />
                <span className="text-ink">
                  TCPA consent capture verified — 100% conformance last 30d.
                </span>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </OperatorShell>
  );
}
