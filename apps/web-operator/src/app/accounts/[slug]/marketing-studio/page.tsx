'use client';

/**
 * Per-account Marketing Studio overview — real counts rolled up from the
 * four Marketing Studio BFF routes (providers, jobs, creatives, campaigns).
 * There is no ROAS/spend/conversion-attribution pipeline in the schema yet,
 * so this shows what's actually tracked: job status distribution, creative
 * approval state, campaign budget/status, and provider connectivity.
 */
import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  FileCheck2,
  ShieldCheck,
  Megaphone,
  Plug,
  Clock,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Ban,
  Activity,
} from 'lucide-react';
import { Banner, Button, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { MarketingStudioTabs } from '@/components/marketing-studio-tabs';
import { MarketingStudioEmpty } from '@/components/AccountEmptyStates';
import { DataSourceBadge } from '@/components/DataSourceBadge';

interface ApiProvider {
  id: string;
  kind: string;
  status: string;
}

interface ApiJob {
  id: string;
  providerKind: string;
  capability: string;
  status: string;
  costCents: string;
  createdAt: string;
}

interface ApiCreative {
  id: string;
  type: string;
  prompt: string | null;
  costCents: string;
  safetyScanResult: unknown;
  c2paManifestId: string | null;
  approvedAt: string | null;
  createdAt: string;
}

interface ApiCampaign {
  id: string;
  provider: string;
  objective: string;
  budgetCents: string;
  status: string;
  startedAt: string | null;
}

interface Overview {
  org: {
    tradingName: string;
    regionCode: 'AU' | 'US' | 'SG';
    vertical: 'charity' | 'commercial' | null;
  };
  providers: ApiProvider[];
  jobs: ApiJob[];
  creatives: ApiCreative[];
  campaigns: ApiCampaign[];
}

const JOB_STATUSES = ['pending', 'running', 'ready', 'failed', 'cancelled'] as const;

function scanFailed(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false;
  return (result as { pass?: unknown }).pass === false;
}
function scanPassed(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false;
  return (result as { pass?: unknown }).pass === true;
}

export default function Page({
  params: paramsPromise,
}: {
  params: Promise<{ slug: string }>;
}): JSX.Element {
  const params = use(paramsPromise);
  const [data, setData] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoadError(null);
    try {
      const base = `/api/orgs/${encodeURIComponent(params.slug)}/marketing`;
      const [providersRes, jobsRes, creativesRes, campaignsRes] = await Promise.all([
        fetch(`${base}/providers`, { credentials: 'include' }),
        fetch(`${base}/jobs`, { credentials: 'include' }),
        fetch(`${base}/creatives`, { credentials: 'include' }),
        fetch(`${base}/campaigns`, { credentials: 'include' }),
      ]);
      if (!providersRes.ok || !jobsRes.ok || !creativesRes.ok || !campaignsRes.ok) {
        setLoadError('Could not load Marketing Studio — please retry.');
        return;
      }
      const [providersJson, jobsJson, creativesJson, campaignsJson] = await Promise.all([
        providersRes.json() as Promise<{
          providers: ApiProvider[];
          org: Overview['org'];
        }>,
        jobsRes.json() as Promise<{ jobs: ApiJob[] }>,
        creativesRes.json() as Promise<{ creatives: ApiCreative[] }>,
        campaignsRes.json() as Promise<{ campaigns: ApiCampaign[] }>,
      ]);
      setData({
        org: providersJson.org,
        providers: providersJson.providers,
        jobs: jobsJson.jobs,
        creatives: creativesJson.creatives,
        campaigns: campaignsJson.campaigns,
      });
    } catch {
      setLoadError('Could not load Marketing Studio — please retry.');
    }
  }, [params.slug]);

  useEffect(() => {
    // W3 fix: this used to gate on the fixture-keyed firstRunSnapshot, which
    // defaults ANY non-demo-seed slug to isFirstRun=true — silently skipping
    // this fetch for every real org and stranding it on a generic empty
    // state forever. Always attempt the real load; `isEmpty` below (driven
    // by actual API results) already renders the same honest empty state
    // when there's genuinely nothing yet.
    void load();
  }, [load]);

  if (loadError) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Marketing Studio">
        <div className="card card-pad text-center py-8 max-w-[1400px]">
          <div className="text-[13px] text-ink mb-2" role="alert">
            {loadError}
          </div>
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      </AccountShell>
    );
  }

  if (!data) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Marketing Studio">
        <div className="card card-pad text-center py-10 text-[12px] text-muted max-w-[1400px]">
          Loading Marketing Studio…
        </div>
      </AccountShell>
    );
  }

  const isEmpty =
    data.providers.length === 0 &&
    data.jobs.length === 0 &&
    data.creatives.length === 0 &&
    data.campaigns.length === 0;

  if (isEmpty) {
    return (
      <AccountShell
        accountSlug={params.slug}
        pageTitle={`Marketing Studio · ${data.org.tradingName}`}
      >
        <div className="space-y-5 max-w-[1400px]">
          <MarketingStudioEmpty slug={params.slug} accountName={data.org.tradingName} />
        </div>
      </AccountShell>
    );
  }

  const connected = data.providers.filter((p) => p.status === 'connected').length;
  const approvedCreatives = data.creatives.filter((c) => c.approvedAt !== null).length;
  const pendingCreatives = data.creatives.length - approvedCreatives;
  const scannedCreatives = data.creatives.filter(
    (c) => scanPassed(c.safetyScanResult) || scanFailed(c.safetyScanResult),
  );
  const passedCreatives = data.creatives.filter((c) => scanPassed(c.safetyScanResult));
  const safetyPassPct =
    scannedCreatives.length > 0 ? (passedCreatives.length / scannedCreatives.length) * 100 : null;
  const c2paCount = data.creatives.filter((c) => c.c2paManifestId !== null).length;
  const activeCampaigns = data.campaigns.filter((c) => c.status === 'active').length;
  const totalBudget = data.campaigns.reduce((s, c) => s + BigInt(c.budgetCents), 0n);
  const totalAiSpend = data.creatives.reduce((s, c) => s + BigInt(c.costCents), 0n);

  const jobCounts = JOB_STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = data.jobs.filter((j) => j.status === s).length;
    return acc;
  }, {});

  const recentCreatives = [...data.creatives]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);
  const recentCampaigns = [...data.campaigns]
    .sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''))
    .slice(0, 5);
  const pendingQueue = data.creatives.filter((c) => c.approvedAt === null).slice(0, 6);

  return (
    <AccountShell
      accountSlug={params.slug}
      pageTitle={`Marketing Studio · ${data.org.tradingName}`}
    >
      <div className="space-y-5 max-w-[1700px]">
        <MarketingStudioTabs slug={params.slug} active="overview" />

        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Sparkles size={14} className="text-accent" />
            <span>
              <span className="font-semibold">{data.org.tradingName}</span> · {data.org.regionCode}
              {data.org.vertical ? ` · ${data.org.vertical}` : ''}. Live counts from
              ContentGenerationJob, Creative, AdCampaign, and ProviderConnection.
            </span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            label="Creatives"
            value={data.creatives.length}
            hint={`${approvedCreatives} approved`}
          />
          <KpiCard
            label="Safety pass rate"
            value={safetyPassPct === null ? '—' : `${safetyPassPct.toFixed(1)}%`}
            hint={`of ${scannedCreatives.length} scanned`}
          />
          <KpiCard
            label="AI spend"
            value={<Money cents={totalAiSpend} region={data.org.regionCode} />}
          />
          <KpiCard
            label="Active campaigns"
            value={activeCampaigns}
            hint={`of ${data.campaigns.length}`}
          />
          <KpiCard
            label="Campaign budget"
            value={<Money cents={totalBudget} region={data.org.regionCode} />}
          />
          <KpiCard
            label="Providers connected"
            value={connected}
            hint={`of ${data.providers.length}`}
          />
        </div>

        <Section
          title="Generation pipeline · job status"
          subtitle="ContentGenerationJob rows for this account, by status"
          action={<DataSourceBadge source="live" />}
        >
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {JOB_STATUSES.map((status) => (
              <div key={status} className="card card-pad relative">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded bg-accentSoft text-accent flex items-center justify-center">
                    {status === 'ready' && <CheckCircle2 size={13} />}
                    {status === 'running' && <PlayCircle size={13} />}
                    {status === 'pending' && <Clock size={13} />}
                    {status === 'failed' && <XCircle size={13} />}
                    {status === 'cancelled' && <Ban size={13} />}
                  </span>
                  <div className="text-[11.5px] font-semibold uppercase tracking-wider text-muted">
                    {status}
                  </div>
                </div>
                <div className="text-[22px] font-semibold text-ink tracking-tight numeric">
                  {jobCounts[status] ?? 0}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <Section
              title={`Recent creatives · ${recentCreatives.length}`}
              subtitle="Newest first"
              paddedBody={false}
              action={
                <Link href={`/accounts/${params.slug}/marketing-studio/library`}>
                  <Button variant="ghost" size="sm">
                    Open library
                  </Button>
                </Link>
              }
            >
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Prompt</th>
                    <th>Type</th>
                    <th>Cost</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCreatives.map((c) => (
                    <tr key={c.id}>
                      <td className="text-[12.5px] text-ink leading-snug line-clamp-1">
                        {c.prompt ?? '—'}
                      </td>
                      <td className="text-[12px] text-muted capitalize">{c.type}</td>
                      <td className="text-[12px] text-ink">
                        <Money
                          cents={BigInt(c.costCents)}
                          region={data.org.regionCode}
                          emptyAsDash
                        />
                      </td>
                      <td>
                        {scanFailed(c.safetyScanResult) ? (
                          <StatusPill tone="danger">safety failed</StatusPill>
                        ) : c.approvedAt ? (
                          <StatusPill tone="success">approved</StatusPill>
                        ) : (
                          <StatusPill tone="muted">pending</StatusPill>
                        )}
                      </td>
                      <td className="text-[11px] text-muted">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {recentCreatives.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-[12.5px] text-muted py-8 text-center">
                        No creatives yet for this account.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Section>

            <Section
              title={`Recent campaigns · ${recentCampaigns.length}`}
              subtitle="Latest 5 by start date"
              paddedBody={false}
            >
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Provider</th>
                    <th>Budget</th>
                    <th>Status</th>
                    <th>Started</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCampaigns.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className="text-[12.5px] font-medium text-ink leading-snug">
                          {c.objective}
                        </div>
                        <div className="text-[10px] text-muted font-mono">{c.id}</div>
                      </td>
                      <td className="text-[12px] text-ink capitalize">{c.provider}</td>
                      <td className="text-[12px] text-ink">
                        <Money
                          cents={BigInt(c.budgetCents)}
                          region={data.org.regionCode}
                          emptyAsDash
                        />
                      </td>
                      <td>
                        <StatusPill tone={c.status === 'active' ? 'success' : 'muted'}>
                          {c.status}
                        </StatusPill>
                      </td>
                      <td className="text-[11.5px] text-muted numeric">
                        {c.startedAt ? new Date(c.startedAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                  {recentCampaigns.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-[12.5px] text-muted py-8 text-center">
                        No campaigns yet for this account.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Section>
          </div>

          <div className="space-y-5">
            <Section
              title="Approval queue"
              subtitle={`${pendingQueue.length} of ${pendingCreatives} pending creatives`}
              action={
                <Link href={`/accounts/${params.slug}/marketing-studio/library`}>
                  <Button variant="ghost" size="sm">
                    Review all
                  </Button>
                </Link>
              }
            >
              <ul className="space-y-2.5">
                {pendingQueue.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/accounts/${params.slug}/marketing-studio/library`}
                      className="flex items-start gap-2.5 p-2 rounded-md hover:bg-paper transition"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold text-ink leading-snug line-clamp-2">
                          {c.prompt ?? c.id}
                        </div>
                        <div className="text-[10.5px] text-muted mt-0.5 capitalize">{c.type}</div>
                      </div>
                    </Link>
                  </li>
                ))}
                {pendingQueue.length === 0 && (
                  <li className="text-[12px] text-muted text-center py-4">
                    Approval queue is clear.
                  </li>
                )}
              </ul>
            </Section>

            <Section title="Provenance & safety" subtitle="C2PA · moderation · approval">
              <div className="grid grid-cols-2 gap-3">
                <ProvCard
                  icon={<Activity size={14} className="text-accent" />}
                  label="Creatives"
                  value={data.creatives.length.toString()}
                />
                <ProvCard
                  icon={<ShieldCheck size={14} className="text-success" />}
                  label="Safety failed"
                  value={data.creatives
                    .filter((c) => scanFailed(c.safetyScanResult))
                    .length.toString()}
                />
                <ProvCard
                  icon={<FileCheck2 size={14} className="text-accent" />}
                  label="C2PA issued"
                  value={c2paCount.toString()}
                />
                <ProvCard
                  icon={<Plug size={14} className="text-accent" />}
                  label="Providers connected"
                  value={connected.toString()}
                />
              </div>
              <div className="mt-4">
                <Link href={`/accounts/${params.slug}/marketing-studio/integrations`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Megaphone size={12} />}
                    className="w-full"
                  >
                    Manage integrations
                  </Button>
                </Link>
              </div>
            </Section>
          </div>
        </div>
      </div>
    </AccountShell>
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
