import { Mail, MessageSquare, Phone, Clock, ArrowRight, Plus, Split, Sparkles } from 'lucide-react';
import { Banner, Button, EmptyState, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { FirstRunBanner } from '@/components/AccountEmptyStates';
import { firstRunSnapshot } from '@/lib/first-run';

const DRIPS = [
  {
    name: 'New lead Day-1 nurture',
    stage: 'New',
    enrolledCount: 142,
    convRate: 14.2,
    steps: [
      { day: 0, hour: '+5m', ch: 'sms', label: 'Thanks for your interest' },
      { day: 1, hour: '10:00', ch: 'email', label: 'Welcome email + impact story' },
      { day: 2, hour: '15:00', ch: 'sms', label: 'Hey, did you have time to read?' },
      { day: 3, hour: '14:00', ch: 'call', label: 'Outbound call attempt' },
    ],
  },
  {
    name: 'Qualified → close drip',
    stage: 'Qualified',
    enrolledCount: 89,
    convRate: 34.8,
    steps: [
      { day: 0, hour: '+10m', ch: 'sms', label: 'Confirm appointment slot' },
      { day: 1, hour: '09:00', ch: 'email', label: 'Detailed program info + FAQ' },
      { day: 2, hour: '14:00', ch: 'call', label: 'Pre-meeting call (closer)' },
      { day: 3, hour: '15:00', ch: 'sms', label: 'Day-of reminder' },
    ],
  },
  {
    name: 'Appointment → seal the deal',
    stage: 'Appointment',
    enrolledCount: 41,
    convRate: 64.1,
    steps: [
      { day: 0, hour: '+30m', ch: 'email', label: 'Personalised summary + checkout link' },
      { day: 1, hour: '11:00', ch: 'sms', label: 'Soft nudge if no checkout' },
      { day: 3, hour: '15:00', ch: 'call', label: 'Final close call' },
    ],
  },
  {
    name: 'Converted donor — onboard',
    stage: 'Converted',
    enrolledCount: 318,
    convRate: 88.4,
    steps: [
      { day: 0, hour: '+2m', ch: 'email', label: 'Receipt + welcome to the family' },
      { day: 7, hour: '11:00', ch: 'email', label: 'Impact stat — first week' },
      { day: 30, hour: '15:00', ch: 'sms', label: 'Thank you + ask for testimonial' },
      { day: 90, hour: '12:00', ch: 'email', label: 'Quarterly impact report' },
    ],
  },
];

const CH_ICON = { sms: MessageSquare, email: Mail, call: Phone };
const CH_COLOR = {
  sms: 'bg-accentSoft text-accent',
  email: 'bg-accentSoft text-accent',
  call: 'bg-successSoft text-success',
};

export default function DripDesignerPage({ params }: { params: { slug: string } }): JSX.Element {
  const firstRun = firstRunSnapshot(params.slug);
  if (firstRun.isFirstRun) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Sequence designer">
        <div className="space-y-5 max-w-[1400px]">
          <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          <EmptyState
            icon={Mail}
            title="No sequences built."
            description="Sequences fire automatically when a lead enters a pipeline stage. Each step is channel-aware (SMS / email / call) and respects per-lead consent records."
            primaryAction={{ label: 'New sequence', href: `/accounts/${params.slug}/drip?new=1` }}
            secondaryAction={{ label: 'See an example', href: '/accounts/hope-forward/drip' }}
            variant="first-run"
          />
        </div>
      </AccountShell>
    );
  }
  return (
    <AccountShell accountSlug={params.slug} pageTitle="Sequence designer">
      <div className="space-y-6 max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px]">
            Multi-step sequences fire automatically when a lead enters a pipeline stage. Each step
            is channel-aware (SMS / email / call) and respects per-lead consent records.
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Active sequences" value={DRIPS.length} hint="one per pipeline stage" />
          <KpiCard
            label="Enrolled leads"
            value={DRIPS.reduce((s, d) => s + d.enrolledCount, 0)}
            delta="+18%"
            deltaTone="positive"
          />
          <KpiCard
            label="Avg conv. rate"
            value={`${(DRIPS.reduce((s, d) => s + d.convRate, 0) / DRIPS.length).toFixed(1)}%`}
            hint="sequence-driven"
          />
          <KpiCard
            label="Steps total"
            value={DRIPS.reduce((s, d) => s + d.steps.length, 0)}
            hint="across all sequences"
          />
        </div>

        {DRIPS.map((drip) => (
          <Section
            key={drip.name}
            title={drip.name}
            subtitle={`Trigger: lead enters "${drip.stage}" stage · ${drip.enrolledCount} currently enrolled · ${drip.convRate}% conv. rate`}
            action={
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" leftIcon={<Split size={13} />}>
                  A/B
                </Button>
                <Button variant="secondary" size="sm" leftIcon={<Plus size={13} />}>
                  Add step
                </Button>
                <StatusPill tone="success">Live</StatusPill>
              </div>
            }
          >
            <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
              {drip.steps.map((step, i) => {
                const Icon = CH_ICON[step.ch as keyof typeof CH_ICON];
                const color = CH_COLOR[step.ch as keyof typeof CH_COLOR];
                return (
                  <div key={`${drip.name}-${i}`} className="flex items-center gap-2 shrink-0">
                    <div className="card !shadow-none border border-line2 p-3 w-[200px]">
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className={`w-7 h-7 rounded-lg ${color} flex items-center justify-center`}
                        >
                          <Icon size={13} strokeWidth={2} />
                        </div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-ink">
                          Day {step.day}
                        </div>
                      </div>
                      <div className="text-[11px] text-muted flex items-center gap-1 numeric">
                        <Clock size={10} /> {step.hour}
                      </div>
                      <div className="text-[12px] text-ink mt-1.5">{step.label}</div>
                    </div>
                    {i < drip.steps.length - 1 && (
                      <ArrowRight size={14} className="text-soft shrink-0" />
                    )}
                  </div>
                );
              })}
              {/* End cap */}
              <div className="flex items-center gap-2 shrink-0">
                <ArrowRight size={14} className="text-soft" />
                <div className="card !shadow-none border border-dashed border-line2 p-3 w-[160px] flex flex-col items-center justify-center">
                  <Plus size={16} className="text-soft mb-1" />
                  <div className="text-[11px] text-muted">Add step</div>
                </div>
              </div>
            </div>
          </Section>
        ))}

        <Section
          title="AI-suggested sequence refinement"
          subtitle="Claude analyses 30d of sequence performance"
        >
          <div className="card !shadow-none border border-accent/20 bg-accentSoft/30 card-pad flex items-start gap-3">
            <Sparkles size={16} className="text-accent mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-ink">
                &ldquo;Qualified → close sequence&rdquo; Day-2 call is converting only at 28%
              </div>
              <div className="text-[12px] text-muted mt-1">
                Consider replacing Day-2 call with a 2-min branded video sent over SMS (Heygen AI
                avatar). Pilot test on 50 leads suggests +9pp lift in same window.
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button variant="primary" size="sm">
                  Run A/B test
                </Button>
                <Button variant="ghost" size="sm">
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        </Section>
      </div>
    </AccountShell>
  );
}
