'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  FileCheck2,
  Megaphone,
  AlertTriangle,
  Eye,
  UserCheck,
  RefreshCw,
} from 'lucide-react';
import { Banner, Button, KpiCard, Money, Reveal, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { MarketingStudioTabs } from '@/components/marketing-studio-tabs';
import { DataSourceBadge, useDataFreshness } from '@/components/DataSourceBadge';
import { toast } from '@/components/Toaster';
import { pickCreativeImage, inferTheme } from '@/lib/creative-images';
import { MarketingPipelineEmpty, ApprovalQueueEmpty } from '@/components/MarketingEmptyStates';

/**
 * AI Marketing Studio — command centre.
 *
 * Cross-account (HQ) view of the creative pipeline, wired to real Prisma
 * rows: ContentGenerationJob (generation jobs), Creative (library + approval
 * queue), and ProviderWebhookEvent (activity feed). There is no backing model
 * for a fictional "brief → compose → variation → review → publish → measure"
 * funnel with per-stage daily counts, so that stat grid is gone — the KPI row
 * and job table below report real counts instead.
 *
 * Curated Unsplash image previews on every creative tile (see
 * @/lib/creative-images) — deterministic photo pick per creative id, fed by
 * the creative's real `prompt`/`type`.
 */

interface JobRow {
  id: string;
  account: string;
  providerKind: string;
  capability: string;
  status: string;
  costCents: string;
  modelId: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface CreativeRow {
  id: string;
  account: string;
  type: string;
  prompt: string | null;
  model: string | null;
  costCents: string;
  c2paManifestId: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
}

interface WebhookEventRow {
  id: string;
  account: string;
  providerKind: string;
  eventType: string;
  verifiedSignature: boolean;
  receivedAt: string;
}

interface ProviderRow {
  id: string;
  status: string;
}

function jobStageTone(s: string): 'success' | 'info' | 'warn' | 'danger' | 'muted' {
  switch (s) {
    case 'ready':
      return 'success';
    case 'running':
      return 'info';
    case 'pending':
      return 'muted';
    case 'cancelled':
      return 'warn';
    case 'failed':
      return 'danger';
    default:
      return 'muted';
  }
}

function creativeHeadline(c: { prompt: string | null; id: string }): string {
  return c.prompt && c.prompt.trim().length > 0 ? c.prompt.slice(0, 90) : `Creative ${c.id}`;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export default function MarketingStudioPage(): JSX.Element {
  const { source, updatedAt, markFresh } = useDataFreshness('live');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [creatives, setCreatives] = useState<CreativeRow[]>([]);
  const [events, setEvents] = useState<WebhookEventRow[]>([]);
  const [providers, setProviders] = useState<ProviderRow[]>([]);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [jobsRes, creativesRes, eventsRes, providersRes] = await Promise.all([
        fetch('/api/marketing/jobs', { method: 'GET' }),
        fetch('/api/marketing/creatives', { method: 'GET' }),
        fetch('/api/marketing/webhook-events', { method: 'GET' }),
        fetch('/api/marketing/providers', { method: 'GET' }),
      ]);
      if (!jobsRes.ok || !creativesRes.ok || !eventsRes.ok || !providersRes.ok) {
        throw new Error('One or more marketing endpoints returned a non-2xx status');
      }
      const jobsData = (await jobsRes.json()) as { jobs?: JobRow[] };
      const creativesData = (await creativesRes.json()) as { creatives?: CreativeRow[] };
      const eventsData = (await eventsRes.json()) as { events?: WebhookEventRow[] };
      const providersData = (await providersRes.json()) as { providers?: ProviderRow[] };

      setJobs(Array.isArray(jobsData.jobs) ? jobsData.jobs : []);
      setCreatives(Array.isArray(creativesData.creatives) ? creativesData.creatives : []);
      setEvents(Array.isArray(eventsData.events) ? eventsData.events : []);
      setProviders(Array.isArray(providersData.providers) ? providersData.providers : []);
      setLoadError(null);
      markFresh();
    } catch (err) {
      console.error('[marketing-studio overview] fetch failed:', err);
      setLoadError('Could not load Marketing Studio data — try refreshing.');
    } finally {
      setLoading(false);
    }
  }, [markFresh]);

  useEffect(() => {
    void load();
  }, [load]);

  const recentJobs = jobs.slice(0, 12);
  const awaitingReview = creatives.filter((c) => !c.approvedAt).slice(0, 6);
  const recentlyApproved = creatives.filter((c) => c.approvedAt).slice(0, 10);
  const recentEvents = events.slice(0, 15);

  const now = Date.now();
  const creativesThisWeek = creatives.filter(
    (c) => now - new Date(c.createdAt).getTime() <= SEVEN_DAYS_MS,
  ).length;
  const jobsThisWeek = jobs.filter(
    (j) => now - new Date(j.createdAt).getTime() <= SEVEN_DAYS_MS,
  ).length;
  const c2paIssued = creatives.filter((c) => c.c2paManifestId).length;
  const providersConnected = providers.filter((p) => p.status === 'connected').length;
  const totalCostCents = jobs.reduce((sum, j) => sum + BigInt(j.costCents || '0'), 0n);
  const avgCostCents =
    creatives.length > 0
      ? creatives.reduce((sum, c) => sum + BigInt(c.costCents || '0'), 0n) /
        BigInt(creatives.length)
      : 0n;

  return (
    <PlatformShell pageTitle="AI Marketing Studio — overview">
      <div className="space-y-5 max-w-[1700px]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <MarketingStudioTabs active="overview" />
          <div className="flex items-center gap-2">
            {updatedAt && <DataSourceBadge source={source} updatedAt={updatedAt} />}
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<RefreshCw size={13} className={loading ? 'animate-spin' : ''} />}
              onClick={() => void load()}
              disabled={loading}
            >
              Refresh
            </Button>
          </div>
        </div>

        {loadError && (
          <Banner tone="warn">
            <span className="text-[13px] flex items-center gap-2">
              <AlertTriangle size={14} className="text-warn shrink-0" />
              <span>{loadError}</span>
            </span>
          </Banner>
        )}

        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Sparkles size={14} className="text-accent" />
            <span>
              The AI Marketing Studio is D2D&apos;s creative spine: generate → safety-scan → approve
              → publish. Every job is a real{' '}
              <span className="font-semibold">ContentGenerationJob</span> row and every asset is a
              real <span className="font-semibold">Creative</span> row, provenance-stamped where a
              C2PA manifest exists. Per-account workspaces drill in from{' '}
              <span className="font-semibold">Accounts → [account] → Marketing Studio</span>.
            </span>
          </span>
        </Banner>

        <Reveal delay={0} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Creatives · this week" value={creativesThisWeek} hint="generated · 7d" />
          <KpiCard label="Generation jobs · this week" value={jobsThisWeek} hint="7d" />
          <KpiCard
            label="Avg cost / creative"
            value={<Money cents={avgCostCents} region="US" />}
            hint="all formats blended"
          />
          <KpiCard
            label="Awaiting review"
            value={awaitingReview.length}
            hint="approvedAt not set"
          />
          <KpiCard label="C2PA manifests issued" value={c2paIssued} hint="of all creatives" />
          <KpiCard
            label="Providers connected"
            value={providersConnected}
            hint={`of ${providers.length} registered`}
          />
        </Reveal>

        <Reveal delay={80}>
          <Section
            title="Recently approved creatives"
            subtitle="Most recent 10 · scroll horizontally · click a tile to inspect"
            paddedBody={false}
          >
            {loading ? (
              <div className="px-4 py-8 text-center text-[12.5px] text-muted">Loading…</div>
            ) : recentlyApproved.length === 0 ? (
              <MarketingPipelineEmpty />
            ) : (
              <div className="overflow-x-auto px-4 py-4">
                <div className="flex gap-3 min-w-max">
                  {recentlyApproved.map((c) => (
                    <TopCreativeCard key={c.id} creative={c} />
                  ))}
                </div>
              </div>
            )}
          </Section>
        </Reveal>

        <Reveal delay={160} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <Section
              title="Recent generation jobs"
              subtitle="Most recent 12 ContentGenerationJob rows across HQ orgs"
              paddedBody={false}
            >
              {loading ? (
                <div className="px-4 py-8 text-center text-[12.5px] text-muted">Loading…</div>
              ) : recentJobs.length === 0 ? (
                <MarketingPipelineEmpty />
              ) : (
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Job</th>
                      <th>Account</th>
                      <th>Provider</th>
                      <th>Capability</th>
                      <th>Model</th>
                      <th>Cost</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentJobs.map((j) => (
                      <tr key={j.id} className="hover:bg-paper">
                        <td>
                          <span className="mono text-[10px] !w-auto !px-2">{j.id}</span>
                        </td>
                        <td className="text-[12px] text-ink">{j.account}</td>
                        <td className="text-[12px] text-ink">{j.providerKind}</td>
                        <td className="text-[12px] text-muted">{j.capability}</td>
                        <td className="text-[11px] text-muted font-mono">{j.modelId ?? '—'}</td>
                        <td className="text-[12px] text-ink numeric">
                          {j.costCents === '0' ? (
                            '—'
                          ) : (
                            <Money cents={BigInt(j.costCents)} region="US" />
                          )}
                        </td>
                        <td>
                          <StatusPill tone={jobStageTone(j.status)}>{j.status}</StatusPill>
                        </td>
                        <td className="text-[12px] text-muted numeric">
                          {new Date(j.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>

            <Section
              title="Provider activity"
              subtitle="Last 15 inbound webhook events across all orgs"
            >
              {loading ? (
                <div className="text-center text-[12.5px] text-muted py-6">Loading…</div>
              ) : recentEvents.length === 0 ? (
                <div className="text-center text-[12.5px] text-muted py-6">
                  No inbound provider events recorded yet.
                </div>
              ) : (
                <ol className="space-y-0">
                  {recentEvents.map((evt, idx) => (
                    <li
                      key={evt.id}
                      className={
                        idx < recentEvents.length - 1
                          ? 'flex items-start gap-3 pb-3 mb-3 border-b border-line2'
                          : 'flex items-start gap-3'
                      }
                    >
                      <span className="w-7 h-7 rounded-full bg-paper border border-line2 flex items-center justify-center shrink-0 mt-0.5">
                        {evt.verifiedSignature ? (
                          <CheckCircle2 size={13} className="text-success" />
                        ) : (
                          <XCircle size={13} className="text-danger" />
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2 mb-0.5">
                          <div className="text-[12.5px] font-semibold text-ink">
                            {evt.eventType}
                          </div>
                          <div className="text-[10.5px] text-muted mono shrink-0">
                            {new Date(evt.receivedAt).toLocaleTimeString()}
                          </div>
                        </div>
                        <div className="text-[11.5px] text-muted leading-snug">
                          {evt.account} · {evt.providerKind}
                        </div>
                        <div className="text-[10px] text-soft mt-0.5">
                          signature:{' '}
                          <span className={evt.verifiedSignature ? 'text-success' : 'text-danger'}>
                            {evt.verifiedSignature ? 'valid' : 'rejected'}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Section>
          </div>

          <div className="space-y-5">
            <Section
              title="Approval queue"
              subtitle={`${awaitingReview.length} creatives awaiting human review`}
              action={
                <Link href="/marketing-studio/review-queue">
                  <Button variant="ghost" size="sm" leftIcon={<UserCheck size={12} />}>
                    Review all
                  </Button>
                </Link>
              }
            >
              {loading ? (
                <div className="text-center text-[12.5px] text-muted py-4">Loading…</div>
              ) : awaitingReview.length === 0 ? (
                <ApprovalQueueEmpty />
              ) : (
                <ul className="space-y-2.5">
                  {awaitingReview.map((c) => (
                    <li
                      key={c.id}
                      onClick={() => toast.info(`Inspect ${c.id} — creative inspector coming soon`)}
                      className="flex items-start gap-2.5 p-2 rounded-md hover:bg-paper transition cursor-pointer"
                    >
                      <div className="w-14 h-14 rounded-md overflow-hidden border border-line2 shrink-0">
                        <img
                          src={pickCreativeImage(
                            inferTheme({ headline: creativeHeadline(c), copy: c.prompt ?? '' }),
                            c.id,
                            { w: 120, h: 120 },
                          )}
                          alt={creativeHeadline(c)}
                          width={56}
                          height={56}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold text-ink leading-snug line-clamp-2">
                          {creativeHeadline(c)}
                        </div>
                        <div className="text-[10.5px] text-muted mt-0.5">{c.account}</div>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[10.5px] text-muted capitalize">{c.type}</span>
                          <span className="text-[10px] text-soft mono">
                            {new Date(c.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Provenance" subtitle="C2PA · generation spend">
              <div className="grid grid-cols-2 gap-3">
                <ProvCard
                  icon={<Sparkles size={14} className="text-accent" />}
                  label="Jobs · 7d"
                  value={jobsThisWeek.toString()}
                />
                <ProvCard
                  icon={<ShieldCheck size={14} className="text-success" />}
                  label="Providers connected"
                  value={providersConnected.toString()}
                />
                <ProvCard
                  icon={<FileCheck2 size={14} className="text-accent" />}
                  label="C2PA issued"
                  value={c2paIssued.toString()}
                />
                <ProvCard
                  icon={<Megaphone size={14} className="text-accent" />}
                  label="Job spend total"
                  value={<Money cents={totalCostCents} region="US" />}
                />
              </div>
              <div className="mt-4">
                <ProvDetail
                  icon={<Clock size={13} className="text-soft" />}
                  title="Safety scan"
                  detail="Read from Creative.safetyScanResult — see Brand safety for the full breakdown."
                />
              </div>
            </Section>
          </div>
        </Reveal>
      </div>
    </PlatformShell>
  );
}

function TopCreativeCard({ creative }: { creative: CreativeRow }): JSX.Element {
  return (
    <div
      onClick={() => toast.info(`Inspect ${creative.id} — creative inspector coming soon`)}
      className="card hover:ring-1 hover:ring-accent transition cursor-pointer overflow-hidden w-[260px] shrink-0"
    >
      <div className="aspect-square relative overflow-hidden bg-paper">
        <img
          src={pickCreativeImage(
            inferTheme({ headline: creativeHeadline(creative), copy: creative.prompt ?? '' }),
            creative.id,
            { w: 600, h: 600 },
          )}
          alt={creativeHeadline(creative)}
          width={600}
          height={600}
          loading="lazy"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/30 to-transparent" />
        <div className="absolute top-2 left-2 flex items-center gap-1">
          <span className="bg-surface/95 backdrop-blur rounded text-[9px] uppercase tracking-wider px-1.5 py-0.5 font-semibold text-ink capitalize">
            {creative.type}
          </span>
        </div>
        {creative.c2paManifestId && (
          <div className="absolute top-2 right-2">
            <span
              className="inline-flex items-center gap-1 bg-surface/95 backdrop-blur rounded text-[9px] uppercase tracking-wider px-1.5 py-0.5 font-semibold text-success"
              title="C2PA provenance manifest signed"
            >
              <FileCheck2 size={9} /> C2PA
            </span>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <div className="text-surface text-[12.5px] font-semibold leading-snug drop-shadow-md line-clamp-3">
            {creativeHeadline(creative)}
          </div>
        </div>
      </div>
      <div className="p-3 space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted">{creative.account}</span>
          <span className="text-ink font-medium">
            <Money cents={BigInt(creative.costCents || '0')} region="US" />
          </span>
        </div>
        <div className="flex items-center justify-between pt-1.5 border-t border-line2">
          <StatusPill tone="success">
            <CheckCircle2 size={9} className="-ml-0.5" /> approved
          </StatusPill>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toast.info(`Inspect ${creative.id} — creative inspector coming soon`);
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

function ProvCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
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
