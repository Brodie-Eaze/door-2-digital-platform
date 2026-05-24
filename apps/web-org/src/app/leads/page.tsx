import { Section } from '@d2d/ui-web';
import { LeadCard } from '@d2d/ui-web';
import { OrgShell } from '@/components/OrgShell';
import { LEADS } from '@/lib/fixtures';

export default function LeadsPage(): JSX.Element {
  return (
    <OrgShell pageTitle="Leads">
      <div className="space-y-6 max-w-[1400px]">
        <Section
          title={`${LEADS.length} leads in inbox`}
          subtitle="Sort: most-recent · Filter: all sources, all stages"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {LEADS.map((lead) => (
              <LeadCard
                key={lead.name}
                givenName={lead.name.split(' ')[0] ?? lead.name}
                familyName={lead.name.split(' ').slice(1).join(' ') ?? ''}
                status={lead.status}
                address={lead.address}
                phone={lead.phone}
                attributionSource={lead.source}
                assignee={lead.assignee || undefined}
              />
            ))}
          </div>
        </Section>
      </div>
    </OrgShell>
  );
}
