import { ArrowRight, Mail, MessageSquare, Phone, Sparkles, Split, ShieldCheck } from 'lucide-react';
import { Banner, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { OrgShell } from '@/components/OrgShell';

const ROUTING_RULES = [
  {
    name: 'Texas Tier-1 routing',
    match: 'Territory IN (Austin East, Austin North, Dallas Metro, Houston SE)',
    action: 'Round-robin among 4 reps with load < 25',
    active: true,
    leads30d: 1240,
  },
  {
    name: 'Arizona overflow',
    match: 'Territory = Phoenix West AND inbox > 8',
    action: 'Fallback to Atlanta team (timezone-adjusted)',
    active: true,
    leads30d: 142,
  },
  {
    name: 'High-value SLA',
    match: 'Lead.tier = high',
    action: 'Skip queue · alert top closer · 60-min SLA',
    active: true,
    leads30d: 388,
  },
  {
    name: 'Retargeting → priority queue',
    match: 'attributionSource = retargeting',
    action: 'Auto-assigned to inside-sales lead (already warm)',
    active: true,
    leads30d: 264,
  },
  {
    name: 'After-hours holding',
    match: 'Captured between 21:00–07:00 local',
    action: 'Hold for next-day 08:00 dispatch',
    active: true,
    leads30d: 92,
  },
];

const SEQUENCES = [
  {
    name: 'Hope Forward Day-1 follow-up',
    description: 'Charity vertical · door-source · default',
    steps: [
      { day: 0, hour: '+5m', channel: 'sms', label: 'Welcome + appointment hint' },
      { day: 1, hour: '14:00', channel: 'call', label: 'Outbound call — pitch confirm' },
      { day: 2, hour: '10:00', channel: 'sms', label: 'Soft re-engage if no answer' },
      { day: 3, hour: '16:00', channel: 'email', label: 'Impact-story brochure' },
      { day: 7, hour: '12:00', channel: 'call', label: 'Final call — convert or close-out' },
    ],
    activeLeads: 218,
    convRate: 12.4,
  },
  {
    name: 'Retargeting → recurring giving',
    description: 'Charity vertical · retargeting-source',
    steps: [
      { day: 0, hour: '+2m', channel: 'sms', label: 'Thanks for clicking — link to checkout' },
      { day: 1, hour: '11:00', channel: 'call', label: 'Optional rep call if no checkout' },
      { day: 4, hour: '15:00', channel: 'email', label: 'Donation-impact stats' },
    ],
    activeLeads: 89,
    convRate: 18.7,
  },
  {
    name: 'Commercial sale — installer handoff',
    description: 'Commercial vertical · all sources',
    steps: [
      { day: 0, hour: '+0m', channel: 'sms', label: 'Confirm install window' },
      { day: 0, hour: '+30m', channel: 'call', label: 'Installer-team handoff call' },
    ],
    activeLeads: 41,
    convRate: 64.1,
  },
];

const CHANNEL_ICON = { sms: MessageSquare, email: Mail, call: Phone };
const CHANNEL_COLOR = {
  sms: 'bg-accentSoft text-accent',
  email: 'bg-accentSoft text-accent',
  call: 'bg-successSoft text-success',
};

export default function AutomationsPage(): JSX.Element {
  return (
    <OrgShell pageTitle="Automations">
      <div className="space-y-6 max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <ShieldCheck size={14} />
            CRM operations engine. Lead-routing rules + multi-touch sequences. Every step is
            consent-checked + state-clearance-checked before dispatch.
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Active rules" value={ROUTING_RULES.length} hint="lead routing" />
          <KpiCard label="Active sequences" value={SEQUENCES.length} hint="multi-touch" />
          <KpiCard label="Leads routed (30d)" value="2,126" delta="+18%" deltaTone="positive" />
          <KpiCard
            label="Sequence-driven conv."
            value="22.4%"
            delta="+3.2pp"
            deltaTone="positive"
          />
        </div>

        <Section
          title="Lead routing rules"
          subtitle="Top match wins · evaluated server-side on lead creation"
          paddedBody={false}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Rule</th>
                <th>Match</th>
                <th>Action</th>
                <th>Leads (30d)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {ROUTING_RULES.map((r) => (
                <tr key={r.name}>
                  <td>
                    <div className="flex items-center gap-2">
                      <Split size={14} className="text-soft shrink-0" />
                      <span className="text-[13px] font-medium text-ink">{r.name}</span>
                    </div>
                  </td>
                  <td className="text-[12px] text-muted font-mono">{r.match}</td>
                  <td className="text-[12px] text-ink">{r.action}</td>
                  <td className="numeric text-[13px]">{r.leads30d.toLocaleString()}</td>
                  <td>
                    <StatusPill tone={r.active ? 'success' : 'muted'}>
                      {r.active ? 'Active' : 'Off'}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section
          title="Multi-touch sequences"
          subtitle="Run on every routed lead · channel-aware · consent-gated"
        >
          <div className="space-y-6">
            {SEQUENCES.map((seq) => (
              <div key={seq.name} className="card !p-0 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-line2 flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-semibold text-ink tracking-tight">
                      {seq.name}
                    </div>
                    <div className="text-[11px] text-muted mt-0.5">{seq.description}</div>
                  </div>
                  <div className="flex items-center gap-4 text-[11px]">
                    <span className="text-muted">
                      <span className="numeric text-ink font-semibold">{seq.activeLeads}</span>{' '}
                      active
                    </span>
                    <StatusPill tone={seq.convRate > 15 ? 'success' : 'info'}>
                      {seq.convRate}% conv.
                    </StatusPill>
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex items-center gap-3 overflow-x-auto pb-2">
                    {seq.steps.map((step, i) => {
                      const Icon = CHANNEL_ICON[step.channel as keyof typeof CHANNEL_ICON];
                      const colorClass = CHANNEL_COLOR[step.channel as keyof typeof CHANNEL_COLOR];
                      return (
                        <div
                          key={`${seq.name}-${i}-wrap`}
                          className="flex items-center gap-3 shrink-0"
                        >
                          <div
                            className="flex flex-col items-center gap-1.5"
                            style={{ minWidth: 130 }}
                          >
                            <div
                              className={`w-10 h-10 rounded-xl ${colorClass} flex items-center justify-center`}
                            >
                              <Icon size={16} strokeWidth={2} />
                            </div>
                            <div className="text-[11px] font-semibold text-ink uppercase tracking-wider">
                              Day {step.day}
                              {step.hour && (
                                <span className="text-soft normal-case font-normal">
                                  {' '}
                                  · {step.hour}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted text-center max-w-[130px]">
                              {step.label}
                            </div>
                          </div>
                          {i < seq.steps.length - 1 && (
                            <ArrowRight size={14} className="text-soft" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="AI-suggested optimisation"
          subtitle="Claude analyses last 30d of sequence performance"
        >
          <div className="card !shadow-none border border-accent/20 bg-accentSoft/30 card-pad">
            <div className="flex items-start gap-3">
              <Sparkles size={16} className="text-accent mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-ink">
                  Move Day-2 SMS to Day-1 18:00 for door-source leads in TX
                </div>
                <div className="text-[12px] text-muted mt-1">
                  Reps report 38% of door-captured TX leads convert within 24h of capture. Pulling
                  the Day-2 SMS forward should lift conversion by ~2.1pp (model confidence: 0.81).
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button className="pill pill-info hover:opacity-80 transition cursor-pointer">
                    Apply (A/B test)
                  </button>
                  <button className="pill pill-muted hover:opacity-80 transition cursor-pointer">
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Section>
      </div>
    </OrgShell>
  );
}
