import Link from 'next/link';
import { ArrowRight, Inbox, Phone, Megaphone } from 'lucide-react';
import { Banner, KpiCard, LeadCard, Section } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { accountData } from '@/lib/account-fixtures';

export default function LeadsInboxPage({ params }: { params: { slug: string } }): JSX.Element {
  const { account, leads } = accountData(params.slug);
  if (!account)
    return (
      <AccountShell accountSlug={params.slug}>
        <div>Not found</div>
      </AccountShell>
    );

  const door = leads.filter((l) => l.source === 'door').length;
  const inside = leads.filter((l) => l.source === 'inside_sales').length;
  const retarget = leads.filter((l) => l.source === 'retargeting').length;

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Leads inbox">
      <div className="space-y-6 max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px]">
            Every Noctua interaction at the door creates a Lead — even if they didn't sell on the
            spot. Inside-sales team has <span className="font-semibold">7 days</span> to call,
            convert, or close out.
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="In inbox"
            value={leads.length}
            hint={`across ${door + inside + retarget} sources`}
          />
          <KpiCard label="Door" value={door} hint="15% rake" />
          <KpiCard label="Inside sales" value={inside} hint="10% rake" />
          <KpiCard label="Retargeting" value={retarget} hint="5% rake" />
        </div>

        <Section
          title={`${leads.length} leads in inbox`}
          subtitle="Sort: most-recent · Click any card for full journey"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {leads.map((lead) => {
              const isLinked = lead.name === 'Maria Santos' && params.slug === 'hope-forward';
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
                  key={lead.id}
                  href={`/accounts/${params.slug}/leads/maria-santos`}
                  className="block"
                >
                  {card}
                </Link>
              ) : (
                <div key={lead.id}>{card}</div>
              );
            })}
          </div>
        </Section>

        <Section
          title="How a lead flows through this account"
          subtitle="Door → CRM → Sales team works 7 days → Converted"
        >
          <div className="flex items-center justify-between gap-2 py-2 flex-wrap">
            {[
              {
                icon: Inbox,
                label: 'Captured',
                sub: 'by Noctua at door',
                tone: 'bg-accentSoft text-accent',
              },
              { icon: ArrowRight, arrow: true },
              {
                icon: Megaphone,
                label: 'Auto-routed',
                sub: 'territory + load',
                tone: 'bg-accentSoft text-accent',
              },
              { icon: ArrowRight, arrow: true },
              {
                icon: Phone,
                label: 'Sales calls (7d)',
                sub: 'sequence + drip',
                tone: 'bg-accentSoft text-accent',
              },
              { icon: ArrowRight, arrow: true },
              {
                icon: Inbox,
                label: 'Converted',
                sub: 'attribution + rake',
                tone: 'bg-successSoft text-success',
              },
            ].map((step, i) => {
              if (step.arrow) {
                return (
                  <div key={i} className="flex items-center text-soft">
                    <step.icon size={18} />
                  </div>
                );
              }
              const Icon = step.icon;
              return (
                <div key={i} className="flex flex-col items-center gap-2 min-w-[110px]">
                  <div
                    className={`w-12 h-12 rounded-2xl ${step.tone} flex items-center justify-center`}
                  >
                    <Icon size={20} strokeWidth={2} />
                  </div>
                  <div className="text-[12px] font-semibold text-ink">{step.label}</div>
                  <div className="text-[10px] text-muted text-center">{step.sub}</div>
                </div>
              );
            })}
          </div>
        </Section>
      </div>
    </AccountShell>
  );
}
