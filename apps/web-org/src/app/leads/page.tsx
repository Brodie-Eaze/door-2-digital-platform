import Link from 'next/link';
import { Inbox, Megaphone, Phone, ArrowRight } from 'lucide-react';
import { Banner, KpiCard, LeadCard, Section } from '@d2d/ui-web';
import { OrgShell } from '@/components/OrgShell';
import { LEADS } from '@/lib/fixtures';

export default function LeadsPage(): JSX.Element {
  const door = LEADS.filter((l) => l.source === 'door').length;
  const inside = LEADS.filter((l) => l.source === 'inside_sales').length;
  const retarget = LEADS.filter((l) => l.source === 'retargeting').length;

  return (
    <OrgShell pageTitle="Leads">
      <div className="space-y-6 max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px]">
            Leads are the spine of D2D.{' '}
            <span className="font-semibold">
              Every door knock, every retargeting click, every inbound SMS
            </span>{' '}
            creates a Lead. The sales team works them from this inbox through to conversion. Click{' '}
            <span className="font-semibold">Maria Santos</span> below to see a real lead journey
            end-to-end.
          </span>
        </Banner>

        {/* Source breakdown */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="In inbox"
            value={LEADS.length}
            hint={`across ${door + inside + retarget} sources`}
          />
          <KpiCard
            label="Door"
            value={door}
            hint="captured at the door"
            delta="15% rake"
            deltaTone="neutral"
          />
          <KpiCard
            label="Inside sales"
            value={inside}
            hint="closed by call centre"
            delta="10% rake"
            deltaTone="neutral"
          />
          <KpiCard
            label="Retargeting"
            value={retarget}
            hint="clicked an ad"
            delta="5% rake"
            deltaTone="neutral"
          />
        </div>

        <Section
          title={`${LEADS.length} leads in inbox`}
          subtitle="Sort: most-recent · Filter: all sources, all stages · Click a card for the full journey"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {LEADS.map((lead) => {
              // Maria Santos has a real detail page; others are mocked
              const isLinked = lead.name === 'Maria Santos';
              const card = (
                <LeadCard
                  givenName={lead.name.split(' ')[0] ?? lead.name}
                  familyName={lead.name.split(' ').slice(1).join(' ') ?? ''}
                  status={lead.status}
                  address={lead.address}
                  phone={lead.phone}
                  attributionSource={lead.source}
                  assignee={lead.assignee || undefined}
                />
              );
              return isLinked ? (
                <Link
                  key={lead.name}
                  href="/leads/maria-santos"
                  className="block focus:outline-none"
                >
                  {card}
                </Link>
              ) : (
                <div key={lead.name}>{card}</div>
              );
            })}
          </div>
        </Section>

        {/* CRM flow diagram */}
        <Section
          title="How a lead flows through the CRM"
          subtitle="From capture to converted donor"
        >
          <div className="flex items-center justify-between gap-2 py-2 flex-wrap">
            {[
              {
                icon: Inbox,
                label: 'Captured',
                sub: 'door / SMS / ad',
                tone: 'bg-accentSoft text-accent',
              },
              {
                icon: ArrowRight,
                label: '',
                sub: '',
                tone: 'bg-transparent text-soft',
                arrow: true,
              },
              {
                icon: Megaphone,
                label: 'Auto-routed',
                sub: 'territory + load',
                tone: 'bg-accentSoft text-accent',
              },
              {
                icon: ArrowRight,
                label: '',
                sub: '',
                tone: 'bg-transparent text-soft',
                arrow: true,
              },
              {
                icon: Phone,
                label: 'Worked',
                sub: 'sequence · call · SMS',
                tone: 'bg-accentSoft text-accent',
              },
              {
                icon: ArrowRight,
                label: '',
                sub: '',
                tone: 'bg-transparent text-soft',
                arrow: true,
              },
              {
                icon: Inbox,
                label: 'Converted',
                sub: 'attribution + rake',
                tone: 'bg-successSoft text-success',
              },
            ].map((step, i) => {
              const Icon = step.icon;
              if (step.arrow) {
                return (
                  <div key={i} className="flex items-center text-soft">
                    <Icon size={18} />
                  </div>
                );
              }
              return (
                <div key={i} className="flex flex-col items-center gap-2 min-w-[110px]">
                  <div
                    className={`w-12 h-12 rounded-2xl ${step.tone} flex items-center justify-center`}
                  >
                    <Icon size={20} strokeWidth={2} />
                  </div>
                  <div className="text-[12px] font-semibold text-ink">{step.label}</div>
                  <div className="text-[10px] text-muted">{step.sub}</div>
                </div>
              );
            })}
          </div>
        </Section>
      </div>
    </OrgShell>
  );
}
