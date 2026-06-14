'use client';

import { ListChecks, Plus, Megaphone, MailPlus, Filter, Sparkles } from 'lucide-react';
import { Banner, Button, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { SmartListsEmpty, FirstRunBanner } from '@/components/AccountEmptyStates';
import { firstRunSnapshot } from '@/lib/first-run';
import { toast } from '@/components/Toaster';
import { DataSourceBadge } from '@/components/DataSourceBadge';

const LISTS = [
  {
    name: 'High-tier, door-source, not converted (7d)',
    type: 'smart',
    rule: 'tier=high AND source=door AND status NOT IN (converted, lost) AND age <= 7d',
    members: 142,
    growthDelta: '+18',
    linkedCampaigns: ['Q3 push retargeting', 'Day-7 sequence'],
  },
  {
    name: 'Texas-only door knocks last 30d',
    type: 'smart',
    rule: 'territory.state = TX AND source = door AND age <= 30d',
    members: 1240,
    growthDelta: '+82',
    linkedCampaigns: ['TX Meta ads', 'TX-specific sequence'],
  },
  {
    name: 'Converted donors, $20+/mo',
    type: 'smart',
    rule: 'status = converted AND donation.amountCents >= 2000 AND donation.frequency IN (monthly, fortnightly)',
    members: 481,
    growthDelta: '+12',
    linkedCampaigns: ['Donor upgrade sequence', 'Annual impact report'],
  },
  {
    name: 'Cold leads — final reactivation push',
    type: 'smart',
    rule: 'status = lost AND age >= 90d AND consentRecords.granted = true',
    members: 826,
    growthDelta: '+44',
    linkedCampaigns: ['Reactivation Meta'],
  },
  {
    name: 'Bay Area appointment-set (manual)',
    type: 'static',
    rule: 'Manually-curated VIP list',
    members: 31,
    growthDelta: '+2',
    linkedCampaigns: ['VIP closer sequence'],
  },
];

export default function LeadListsPage({ params }: { params: { slug: string } }): JSX.Element {
  const firstRun = firstRunSnapshot(params.slug);
  if (firstRun.isFirstRun) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Smart lead lists">
        <div className="space-y-5 max-w-[1400px]">
          <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          <SmartListsEmpty slug={params.slug} accountName={firstRun.accountName} />
        </div>
      </AccountShell>
    );
  }
  return (
    <AccountShell accountSlug={params.slug} pageTitle="Smart lead lists">
      <div className="space-y-6 max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Sparkles size={14} />
            Saved filter rules that auto-populate. Lists feed into marketing campaigns + sequences.
            &ldquo;Smart&rdquo; lists update continuously — &ldquo;Static&rdquo; lists are manual
            snapshots.
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Active lists" value={LISTS.length} hint="smart + static" />
          <KpiCard
            label="Total members"
            value={LISTS.reduce((s, l) => s + l.members, 0).toLocaleString()}
          />
          <KpiCard
            label="Smart lists"
            value={LISTS.filter((l) => l.type === 'smart').length}
            hint="auto-updating"
          />
          <KpiCard
            label="Linked campaigns"
            value={[...new Set(LISTS.flatMap((l) => l.linkedCampaigns))].length}
          />
        </div>

        <Section
          title="All lists"
          subtitle="Rule-driven smart lists update on every lead create/update"
          action={
            <div className="flex items-center gap-2">
              <DataSourceBadge source="fixture" />
              <Button
                leftIcon={<Plus size={14} />}
                variant="primary"
                size="sm"
                onClick={() => toast.info('New smart list — builder wiring lands in Phase 1.2')}
              >
                New smart list
              </Button>
            </div>
          }
          paddedBody={false}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>List</th>
                <th>Type</th>
                <th>Rule</th>
                <th>Members</th>
                <th>Δ 7d</th>
                <th>Linked to</th>
              </tr>
            </thead>
            <tbody>
              {LISTS.map((l) => (
                <tr key={l.name}>
                  <td>
                    <div className="flex items-center gap-2">
                      {l.type === 'smart' ? (
                        <Sparkles size={14} className="text-accent shrink-0" />
                      ) : (
                        <ListChecks size={14} className="text-soft shrink-0" />
                      )}
                      <span className="text-[13px] font-medium text-ink">{l.name}</span>
                    </div>
                  </td>
                  <td>
                    <StatusPill tone={l.type === 'smart' ? 'info' : 'muted'}>{l.type}</StatusPill>
                  </td>
                  <td className="text-[11px] text-muted font-mono max-w-[360px] truncate">
                    {l.rule}
                  </td>
                  <td className="numeric text-[13px] font-medium">{l.members.toLocaleString()}</td>
                  <td className="numeric text-[12px] text-success">{l.growthDelta}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {l.linkedCampaigns.map((c) => (
                        <span key={c} className="tag !text-[10px]">
                          {c}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* Rule builder preview */}
        <Section
          title="Build a new smart list"
          subtitle="Drag conditions in · live preview of matching count"
        >
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-muted mb-1">Field</label>
                <select className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px]">
                  <option>attributionSource</option>
                  <option>status</option>
                  <option>tier</option>
                  <option>territory.state</option>
                  <option>donation.amountCents</option>
                  <option>age</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-muted mb-1">Operator</label>
                <select className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px]">
                  <option>=</option>
                  <option>≠</option>
                  <option>IN</option>
                  <option>NOT IN</option>
                  <option>≥</option>
                  <option>≤</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-muted mb-1">Value</label>
                <input
                  className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px]"
                  defaultValue="door"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Plus size={14} />}
                onClick={() => toast.info('Add condition — rule builder wiring lands in Phase 1.2')}
              >
                Add condition
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Filter size={14} />}
                onClick={() =>
                  toast.info('Preview members — live count query lands in Phase 1.2')
                }
              >
                Preview members
              </Button>
              <div className="flex-1" />
              <span className="text-[12px] text-muted">
                → <span className="text-ink font-semibold numeric">218</span> leads match
              </span>
              <Button
                variant="primary"
                size="sm"
                onClick={() => toast.info('Save list — persistence lands in Phase 1.2')}
              >
                Save list
              </Button>
            </div>
          </div>
        </Section>

        <Section
          title="Push list to"
          subtitle="One-click hand-off to downstream marketing surfaces"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: Megaphone,
                title: 'Marketing campaign',
                desc: 'Meta · Google · TikTok custom audiences',
              },
              {
                icon: MailPlus,
                title: 'Email sequence',
                desc: 'Multi-step sequence with day-by-day cadence',
              },
              {
                icon: ListChecks,
                title: 'Inside-sales queue',
                desc: 'Drop list into auto-dial work queue',
              },
            ].map((p) => (
              <button
                key={p.title}
                type="button"
                onClick={() =>
                  toast.info(`Push to ${p.title} — hand-off wiring lands in Phase 1.2`)
                }
                className="card card-pad flex items-start gap-3 hover:shadow-md transition cursor-pointer text-left w-full"
              >
                <div className="w-10 h-10 rounded-lg bg-accentSoft text-accent flex items-center justify-center shrink-0">
                  <p.icon size={18} />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-ink">{p.title}</div>
                  <div className="text-[11px] text-muted mt-0.5">{p.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </Section>
      </div>
    </AccountShell>
  );
}
