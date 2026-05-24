'use client';

import {
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  PenTool,
  PhoneCall,
  MessageSquare,
  ChevronRight,
  User,
  Hash,
  Sparkles,
  DollarSign,
} from 'lucide-react';
import { Banner, Button, Money, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';

const LEAD = {
  name: 'Maria Santos',
  status: 'converted',
  source: 'door',
  email: 'maria.santos@gmail.com',
  phone: '+15125550182',
  address: '4218 Lakeview Dr, Austin TX 78739',
  campaign: 'Fall Pledge Drive 2026',
};

const TIMELINE = [
  {
    when: '2026-05-23T14:55:12Z',
    actor: { name: 'Jada Davis', initials: 'JD', role: 'Knocker' },
    icon: PenTool,
    color: 'text-success',
    title: 'Lead captured at door',
    detail: '4218 Lakeview Dr · Austin TX · Knocker rated interest: HIGH',
    artifacts: ['Signed consent', 'Photo of doorstep', 'GPS ±3m', 'Pitch: clean-water programme'],
    badge: 'door',
  },
  {
    when: '2026-05-23T14:55:14Z',
    actor: { name: 'system', initials: 'SY', role: 'system' },
    icon: ShieldCheck,
    color: 'text-accent',
    title: 'Compliance check passed',
    detail: 'Address not on DNK list · Phone not on TCPA DNC · State (TX) cleared for solicitation',
    artifacts: [
      'TCPA consent recorded',
      'FTC DNC scrubbed',
      'TX paid-solicitor reg #TX-2026-04421',
    ],
  },
  {
    when: '2026-05-23T14:55:18Z',
    actor: { name: 'system', initials: 'SY', role: 'system' },
    icon: ChevronRight,
    color: 'text-soft',
    title: 'Auto-routed to inside-sales',
    detail: 'Territory: Austin East → Sarah Harris (3 active leads, capacity 25)',
    artifacts: ['Rule: territory_capacity_round_robin', 'Sequence: Hope Forward Day-1 follow-up'],
  },
  {
    when: '2026-05-23T15:02:00Z',
    actor: { name: 'system', initials: 'SY', role: 'system' },
    icon: MessageSquare,
    color: 'text-accent',
    title: 'SMS sent — Step 1 of 5',
    detail:
      '"Hi Maria, thanks for chatting with Jada about Hope Forward today. I\'ll call you tomorrow afternoon. — Sarah"',
    artifacts: ['Twilio US long code', 'Delivered 15:02:03', 'Read 15:14:22'],
  },
  {
    when: '2026-05-24T14:30:08Z',
    actor: { name: 'Sarah Harris', initials: 'SH', role: 'inside_sales' },
    icon: PhoneCall,
    color: 'text-success',
    title: 'Outbound call — no answer',
    detail: 'Duration 22s · Left voicemail · Auto-scheduled retry tomorrow',
    artifacts: ['Aircall · call_id 8a3f...4291', 'Voicemail transcript stored'],
  },
  {
    when: '2026-05-24T16:42:11Z',
    actor: { name: 'Maria Santos', initials: 'MS', role: 'lead' },
    icon: PhoneCall,
    color: 'text-success',
    title: 'Inbound callback from lead',
    detail: 'Duration 4m 18s · Connected with Sarah · High-intent',
    artifacts: ['Aircall recording', 'Transcript', 'Sentiment: positive'],
  },
  {
    when: '2026-05-24T16:46:29Z',
    actor: { name: 'Sarah Harris', initials: 'SH', role: 'inside_sales' },
    icon: DollarSign,
    color: 'text-success',
    title: 'Conversion captured — $24/mo recurring',
    detail: 'Payment method tokenised via MiCamp · First charge 2026-06-05',
    artifacts: ['MiCamp token last4 4242', 'MiCamp sub mcs_01HX...', 'Receipt PDF generated'],
  },
  {
    when: '2026-05-24T16:46:30Z',
    actor: { name: 'system', initials: 'SY', role: 'system' },
    icon: Hash,
    color: 'text-accent',
    title: 'Attribution computed → DOOR bucket (15%)',
    detail: 'Knocker Jada Davis credited. D2D rake: $3.60/mo. Processor residual: $0.04/mo.',
    artifacts: [
      'Conversion attributionSource=door',
      'Commission accrual → JD',
      'AuditEvent chain row 3,481,920',
    ],
  },
];

export default function LeadDetailPage({ params }: { params: { slug: string } }): JSX.Element {
  return (
    <AccountShell accountSlug={params.slug} pageTitle="Maria Santos">
      <div className="space-y-6 max-w-[1400px]">
        <Banner tone="success">
          <span className="text-[13px] flex items-center gap-2">
            <ShieldCheck size={14} />
            Full lead journey: door capture → CRM → 4-touch sequence → converted to monthly donor in
            <span className="font-semibold ml-1">26h 51m</span>. Every step audit-logged.
          </span>
        </Banner>

        <div className="card card-pad">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-ink/5 flex items-center justify-center">
                <User size={24} className="text-ink" />
              </div>
              <div>
                <div className="text-base font-semibold text-ink tracking-tight">{LEAD.name}</div>
                <div className="text-xs text-muted mt-0.5 flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <MapPin size={11} /> {LEAD.address}
                  </span>
                </div>
                <div className="text-xs text-muted mt-1 flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Phone size={11} /> <span className="numeric">{LEAD.phone}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Mail size={11} /> {LEAD.email}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <StatusPill tone="success">Converted</StatusPill>
                  <span className="tag">{LEAD.source}-source</span>
                  <span className="tag">{LEAD.campaign}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-muted uppercase tracking-wider">Lifetime value</div>
              <div className="text-[20px] font-semibold text-ink mt-0.5 numeric">
                <Money cents={28800n} region="US" />
              </div>
              <div className="text-[11px] text-muted mt-0.5">$24/mo × 12 mo</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="h-section">Lead journey timeline</h2>
            <div className="card">
              {TIMELINE.map((e, i) => {
                const Icon = e.icon;
                return (
                  <div
                    key={i}
                    className="flex gap-4 px-5 py-4 border-b border-line2 last:border-b-0"
                  >
                    <div className="flex flex-col items-center shrink-0 pt-0.5">
                      <div
                        className={`w-9 h-9 rounded-full bg-paper border border-line2 flex items-center justify-center ${e.color}`}
                      >
                        <Icon size={16} strokeWidth={2} />
                      </div>
                      {i < TIMELINE.length - 1 && <div className="flex-1 w-px bg-line2 mt-2" />}
                    </div>
                    <div className="flex-1 min-w-0 pb-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold text-ink tracking-tight">
                            {e.title}
                            {e.badge && <span className="ml-2 tag !text-[10px]">{e.badge}</span>}
                          </div>
                          <div className="text-[12px] text-muted mt-1">{e.detail}</div>
                        </div>
                        <div className="text-[10px] text-soft shrink-0 numeric whitespace-nowrap">
                          {new Date(e.when).toISOString().slice(5, 16).replace('T', ' ')}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span
                          className={`mono !text-[9px] ${e.actor.role === 'system' ? '!bg-line2 !text-muted' : ''}`}
                        >
                          {e.actor.initials}
                        </span>
                        <span className="text-[11px] text-muted">{e.actor.name}</span>
                        {e.actor.role !== 'system' && (
                          <span className="text-[10px] text-soft">· {e.actor.role}</span>
                        )}
                      </div>
                      {e.artifacts && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {e.artifacts.map((a) => (
                            <span key={a} className="tag !text-[10px]">
                              {a}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <Section title="Attribution" subtitle="Drives billing rake">
              <div className="space-y-3 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted">Source bucket</span>
                  <span className="pill pill-info">door (15%)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Captured by</span>
                  <span className="flex items-center gap-1.5">
                    <span className="mono !w-6 !h-5 !text-[10px]">JD</span>
                    <span className="text-ink font-medium">Jada Davis</span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Closed by</span>
                  <span className="flex items-center gap-1.5">
                    <span className="mono !w-6 !h-5 !text-[10px]">SH</span>
                    <span className="text-ink font-medium">Sarah Harris</span>
                  </span>
                </div>
                <div className="border-t border-line2 pt-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-muted">D2D rake (15%)</span>
                    <span className="font-semibold text-ink">
                      <Money cents={360n} region="US" />
                      /mo
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">MiCamp residual</span>
                    <span className="font-semibold text-ink">
                      <Money cents={4n} region="US" />
                      /mo
                    </span>
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Suggested next action" subtitle="ML-ranked">
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Sparkles size={14} className="text-accent mt-0.5 shrink-0" />
                  <div className="text-[13px] text-ink">
                    Day 30 thank-you SMS scheduled for 2026-06-23. Likelihood-to-upsell score:{' '}
                    <span className="font-semibold">0.71</span> — consider asking to upgrade to
                    $40/mo.
                  </div>
                </div>
                <Button variant="secondary" size="sm" className="w-full">
                  View suggested sequence
                </Button>
              </div>
            </Section>
          </div>
        </div>
      </div>
    </AccountShell>
  );
}
