'use client';

import { Check, Minus, Tag } from 'lucide-react';
import { Button, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { OperatorShell } from '@/components/OperatorShell';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { toast } from '@/components/Toaster';

interface Plan {
  id: 'pilot' | 'growth' | 'enterprise';
  name: string;
  tagline: string;
  monthlyCents: bigint;
  seatsIncluded: number;
  rakeBps: number;
  orgsOnPlan: number;
  highlight: boolean;
  features: { label: string; included: boolean }[];
}

const PLANS: Plan[] = [
  {
    id: 'pilot',
    name: 'Pilot',
    tagline: 'Single-org proof of value',
    monthlyCents: 2_500_00n,
    seatsIncluded: 25,
    rakeBps: 1500,
    orgsOnPlan: 3,
    highlight: false,
    features: [
      { label: 'Household Ontology & Propensity Engine', included: true },
      { label: 'Knocker roster + territory mapping', included: true },
      { label: 'Conversation Intelligence', included: false },
      { label: 'Marketing Studio (retargeting)', included: false },
      { label: 'Dedicated success manager', included: false },
      { label: 'SSO / SCIM provisioning', included: false },
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    tagline: 'Scaling field + inside-sales teams',
    monthlyCents: 9_500_00n,
    seatsIncluded: 150,
    rakeBps: 1000,
    orgsOnPlan: 2,
    highlight: true,
    features: [
      { label: 'Household Ontology & Propensity Engine', included: true },
      { label: 'Knocker roster + territory mapping', included: true },
      { label: 'Conversation Intelligence', included: true },
      { label: 'Marketing Studio (retargeting)', included: true },
      { label: 'Dedicated success manager', included: false },
      { label: 'SSO / SCIM provisioning', included: false },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Multi-org charities & franchises',
    monthlyCents: 0n,
    seatsIncluded: 500,
    rakeBps: 700,
    orgsOnPlan: 1,
    highlight: false,
    features: [
      { label: 'Household Ontology & Propensity Engine', included: true },
      { label: 'Knocker roster + territory mapping', included: true },
      { label: 'Conversation Intelligence', included: true },
      { label: 'Marketing Studio (retargeting)', included: true },
      { label: 'Dedicated success manager', included: true },
      { label: 'SSO / SCIM provisioning', included: true },
    ],
  },
];

const ORGS = [
  { id: 'org_hope', name: 'Hope Forward International', plan: 'growth', seats: 184, mrrCents: 9_500_00n, renews: '2026-12-01', status: 'active' },
  { id: 'org_pestmax', name: 'PestMax Services', plan: 'pilot', seats: 22, mrrCents: 2_500_00n, renews: '2026-07-15', status: 'active' },
  { id: 'org_solarbright', name: 'SolarBright Energy', plan: 'growth', seats: 96, mrrCents: 9_500_00n, renews: '2026-09-01', status: 'active' },
  { id: 'org_cleanstreets', name: 'Clean Streets Coalition', plan: 'pilot', seats: 14, mrrCents: 2_500_00n, renews: '2026-08-20', status: 'trial' },
  { id: 'org_unitedaid', name: 'United Aid Alliance', plan: 'enterprise', seats: 412, mrrCents: 24_000_00n, renews: '2027-03-01', status: 'active' },
  { id: 'org_doorworks', name: 'DoorWorks Home Services', plan: 'pilot', seats: 19, mrrCents: 2_500_00n, renews: '2026-07-30', status: 'past_due' },
];

const PLAN_LABEL: Record<string, string> = { pilot: 'Pilot', growth: 'Growth', enterprise: 'Enterprise' };

function planTone(plan: string): 'muted' | 'info' | 'success' {
  if (plan === 'enterprise') return 'success';
  if (plan === 'growth') return 'info';
  return 'muted';
}

function statusTone(status: string): 'success' | 'warn' | 'danger' {
  if (status === 'active') return 'success';
  if (status === 'trial') return 'warn';
  return 'danger';
}

export default function PlansPage(): JSX.Element {
  const totalMrr = ORGS.reduce((acc, o) => acc + o.mrrCents, 0n);
  const totalSeats = ORGS.reduce((acc, o) => acc + o.seats, 0);

  return (
    <OperatorShell pageTitle="Plans & billing config">
      <div className="space-y-6 max-w-[1280px]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Total MRR" value={<Money cents={totalMrr} region="US" />} delta="+18.2%" deltaTone="positive" />
          <KpiCard label="Orgs on a plan" value={String(ORGS.length)} hint="2 verticals · 1 charity" />
          <KpiCard label="Billable seats" value={totalSeats.toLocaleString('en-US')} hint="across all plans" />
          <KpiCard label="Net revenue retention" value="118%" delta="+6pp" deltaTone="positive" hint="trailing 90d" />
        </div>

        <Section
          title="Plan catalog"
          subtitle="Per-org subscription tiers. Plan fee + per-attribution rake is the platform revenue model."
          action={<DataSourceBadge source="fixture" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`card card-pad flex flex-col ${plan.highlight ? 'ring-2 ring-accent/40' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tag size={14} className="text-accent" />
                    <span className="text-[15px] font-semibold text-ink">{plan.name}</span>
                  </div>
                  <span className="pill pill-info">{plan.orgsOnPlan} orgs</span>
                </div>
                <div className="text-[12px] text-muted mt-1">{plan.tagline}</div>

                <div className="mt-4 flex items-baseline gap-1">
                  {plan.monthlyCents > 0n ? (
                    <>
                      <span className="text-[24px] font-semibold text-ink">
                        <Money cents={plan.monthlyCents} region="US" />
                      </span>
                      <span className="text-[12px] text-muted">/mo</span>
                    </>
                  ) : (
                    <span className="text-[22px] font-semibold text-ink">Custom</span>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-[11.5px]">
                  <div className="rounded-lg bg-paper border border-line2 px-2.5 py-1.5">
                    <div className="text-muted">Seats incl.</div>
                    <div className="text-ink font-medium numeric">{plan.seatsIncluded}</div>
                  </div>
                  <div className="rounded-lg bg-paper border border-line2 px-2.5 py-1.5">
                    <div className="text-muted">Rake</div>
                    <div className="text-ink font-medium numeric">{(plan.rakeBps / 100).toFixed(1)}%</div>
                  </div>
                </div>

                <ul className="mt-4 space-y-1.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f.label} className="flex items-start gap-2 text-[12px]">
                      {f.included ? (
                        <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <Minus size={14} className="text-soft shrink-0 mt-0.5" />
                      )}
                      <span className={f.included ? 'text-ink2' : 'text-soft line-through'}>{f.label}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={plan.highlight ? 'primary' : 'secondary'}
                  size="sm"
                  className="mt-4 w-full"
                  onClick={() => toast.info(`Edit ${plan.name} pricing — config writes land in Phase 1.3`)}
                >
                  Edit plan
                </Button>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Orgs by plan"
          subtitle="Demo data — live billing sync (Stripe) lands in Phase 1.3."
          paddedBody={false}
          action={
            <div className="flex items-center gap-2">
              <DataSourceBadge source="fixture" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toast.info('Export plan roster CSV — wiring lands in Phase 1.3')}
              >
                Export CSV
              </Button>
            </div>
          }
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Org</th>
                <th>Plan</th>
                <th>Seats</th>
                <th>MRR</th>
                <th>Renews</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ORGS.map((org) => (
                <tr key={org.id}>
                  <td className="text-[13px] text-ink truncate max-w-[220px]">{org.name}</td>
                  <td>
                    <StatusPill tone={planTone(org.plan)}>{PLAN_LABEL[org.plan]}</StatusPill>
                  </td>
                  <td className="numeric text-[13px] text-ink2">{org.seats}</td>
                  <td className="font-medium">
                    <Money cents={org.mrrCents} region="US" />
                  </td>
                  <td className="text-[12px] text-muted">{org.renews}</td>
                  <td>
                    <StatusPill tone={statusTone(org.status)}>
                      {org.status === 'past_due' ? 'Past due' : org.status === 'trial' ? 'Trial' : 'Active'}
                    </StatusPill>
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        toast.info(`Change plan for ${org.name} — billing changes require an active subscription in Phase 1.3`)
                      }
                    >
                      Change plan
                    </Button>
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
