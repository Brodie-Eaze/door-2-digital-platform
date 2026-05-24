import { Building2, Calendar, CreditCard, Globe, ShieldCheck } from 'lucide-react';
import { KpiCard, Money, RegionBadge, Section, StatusPill } from '@d2d/ui-web';
import { OperatorShell } from '@/components/OperatorShell';
import { PILOT, STATE_CLEARANCE } from '@/lib/fixtures';

export default function PilotCharliePage(): JSX.Element {
  return (
    <OperatorShell pageTitle="Hope Forward International">
      <div className="space-y-6 max-w-[1280px]">
        {/* Header card */}
        <div className="card card-pad">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-ink/5 flex items-center justify-center">
                <Building2 size={24} className="text-ink" />
              </div>
              <div>
                <div className="text-base font-semibold text-ink tracking-tight">
                  Hope Forward International
                </div>
                <div className="text-xs text-muted mt-0.5">
                  Charity · 501(c)(3) · EIN 83-2461037 · Pilot-Charlie
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <RegionBadge region="US" />
                  <span className="pill pill-info">Enterprise</span>
                  <span className="pill pill-success">Active</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-muted uppercase tracking-wider">Go-live</div>
              <div className="text-[13px] font-semibold text-ink mt-0.5 numeric">2026-09-15</div>
              <div className="text-[11px] text-muted mt-0.5">in 16 weeks</div>
            </div>
          </div>
        </div>

        {/* KPI rail */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Knockers" value={PILOT.knockers} hint="active field reps" />
          <KpiCard label="Inside sales" value={PILOT.insideSalesReps} hint="call-centre seats" />
          <KpiCard
            label="MTD conversions"
            value={PILOT.monthlyConversions.toLocaleString()}
            delta="+22.4%"
            deltaTone="positive"
          />
          <KpiCard
            label="MTD revenue"
            value={<Money cents={PILOT.monthlyRevenueCents} region="US" />}
            delta="+18.2%"
            deltaTone="positive"
            hint="fee + rake"
          />
        </div>

        {/* Two-column: contract + integrations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section title="Contract" subtitle="Pilot-Charlie commercial terms">
            <div className="space-y-3 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-muted flex items-center gap-2">
                  <CreditCard size={14} className="text-soft" />
                  Platform fee
                </span>
                <span className="numeric font-medium text-ink">
                  <Money cents={250000n} region="US" /> / mo
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Door-sale rake</span>
                <span className="numeric font-medium text-ink">15.00%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Inside-sales rake</span>
                <span className="numeric font-medium text-ink">10.00%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Retargeting rake</span>
                <span className="numeric font-medium text-ink">5.00%</span>
              </div>
              <div className="flex items-center justify-between border-t border-line2 pt-3 mt-3">
                <span className="text-muted flex items-center gap-2">
                  <Calendar size={14} className="text-soft" />
                  Billing day
                </span>
                <span className="numeric font-medium text-ink">1st of month</span>
              </div>
            </div>
          </Section>

          <Section title="Enterprise integrations" subtitle="Tenant-specific config">
            <div className="space-y-3 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-muted flex items-center gap-2">
                  <ShieldCheck size={14} className="text-soft" />
                  SSO provider
                </span>
                <span className="font-medium text-ink">Okta</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">SAML metadata</span>
                <StatusPill tone="warn">Pending</StatusPill>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">SOC 2 Type I scope</span>
                <StatusPill tone="info">In progress</StatusPill>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">White-label domain</span>
                <span className="font-medium text-ink truncate">app.hopeforward.org</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Dedicated DB</span>
                <StatusPill tone="success">Provisioned</StatusPill>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted flex items-center gap-2">
                  <Globe size={14} className="text-soft" />
                  iOS bundle ID
                </span>
                <span className="font-medium text-ink truncate">org.hopeforward.knocker</span>
              </div>
            </div>
          </Section>
        </div>

        {/* State clearance matrix */}
        <Section
          title="Paid-solicitor state clearance"
          subtitle={`${STATE_CLEARANCE.filter((s) => s.status === 'approved').length} of ${STATE_CLEARANCE.length} states cleared · campaigns deliver only to approved states`}
          paddedBody={false}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>State</th>
                <th>Status</th>
                <th>Bond</th>
                <th>Filed</th>
                <th>Approved</th>
              </tr>
            </thead>
            <tbody>
              {STATE_CLEARANCE.map((s) => (
                <tr key={s.state}>
                  <td>
                    <span className="mono">{s.state}</span>
                  </td>
                  <td>
                    <StatusPill
                      tone={
                        s.status === 'approved'
                          ? 'success'
                          : s.status === 'submitted'
                            ? 'info'
                            : 'warn'
                      }
                    >
                      {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                    </StatusPill>
                  </td>
                  <td className="numeric text-[13px]">
                    <Money cents={s.bondCents} region="US" />
                  </td>
                  <td className="numeric text-[12px] text-muted">
                    {'filedAt' in s ? s.filedAt : '—'}
                  </td>
                  <td className="numeric text-[12px] text-muted">
                    {'approvedAt' in s ? s.approvedAt : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
    </OperatorShell>
  );
}
