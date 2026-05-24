'use client';

import { useState } from 'react';
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
  X,
  FileCheck2,
  DollarSign,
  Activity,
} from 'lucide-react';
import { Banner, Button, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';

/**
 * Marketing campaigns dashboard.
 *
 * Live campaigns across Meta + Google + TikTok + YouTube with creative
 * thumbnails (real picsum images), spend / impressions / clicks /
 * conversions / ROAS / CPM / CTR / attribution. Click a row → side panel
 * with all creatives in that campaign + daily spend SVG sparkline +
 * delivery log.
 */

type Channel = 'Meta' | 'Google' | 'TikTok' | 'YouTube';
type CampaignStatus = 'active' | 'paused' | 'ended' | 'pending_review';

interface CampaignCreative {
  id: string;
  seed: string;
  headline: string;
  format: 'image' | 'carousel' | 'video';
  aspect: 'square' | 'portrait' | 'vertical' | 'video';
}

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
  heroSeed: string;
  creatives: CampaignCreative[];
  // 14-day daily spend in dollars for the sparkline
  dailySpend: number[];
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
    heroSeed: 'hopeforward-tx-meals-4960',
    dailySpend: [820, 880, 740, 920, 1040, 960, 1120, 880, 940, 1010, 1180, 940, 880, 1020],
    creatives: [
      {
        id: 'cr_4960',
        seed: 'hopeforward-tx-meals-4960',
        headline: 'Five dollars covers a meal — every Tuesday.',
        format: 'image',
        aspect: 'square',
      },
      {
        id: 'cr_4934',
        seed: 'hf-dollar-stretch-4934',
        headline: 'A Hope Forward dollar lasts longer.',
        format: 'image',
        aspect: 'square',
      },
      {
        id: 'cr_4902',
        seed: 'hf-charity-nav-badge-4902',
        headline: 'Charity Navigator 4-star · 7 years.',
        format: 'image',
        aspect: 'square',
      },
    ],
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
    heroSeed: 'worldvision-au-winter-4954',
    dailySpend: [620, 580, 640, 720, 680, 720, 790, 740, 820, 760, 690, 740, 680, 720],
    creatives: [
      {
        id: 'cr_4954',
        seed: 'worldvision-au-winter-4954',
        headline: '3 in 5 Aussie families need help this winter.',
        format: 'image',
        aspect: 'portrait',
      },
      {
        id: 'cr_4939',
        seed: 'wv-au-coffee-cost-4939',
        headline: 'For the cost of a coffee, a child eats.',
        format: 'image',
        aspect: 'portrait',
      },
    ],
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
    heroSeed: 'pestmax-tx-roach-4958',
    dailySpend: [180, 220, 240, 260, 280, 300, 320, 280, 240, 260, 280, 240, 220, 240],
    creatives: [
      {
        id: 'cr_4958',
        seed: 'pestmax-tx-roach-4958',
        headline: "Don't share your meal with roaches.",
        format: 'video',
        aspect: 'vertical',
      },
      {
        id: 'cr_4944',
        seed: 'pestmax-tx-termites-4944',
        headline: 'Termites cost Texas $5B/year.',
        format: 'image',
        aspect: 'square',
      },
    ],
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
    heroSeed: 'hopeforward-renew-2026-4955',
    dailySpend: [340, 380, 360, 400, 420, 380, 360, 340, 380, 360, 340, 320, 340, 380],
    creatives: [
      {
        id: 'cr_4955',
        seed: 'hopeforward-renew-2026-4955',
        headline: 'Renew your faith in giving.',
        format: 'video',
        aspect: 'video',
      },
      {
        id: 'cr_4906',
        seed: 'hf-mothers-day-4906',
        headline: 'Mothers Day · sponsor in her name.',
        format: 'carousel',
        aspect: 'square',
      },
    ],
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
    heroSeed: 'tampines-fsc-neighbour-4959',
    dailySpend: [140, 160, 150, 180, 170, 160, 180, 200, 180, 160, 140, 150, 160, 170],
    creatives: [
      {
        id: 'cr_4959',
        seed: 'tampines-fsc-neighbour-4959',
        headline: 'Your neighbour sponsored a child in Tampines.',
        format: 'carousel',
        aspect: 'square',
      },
      {
        id: 'cr_4945',
        seed: 'tampines-knockknock-4945',
        headline: 'Knock-knock. Tampines is here.',
        format: 'image',
        aspect: 'square',
      },
      {
        id: 'cr_4904',
        seed: 'tampines-paynow-recur-4904',
        headline: 'PayNow recurring · S$45/mo.',
        format: 'image',
        aspect: 'portrait',
      },
    ],
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
    heroSeed: 'scs-recovery-story-4925',
    dailySpend: [120, 140, 130, 150, 140, 130, 140, 150, 140, 130, 120, 130, 140, 150],
    creatives: [
      {
        id: 'cr_4925',
        seed: 'scs-recovery-story-4925',
        headline: "A neighbour's recovery story.",
        format: 'video',
        aspect: 'vertical',
      },
      {
        id: 'cr_4927',
        seed: 'scs-pilot-412-sgp-4927',
        headline: 'SCS pilot · 412 Singaporeans give monthly.',
        format: 'image',
        aspect: 'square',
      },
    ],
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
    heroSeed: 'goldcoast-oncology-4937',
    dailySpend: [420, 440, 460, 440, 420, 380, 400, 440, 480, 460, 440, 420, 400, 440],
    creatives: [
      {
        id: 'cr_4937',
        seed: 'goldcoast-oncology-4937',
        headline: 'Gold Coast Hospital · new oncology wing.',
        format: 'image',
        aspect: 'portrait',
      },
    ],
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
    heroSeed: 'wv-au-carlton-knock-4916',
    dailySpend: [220, 240, 230, 250, 240, 220, 240, 260, 240, 220, 200, 220, 240, 260],
    creatives: [
      {
        id: 'cr_4916',
        seed: 'wv-au-carlton-knock-4916',
        headline: 'Knockers walked 312 km in Carlton.',
        format: 'image',
        aspect: 'square',
      },
      {
        id: 'cr_4938',
        seed: 'wv-au-nsw-28400-4938',
        headline: 'Knockers cleared 28,400 doors in NSW.',
        format: 'carousel',
        aspect: 'square',
      },
    ],
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
    heroSeed: 'pestmax-az-termite-4931',
    dailySpend: [120, 140, 130, 150, 140, 130, 140, 150, 140, 130, 120, 130, 140, 130],
    creatives: [
      {
        id: 'cr_4931',
        seed: 'pestmax-az-termite-4931',
        headline: 'AZ summer · termite-season starts in May.',
        format: 'video',
        aspect: 'vertical',
      },
    ],
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
    heroSeed: 'hf-charity-nav-badge-4902',
    dailySpend: [180, 200, 220, 200, 180, 200, 220, 240, 220, 200, 180, 200, 220, 200],
    creatives: [
      {
        id: 'cr_4902',
        seed: 'hf-charity-nav-badge-4902',
        headline: 'Charity Navigator 4-star · 7 years.',
        format: 'image',
        aspect: 'square',
      },
    ],
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
    heroSeed: 'nextgen-tx-dmo-tablet-4914',
    dailySpend: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    creatives: [
      {
        id: 'cr_4914',
        seed: 'nextgen-tx-dmo-tablet-4914',
        headline: 'NextGen Power TX — DMO shown live on tablet.',
        format: 'image',
        aspect: 'portrait',
      },
    ],
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
    heroSeed: 'sunlinkco-boise-solar-4956',
    dailySpend: [280, 300, 320, 300, 280, 300, 320, 340, 320, 300, 280, 300, 320, 280],
    creatives: [
      {
        id: 'cr_4956',
        seed: 'sunlinkco-boise-solar-4956',
        headline: 'Our solar bills shrank 71% · Boise, ID.',
        format: 'image',
        aspect: 'square',
      },
      {
        id: 'cr_4941',
        seed: 'sunlinkco-text-quote-4941',
        headline: 'Free quote, no salesperson.',
        format: 'image',
        aspect: 'portrait',
      },
    ],
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
    heroSeed: 'wv-au-melbourne-knock-4909',
    dailySpend: [140, 160, 150, 140, 120, 80, 60, 0, 0, 0, 0, 0, 0, 0],
    creatives: [
      {
        id: 'cr_4909',
        seed: 'wv-au-melbourne-knock-4909',
        headline: 'Melbourne knock teams · 18,400 doors.',
        format: 'image',
        aspect: 'square',
      },
    ],
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
    heroSeed: 'hf-tx-townhall-4910',
    dailySpend: [580, 620, 640, 600, 580, 540, 520, 500, 480, 460, 440, 420, 400, 0],
    creatives: [
      {
        id: 'cr_4910',
        seed: 'hf-tx-townhall-4910',
        headline: 'Hope Forward · TX Town Hall.',
        format: 'video',
        aspect: 'video',
      },
    ],
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
    heroSeed: 'scs-bedok-stairwell-4912',
    dailySpend: [80, 100, 90, 110, 100, 90, 100, 110, 100, 90, 80, 90, 100, 110],
    creatives: [
      {
        id: 'cr_4912',
        seed: 'scs-bedok-stairwell-4912',
        headline: 'Stairwell-by-stairwell · Bedok block 412.',
        format: 'image',
        aspect: 'portrait',
      },
    ],
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

function aspectClass(a: CampaignCreative['aspect']): string {
  switch (a) {
    case 'square':
      return 'aspect-square';
    case 'portrait':
      return 'aspect-[4/5]';
    case 'vertical':
      return 'aspect-[9/16]';
    case 'video':
      return 'aspect-video';
  }
}

export default function CampaignsPage(): JSX.Element {
  const [openId, setOpenId] = useState<string | null>(null);
  const opened = openId ? CAMPAIGNS.find((c) => c.id === openId) : null;

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
                <th></th>
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
                  <tr
                    key={c.id}
                    className="cursor-pointer hover:bg-paper"
                    onClick={() => setOpenId(c.id)}
                  >
                    <td className="!pr-0 w-[88px]">
                      <div className="w-16 h-16 rounded-md overflow-hidden border border-line2 bg-paper">
                        <img
                          src={`https://picsum.photos/seed/${c.heroSeed}/160/160`}
                          alt={c.name}
                          width={64}
                          height={64}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </td>
                    <td>
                      <div className="text-[13px] font-medium text-ink leading-snug">{c.name}</div>
                      <div className="text-[10px] text-muted font-mono">
                        {c.id} · started {c.startDate}
                      </div>
                    </td>
                    <td className="text-[12px] text-ink">{c.account}</td>
                    <td>
                      <span
                        className={`inline-flex items-center text-[10px] font-semibold rounded px-2 py-0.5 ${channelBadge(c.channel)}`}
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
                            onClick={(e) => e.stopPropagation()}
                            className="w-6 h-6 rounded hover:bg-paper flex items-center justify-center text-soft"
                            title="Pause"
                          >
                            <Pause size={12} />
                          </button>
                        ) : c.status === 'paused' ? (
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className="w-6 h-6 rounded hover:bg-paper flex items-center justify-center text-success"
                            title="Resume"
                          >
                            <Play size={12} />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenId(c.id);
                          }}
                          className="w-6 h-6 rounded hover:bg-paper flex items-center justify-center text-soft"
                          title="Inspect"
                        >
                          <Eye size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
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
                          className={`inline-flex items-center text-[9px] font-semibold rounded px-1.5 py-0.5 ${channelBadge(ch)}`}
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

      {opened && <CampaignDrawer campaign={opened} onClose={() => setOpenId(null)} />}
    </PlatformShell>
  );
}

