import {
  Megaphone,
  TrendingUp,
  Eye,
  Play,
  Pause,
  ExternalLink,
  Filter,
  Plus,
  ArrowUpRight,
} from 'lucide-react';
import { Banner, Button, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';

/**
 * Marketing campaigns dashboard.
 *
 * Active campaigns across Meta + Google + TikTok + YouTube with
 * spend / conversions / ROAS / CPM / CTR. Row click is decorative —
 * the side panel idea is referenced but rendered as a static "details"
 * column for now.
 */

type Channel = 'Meta' | 'Google' | 'TikTok' | 'YouTube';
type CampaignStatus = 'active' | 'paused' | 'ended' | 'pending_review';

interface Campaign {
  id: string;
  name: string;
  account: string;
  channel: Channel;
  status: CampaignStatus;
  startDate: string;
  spendCents: bigint;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionRevenueCents: bigint;
  attributionSource: 'click' | 'view' | 'lift' | 'knock+digital';
}

const CAMPAIGNS: Campaign[] = [
  {
    id: 'cmp_8821',
    name: 'May Sustainer · Tx-based child sponsorship',
    account: 'Hope Forward (US)',
    channel: 'Meta',
    status: 'active',
    startDate: '2026-05-01',
    spendCents: 12_840_00n,
    impressions: 1_842_300,
    clicks: 41_220,
    conversions: 818,
    conversionRevenueCents: 71_944_00n,
    attributionSource: 'click',
  },
  {
    id: 'cmp_8820',
    name: 'Winter Appeal · NSW SEIFA-9',
    account: 'World Vision (AU)',
    channel: 'Meta',
    status: 'active',
    startDate: '2026-04-22',
    spendCents: 8_420_00n,
    impressions: 1_142_810,
    clicks: 28_915,
    conversions: 542,
    conversionRevenueCents: 48_780_00n,
    attributionSource: 'click',
  },
  {
    id: 'cmp_8819',
    name: 'PestMax · TX Roach Combo Q2',
    account: 'PestMax (US)',
    channel: 'TikTok',
    status: 'active',
    startDate: '2026-04-15',
    spendCents: 3_280_00n,
    impressions: 642_120,
    clicks: 18_910,
    conversions: 184,
    conversionRevenueCents: 16_376_00n,
    attributionSource: 'lift',
  },
  {
    id: 'cmp_8818',
    name: 'Hope Forward · Mothers Day 2026',
    account: 'Hope Forward (US)',
    channel: 'YouTube',
    status: 'active',
    startDate: '2026-04-21',
    spendCents: 4_980_00n,
    impressions: 312_400,
    clicks: 4_812,
    conversions: 218,
    conversionRevenueCents: 21_582_00n,
    attributionSource: 'view',
  },
  {
    id: 'cmp_8817',
    name: 'Tampines FSC · PayNow Recurring',
    account: 'Tampines FSC pilot (SG)',
    channel: 'Meta',
    status: 'active',
    startDate: '2026-04-08',
    spendCents: 2_120_00n,
    impressions: 412_300,
    clicks: 14_212,
    conversions: 282,
    conversionRevenueCents: 14_400_00n,
    attributionSource: 'knock+digital',
  },
  {
    id: 'cmp_8816',
    name: 'SCS · Cancer Awareness Toa Payoh',
    account: 'SCS pilot (SG)',
    channel: 'Meta',
    status: 'active',
    startDate: '2026-04-15',
    spendCents: 1_840_00n,
    impressions: 318_120,
    clicks: 9_211,
    conversions: 184,
    conversionRevenueCents: 11_040_00n,
    attributionSource: 'knock+digital',
  },
  {
    id: 'cmp_8815',
    name: 'Gold Coast Hospital · Oncology Capital',
    account: 'Gold Coast Hospital (AU)',
    channel: 'Google',
    status: 'active',
    startDate: '2026-04-01',
    spendCents: 6_120_00n,
    impressions: 218_410,
    clicks: 5_124,
    conversions: 89,
    conversionRevenueCents: 53_400_00n,
    attributionSource: 'click',
  },
  {
    id: 'cmp_8814',
    name: 'World Vision AU · Carlton Knocker support',
    account: 'World Vision (AU)',
    channel: 'Google',
    status: 'active',
    startDate: '2026-05-01',
    spendCents: 3_240_00n,
    impressions: 142_300,
    clicks: 3_810,
    conversions: 198,
    conversionRevenueCents: 17_820_00n,
    attributionSource: 'knock+digital',
  },
  {
    id: 'cmp_8813',
    name: 'PestMax · Phoenix Termite Season',
    account: 'PestMax (US)',
    channel: 'Google',
    status: 'active',
    startDate: '2026-05-08',
    spendCents: 1_840_00n,
    impressions: 88_120,
    clicks: 2_910,
    conversions: 71,
    conversionRevenueCents: 6_319_00n,
    attributionSource: 'click',
  },
  {
    id: 'cmp_8812',
    name: 'Hope Forward · Charity Navigator badge',
    account: 'Hope Forward (US)',
    channel: 'Meta',
    status: 'active',
    startDate: '2026-04-29',
    spendCents: 2_840_00n,
    impressions: 412_310,
    clicks: 11_820,
    conversions: 312,
    conversionRevenueCents: 27_456_00n,
    attributionSource: 'click',
  },
  {
    id: 'cmp_8811',
    name: 'NextGen Power · TX DMO transparency',
    account: 'NextGen Power (US)',
    channel: 'Meta',
    status: 'pending_review',
    startDate: '2026-05-25',
    spendCents: 0n,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    conversionRevenueCents: 0n,
    attributionSource: 'click',
  },
  {
    id: 'cmp_8810',
    name: 'SunlinkCo · Boise rooftop quote',
    account: 'SunlinkCo (US)',
    channel: 'Google',
    status: 'active',
    startDate: '2026-05-05',
    spendCents: 4_120_00n,
    impressions: 218_400,
    clicks: 7_212,
    conversions: 142,
    conversionRevenueCents: 28_400_00n,
    attributionSource: 'click',
  },
  {
    id: 'cmp_8809',
    name: 'World Vision AU · Footscray Reactivation',
    account: 'World Vision (AU)',
    channel: 'Meta',
    status: 'paused',
    startDate: '2026-04-12',
    spendCents: 1_840_00n,
    impressions: 218_210,
    clicks: 4_112,
    conversions: 24,
    conversionRevenueCents: 2_160_00n,
    attributionSource: 'click',
  },
  {
    id: 'cmp_8808',
    name: 'Hope Forward · TX Town Hall (long-form)',
    account: 'Hope Forward (US)',
    channel: 'YouTube',
    status: 'ended',
    startDate: '2026-03-01',
    spendCents: 8_120_00n,
    impressions: 1_240_300,
    clicks: 12_812,
    conversions: 421,
    conversionRevenueCents: 39_780_00n,
    attributionSource: 'view',
  },
  {
    id: 'cmp_8807',
    name: 'SCS · Knocker support Bedok',
    account: 'SCS pilot (SG)',
    channel: 'Meta',
    status: 'active',
    startDate: '2026-05-10',
    spendCents: 1_240_00n,
    impressions: 218_310,
    clicks: 6_812,
    conversions: 118,
    conversionRevenueCents: 7_080_00n,
    attributionSource: 'knock+digital',
  },
];

function statusTone(s: CampaignStatus): 'success' | 'muted' | 'warn' | 'info' {
  switch (s) {
    case 'active':
      return 'success';
    case 'ended':
      return 'muted';
    case 'paused':
      return 'warn';
    case 'pending_review':
      return 'info';
  }
}

function statusLabel(s: CampaignStatus): string {
  return s === 'pending_review' ? 'Pending review' : s.charAt(0).toUpperCase() + s.slice(1);
}

function channelBadge(c: Channel): string {
  switch (c) {
    case 'Meta':
      return 'bg-blue-100 text-blue-700';
    case 'Google':
      return 'bg-amber-100 text-amber-700';
    case 'TikTok':
      return 'bg-rose-100 text-rose-700';
    case 'YouTube':
      return 'bg-red-100 text-red-700';
  }
}

export default function CampaignsPage(): JSX.Element {
  const totalSpendCents = CAMPAIGNS.reduce((s, c) => s + c.spendCents, 0n);
  const totalRevCents = CAMPAIGNS.reduce((s, c) => s + c.conversionRevenueCents, 0n);
  const totalConversions = CAMPAIGNS.reduce((s, c) => s + c.conversions, 0);
  const totalImpressions = CAMPAIGNS.reduce((s, c) => s + c.impressions, 0);
  const totalClicks = CAMPAIGNS.reduce((s, c) => s + c.clicks, 0);
  const roas = Number(totalSpendCents) > 0 ? Number(totalRevCents) / Number(totalSpendCents) : 0;
  const cpmCents = totalImpressions > 0 ? Number(totalSpendCents) / (totalImpressions / 1000) : 0;
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const active = CAMPAIGNS.filter((c) => c.status === 'active').length;

  return (
    <PlatformShell pageTitle="Campaigns — Meta / Google / TikTok / YouTube">
      <div className="space-y-5 max-w-[1700px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Megaphone size={14} className="text-accent" />
            <span>
              Live campaigns across paid channels. ROAS attribution flows from conversion webhooks
              back to creative_id → campaign → spend, with{' '}
              <span className="font-semibold">knock+digital</span> tied to Knocker disposition
              records so air-cover ROI is properly credited.
            </span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            label="Total spend MTD"
            value={<Money cents={totalSpendCents} region="US" />}
            hint={`${active} active campaigns`}
          />
          <KpiCard
            label="Conversions"
            value={totalConversions.toLocaleString()}
            delta="+12.4%"
            deltaTone="positive"
          />
          <KpiCard label="Revenue attributed" value={<Money cents={totalRevCents} region="US" />} />
          <KpiCard label="Blended ROAS" value={`${roas.toFixed(1)}x`} deltaTone="positive" />
          <KpiCard
            label="Blended CPM"
            value={<Money cents={BigInt(Math.round(cpmCents))} region="US" />}
            hint="per 1k impressions"
          />
          <KpiCard label="Blended CTR" value={`${ctr.toFixed(2)}%`} hint="across all channels" />
        </div>

        <Section
          title={`Active campaigns · ${CAMPAIGNS.length}`}
          subtitle="Row click loads creative previews + delivery log in side panel"
          paddedBody={false}
          action={
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" leftIcon={<Filter size={13} />}>
                Filter
              </Button>
              <Button variant="primary" size="sm" leftIcon={<Plus size={13} />}>
                New campaign
              </Button>
            </div>
          }
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Account</th>
                <th>Channel</th>
                <th>Spend</th>
                <th>Impressions</th>
                <th>Clicks</th>
                <th>Conv</th>
                <th>Revenue</th>
                <th>ROAS</th>
                <th>Attribution</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {CAMPAIGNS.map((c) => {
                const cRoas =
                  Number(c.spendCents) > 0
                    ? Number(c.conversionRevenueCents) / Number(c.spendCents)
                    : 0;
                return (
                  <tr key={c.id} className="cursor-pointer hover:bg-paper">
                    <td>
                      <div className="text-[13px] font-medium text-ink">{c.name}</div>
                      <div className="text-[10px] text-muted mono">
                        {c.id} · started {c.startDate}
                      </div>
                    </td>
                    <td className="text-[12px] text-ink">{c.account}</td>
                    <td>
                      <span
                        className={`inline-flex items-center text-[10px] font-semibold rounded px-2 py-0.5 ${channelBadge(
                          c.channel,
                        )}`}
                      >
                        {c.channel}
                      </span>
                    </td>
                    <td className="text-[12px] text-ink">
                      <Money cents={c.spendCents} region="US" emptyAsDash />
                    </td>
                    <td className="text-[12px] text-ink numeric">
                      {c.impressions.toLocaleString()}
                    </td>
                    <td className="text-[12px] text-ink numeric">{c.clicks.toLocaleString()}</td>
                    <td className="text-[12px] text-ink numeric font-semibold">
                      {c.conversions.toLocaleString()}
                    </td>
                    <td className="text-[12px] text-ink">
                      <Money cents={c.conversionRevenueCents} region="US" emptyAsDash />
                    </td>
                    <td className="text-[12px]">
                      {c.spendCents === 0n ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <span
                          className={
                            cRoas >= 5
                              ? 'text-success font-semibold'
                              : cRoas >= 3
                                ? 'text-accent font-semibold'
                                : 'text-warn font-semibold'
                          }
                        >
                          {cRoas.toFixed(1)}x
                        </span>
                      )}
                    </td>
                    <td className="text-[11px] text-muted">{c.attributionSource}</td>
                    <td>
                      <StatusPill tone={statusTone(c.status)}>{statusLabel(c.status)}</StatusPill>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        {c.status === 'active' ? (
                          <button
                            type="button"
                            className="w-6 h-6 rounded hover:bg-paper flex items-center justify-center text-soft"
                            title="Pause"
                          >
                            <Pause size={12} />
                          </button>
                        ) : c.status === 'paused' ? (
                          <button
                            type="button"
                            className="w-6 h-6 rounded hover:bg-paper flex items-center justify-center text-success"
                            title="Resume"
                          >
                            <Play size={12} />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="w-6 h-6 rounded hover:bg-paper flex items-center justify-center text-soft"
                          title="Inspect"
                        >
                          <Eye size={12} />
                        </button>
                        <button
                          type="button"
                          className="w-6 h-6 rounded hover:bg-paper flex items-center justify-center text-soft"
                          title="Open in channel dashboard"
                        >
                          <ExternalLink size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Section title="Channel mix · MTD spend" subtitle="Where the money went">
            <div className="space-y-2.5">
              {(['Meta', 'Google', 'TikTok', 'YouTube'] as Channel[]).map((ch) => {
                const chSpend = CAMPAIGNS.filter((c) => c.channel === ch).reduce(
                  (s, c) => s + c.spendCents,
                  0n,
                );
                const pct =
                  Number(totalSpendCents) > 0
                    ? Number((chSpend * 10_000n) / totalSpendCents) / 100
                    : 0;
                return (
                  <div key={ch}>
                    <div className="flex items-center justify-between text-[12px] mb-1">
                      <span className="font-medium text-ink flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center text-[9px] font-semibold rounded px-1.5 py-0.5 ${channelBadge(
                            ch,
                          )}`}
                        >
                          {ch}
                        </span>
                      </span>
                      <span className="text-ink">
                        <Money cents={chSpend} region="US" /> · {pct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-line2 rounded-full overflow-hidden">
                      <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title="ROAS by attribution path" subtitle="How the conversion was credited">
            <div className="space-y-3">
              {(
                [
                  { src: 'click', label: 'Click-through' },
                  { src: 'view', label: 'View-through' },
                  { src: 'lift', label: 'Brand-lift (modelled)' },
                  { src: 'knock+digital', label: 'Knock + digital (joint)' },
                ] as const
              ).map((a) => {
                const cs = CAMPAIGNS.filter((c) => c.attributionSource === a.src);
                const sp = cs.reduce((s, c) => s + c.spendCents, 0n);
                const rv = cs.reduce((s, c) => s + c.conversionRevenueCents, 0n);
                const r = Number(sp) > 0 ? Number(rv) / Number(sp) : 0;
                return (
                  <div key={a.src} className="flex items-center justify-between gap-3">
                    <div className="text-[12.5px] text-ink font-medium">{a.label}</div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-muted">
                        spend <Money cents={sp} region="US" emptyAsDash />
                      </span>
                      <span className="text-[11px] text-muted">
                        rev <Money cents={rv} region="US" emptyAsDash />
                      </span>
                      <StatusPill tone={r >= 5 ? 'success' : r >= 3 ? 'info' : 'warn'}>
                        {r.toFixed(1)}x
                      </StatusPill>
                      <ArrowUpRight size={11} className="text-soft" />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-line2 flex items-center justify-between text-[11px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <TrendingUp size={11} className="text-success" />
                Knock+digital is D2D&apos;s unique attribution channel
              </span>
              <span className="text-ink font-semibold">Avg lift +27%</span>
            </div>
          </Section>
        </div>
      </div>
    </PlatformShell>
  );
}
