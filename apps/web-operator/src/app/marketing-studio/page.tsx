'use client';

import Link from 'next/link';
import {
  Sparkles,
  Wand2,
  ShieldCheck,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  FileCheck2,
  Image as ImageIcon,
  Megaphone,
  Activity,
  AlertTriangle,
  Eye,
  PlayCircle,
  Pause,
  Ban,
  UserCheck,
  RotateCw,
  Sparkle,
} from 'lucide-react';
import { Banner, Button, KpiCard, Money, Reveal, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { MarketingStudioTabs } from '@/components/marketing-studio-tabs';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { toast } from '@/components/Toaster';
import { pickCreativeImage, inferTheme, type CreativeTheme } from '@/lib/creative-images';

/**
 * AI Marketing Studio — command centre.
 *
 * Top-of-stack overview of the creative-generation pipeline:
 * Brief → Compose → Variation → Review → Publish → Measure.
 *
 * Curated Unsplash image previews on every creative tile (see
 * @/lib/creative-images) — deterministic photo pick per creative id,
 * matched to the campaign vertical + copy intent (no random photos).
 *
 * Per master plan §10: this surface aggregates jobs from
 * services/marketing-studio across all HQ orgs and feeds the
 * per-account marketing-studio pages.
 */

interface PipelineStage {
  label: string;
  todayCount: number;
  detail: string;
  icon: typeof Sparkles;
  tone: 'success' | 'info' | 'warn' | 'danger';
}

const PIPELINE: PipelineStage[] = [
  {
    label: 'Brief',
    todayCount: 14,
    detail: 'audiences + brand voice in',
    icon: FileCheck2,
    tone: 'info',
  },
  { label: 'Compose', todayCount: 22, detail: 'Claude + GPT-4.5 fb', icon: Wand2, tone: 'info' },
  {
    label: 'Variation',
    todayCount: 184,
    detail: 'aud x msg x format',
    icon: Sparkles,
    tone: 'success',
  },
  {
    label: 'Review',
    todayCount: 38,
    detail: 'human-in-loop queue',
    icon: ShieldCheck,
    tone: 'warn',
  },
  {
    label: 'Publish',
    todayCount: 71,
    detail: 'Meta + Google + TikTok',
    icon: Megaphone,
    tone: 'success',
  },
  {
    label: 'Measure',
    todayCount: 412,
    detail: 'conv webhooks attributed',
    icon: TrendingUp,
    tone: 'success',
  },
];

interface TopCreative {
  id: string;
  seed: string;
  headline: string;
  vertical: 'charity' | 'pest' | 'solar' | 'energy';
  theme: CreativeTheme;
  region: 'US' | 'AU' | 'SG';
  channel: 'Meta' | 'Google' | 'TikTok' | 'YouTube';
  format: 'image' | 'carousel' | 'video';
  aspect: 'square' | 'portrait' | 'video' | 'vertical';
  conversionRate: number;
  spendCents: bigint;
  conversions: number;
  roas: number;
  status: 'live' | 'paused' | 'review';
}

const TOP_CREATIVES: TopCreative[] = [
  {
    id: 'cr_4912',
    seed: 'hopeforward-tx-meals-4912',
    headline: 'Five dollars covers a meal — every Tuesday.',
    vertical: 'charity',
    theme: 'charity_food',
    region: 'US',
    channel: 'Meta',
    format: 'image',
    aspect: 'square',
    conversionRate: 4.8,
    spendCents: 124_00n,
    conversions: 88,
    roas: 6.4,
    status: 'live',
  },
  {
    id: 'cr_4908',
    seed: 'tampines-fsc-neighbour-4908',
    headline: 'Your neighbour just sponsored a child in Tampines.',
    vertical: 'charity',
    theme: 'charity_children',
    region: 'SG',
    channel: 'Meta',
    format: 'carousel',
    aspect: 'square',
    conversionRate: 4.2,
    spendCents: 94_00n,
    conversions: 51,
    roas: 5.8,
    status: 'live',
  },
  {
    id: 'cr_4901',
    seed: 'pestmax-tx-roach-4901',
    headline: "Don't share your meal with roaches. Texas-licensed.",
    vertical: 'pest',
    theme: 'pest_control',
    region: 'US',
    channel: 'TikTok',
    format: 'video',
    aspect: 'vertical',
    conversionRate: 3.8,
    spendCents: 184_00n,
    conversions: 42,
    roas: 4.9,
    status: 'live',
  },
  {
    id: 'cr_4897',
    seed: 'worldvision-cebu-tree-4897',
    headline: 'For every child sponsored in Cebu, a Knocker plants one tree.',
    vertical: 'charity',
    theme: 'charity_children',
    region: 'AU',
    channel: 'Meta',
    format: 'video',
    aspect: 'portrait',
    conversionRate: 4.1,
    spendCents: 142_00n,
    conversions: 64,
    roas: 5.4,
    status: 'live',
  },
  {
    id: 'cr_4891',
    seed: 'sunlinkco-boise-solar-4891',
    headline: 'Our solar bills shrank 71% in 8 weeks. Boise, ID.',
    vertical: 'solar',
    theme: 'solar',
    region: 'US',
    channel: 'Google',
    format: 'image',
    aspect: 'square',
    conversionRate: 2.9,
    spendCents: 224_00n,
    conversions: 22,
    roas: 4.1,
    status: 'live',
  },
  {
    id: 'cr_4884',
    seed: 'hopeforward-renew-2026-4884',
    headline: 'Renew your faith in giving — Hope Forward, 2026.',
    vertical: 'charity',
    theme: 'charity_food',
    region: 'US',
    channel: 'YouTube',
    format: 'video',
    aspect: 'video',
    conversionRate: 3.6,
    spendCents: 312_00n,
    conversions: 71,
    roas: 5.1,
    status: 'live',
  },
  {
    id: 'cr_4877',
    seed: 'worldvision-au-winter-4877',
    headline: '3 in 5 Aussie families need help this winter.',
    vertical: 'charity',
    theme: 'charity_food',
    region: 'AU',
    channel: 'Meta',
    format: 'image',
    aspect: 'portrait',
    conversionRate: 3.9,
    spendCents: 104_00n,
    conversions: 48,
    roas: 5.7,
    status: 'live',
  },
  {
    id: 'cr_4862',
    seed: 'nextgen-power-switch-4862',
    headline: 'Switch to NextGen Power and pay nothing for 3 months.',
    vertical: 'energy',
    theme: 'energy_telco',
    region: 'US',
    channel: 'Google',
    format: 'carousel',
    aspect: 'square',
    conversionRate: 2.7,
    spendCents: 194_00n,
    conversions: 18,
    roas: 3.6,
    status: 'paused',
  },
  {
    id: 'cr_4855',
    seed: 'scs-bedok-mother-4855',
    headline: "A neighbour's recovery story. S$45/mo.",
    vertical: 'charity',
    theme: 'charity_medical',
    region: 'SG',
    channel: 'Meta',
    format: 'video',
    aspect: 'vertical',
    conversionRate: 4.4,
    spendCents: 88_00n,
    conversions: 39,
    roas: 5.9,
    status: 'live',
  },
  {
    id: 'cr_4849',
    seed: 'goldcoast-onc-wing-4849',
    headline: 'Gold Coast Hospital · new oncology wing · open 2027.',
    vertical: 'charity',
    theme: 'charity_medical',
    region: 'AU',
    channel: 'Meta',
    format: 'image',
    aspect: 'portrait',
    conversionRate: 3.4,
    spendCents: 184_00n,
    conversions: 36,
    roas: 4.6,
    status: 'live',
  },
];

interface RecentJob {
  id: string;
  seed: string;
  type: 'compose' | 'variation' | 'safety_scan' | 'publish' | 'measure';
  account: string;
  brief: string;
  model: string;
  costCents: number;
  stage: 'queued' | 'running' | 'completed' | 'blocked' | 'failed';
  durationSec: number;
  ts: string;
}

const RECENT_JOBS: RecentJob[] = [
  {
    id: 'job_9421',
    seed: 'wv-au-winter-sponsor',
    type: 'compose',
    account: 'World Vision (AU)',
    brief: 'Winter sponsorship · Outer Sydney',
    model: 'claude-3-5-sonnet',
    costCents: 6,
    stage: 'completed',
    durationSec: 12.4,
    ts: '2026-05-24 09:42:18',
  },
  {
    id: 'job_9420',
    seed: 'hf-mothers-day-var',
    type: 'variation',
    account: 'Hope Forward (US)',
    brief: 'Mothers Day · 23 variations',
    model: 'flux-1.1-pro',
    costCents: 92,
    stage: 'running',
    durationSec: 38.1,
    ts: '2026-05-24 09:41:02',
  },
  {
    id: 'job_9419',
    seed: 'pestmax-tx-roach-v2',
    type: 'safety_scan',
    account: 'PestMax (US)',
    brief: 'TX Roach script v2 · YouTube',
    model: 'anthropic-mod',
    costCents: 2,
    stage: 'blocked',
    durationSec: 4.8,
    ts: '2026-05-24 09:39:55',
  },
  {
    id: 'job_9418',
    seed: 'hf-cr4912-meta-publish',
    type: 'publish',
    account: 'Hope Forward (US)',
    brief: 'cr_4912 → Meta US',
    model: 'meta-marketing',
    costCents: 0,
    stage: 'completed',
    durationSec: 2.1,
    ts: '2026-05-24 09:38:21',
  },
  {
    id: 'job_9417',
    seed: 'wv-cr4877-attribution',
    type: 'measure',
    account: 'World Vision (AU)',
    brief: 'cr_4877 attribution sync',
    model: 'capi-webhook',
    costCents: 0,
    stage: 'completed',
    durationSec: 1.4,
    ts: '2026-05-24 09:36:09',
  },
  {
    id: 'job_9416',
    seed: 'goldcoast-oncology-cap',
    type: 'compose',
    account: 'Gold Coast Hospital (AU)',
    brief: 'Cancer wing capital campaign',
    model: 'claude-3-5-sonnet',
    costCents: 8,
    stage: 'queued',
    durationSec: 0,
    ts: '2026-05-24 09:34:44',
  },
  {
    id: 'job_9415',
    seed: 'tampines-fsc-h2h-sg',
    type: 'safety_scan',
    account: 'Tampines FSC (SG)',
    brief: 'House-to-house pitch · SG charity',
    model: 'anthropic-mod',
    costCents: 2,
    stage: 'completed',
    durationSec: 5.2,
    ts: '2026-05-24 09:32:11',
  },
  {
    id: 'job_9414',
    seed: 'pestmax-az-termite-v',
    type: 'variation',
    account: 'PestMax (US)',
    brief: 'AZ Termite script · 12 variations',
    model: 'higgsfield',
    costCents: 48,
    stage: 'failed',
    durationSec: 17.4,
    ts: '2026-05-24 09:28:55',
  },
  {
    id: 'job_9413',
    seed: 'wv-cr4877-meta-au',
    type: 'publish',
    account: 'World Vision (AU)',
    brief: 'cr_4877 → Meta AU',
    model: 'meta-marketing',
    costCents: 0,
    stage: 'completed',
    durationSec: 1.9,
    ts: '2026-05-24 09:24:13',
  },
  {
    id: 'job_9412',
    seed: 'scs-toa-payoh-cancer',
    type: 'compose',
    account: 'SCS pilot (SG)',
    brief: 'Cancer awareness · Toa Payoh',
    model: 'claude-3-5-sonnet',
    costCents: 5,
    stage: 'completed',
    durationSec: 11.8,
    ts: '2026-05-24 09:21:08',
  },
  {
    id: 'job_9411',
    seed: 'sunlinkco-roof-quote',
    type: 'variation',
    account: 'SunlinkCo (US)',
    brief: 'Boise rooftop carousel · 6 variants',
    model: 'flux-1.1-pro',
    costCents: 28,
    stage: 'completed',
    durationSec: 8.4,
    ts: '2026-05-24 09:18:42',
  },
  {
    id: 'job_9410',
    seed: 'hf-charity-nav-badge',
    type: 'publish',
    account: 'Hope Forward (US)',
    brief: 'Charity Navigator badge · 4 cards',
    model: 'meta-marketing',
    costCents: 0,
    stage: 'completed',
    durationSec: 1.7,
    ts: '2026-05-24 09:15:11',
  },
];

interface ActivityEvent {
  id: string;
  kind: 'generated' | 'approved' | 'blocked' | 'published' | 'cohort' | 'attribution' | 'edited';
  title: string;
  detail: string;
  actor: string;
  ts: string;
}

const ACTIVITY: ActivityEvent[] = [
  {
    id: 'evt_001',
    kind: 'generated',
    title: '4 image variants generated',
    detail: 'World Vision AU · Winter sponsorship brief · flux-1.1-pro',
    actor: 'studio-agent',
    ts: '09:42:18',
  },
  {
    id: 'evt_002',
    kind: 'approved',
    title: 'cr_4912 approved',
    detail: 'Brodie approved Hope Forward Tuesday-meal variant for Meta US',
    actor: 'Brodie',
    ts: '09:38:21',
  },
  {
    id: 'evt_003',
    kind: 'blocked',
    title: 'cr_4937 blocked · safety',
    detail: 'NextGen Power · "forever" lock-in violates FCC marketing rules',
    actor: 'safety-engine',
    ts: '09:36:09',
  },
  {
    id: 'evt_004',
    kind: 'cohort',
    title: 'Cohort aud_4421 built',
    detail: 'WV AU NSW SEIFA-9 callbacks · 84,210 reach · pushed to Meta',
    actor: 'retargeting',
    ts: '09:31:18',
  },
  {
    id: 'evt_005',
    kind: 'published',
    title: 'cr_4877 went live · Meta AU',
    detail: 'World Vision AU winter appeal · 14 ad sets · daily cap $1,200',
    actor: 'meta-marketing',
    ts: '09:24:13',
  },
  {
    id: 'evt_006',
    kind: 'attribution',
    title: '88 conversions attributed to cr_4912',
    detail: 'CAPI webhooks reconciled · ROAS now 6.4x · 24h window',
    actor: 'capi-webhook',
    ts: '09:18:42',
  },
  {
    id: 'evt_007',
    kind: 'generated',
    title: '12 video variants generated',
    detail: 'PestMax AZ Termite script · Higgsfield · 9:16 vertical',
    actor: 'studio-agent',
    ts: '09:12:55',
  },
  {
    id: 'evt_008',
    kind: 'edited',
    title: 'Brand-safety rule_290 updated',
    detail: 'Energy/Telco · re-enabled DMO/VDO requirement for locked rates',
    actor: 'Brodie',
    ts: '08:54:11',
  },
  {
    id: 'evt_009',
    kind: 'cohort',
    title: 'Cohort aud_4420 built',
    detail: 'Hope Forward NOT_HOME 7d TX zips · 142,300 reach',
    actor: 'retargeting',
    ts: '08:42:33',
  },
  {
    id: 'evt_010',
    kind: 'approved',
    title: 'cr_4849 approved',
    detail: 'Compliance team approved Gold Coast Hospital oncology image',
    actor: 'Compliance team',
    ts: '08:31:48',
  },
  {
    id: 'evt_011',
    kind: 'blocked',
    title: 'cr_4924 critical · legal-hold',
    detail: 'SunlinkCo "Free solar. Pay nothing. Ever." → FTC inquiry',
    actor: 'Counsel',
    ts: '08:14:55',
  },
  {
    id: 'evt_012',
    kind: 'published',
    title: 'cr_4901 went live · TikTok US',
    detail: 'PestMax TX roach video · 8 ad groups · daily cap $640',
    actor: 'tiktok-marketing',
    ts: '08:02:18',
  },
  {
    id: 'evt_013',
    kind: 'attribution',
    title: '218 click-throughs attributed',
    detail: 'Meta lead webhook · cr_4877 / cr_4912 / cr_4855 attribution sync',
    actor: 'capi-webhook',
    ts: '07:48:09',
  },
  {
    id: 'evt_014',
    kind: 'generated',
    title: 'Avatar segment composed · 45s',
    detail: 'Hope Forward · HeyGen · personal-thanks template · $2.20',
    actor: 'studio-agent',
    ts: '07:36:42',
  },
  {
    id: 'evt_015',
    kind: 'approved',
    title: 'cr_4855 approved',
    detail: 'SCS pilot · neighbour recovery story · S$45/mo recurring',
    actor: 'Brodie',
    ts: '07:21:11',
  },
];

interface ApprovalItem {
  id: string;
  seed: string;
  headline: string;
  account: string;
  reviewer: string;
  reviewerInitials: string;
  age: string;
  vertical: string;
}

const APPROVAL_QUEUE: ApprovalItem[] = [
  {
    id: 'cr_4948',
    seed: 'tampines-quiet-8pct',
    headline: "Singapore's quiet 8% live below the line.",
    account: 'Tampines FSC (SG)',
    reviewer: 'Brodie',
    reviewerInitials: 'B',
    age: '14m',
    vertical: 'charity',
  },
  {
    id: 'cr_4946',
    seed: 'wv-au-carlton-knockers',
    headline: 'Knockers walked 312 km in Carlton this week.',
    account: 'World Vision (AU)',
    reviewer: 'Compliance',
    reviewerInitials: 'CT',
    age: '38m',
    vertical: 'charity',
  },
  {
    id: 'cr_4945',
    seed: 'pestmax-az-termite-may',
    headline: 'AZ summer: termite-season starts in May. We knock at 9am.',
    account: 'PestMax (US)',
    reviewer: 'Brodie',
    reviewerInitials: 'B',
    age: '1h 12m',
    vertical: 'pest',
  },
  {
    id: 'cr_4944',
    seed: 'scs-grandma-28-kids',
    headline: 'Stayed-at-home grandma · 28 grandkids · 1 PayNow.',
    account: 'SCS pilot (SG)',
    reviewer: 'Brodie',
    reviewerInitials: 'B',
    age: '1h 48m',
    vertical: 'charity',
  },
  {
    id: 'cr_4942',
    seed: 'nextgen-tx-dmo-tablet',
    headline: 'NextGen Power Texas — Knocker shows DMO live on tablet.',
    account: 'NextGen Power (US)',
    reviewer: 'Compliance',
    reviewerInitials: 'CT',
    age: '2h 22m',
    vertical: 'energy',
  },
  {
    id: 'cr_4940',
    seed: 'hf-tx-townhall',
    headline: 'Hope Forward · TX Town Hall · Knocker leadership.',
    account: 'Hope Forward (US)',
    reviewer: 'Brodie',
    reviewerInitials: 'B',
    age: '3h 04m',
    vertical: 'charity',
  },
];

function jobStageTone(s: RecentJob['stage']): 'success' | 'info' | 'warn' | 'danger' | 'muted' {
  switch (s) {
    case 'completed':
      return 'success';
    case 'running':
      return 'info';
    case 'queued':
      return 'muted';
    case 'blocked':
      return 'warn';
    case 'failed':
      return 'danger';
  }
}

function aspectClass(a: TopCreative['aspect']): string {
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

function aspectDims(a: TopCreative['aspect']): { w: number; h: number } {
  switch (a) {
    case 'square':
      return { w: 600, h: 600 };
    case 'portrait':
      return { w: 600, h: 750 };
    case 'vertical':
      return { w: 450, h: 800 };
    case 'video':
      return { w: 800, h: 450 };
  }
}

function channelBadge(c: TopCreative['channel']): string {
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

function activityIcon(k: ActivityEvent['kind']): JSX.Element {
  switch (k) {
    case 'generated':
      return <Sparkle size={13} className="text-accent" />;
    case 'approved':
      return <CheckCircle2 size={13} className="text-success" />;
    case 'blocked':
      return <Ban size={13} className="text-danger" />;
    case 'published':
      return <Megaphone size={13} className="text-accent" />;
    case 'cohort':
      return <RotateCw size={13} className="text-accent" />;
    case 'attribution':
      return <TrendingUp size={13} className="text-success" />;
    case 'edited':
      return <ShieldCheck size={13} className="text-warn" />;
  }
}

export default function MarketingStudioPage(): JSX.Element {
  return (
    <PlatformShell pageTitle="AI Marketing Studio — overview">
      <div className="space-y-5 max-w-[1700px]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <MarketingStudioTabs active="overview" />
          <DataSourceBadge source="fixture" />
        </div>
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Sparkles size={14} className="text-accent" />
            <span>
              The AI Marketing Studio is D2D&apos;s creative spine:{' '}
              <span className="font-semibold">
                brief → compose → variation → review → publish → measure
              </span>
              . Every output is provenance-stamped (C2PA), brand-safety-scanned per vertical, and
              attributed end-to-end. Per-account workspaces drill in from{' '}
              <span className="font-semibold">Accounts → [account] → Marketing Studio</span>.
            </span>
          </span>
        </Banner>

        <Reveal delay={0} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            label="Creatives this week"
            value="412"
            delta="+24.1%"
            deltaTone="positive"
            hint="generated · 7d"
          />
          <KpiCard
            label="Brand-safety pass"
            value="94.2%"
            delta="+1.4pp"
            deltaTone="positive"
            hint="of last 500 scans"
          />
          <KpiCard
            label="Avg cost / creative"
            value={<Money cents={48n} region="US" />}
            hint="all formats blended"
          />
          <KpiCard label="Active campaigns" value="28" hint="Meta + Google + TikTok" />
          <KpiCard label="Rolling ROAS" value="5.2x" delta="+0.4x" deltaTone="positive" />
          <KpiCard label="AI assist time saved" value="184 hr" hint="vs manual baseline · 7d" />
        </Reveal>

        <Reveal delay={80}>
          <Section
            title="Pipeline · today"
            subtitle="Brief → Compose → Variation → Review → Publish → Measure"
          >
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {PIPELINE.map((stage, idx) => {
                const Icon = stage.icon;
                return (
                  <div key={stage.label} className="card card-pad relative">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 rounded bg-accentSoft text-accent flex items-center justify-center">
                        <Icon size={13} />
                      </span>
                      <div className="text-[11.5px] font-semibold uppercase tracking-wider text-muted">
                        {stage.label}
                      </div>
                    </div>
                    <div className="text-[22px] font-semibold text-ink tracking-tight numeric">
                      {stage.todayCount.toLocaleString()}
                    </div>
                    <div className="text-[10.5px] text-muted mt-0.5">{stage.detail}</div>
                    {idx < PIPELINE.length - 1 && (
                      <div className="hidden md:block absolute right-[-9px] top-1/2 -translate-y-1/2 text-soft text-[14px]">
                        →
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        </Reveal>

        <Reveal delay={160}>
          <Section
            title="Top-performing creatives · last 7 days"
            subtitle="Ranked by ROAS · scroll horizontally · click any tile to inspect"
            paddedBody={false}
          >
            <div className="overflow-x-auto px-4 py-4">
              <div className="flex gap-3 min-w-max">
                {TOP_CREATIVES.map((c) => (
                  <TopCreativeCard key={c.id} creative={c} />
                ))}
              </div>
            </div>
          </Section>
        </Reveal>

        <Reveal delay={240} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <Section
              title="Recent jobs"
              subtitle="Most recent 12 marketing-studio jobs across HQ orgs"
              paddedBody={false}
            >
              <table className="tbl">
                <thead>
                  <tr>
                    <th></th>
                    <th>Job</th>
                    <th>Type</th>
                    <th>Account</th>
                    <th>Brief</th>
                    <th>Model</th>
                    <th>Cost</th>
                    <th>Stage</th>
                    <th>Duration</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {RECENT_JOBS.map((j) => (
                    <tr key={j.id} className="hover:bg-paper">
                      <td className="!pr-0 w-[60px]">
                        <div className="w-12 h-12 rounded-md overflow-hidden border border-line2 bg-paper">
                          <img
                            src={pickCreativeImage(
                              inferTheme({ brief: j.brief, account: j.account }),
                              j.id,
                              { w: 96, h: 96 },
                            )}
                            alt={j.brief}
                            width={48}
                            height={48}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </td>
                      <td>
                        <span className="mono text-[10px] !w-auto !px-2">{j.id}</span>
                      </td>
                      <td className="text-[12px] text-ink capitalize">
                        {j.type.replace('_', ' ')}
                      </td>
                      <td className="text-[12px] text-ink">{j.account}</td>
                      <td className="text-[12px] text-muted">{j.brief}</td>
                      <td className="text-[11px] text-muted font-mono">{j.model}</td>
                      <td className="text-[12px] text-ink numeric">
                        {j.costCents === 0 ? (
                          '—'
                        ) : (
                          <Money cents={BigInt(j.costCents)} region="US" />
                        )}
                      </td>
                      <td>
                        <StatusPill tone={jobStageTone(j.stage)}>{j.stage}</StatusPill>
                      </td>
                      <td className="text-[12px] text-muted numeric">
                        {j.durationSec === 0 ? '—' : `${j.durationSec.toFixed(1)}s`}
                      </td>
                      <td className="text-[12px] text-muted numeric">{j.ts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section
              title="AI activity feed"
              subtitle="Live event stream · last 15 events across all orgs"
            >
              <ol className="space-y-0">
                {ACTIVITY.map((evt, idx) => (
                  <li
                    key={evt.id}
                    className={
                      idx < ACTIVITY.length - 1
                        ? 'flex items-start gap-3 pb-3 mb-3 border-b border-line2'
                        : 'flex items-start gap-3'
                    }
                  >
                    <span className="w-7 h-7 rounded-full bg-paper border border-line2 flex items-center justify-center shrink-0 mt-0.5">
                      {activityIcon(evt.kind)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 mb-0.5">
                        <div className="text-[12.5px] font-semibold text-ink">{evt.title}</div>
                        <div className="text-[10.5px] text-muted mono shrink-0">{evt.ts}</div>
                      </div>
                      <div className="text-[11.5px] text-muted leading-snug">{evt.detail}</div>
                      <div className="text-[10px] text-soft mt-0.5">
                        actor: <span className="font-mono text-soft">{evt.actor}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </Section>
          </div>

          <div className="space-y-5">
            <Section
              title="Approval queue"
              subtitle={`${APPROVAL_QUEUE.length} creatives awaiting human review`}
              action={
                <Link href="/marketing-studio/review-queue">
                  <Button variant="ghost" size="sm" leftIcon={<UserCheck size={12} />}>
                    Review all
                  </Button>
                </Link>
              }
            >
              <ul className="space-y-2.5">
                {APPROVAL_QUEUE.map((it) => (
                  <li
                    key={it.id}
                    onClick={() =>
                      toast.info(`Inspect ${it.id} — creative inspector wiring lands in Phase 1.2`)
                    }
                    className="flex items-start gap-2.5 p-2 rounded-md hover:bg-paper transition cursor-pointer"
                  >
                    <div className="w-14 h-14 rounded-md overflow-hidden border border-line2 shrink-0">
                      <img
                        src={pickCreativeImage(
                          inferTheme({
                            vertical: it.vertical,
                            headline: it.headline,
                            account: it.account,
                          }),
                          it.id,
                          { w: 120, h: 120 },
                        )}
                        alt={it.headline}
                        width={56}
                        height={56}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold text-ink leading-snug line-clamp-2">
                        {it.headline}
                      </div>
                      <div className="text-[10.5px] text-muted mt-0.5">{it.account}</div>
                      <div className="flex items-center justify-between mt-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-accent text-surface flex items-center justify-center text-[8.5px] font-bold">
                            {it.reviewerInitials}
                          </span>
                          <span className="text-[10.5px] text-muted">{it.reviewer}</span>
                        </div>
                        <span className="text-[10px] text-soft mono">{it.age}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Provenance & safety" subtitle="C2PA · Anthropic mod · legal-hold">
              <div className="grid grid-cols-2 gap-3">
                <ProvCard
                  icon={<Activity size={14} className="text-accent" />}
                  label="Jobs · 7d"
                  value="2,184"
                />
                <ProvCard
                  icon={<ShieldCheck size={14} className="text-success" />}
                  label="Blocks today"
                  value="3"
                />
                <ProvCard
                  icon={<FileCheck2 size={14} className="text-accent" />}
                  label="C2PA issued"
                  value="412"
                />
                <ProvCard
                  icon={<AlertTriangle size={14} className="text-warn" />}
                  label="Legal-hold"
                  value="2"
                />
              </div>
              <div className="mt-4 space-y-2">
                <ProvDetail
                  icon={<CheckCircle2 size={13} className="text-success" />}
                  title="Anthropic moderation"
                  detail="Every copy string scanned pre-save · 1.2% block rate this week"
                />
                <ProvDetail
                  icon={<XCircle size={13} className="text-danger" />}
                  title="Image safety (Sightengine)"
                  detail="NSFW + violence + brand-logo collision · 0.4% block rate"
                />
                <ProvDetail
                  icon={<Clock size={13} className="text-soft" />}
                  title="Video frame sampling"
                  detail="Every 1.5s sampled + transcript scanned · 18 videos this week"
                />
                <ProvDetail
                  icon={<ImageIcon size={13} className="text-accent" />}
                  title="C2PA chain of custody"
                  detail="Model + prompt hash + seed + temp + cost stored per output"
                />
              </div>
            </Section>
          </div>
        </Reveal>
      </div>
    </PlatformShell>
  );
}

function TopCreativeCard({ creative }: { creative: TopCreative }): JSX.Element {
  const dims = aspectDims(creative.aspect);
  return (
    <div
      onClick={() =>
        toast.info(`Inspect ${creative.id} — creative inspector wiring lands in Phase 1.2`)
      }
      className="card hover:ring-1 hover:ring-accent transition cursor-pointer overflow-hidden w-[260px] shrink-0"
    >
      <div className={`${aspectClass(creative.aspect)} relative overflow-hidden bg-paper`}>
        <img
          src={pickCreativeImage(creative.theme, creative.id, { w: dims.w, h: dims.h })}
          alt={creative.headline}
          width={dims.w}
          height={dims.h}
          loading="lazy"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/30 to-transparent" />
        <div className="absolute top-2 left-2 flex items-center gap-1">
          <span
            className={`rounded text-[9px] uppercase tracking-wider px-1.5 py-0.5 font-semibold ${channelBadge(creative.channel)}`}
          >
            {creative.channel}
          </span>
          <span className="bg-surface/95 backdrop-blur rounded text-[9px] uppercase tracking-wider px-1.5 py-0.5 font-semibold text-ink">
            {creative.format}
          </span>
        </div>
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <span
            className="inline-flex items-center gap-1 bg-surface/95 backdrop-blur rounded text-[9px] uppercase tracking-wider px-1.5 py-0.5 font-semibold text-success"
            title="C2PA provenance manifest signed"
          >
            <FileCheck2 size={9} /> C2PA
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <div className="text-surface text-[12.5px] font-semibold leading-snug drop-shadow-md line-clamp-3">
            {creative.headline}
          </div>
        </div>
      </div>
      <div className="p-3 space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted capitalize">
            {creative.vertical} · {creative.region}
          </span>
          <span className="text-success font-semibold">{creative.roas.toFixed(1)}x ROAS</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-line2">
          <Mini label="Conv %" value={`${creative.conversionRate.toFixed(1)}%`} />
          <Mini label="Spend" value={<Money cents={creative.spendCents} region="US" />} />
          <Mini label="Conv" value={creative.conversions.toString()} />
        </div>
        <div className="flex items-center justify-between pt-1.5 border-t border-line2">
          <StatusPill
            tone={
              creative.status === 'live'
                ? 'success'
                : creative.status === 'paused'
                  ? 'warn'
                  : 'info'
            }
          >
            {creative.status === 'live' && <PlayCircle size={9} className="-ml-0.5" />}
            {creative.status === 'paused' && <Pause size={9} className="-ml-0.5" />}
            {creative.status}
          </StatusPill>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toast.info(`Inspect ${creative.id} — creative inspector wiring lands in Phase 1.2`);
            }}
            className="w-6 h-6 rounded hover:bg-paper flex items-center justify-center text-soft"
            title="Inspect"
          >
            <Eye size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: React.ReactNode }): JSX.Element {
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-wider text-muted">{label}</div>
      <div className="text-[12px] font-semibold text-ink numeric">{value}</div>
    </div>
  );
}

function ProvCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="card card-pad">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted font-medium">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-[18px] font-semibold text-ink tracking-tight numeric">
        {value}
      </div>
    </div>
  );
}

function ProvDetail({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}): JSX.Element {
  return (
    <div className="border border-line2 rounded-md p-2.5">
      <div className="flex items-center gap-1.5 mb-0.5">
        {icon}
        <div className="text-[12px] font-semibold text-ink">{title}</div>
      </div>
      <div className="text-[10.5px] text-muted leading-snug">{detail}</div>
    </div>
  );
}
