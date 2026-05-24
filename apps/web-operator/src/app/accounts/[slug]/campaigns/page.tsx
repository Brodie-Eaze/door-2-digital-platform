import { Plus, Play, Pause, ExternalLink, ListChecks } from 'lucide-react';
import { Banner, Button, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';

const CAMPAIGNS = [
  {
    name: 'Q3 push — TX retargeting',
    status: 'running',
    channels: ['Meta', 'Google', 'TikTok'],
    list: 'High-tier, door-source, not converted (7d)',
    listSize: 142,
    spendCents: 2_840_00n,
    conversions: 18,
    cpaCents: 158_00n,
    startedAt: '2026-05-10',
  },
  {
    name: 'Donor upgrade — $20 → $40',
    status: 'running',
    channels: ['Email', 'SMS'],
    list: 'Converted donors, $20+/mo',
    listSize: 481,
    spendCents: 124_00n,
    conversions: 24,
    cpaCents: 5_17n,
    startedAt: '2026-05-15',
  },
  {
    name: 'Reactivation Meta — 90d cold',
    status: 'running',
    channels: ['Meta'],
    list: 'Cold leads — final reactivation push',
    listSize: 826,
    spendCents: 1_220_00n,
    conversions: 6,
    cpaCents: 203_33n,
    startedAt: '2026-05-18',
  },
  {
    name: 'VIP closer sequence',
    status: 'running',
    channels: ['Email', 'SMS', 'Manual call'],
    list: 'Bay Area appointment-set (manual)',
    listSize: 31,
    spendCents: 0n,
    conversions: 11,
    cpaCents: 0n,
    startedAt: '2026-05-12',
  },
  {
    name: 'TX Meta ads — door-knocking recruit',
    status: 'paused',
    channels: ['Meta', 'TikTok'],
    list: 'Texas-only door knocks last 30d',
    listSize: 1240,
    spendCents: 480_00n,
    conversions: 3,
    cpaCents: 160_00n,
    startedAt: '2026-05-04',
  },
];

export default function CampaignsPage({ params }: { params: { slug: string } }): JSX.Element {
  return (
    <AccountShell accountSlug={params.slug} pageTitle="Marketing campaigns">
      <div className="space-y-6 max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px]">
            Each campaign targets a <span className="font-semibold">smart lead list</span>.
            Multi-channel (Meta / Google / TikTok / Email / SMS). Conversions trace back to the
            originating Noctua via attribution → bills via the 3-bucket rake.
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Active campaigns"
            value={CAMPAIGNS.filter((c) => c.status === 'running').length}
            hint={`${CAMPAIGNS.length} total`}
          />
          <KpiCard
            label="Spend MTD"
            value={<Money cents={CAMPAIGNS.reduce((s, c) => s + c.spendCents, 0n)} region="US" />}
            delta="+18%"
            deltaTone="positive"
          />
          <KpiCard
            label="Conv. attributed"
            value={CAMPAIGNS.reduce((s, c) => s + c.conversions, 0)}
            hint="this month"
          />
          <KpiCard
            label="Blended CPA"
            value={
              <Money
                cents={
                  CAMPAIGNS.reduce((s, c) => s + c.spendCents, 0n) /
                  BigInt(
                    Math.max(
                      1,
                      CAMPAIGNS.reduce((s, c) => s + c.conversions, 0),
                    ),
                  )
                }
                region="US"
              />
            }
            delta="-12%"
            deltaTone="positive"
          />
        </div>

        <Section
          title="All campaigns"
          subtitle="Linked to smart lead lists · multi-channel delivery"
          action={
            <Button leftIcon={<Plus size={14} />} variant="primary" size="sm">
              New campaign
            </Button>
          }
          paddedBody={false}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Status</th>
                <th>Lead list</th>
                <th>Channels</th>
                <th>Spend</th>
                <th>Conv.</th>
                <th>CPA</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {CAMPAIGNS.map((c) => (
                <tr key={c.name}>
                  <td>
                    <div className="text-[13px] font-medium text-ink">{c.name}</div>
                    <div className="text-[10px] text-muted">started {c.startedAt}</div>
                  </td>
                  <td>
                    <StatusPill tone={c.status === 'running' ? 'success' : 'muted'}>
                      {c.status === 'running' ? 'Running' : 'Paused'}
                    </StatusPill>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <ListChecks size={12} className="text-soft shrink-0" />
                      <div>
                        <div className="text-[12px] text-ink truncate max-w-[260px]">{c.list}</div>
                        <div className="text-[10px] text-muted numeric">
                          {c.listSize.toLocaleString()} members
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {c.channels.map((ch) => (
                        <span key={ch} className="tag !text-[10px]">
                          {ch}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <Money cents={c.spendCents} region="US" emptyAsDash />
                  </td>
                  <td className="numeric text-[13px] font-medium">{c.conversions}</td>
                  <td>
                    {c.cpaCents > 0n ? (
                      <Money cents={c.cpaCents} region="US" />
                    ) : (
                      <span className="text-soft">—</span>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button className="w-7 h-7 rounded hover:bg-paper flex items-center justify-center">
                        {c.status === 'running' ? (
                          <Pause size={13} className="text-muted" />
                        ) : (
                          <Play size={13} className="text-success" />
                        )}
                      </button>
                      <button className="w-7 h-7 rounded hover:bg-paper flex items-center justify-center">
                        <ExternalLink size={12} className="text-soft" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
    </AccountShell>
  );
}
