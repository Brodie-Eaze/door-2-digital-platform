import { AnomalyCard, Banner, KpiCard, Money, RegionBadge, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';

/**
 * Operator overview — Brodie's cross-tenant mission control.
 * Anomaly-first home, KPI rail, recent activity.
 *
 * Phase 0: static placeholders. Phase 1.4: wired to real data.
 */
export default function OverviewPage(): JSX.Element {
  return (
    <PlatformShell pageTitle="Cross-org overview">
      <div className="space-y-6 max-w-[1280px]">
        <Banner tone="info">
          <span className="text-[13px]">
            Phase 0 scaffold deployed. Real data wires up in Phase 1.4. See{' '}
            <code className="kbd">docs/architecture.md</code> for the build plan.
          </span>
        </Banner>

        {/* KPI rail */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Active client orgs" value="1" hint="Pilot-Charlie" />
          <KpiCard label="Active knockers" value="0" delta="—" deltaTone="neutral" />
          <KpiCard
            label="MTD conversions"
            value="0"
            delta="—"
            deltaTone="neutral"
            hint="all sources"
          />
          <KpiCard
            label="MTD platform revenue"
            value={<Money cents={0n} region="US" />}
            delta="—"
            deltaTone="neutral"
            hint="fee + rake"
          />
        </div>

        {/* Today: anomalies + activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="h-section">Needs attention</h2>
            <AnomalyCard
              severity="warning"
              title="Paid-solicitor registration in CA pending"
              description="Counsel filed 2026-05-12. Estimated approval Week 4. No campaigns can deliver to CA until approved."
              timestamp="12 days ago"
            />
            <AnomalyCard
              severity="info"
              title="MiCamp Gateway API kickoff scheduled"
              description="Sandbox credentials expected by EOW. Phase 1.3 payment integration unblocked once received."
              timestamp="3 days ago"
            />
            <AnomalyCard
              severity="critical"
              title="Pilot-Charlie SSO/SAML metadata not yet received"
              description="Required for Phase 1.1 go-live. Follow up with their IT admin today."
              timestamp="1 day ago"
            />
          </div>

          <div className="space-y-4">
            <Section title="Regions" subtitle="Data residency status">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <RegionBadge region="US" />
                  <StatusPill tone="success">Active</StatusPill>
                </div>
                <div className="flex items-center justify-between">
                  <RegionBadge region="AU" />
                  <StatusPill tone="muted">Phase 2</StatusPill>
                </div>
                <div className="flex items-center justify-between">
                  <RegionBadge region="SG" />
                  <StatusPill tone="muted">Phase 3</StatusPill>
                </div>
              </div>
            </Section>

            <Section title="Build status" subtitle="Phase 0 / 16">
              <div className="space-y-2.5 text-[13px]">
                <div className="flex items-center justify-between">
                  <span>Scaffold</span>
                  <StatusPill tone="success">Complete</StatusPill>
                </div>
                <div className="flex items-center justify-between">
                  <span>Design system</span>
                  <StatusPill tone="success">Complete</StatusPill>
                </div>
                <div className="flex items-center justify-between">
                  <span>Auth + Org (1.1)</span>
                  <StatusPill tone="warn">In progress</StatusPill>
                </div>
                <div className="flex items-center justify-between">
                  <span>Field + Compliance (1.2)</span>
                  <StatusPill tone="muted">Queued</StatusPill>
                </div>
                <div className="flex items-center justify-between">
                  <span>Payment + Billing (1.3)</span>
                  <StatusPill tone="muted">Queued</StatusPill>
                </div>
                <div className="flex items-center justify-between">
                  <span>Hardening + go-live (1.4)</span>
                  <StatusPill tone="muted">Queued</StatusPill>
                </div>
              </div>
            </Section>
          </div>
        </div>
      </div>
    </PlatformShell>
  );
}
