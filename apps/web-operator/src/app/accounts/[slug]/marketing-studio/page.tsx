import {
  Sparkles,
  FileCheck2,
  Wand2,
  ShieldCheck,
  Megaphone,
  TrendingUp,
  Eye,
  PlayCircle,
  Pause,
  CheckCircle2,
  Ban,
  UserCheck,
  Activity,
} from 'lucide-react';
import { Banner, Button, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { MarketingStudioTabs } from '@/components/marketing-studio-tabs';
import { getAccount } from '@/lib/accounts';
import {
  getAccountMarketing,
  CHANNEL_LABEL,
  CHANNEL_BADGE,
  type AccountMarketing,
} from '@/lib/account-marketing';
import { pickCreativeImage } from '@/lib/creative-images';

/**
 * Per-account Marketing Studio overview — Brodie's mission-control view of a
 * single sub-account's creative pipeline. Mirrors the HQ overview surface
 * but every number, creative, and reviewer is scoped to this account only.
 */

interface PageProps {
  params: { slug: string };
}

const PIPELINE_STAGES: Array<{
  key: keyof AccountMarketing['pipelineCounts'];
  label: string;
  detail: string;
  icon: typeof Sparkles;
}> = [
  { key: 'brief', label: 'Brief', detail: 'audiences in', icon: FileCheck2 },
  { key: 'compose', label: 'Compose', detail: 'Claude + GPT', icon: Wand2 },
  { key: 'variation', label: 'Variation', detail: 'aud × msg × fmt', icon: Sparkles },
  { key: 'review', label: 'Review', detail: 'human-in-loop', icon: ShieldCheck },
  { key: 'publish', label: 'Publish', detail: 'channels live', icon: Megaphone },
  { key: 'measure', label: 'Measure', detail: 'conv attributed', icon: TrendingUp },
];

export default function Page({ params }: PageProps): JSX.Element {
  const account = getAccount(params.slug);
  const data = getAccountMarketing(params.slug);

  if (!account || !data) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Marketing Studio">
        <div className="text-[13px] text-muted">No marketing data wired for this account.</div>
      </AccountShell>
    );
  }

  const topCreatives = [...data.creatives]
    .filter((c) => c.status === 'published' && c.roas > 0)
    .sort((a, b) => b.roas - a.roas)
    .slice(0, 8);

  const reviewQueue = data.creatives.filter((c) => c.status === 'review').slice(0, 6);

  const recentCampaigns = [...data.campaigns]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 5);

  const blockedCount = data.recentBlocks.filter((b) => b.status === 'pending').length;
  const resolvedCount = data.recentBlocks.filter(
    (b) => b.status === 'released' || b.status === 'rewritten',
  ).length;

  return (
    <AccountShell accountSlug={params.slug} pageTitle={`Marketing Studio · ${account.shortName}`}>
      <div className="space-y-5 max-w-[1700px]">
        <MarketingStudioTabs slug={params.slug} active="overview" />

        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Sparkles size={14} className="text-accent" />
            <span>
              <span className="font-semibold">{data.scopeLabel}</span> · vertical-scoped Marketing
              Studio. Every creative, campaign, and audience is filtered to this account&apos;s{' '}
              <span className="font-semibold">{data.vertical}</span> playbook,{' '}
              <span className="font-semibold">{data.region}</span> regulatory stack, and{' '}
              <span className="font-semibold">{data.currency}</span> budgets.
            </span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            label="Creatives · this week"
            value={data.kpis.creativesThisWeek.toString()}
            hint={`${account.shortName} only`}
            deltaTone="positive"
          />
          <KpiCard
            label="Brand-safety pass"
            value={`${data.kpis.safetyPassPct.toFixed(1)}%`}
            hint="of recent scans"
            deltaTone={data.kpis.safetyPassPct > 95 ? 'positive' : 'negative'}
          />
          <KpiCard
            label="Avg cost / creative"
            value={<Money cents={BigInt(data.kpis.avgCostPerCreativeCents)} region={data.region} />}
            hint="all formats blended"
          />
          <KpiCard
            label="Active campaigns"
            value={data.kpis.activeCampaigns.toString()}
            hint={data.channels.map((c) => CHANNEL_LABEL[c]).join(' · ')}
          />
          <KpiCard
            label="Rolling ROAS"
            value={`${data.kpis.rollingRoas.toFixed(1)}x`}
            deltaTone="positive"
          />
          <KpiCard
            label="AI assist saved"
            value={`${data.kpis.aiAssistHoursSaved} hr`}
            hint="vs manual · 7d"
          />
        </div>

        <Section
          title="Pipeline · today"
          subtitle="Brief → Compose → Variation → Review → Publish → Measure (this account only)"
        >
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {PIPELINE_STAGES.map((stage, idx) => {
              const Icon = stage.icon;
              const count = data.pipelineCounts[stage.key];
              return (
                <div key={stage.key} className="card card-pad relative">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 rounded bg-accentSoft text-accent flex items-center justify-center">
                      <Icon size={13} />
                    </span>
                    <div className="text-[11.5px] font-semibold uppercase tracking-wider text-muted">
                      {stage.label}
                    </div>
                  </div>
                  <div className="text-[22px] font-semibold text-ink tracking-tight numeric">
                    {count.toLocaleString()}
                  </div>
                  <div className="text-[10.5px] text-muted mt-0.5">{stage.detail}</div>
                  {idx < PIPELINE_STAGES.length - 1 && (
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
          title={`Top-performing creatives · ${account.shortName}`}
          subtitle="Ranked by ROAS · scoped to this account · scroll horizontally"
          paddedBody={false}
        >
          <div className="overflow-x-auto px-4 py-4">
            <div className="flex gap-3 min-w-max">
              {topCreatives.map((c) => (
                <div
                  key={c.id}
                  className="card hover:ring-1 hover:ring-accent transition cursor-pointer overflow-hidden w-[260px] shrink-0"
                >
                  <div className="aspect-square relative overflow-hidden bg-paper">
                    <img
                      src={pickCreativeImage(c.theme, c.id)}
                      alt={c.headline}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/30 to-transparent" />
                    <div className="absolute top-2 left-2 flex items-center gap-1">
                      <span
                        className={`rounded text-[9px] uppercase tracking-wider px-1.5 py-0.5 font-semibold ${CHANNEL_BADGE[c.channel]}`}
                      >
                        {CHANNEL_LABEL[c.channel]}
                      </span>
                      <span className="bg-surface/95 backdrop-blur rounded text-[9px] uppercase tracking-wider px-1.5 py-0.5 font-semibold text-ink">
                        {c.format}
                      </span>
                    </div>
                    <div className="absolute top-2 right-2">
                      <span
                        className="inline-flex items-center gap-1 bg-surface/95 backdrop-blur rounded text-[9px] uppercase tracking-wider px-1.5 py-0.5 font-semibold text-success"
                        title="C2PA signed"
                      >
                        <FileCheck2 size={9} /> C2PA
                      </span>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <div className="text-surface text-[12.5px] font-semibold leading-snug drop-shadow-md line-clamp-3">
                        {c.headline}
                      </div>
                    </div>
                  </div>
                  <div className="p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted capitalize">
                        {data.vertical} · {data.region}
                      </span>
                      <span className="text-success font-semibold">{c.roas.toFixed(1)}x ROAS</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-line2">
                      <Mini label="Conv %" value={`${c.convRate.toFixed(1)}%`} />
                      <Mini
                        label="Spend"
                        value={<Money cents={BigInt(c.spendCents)} region={data.region} />}
                      />
                      <Mini label="Conv" value={c.conversions.toString()} />
                    </div>
                    <div className="flex items-center justify-between pt-1.5 border-t border-line2">
                      <StatusPill tone="success">
                        <PlayCircle size={9} className="-ml-0.5" /> live
                      </StatusPill>
                      <button
                        type="button"
                        className="w-6 h-6 rounded hover:bg-paper flex items-center justify-center text-soft"
                        title="Inspect"
                      >
                        <Eye size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {topCreatives.length === 0 && (
                <div className="text-[12.5px] text-muted py-8 px-4">
                  No published creatives yet for this account.
                </div>
              )}
            </div>
          </div>
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <Section
              title="Recent campaigns"
              subtitle={`Latest 5 paid pushes for ${account.shortName}`}
              paddedBody={false}
            >
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Channel</th>
                    <th>Spend</th>
                    <th>Conv</th>
                    <th>ROAS</th>
                    <th>Status</th>
                    <th>Started</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCampaigns.map((c) => (
                    <tr key={c.id} className="hover:bg-paper">
                      <td>
                        <div className="text-[12.5px] font-medium text-ink leading-snug">
                          {c.name}
                        </div>
                        <div className="text-[10px] text-muted font-mono">{c.id}</div>
                      </td>
                      <td>
                        <span
                          className={`inline-flex items-center text-[10px] font-semibold rounded px-2 py-0.5 ${CHANNEL_BADGE[c.channel]}`}
                        >
                          {CHANNEL_LABEL[c.channel]}
                        </span>
                      </td>
                      <td className="text-[12px] text-ink">
                        <Money cents={BigInt(c.spendCents)} region={data.region} emptyAsDash />
                      </td>
                      <td className="text-[12px] text-ink numeric font-semibold">
                        {c.conversions.toLocaleString()}
                      </td>
                      <td className="text-[12px]">
                        {c.roas === 0 ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <span
                            className={
                              c.roas >= 5
                                ? 'text-success font-semibold'
                                : c.roas >= 3
                                  ? 'text-accent font-semibold'
                                  : 'text-warn font-semibold'
                            }
                          >
                            {c.roas.toFixed(1)}x
                          </span>
                        )}
                      </td>
                      <td>
                        <StatusPill
                          tone={
                            c.status === 'active'
                              ? 'success'
                              : c.status === 'paused'
                                ? 'warn'
                                : c.status === 'scheduled'
                                  ? 'info'
                                  : 'muted'
                          }
                        >
                          {c.status === 'active' && <PlayCircle size={9} className="-ml-0.5" />}
                          {c.status === 'paused' && <Pause size={9} className="-ml-0.5" />}
                          {c.status}
                        </StatusPill>
                      </td>
                      <td className="text-[11.5px] text-muted numeric">{c.startedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section
              title="Safety activity"
              subtitle={`Last ${data.recentBlocks.length} blocks · scoped to ${account.shortName}`}
            >
              <ol className="space-y-0">
                {data.recentBlocks.map((b, idx) => (
                  <li
                    key={b.id}
                    className={
                      idx < data.recentBlocks.length - 1
                        ? 'flex items-start gap-3 pb-3 mb-3 border-b border-line2'
                        : 'flex items-start gap-3'
                    }
                  >
                    <span className="w-7 h-7 rounded-full bg-paper border border-line2 flex items-center justify-center shrink-0 mt-0.5">
                      {b.status === 'released' || b.status === 'rewritten' ? (
                        <CheckCircle2 size={13} className="text-success" />
                      ) : (
                        <Ban size={13} className="text-danger" />
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 mb-0.5">
                        <div className="text-[12.5px] font-semibold text-ink leading-snug">
                          {b.creativeHeadline}
                        </div>
                        <div className="text-[10.5px] text-muted mono shrink-0">{b.blockedAt}</div>
                      </div>
                      <div className="text-[11.5px] text-muted leading-snug">{b.ruleViolated}</div>
                      <div className="text-[10px] text-soft mt-0.5 flex items-center gap-2">
                        <span>reviewer: {b.reviewer}</span>
                        <span className="text-soft">·</span>
                        <StatusPill
                          tone={
                            b.severity === 'critical'
                              ? 'danger'
                              : b.severity === 'warn'
                                ? 'warn'
                                : 'info'
                          }
                        >
                          {b.severity}
                        </StatusPill>
                      </div>
                    </div>
                  </li>
                ))}
                {data.recentBlocks.length === 0 && (
                  <li className="text-[12px] text-muted">No safety blocks for this account.</li>
                )}
              </ol>
            </Section>
          </div>

          <div className="space-y-5">
            <Section
              title="Approval queue"
              subtitle={`${reviewQueue.length} creatives awaiting human review`}
              action={
                <Button variant="ghost" size="sm" leftIcon={<UserCheck size={12} />}>
                  Review all
                </Button>
              }
            >
              <ul className="space-y-2.5">
                {reviewQueue.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-start gap-2.5 p-2 rounded-md hover:bg-paper transition cursor-pointer"
                  >
                    <div className="w-14 h-14 rounded-md overflow-hidden border border-line2 shrink-0">
                      <img
                        src={pickCreativeImage(c.theme, c.id)}
                        alt={c.headline}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold text-ink leading-snug line-clamp-2">
                        {c.headline}
                      </div>
                      <div className="text-[10.5px] text-muted mt-0.5">
                        {CHANNEL_LABEL[c.channel]} · {c.format}
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-accent text-surface flex items-center justify-center text-[8.5px] font-bold">
                            {c.reviewerInitials ?? 'B'}
                          </span>
                          <span className="text-[10.5px] text-muted">
                            {c.reviewerInitials ?? 'Brodie'}
                          </span>
                        </div>
                        <span className="text-[10px] text-soft mono">{c.id}</span>
                      </div>
                    </div>
                  </li>
                ))}
                {reviewQueue.length === 0 && (
                  <li className="text-[12px] text-muted text-center py-4">
                    Approval queue is clear.
                  </li>
                )}
              </ul>
            </Section>

            <Section title="Provenance & safety" subtitle="C2PA · moderation · resolution">
              <div className="grid grid-cols-2 gap-3">
                <ProvCard
                  icon={<Activity size={14} className="text-accent" />}
                  label="Creatives · 7d"
                  value={data.kpis.creativesThisWeek.toString()}
                />
                <ProvCard
                  icon={<ShieldCheck size={14} className="text-success" />}
                  label="Open blocks"
                  value={blockedCount.toString()}
                />
                <ProvCard
                  icon={<FileCheck2 size={14} className="text-accent" />}
                  label="C2PA issued"
                  value={data.kpis.creativesThisWeek.toString()}
                />
                <ProvCard
                  icon={<CheckCircle2 size={14} className="text-success" />}
                  label="Resolved blocks"
                  value={resolvedCount.toString()}
                />
              </div>
              <div className="mt-4 space-y-2">
                <ProvDetail
                  icon={<CheckCircle2 size={13} className="text-success" />}
                  title="Per-vertical rule pack"
                  detail={`${data.brandRules.length} rules · ${data.region} · ${data.vertical}`}
                />
                <ProvDetail
                  icon={<Sparkles size={13} className="text-accent" />}
                  title="Brand voice"
                  detail={`${data.themes.length} themes calibrated for ${account.shortName}`}
                />
              </div>
            </Section>
          </div>
        </div>
      </div>
    </AccountShell>
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
