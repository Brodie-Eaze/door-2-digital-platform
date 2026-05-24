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
} from 'lucide-react';
import { Banner, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';

/**
 * AI Marketing Studio — command centre.
 *
 * Top-of-stack overview of the creative-generation pipeline:
 * Brief → Compose → Variation → Review → Publish → Measure.
 *
 * Volumes per stage today, top-performing creatives across the
 * portfolio, safety + provenance strip, recent jobs.
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
  {
    label: 'Compose',
    todayCount: 22,
    detail: 'Claude + GPT-4.5 fb',
    icon: Wand2,
    tone: 'info',
  },
  {
    label: 'Variation',
    todayCount: 184,
    detail: 'aud × msg × format',
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
  headline: string;
  vertical: 'charity' | 'pest' | 'solar' | 'energy';
  region: 'US' | 'AU' | 'SG';
  channel: 'Meta' | 'Google' | 'TikTok' | 'YouTube';
  format: 'image' | 'carousel' | 'video';
  conversionRate: number;
  spendCents: bigint;
  conversions: number;
  roas: number;
  gradient: string;
}

const TOP_CREATIVES: TopCreative[] = [
  {
    id: 'cr_4912',
    headline: '"Five dollars covers a meal — every Tuesday."',
    vertical: 'charity',
    region: 'US',
    channel: 'Meta',
    format: 'image',
    conversionRate: 4.8,
    spendCents: 124_00n,
    conversions: 88,
    roas: 6.4,
    gradient: 'from-emerald-500 to-teal-700',
  },
  {
    id: 'cr_4908',
    headline: '"Your neighbour just sponsored a child in Tampines."',
    vertical: 'charity',
    region: 'SG',
    channel: 'Meta',
    format: 'carousel',
    conversionRate: 4.2,
    spendCents: 94_00n,
    conversions: 51,
    roas: 5.8,
    gradient: 'from-blue-500 to-indigo-700',
  },
  {
    id: 'cr_4901',
    headline: '"Don\'t share your meal with roaches. Texas-licensed."',
    vertical: 'pest',
    region: 'US',
    channel: 'TikTok',
    format: 'video',
    conversionRate: 3.8,
    spendCents: 184_00n,
    conversions: 42,
    roas: 4.9,
    gradient: 'from-amber-500 to-orange-700',
  },
  {
    id: 'cr_4897',
    headline: '"For every child sponsored in Cebu, a Knocker plants one tree."',
    vertical: 'charity',
    region: 'AU',
    channel: 'Meta',
    format: 'video',
    conversionRate: 4.1,
    spendCents: 142_00n,
    conversions: 64,
    roas: 5.4,
    gradient: 'from-green-500 to-emerald-700',
  },
  {
    id: 'cr_4891',
    headline: '"Our solar bills shrank 71% in 8 weeks. Boise, ID."',
    vertical: 'solar',
    region: 'US',
    channel: 'Google',
    format: 'image',
    conversionRate: 2.9,
    spendCents: 224_00n,
    conversions: 22,
    roas: 4.1,
    gradient: 'from-orange-500 to-red-700',
  },
  {
    id: 'cr_4884',
    headline: '"Renew your faith in giving — Hope Forward, 2026."',
    vertical: 'charity',
    region: 'US',
    channel: 'YouTube',
    format: 'video',
    conversionRate: 3.6,
    spendCents: 312_00n,
    conversions: 71,
    roas: 5.1,
    gradient: 'from-violet-500 to-purple-700',
  },
  {
    id: 'cr_4877',
    headline: '"3 in 5 Aussie families need help this winter."',
    vertical: 'charity',
    region: 'AU',
    channel: 'Meta',
    format: 'image',
    conversionRate: 3.9,
    spendCents: 104_00n,
    conversions: 48,
    roas: 5.7,
    gradient: 'from-sky-500 to-blue-700',
  },
  {
    id: 'cr_4862',
    headline: '"Switch to NextGen Power and pay nothing for 3 months."',
    vertical: 'energy',
    region: 'US',
    channel: 'Google',
    format: 'carousel',
    conversionRate: 2.7,
    spendCents: 194_00n,
    conversions: 18,
    roas: 3.6,
    gradient: 'from-yellow-500 to-amber-700',
  },
];

interface RecentJob {
  id: string;
  type: 'compose' | 'variation' | 'safety_scan' | 'publish' | 'measure';
  account: string;
  brief: string;
  stage: 'queued' | 'running' | 'completed' | 'blocked' | 'failed';
  durationSec: number;
  ts: string;
}

const RECENT_JOBS: RecentJob[] = [
  {
    id: 'job_9421',
    type: 'compose',
    account: 'World Vision (AU)',
    brief: 'Winter sponsorship · Outer Sydney',
    stage: 'completed',
    durationSec: 12.4,
    ts: '2026-05-24 09:42:18',
  },
  {
    id: 'job_9420',
    type: 'variation',
    account: 'Hope Forward (US)',
    brief: 'Mothers Day · 23 variations',
    stage: 'running',
    durationSec: 38.1,
    ts: '2026-05-24 09:41:02',
  },
  {
    id: 'job_9419',
    type: 'safety_scan',
    account: 'PestMax (US)',
    brief: 'TX Roach script v2 · YouTube',
    stage: 'blocked',
    durationSec: 4.8,
    ts: '2026-05-24 09:39:55',
  },
  {
    id: 'job_9418',
    type: 'publish',
    account: 'Hope Forward (US)',
    brief: 'cr_4912 → Meta US',
    stage: 'completed',
    durationSec: 2.1,
    ts: '2026-05-24 09:38:21',
  },
  {
    id: 'job_9417',
    type: 'measure',
    account: 'World Vision (AU)',
    brief: 'cr_4877 attribution sync',
    stage: 'completed',
    durationSec: 1.4,
    ts: '2026-05-24 09:36:09',
  },
  {
    id: 'job_9416',
    type: 'compose',
    account: 'Gold Coast Hospital (AU)',
    brief: 'Cancer wing capital campaign',
    stage: 'queued',
    durationSec: 0,
    ts: '2026-05-24 09:34:44',
  },
  {
    id: 'job_9415',
    type: 'safety_scan',
    account: 'Tampines FSC (SG)',
    brief: 'House-to-house pitch · SG charity',
    stage: 'completed',
    durationSec: 5.2,
    ts: '2026-05-24 09:32:11',
  },
  {
    id: 'job_9414',
    type: 'variation',
    account: 'PestMax (US)',
    brief: 'AZ Termite script · 12 variations',
    stage: 'failed',
    durationSec: 17.4,
    ts: '2026-05-24 09:28:55',
  },
  {
    id: 'job_9413',
    type: 'publish',
    account: 'World Vision (AU)',
    brief: 'cr_4877 → Meta AU',
    stage: 'completed',
    durationSec: 1.9,
    ts: '2026-05-24 09:24:13',
  },
  {
    id: 'job_9412',
    type: 'compose',
    account: 'SCS pilot (SG)',
    brief: 'Cancer awareness · Toa Payoh',
    stage: 'completed',
    durationSec: 11.8,
    ts: '2026-05-24 09:21:08',
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

export default function MarketingStudioPage(): JSX.Element {
  return (
    <PlatformShell pageTitle="AI Marketing Studio — overview">
      <div className="space-y-5 max-w-[1700px]">
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

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
        </div>

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

        <Section
          title="Top-performing creatives · last 7 days"
          subtitle="Ranked by ROAS · click any tile to open creative + delivery log"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {TOP_CREATIVES.map((c) => (
              <CreativeCard key={c.id} creative={c} />
            ))}
          </div>
        </Section>

        <Section
          title="Recent jobs"
          subtitle="Most recent 10 marketing-studio jobs across HQ orgs"
          paddedBody={false}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Job</th>
                <th>Type</th>
                <th>Account</th>
                <th>Brief</th>
                <th>Stage</th>
                <th>Duration</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_JOBS.map((j) => (
                <tr key={j.id}>
                  <td>
                    <span className="mono text-[10px] !w-auto !px-2">{j.id}</span>
                  </td>
                  <td className="text-[12px] text-ink capitalize">{j.type.replace('_', ' ')}</td>
                  <td className="text-[12px] text-ink">{j.account}</td>
                  <td className="text-[12px] text-muted">{j.brief}</td>
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
          title="Provenance & safety"
          subtitle="C2PA manifests · Anthropic moderation · legal-hold queue"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ProvCard
              icon={<Activity size={14} className="text-accent" />}
              label="Jobs run · 7d"
              value="2,184"
              hint="Compose + Variation + Publish"
            />
            <ProvCard
              icon={<ShieldCheck size={14} className="text-success" />}
              label="Safety blocks today"
              value="3"
              hint="2 ACNC · 1 ACL substantiation"
            />
            <ProvCard
              icon={<FileCheck2 size={14} className="text-accent" />}
              label="C2PA manifests issued"
              value="412"
              hint="every img/video signed"
            />
            <ProvCard
              icon={<AlertTriangle size={14} className="text-warn" />}
              label="Legal-hold items"
              value="2"
              hint="awaiting counsel review"
            />
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <ProvDetail
              icon={<CheckCircle2 size={13} className="text-success" />}
              title="Anthropic moderation"
              detail="Every copy string scanned pre-save · 1.2% block rate this week"
            />
            <ProvDetail
              icon={<ShieldCheck size={13} className="text-accent" />}
              title="Custom rule engine"
              detail="Vertical-specific regex + LLM-as-judge · 6 active rule packs"
            />
            <ProvDetail
              icon={<XCircle size={13} className="text-danger" />}
              title="Image safety (Sightengine)"
              detail="NSFW + violence + brand-logo collision · 0.4% block rate"
            />
            <ProvDetail
              icon={<Clock size={13} className="text-soft" />}
              title="Video frame sampling"
              detail="Every 1.5s sampled + transcription scanned · 18 videos this week"
            />
            <ProvDetail
              icon={<ImageIcon size={13} className="text-accent" />}
              title="C2PA chain of custody"
              detail="Model + prompt hash + seed + temp + cost stored per output"
            />
            <ProvDetail
              icon={<TrendingUp size={13} className="text-accent" />}
              title="ROAS dashboard sync"
              detail="Meta + Google + TikTok webhooks · &lt;5min attribution lag"
            />
          </div>
        </Section>
      </div>
    </PlatformShell>
  );
}

function CreativeCard({ creative }: { creative: TopCreative }): JSX.Element {
  return (
    <div className="card hover:ring-1 hover:ring-accent transition cursor-pointer overflow-hidden">
      <div className={`h-32 bg-gradient-to-br ${creative.gradient} relative flex items-end p-3`}>
        <div className="absolute top-2 left-2 flex items-center gap-1">
          <span className="bg-surface/95 backdrop-blur rounded text-[9px] uppercase tracking-wider px-1.5 py-0.5 font-semibold text-ink">
            {creative.channel}
          </span>
          <span className="bg-surface/95 backdrop-blur rounded text-[9px] uppercase tracking-wider px-1.5 py-0.5 font-semibold text-ink">
            {creative.format}
          </span>
        </div>
        <div className="absolute top-2 right-2">
          <span
            className="inline-flex items-center gap-1 bg-surface/95 backdrop-blur rounded text-[9px] uppercase tracking-wider px-1.5 py-0.5 font-semibold text-success"
            title="C2PA provenance manifest signed"
          >
            <FileCheck2 size={9} /> C2PA
          </span>
        </div>
        <div className="text-surface text-[12.5px] font-semibold leading-snug drop-shadow-md">
          {creative.headline}
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
          <Mini label="Conv rate" value={`${creative.conversionRate.toFixed(1)}%`} />
          <Mini label="Spend" value={<Money cents={creative.spendCents} region="US" />} />
          <Mini label="Conversions" value={creative.conversions.toString()} />
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
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
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
      <div className="text-[11px] text-muted mt-0.5">{hint}</div>
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
    <div className="border border-line2 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <div className="text-[12.5px] font-semibold text-ink">{title}</div>
      </div>
      <div
        className="text-[11px] text-muted leading-snug"
        dangerouslySetInnerHTML={{ __html: detail }}
      />
    </div>
  );
}