function CampaignDrawer({
  campaign,
  onClose,
}: {
  campaign: Campaign;
  onClose: () => void;
}): JSX.Element {
  const cRoas =
    Number(campaign.spendCents) > 0
      ? Number(campaign.conversionRevenueCents) / Number(campaign.spendCents)
      : 0;
  const maxSpend = Math.max(...campaign.dailySpend, 1);
  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-ink/40 backdrop-blur-sm" />
      <aside
        className="w-[640px] max-w-[92vw] bg-surface border-l border-line2 h-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-line2 sticky top-0 bg-surface z-10">
          <div>
            <div className="text-[13px] font-semibold text-ink">{campaign.name}</div>
            <div className="text-[10.5px] text-muted font-mono">
              {campaign.id} · {campaign.account}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded hover:bg-paper flex items-center justify-center text-soft"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-4 gap-2">
            <DrawerMetric
              label="Spend"
              value={<Money cents={campaign.spendCents} region="US" emptyAsDash />}
              icon={<DollarSign size={11} className="text-accent" />}
            />
            <DrawerMetric
              label="Conv"
              value={campaign.conversions.toLocaleString()}
              icon={<Activity size={11} className="text-accent" />}
            />
            <DrawerMetric
              label="Revenue"
              value={<Money cents={campaign.conversionRevenueCents} region="US" emptyAsDash />}
              icon={<TrendingUp size={11} className="text-success" />}
            />
            <DrawerMetric
              label="ROAS"
              value={cRoas > 0 ? `${cRoas.toFixed(1)}x` : '—'}
              icon={<TrendingUp size={11} className="text-success" />}
            />
          </div>

          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-muted font-medium mb-1.5">
              Daily spend · last 14 days
            </div>
            <div className="border border-line2 rounded-md p-3 bg-paper">
              <svg viewBox="0 0 280 80" className="w-full h-20" preserveAspectRatio="none">
                <polyline
                  fill="none"
                  stroke="currentColor"
                  className="text-accent"
                  strokeWidth="1.5"
                  points={campaign.dailySpend
                    .map(
                      (v, i) =>
                        `${(i / (campaign.dailySpend.length - 1)) * 280},${80 - (v / maxSpend) * 70}`,
                    )
                    .join(' ')}
                />
                {campaign.dailySpend.map((v, i) => (
                  <circle
                    key={i}
                    cx={(i / (campaign.dailySpend.length - 1)) * 280}
                    cy={80 - (v / maxSpend) * 70}
                    r="1.6"
                    className="fill-accent"
                  />
                ))}
              </svg>
              <div className="flex items-center justify-between text-[10px] text-muted mt-1">
                <span>Day 1</span>
                <span>peak ${maxSpend.toLocaleString()}</span>
                <span>Today</span>
              </div>
            </div>
          </div>

          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-muted font-medium mb-2">
              Creatives in this campaign · {campaign.creatives.length}
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {campaign.creatives.map((cr) => (
                <div key={cr.id} className="card overflow-hidden">
                  <div className={`${aspectClass(cr.aspect)} relative overflow-hidden bg-paper`}>
                    <img
                      src={`https://picsum.photos/seed/${cr.seed}/300/300`}
                      alt={cr.headline}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" />
                    <div className="absolute top-1.5 right-1.5">
                      <span
                        className="inline-flex items-center gap-1 bg-surface/95 rounded text-[8.5px] uppercase tracking-wider px-1.5 py-0.5 font-semibold text-success"
                        title="C2PA signed"
                      >
                        <FileCheck2 size={8} /> C2PA
                      </span>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-2">
                      <div className="text-surface text-[10.5px] font-semibold leading-snug line-clamp-3">
                        {cr.headline}
                      </div>
                    </div>
                  </div>
                  <div className="p-1.5 flex items-center justify-between text-[10px] text-muted">
                    <span className="font-mono">{cr.id}</span>
                    <span className="capitalize">{cr.format}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-muted font-medium mb-2">
              Delivery log
            </div>
            <ul className="space-y-1.5 text-[11px] text-muted">
              <li className="flex items-start gap-2">
                <Activity size={11} className="text-success mt-0.5 shrink-0" />
                <span>
                  <span className="text-ink font-medium">CAPI webhook ingested</span> · 218
                  conversions · 2026-05-24 09:42
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Activity size={11} className="text-accent mt-0.5 shrink-0" />
                <span>
                  <span className="text-ink font-medium">Daily spend cap reached</span> · paused
                  04:00, resumed 09:00
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Activity size={11} className="text-accent mt-0.5 shrink-0" />
                <span>
                  <span className="text-ink font-medium">Audience refreshed</span> · hashed audience
                  uploaded · 8,400 added
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Activity size={11} className="text-accent mt-0.5 shrink-0" />
                <span>
                  <span className="text-ink font-medium">Creative rotation triggered</span> ·
                  cr_4912 promoted to 60% share
                </span>
              </li>
            </ul>
          </div>

          <div className="flex items-center gap-2 pt-3 border-t border-line2">
            {campaign.status === 'active' ? (
              <Button variant="ghost" size="sm" leftIcon={<Pause size={12} />}>
                Pause campaign
              </Button>
            ) : campaign.status === 'paused' ? (
              <Button variant="primary" size="sm" leftIcon={<Play size={12} />}>
                Resume campaign
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" leftIcon={<ExternalLink size={12} />}>
              Open in {campaign.channel}
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function DrawerMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
}): JSX.Element {
  return (
    <div className="border border-line2 rounded-md p-2">
      <div className="flex items-center gap-1 text-[9.5px] uppercase tracking-wider text-muted font-medium">
        {icon}
        {label}
      </div>
      <div className="text-[13px] font-semibold text-ink mt-0.5 numeric">{value}</div>
    </div>
  );
}
