import { ShieldCheck } from 'lucide-react';
import { Banner, Section, StatusPill, KpiCard } from '@d2d/ui-web';
import { db } from '@d2d/database';
import { PlatformShell } from '@/components/PlatformShell';
import { DataSourceBadge } from '@/components/DataSourceBadge';

// Server component reads the DB at request time — never statically built.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ClearanceRow {
  state: string;
  status: string;
}

/**
 * Live read of PaidSolicitorRegistration. No fixture fallback — zero rows is
 * an honest "nothing filed yet" state (the matrix below already renders that
 * correctly: an unmatched state just shows "not filed", which is true), and
 * a DB error is surfaced to the caller instead of silently swapped for demo
 * data.
 */
async function loadClearances(): Promise<{
  rows: ClearanceRow[];
  approvedLast30d: number;
  error?: string;
}> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

    const [regs, approvedLast30d] = await Promise.all([
      db.paidSolicitorRegistration.findMany({
        where: { regionCode: 'US' },
        select: { state: true, status: true },
        orderBy: { state: 'asc' },
      }),
      db.paidSolicitorRegistration.count({
        where: { regionCode: 'US', status: 'approved', approvedAt: { gte: thirtyDaysAgo } },
      }),
    ]);
    return { rows: regs, approvedLast30d };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[compliance] PaidSolicitorRegistration read failed:', err);
    return {
      rows: [],
      approvedLast30d: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export default async function CompliancePage(): Promise<JSX.Element> {
  const { rows: clearances, approvedLast30d, error } = await loadClearances();
  const approved = clearances.filter((s) => s.status === 'approved').length;
  const pending = clearances.filter((s) => s.status !== 'approved').length;

  return (
    <PlatformShell pageTitle="Compliance">
      <div className="space-y-6 max-w-[1280px]">
        {error && (
          <Banner tone="warn">
            <span className="text-[13px]">
              Could not load PaidSolicitorRegistration: {error}. Refresh to retry.
            </span>
          </Banner>
        )}

        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <ShieldCheck size={14} />
            Campaigns only deliver to states where D2D&apos;s paid-solicitor registration is{' '}
            <span className="font-semibold">approved</span>. Enforced server-side via{' '}
            <code className="kbd">CampaignStateClearance</code> per ADR.
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="US states cleared"
            value={`${approved} / 50`}
            delta={approvedLast30d > 0 ? `+${approvedLast30d} last 30d` : undefined}
            deltaTone="positive"
          />
          <KpiCard label="Filings in progress" value={pending} hint="counsel-managed" />
          <KpiCard label="SOC 2 Type I" value="In progress" hint="evidence collection" />
          <KpiCard label="Pen test" value="Scheduled" hint="Bastion · Phase 1.4" />
        </div>

        <Section
          title="US state-by-state matrix"
          subtitle="Paid-solicitor registration status"
          action={<DataSourceBadge source="live" />}
          paddedBody={false}
        >
          <div className="p-5">
            <div className="grid grid-cols-10 gap-1.5">
              {[
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
              ].map((state) => {
                const entry = clearances.find((s) => s.state === state);
                const tone = !entry
                  ? 'muted'
                  : entry.status === 'approved'
                    ? 'success'
                    : entry.status === 'submitted'
                      ? 'info'
                      : 'warn';
                const bg =
                  tone === 'success'
                    ? 'bg-successSoft text-success'
                    : tone === 'info'
                      ? 'bg-accentSoft text-accent'
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

          <Section title="Filings in flight" subtitle="Live — not yet approved">
            {clearances.filter((s) => s.status !== 'approved').length === 0 ? (
              <p className="text-[13px] text-muted">
                Nothing in flight — every filed state is approved.
              </p>
            ) : (
              <div className="space-y-2.5 text-[13px]">
                {clearances
                  .filter((s) => s.status !== 'approved')
                  .map((s) => (
                    <div key={s.state} className="flex items-center justify-between">
                      <span className="text-ink">{s.state}</span>
                      <StatusPill tone={s.status === 'submitted' ? 'info' : 'warn'}>
                        {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                      </StatusPill>
                    </div>
                  ))}
              </div>
            )}
            {/* No ComplianceNotification model exists yet — an honest banner
                beats a fabricated activity feed. */}
            <p className="mt-4 text-[11px] text-soft border-t border-line2 pt-3">
              Notification feed not yet wired — no dedicated model for filing-status alerts or DNC
              refresh events.
            </p>
          </Section>
        </div>
      </div>
    </PlatformShell>
  );
}
