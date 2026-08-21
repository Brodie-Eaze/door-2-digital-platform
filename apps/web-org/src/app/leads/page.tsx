import Link from 'next/link';
import { Inbox, Megaphone, Phone, ArrowRight } from 'lucide-react';
import { Banner, KpiCard, LeadCard, Section } from '@d2d/ui-web';
import { OrgShell } from '@/components/OrgShell';
import { apiFetch, type LeadPublic, type PageResponse } from '@/lib/api';

function shortId(id: string): string {
  return id.slice(-6).toUpperCase();
}

function leadSource(lead: LeadPublic): string {
  return lead.sourceKnockId ? 'door' : 'unattributed';
}

export default async function LeadsPage(): Promise<JSX.Element> {
  const leadPage = await apiFetch<PageResponse<LeadPublic>>('/leads');
  const leads = leadPage.data;
  const door = leads.filter((lead) => lead.sourceKnockId).length;
  const assigned = leads.filter((lead) => lead.assignedToId).length;
  const unassigned = leads.length - assigned;

  return (
    <OrgShell pageTitle="Leads">
      <div className="space-y-6 max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px]">
            Leads are the spine of D2D.{' '}
            <span className="font-semibold">
              Every door knock, every retargeting click, every inbound SMS
            </span>{' '}
            creates a Lead. The sales team works them from this inbox through to conversion.
          </span>
        </Banner>
        {leadPage.nextCursor && (
          <Banner tone="muted">
            <span className="text-[13px]">More leads are available after this first page.</span>
          </Banner>
        )}

        {/* Source breakdown */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="In inbox" value={leads.length} hint="first page" animate={false} />
          <KpiCard label="Door" value={door} hint="linked to a knock" animate={false} />
          <KpiCard label="Assigned" value={assigned} hint="has an owner" animate={false} />
          <KpiCard label="Unassigned" value={unassigned} hint="needs routing" animate={false} />
        </div>

        <Section
          title={`${leads.length} leads in inbox`}
          subtitle="Sort: most-recent · Filter: all sources, all stages · Click a card for the full journey"
        >
          {leads.length === 0 ? (
            <div className="text-[12px] text-muted">
              No leads yet — they appear as knockers capture them in the field
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {leads.map((lead) => (
                <Link key={lead.id} href={`/leads/${lead.id}`} className="block focus:outline-none">
                  <LeadCard
                    givenName={lead.givenName}
                    familyName={lead.familyName}
                    status={lead.status}
                    address={lead.addressId ? `Address ${shortId(lead.addressId)}` : undefined}
                    phone={lead.phone ?? undefined}
                    email={lead.email ?? undefined}
                    attributionSource={leadSource(lead)}
                    assignee={lead.assignedToId ? shortId(lead.assignedToId) : undefined}
                  />
                </Link>
              ))}
            </div>
          )}
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
