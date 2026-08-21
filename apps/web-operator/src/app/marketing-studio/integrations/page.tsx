'use client';

/**
 * AI Marketing Studio — Integrations.
 *
 * Every card, webhook row, and outbound-job row below is live from Prisma:
 *   - Providers        `ProviderConnection` rows (credentialsVault and
 *                       webhookSecretHash are never shipped to the browser —
 *                       the BFF route strips them before responding).
 *   - Webhook receivers `ProviderWebhookEvent` rows (payloadJson is stripped
 *                       server-side — inbound bodies can carry lead PII).
 *   - Outbound jobs     `ContentGenerationJob` rows — every dispatched call to
 *                       a provider adapter persists one of these.
 *
 * Category/gradient/initials per provider `kind` are a static display map
 * (not data) — the same fixed set of adapter kinds the registry ships with.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plug,
  Sparkles,
  ImageIcon,
  Video,
  UserCircle,
  Megaphone,
  CheckCircle2,
  XCircle,
  Filter,
  Plus,
  Settings,
  Webhook,
  Send,
  Lock,
  RefreshCw,
} from 'lucide-react';
import {
  Banner,
  Button,
  FilterChip,
  FilterChipStrip,
  KpiCard,
  Section,
  StatusPill,
} from '@d2d/ui-web';
import { PROVIDER_CONN_LABEL, PROVIDER_CONN_TONE } from '@d2d/ui-tokens/taxonomy';
import { PlatformShell } from '@/components/PlatformShell';
import { MarketingStudioTabs } from '@/components/marketing-studio-tabs';
import { DataSourceBadge, useDataFreshness } from '@/components/DataSourceBadge';
import { toast } from '@/components/Toaster';
import { IntegrationsEmpty } from '@/components/MarketingEmptyStates';

type CategoryFilter = 'All' | 'Ads' | 'Copy' | 'Image' | 'Video' | 'Avatar' | 'Protocol' | 'Other';
type ConnectionStatus = 'connected' | 'sandbox' | 'not_connected' | 'error' | 'disconnected';

interface ProviderRow {
  id: string;
  orgId: string;
  account: string;
  kind: string;
  displayName: string;
  mode: string;
  status: string;
  accountLabel: string | null;
  accountId: string | null;
  lastPingAt: string | null;
  lastPingStatus: string | null;
  lastPingError: string | null;
  connectedAt: string;
  disconnectedAt: string | null;
}

interface WebhookEventRow {
  id: string;
  account: string;
  providerKind: string;
  eventType: string;
  externalId: string;
  occurredAt: string;
  verifiedSignature: boolean;
  receivedAt: string;
}

interface JobRow {
  id: string;
  account: string;
  providerKind: string;
  capability: string;
  status: string;
  costCents: string;
  createdAt: string;
  completedAt: string | null;
}

const KIND_CATEGORY: Record<string, Exclude<CategoryFilter, 'All'>> = {
  meta_marketing: 'Ads',
  google_ads: 'Ads',
  tiktok_marketing: 'Ads',
  meta_mcp: 'Protocol',
  claude_copy: 'Copy',
  openai_copy: 'Copy',
  flux_image: 'Image',
  ideogram_image: 'Image',
  runway_video: 'Video',
  higgsfield: 'Video',
  heygen_avatar: 'Avatar',
};

const KIND_GRADIENT: Record<string, string> = {
  meta_marketing: 'from-blue-600 to-indigo-700',
  meta_mcp: 'from-violet-600 to-purple-700',
  google_ads: 'from-emerald-600 to-teal-700',
  tiktok_marketing: 'from-pink-600 to-rose-700',
  higgsfield: 'from-amber-600 to-orange-700',
  claude_copy: 'from-orange-500 to-red-600',
  openai_copy: 'from-slate-700 to-slate-900',
  flux_image: 'from-cyan-600 to-blue-700',
  ideogram_image: 'from-fuchsia-600 to-pink-700',
  runway_video: 'from-zinc-600 to-zinc-800',
  heygen_avatar: 'from-green-600 to-emerald-700',
};

function categoryFor(kind: string): Exclude<CategoryFilter, 'All'> {
  return KIND_CATEGORY[kind] ?? 'Other';
}

function gradientFor(kind: string): string {
  return KIND_GRADIENT[kind] ?? 'from-slate-600 to-slate-800';
}

function initialsFor(displayName: string): string {
  const words = displayName.trim().split(/\s+/).slice(0, 2);
  return words.map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
}

function categoryIcon(c: Exclude<CategoryFilter, 'All'>): typeof Sparkles {
  switch (c) {
    case 'Copy':
      return Sparkles;
    case 'Image':
      return ImageIcon;
    case 'Video':
      return Video;
    case 'Avatar':
      return UserCircle;
    case 'Ads':
      return Megaphone;
    case 'Protocol':
      return Plug;
    case 'Other':
      return Settings;
  }
}

const CATEGORY_FILTERS: CategoryFilter[] = [
  'All',
  'Ads',
  'Copy',
  'Image',
  'Video',
  'Avatar',
  'Protocol',
  'Other',
];

export default function IntegrationsPage(): JSX.Element {
  const { source, updatedAt, markFresh } = useDataFreshness('live');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [events, setEvents] = useState<WebhookEventRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [filter, setFilter] = useState<CategoryFilter>('All');
  const [modalId, setModalId] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [providersRes, eventsRes, jobsRes] = await Promise.all([
        fetch('/api/marketing/providers', { method: 'GET' }),
        fetch('/api/marketing/webhook-events', { method: 'GET' }),
        fetch('/api/marketing/jobs', { method: 'GET' }),
      ]);
      if (!providersRes.ok || !eventsRes.ok || !jobsRes.ok) {
        throw new Error('One or more integration endpoints returned a non-2xx status');
      }
      const providersData = (await providersRes.json()) as { providers?: ProviderRow[] };
      const eventsData = (await eventsRes.json()) as { events?: WebhookEventRow[] };
      const jobsData = (await jobsRes.json()) as { jobs?: JobRow[] };
      setProviders(Array.isArray(providersData.providers) ? providersData.providers : []);
      setEvents(Array.isArray(eventsData.events) ? eventsData.events : []);
      setJobs(Array.isArray(jobsData.jobs) ? jobsData.jobs : []);
      setLoadError(null);
      markFresh();
    } catch (err) {
      console.error('[integrations] fetch failed:', err);
      setLoadError('Could not load integration data — try refreshing.');
    } finally {
      setLoading(false);
    }
  }, [markFresh]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    if (filter === 'All') return providers;
    return providers.filter((p) => categoryFor(p.kind) === filter);
  }, [providers, filter]);

  const stats = useMemo(() => {
    const connected = providers.filter((p) => p.status === 'connected').length;
    const sandbox = providers.filter((p) => p.status === 'sandbox').length;
    const error = providers.filter((p) => p.status === 'error').length;
    const costCentsToday = jobs
      .filter((j) => new Date(j.createdAt).toDateString() === new Date().toDateString())
      .reduce((sum, j) => sum + BigInt(j.costCents || '0'), 0n);
    const callsToday = jobs.filter(
      (j) => new Date(j.createdAt).toDateString() === new Date().toDateString(),
    ).length;
    return { connected, sandbox, error, callsToday, costCentsToday };
  }, [providers, jobs]);

  const modalProvider = modalId ? (providers.find((p) => p.id === modalId) ?? null) : null;

  return (
    <PlatformShell pageTitle="AI Marketing Studio — Integrations">
      <div className="space-y-5 max-w-[1700px]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <MarketingStudioTabs active="integrations" />
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
            <span className="text-[13px]">{loadError}</span>
          </Banner>
        )}

        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Plug size={14} className="text-accent" />
            <span>
              Every provider plugged into the Marketing Studio lives behind a{' '}
              <span className="font-semibold">ProviderAdapter</span> contract from{' '}
              <span className="mono">@d2d/integrations</span>. This page reads the real connection,
              webhook, and job tables — connect a new provider from any account&apos;s Integrations
              tab to see it here.
            </span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard
            label="Providers connected"
            value={stats.connected}
            hint={`of ${providers.length} registered`}
          />
          <KpiCard label="In sandbox" value={stats.sandbox} hint="awaiting real keys" />
          <KpiCard
            label="Errors"
            value={stats.error}
            deltaTone={stats.error > 0 ? 'negative' : 'positive'}
          />
          <KpiCard label="Jobs · today" value={stats.callsToday} hint="outbound to providers" />
          <KpiCard
            label="Provider spend · today"
            value={`$${(Number(stats.costCentsToday) / 100).toFixed(2)}`}
          />
        </div>

        <Section
          title="Providers"
          subtitle="One card per ProviderConnection row · filter by category"
          action={
            <FilterChipStrip>
              {CATEGORY_FILTERS.map((c) => (
                <FilterChip key={c} active={filter === c} onClick={() => setFilter(c)}>
                  {c}
                </FilterChip>
              ))}
            </FilterChipStrip>
          }
        >
          {loading ? (
            <div className="text-center py-12 text-[12.5px] text-muted">Loading…</div>
          ) : providers.length === 0 ? (
            <IntegrationsEmpty />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {visible.map((p) => (
                  <ProviderTile key={p.id} provider={p} onOpen={() => setModalId(p.id)} />
                ))}
              </div>
              {visible.length === 0 && (
                <div className="text-center text-muted py-12">
                  <Filter size={20} className="inline mr-2" />
                  No providers match this filter.
                </div>
              )}
            </>
          )}
        </Section>

        <Section
          title="Webhook receivers"
          subtitle="Last 50 inbound events · HMAC-verified before persistence"
          paddedBody={false}
          action={
            <div className="flex items-center gap-2 text-[11px] text-muted">
              <Lock size={11} className="text-success" />
              <span>signature verified server-side before ProviderWebhookEvent is written</span>
            </div>
          }
        >
          {loading ? (
            <div className="text-center py-8 text-[12.5px] text-muted">Loading…</div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-[12.5px] text-muted">
              No inbound webhook events recorded yet.
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Event id</th>
                  <th>Account</th>
                  <th>Provider</th>
                  <th>Type</th>
                  <th>Signature</th>
                  <th>Received</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <span className="mono text-[10px] !w-auto !px-2">{e.id}</span>
                    </td>
                    <td className="text-[12px] text-ink">{e.account}</td>
                    <td className="text-[12px] text-ink">{e.providerKind}</td>
                    <td className="text-[12px] text-muted font-mono">{e.eventType}</td>
                    <td>
                      {e.verifiedSignature ? (
                        <span className="inline-flex items-center gap-1 text-success text-[11px]">
                          <CheckCircle2 size={12} /> valid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-danger text-[11px]">
                          <XCircle size={12} /> rejected
                        </span>
                      )}
                    </td>
                    <td className="text-[11px] text-muted numeric">
                      {new Date(e.receivedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section
          title="Outbound jobs"
          subtitle="Last 100 dispatched calls · every ContentGenerationJob row"
          paddedBody={false}
          action={
            <div className="flex items-center gap-2 text-[11px] text-muted">
              <Send size={11} className="text-accent" />
              <span>via app.integrations.get(kind).dispatch()</span>
            </div>
          }
        >
          {loading ? (
            <div className="text-center py-8 text-[12.5px] text-muted">Loading…</div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-8 text-[12.5px] text-muted">
              No outbound jobs dispatched yet.
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Account</th>
                  <th>Provider</th>
                  <th>Capability</th>
                  <th>Cost</th>
                  <th>Status</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {jobs.slice(0, 25).map((j) => (
                  <tr key={j.id}>
                    <td>
                      <span className="mono text-[10px] !w-auto !px-2">{j.id}</span>
                    </td>
                    <td className="text-[12px] text-ink">{j.account}</td>
                    <td className="text-[12px] text-ink">{j.providerKind}</td>
                    <td className="text-[12px] text-muted mono">{j.capability}</td>
                    <td className="text-[12px] text-muted numeric">
                      {j.costCents === '0'
                        ? '—'
                        : `$${(Number(BigInt(j.costCents)) / 100).toFixed(2)}`}
                    </td>
                    <td>
                      <StatusPill
                        tone={
                          j.status === 'ready'
                            ? 'success'
                            : j.status === 'failed'
                              ? 'danger'
                              : j.status === 'running'
                                ? 'info'
                                : 'muted'
                        }
                      >
                        {j.status}
                      </StatusPill>
                    </td>
                    <td className="text-[11px] text-muted numeric">
                      {new Date(j.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section
          title="Plug-in architecture · how it works"
          subtitle="Every provider is a single TypeScript adapter file"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ArchCard
              icon={<Plug size={14} className="text-accent" />}
              title="ProviderAdapter contract"
              detail="Each adapter implements ping, optional generate*/buildAudience/deliverCampaign, and a parseWebhook for inbound events."
            />
            <ArchCard
              icon={<Settings size={14} className="text-accent" />}
              title="IntegrationRegistry"
              detail="Single lookup table decorated onto Fastify — app.integrations.get(kind). Stateless adapters, per-call config from the PII vault."
            />
            <ArchCard
              icon={<Webhook size={14} className="text-accent" />}
              title="Webhook receivers"
              detail="POST /v1/marketing/webhooks/:kind verifies HMAC via adapter.parseWebhook then persists a ProviderWebhookEvent row."
            />
          </div>
        </Section>
      </div>

      {modalProvider && <ConnectModal provider={modalProvider} onClose={() => setModalId(null)} />}
    </PlatformShell>
  );
}

function ProviderTile({
  provider,
  onOpen,
}: {
  provider: ProviderRow;
  onOpen: () => void;
}): JSX.Element {
  const category = categoryFor(provider.kind);
  const Icon = categoryIcon(category);
  const gradient = gradientFor(provider.kind);
  const status = provider.status as ConnectionStatus;
  const tone = PROVIDER_CONN_TONE[status as keyof typeof PROVIDER_CONN_TONE] ?? 'muted';
  const label = PROVIDER_CONN_LABEL[status as keyof typeof PROVIDER_CONN_LABEL] ?? provider.status;

  return (
    <div className="card overflow-hidden hover:ring-1 hover:ring-accent transition flex flex-col">
      <div className="relative">
        <div className={`h-1 bg-gradient-to-r ${gradient}`} />
        <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-line2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center font-bold text-[13px] text-white shrink-0`}
              aria-hidden
            >
              {initialsFor(provider.displayName)}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-ink leading-tight truncate">
                {provider.displayName}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <Icon size={10} className="text-soft" />
                <span className="text-[10px] uppercase tracking-wider text-muted font-medium">
                  {category} · {provider.account}
                </span>
              </div>
            </div>
          </div>
          <StatusPill tone={tone}>{label}</StatusPill>
        </div>
      </div>
      <div className="p-3 space-y-2.5">
        <div className="text-[11px] text-muted">
          <span className="text-ink font-medium">Account · </span>
          {provider.accountLabel ?? '—'}
        </div>
        <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-line2">
          <Mini label="Mode" value={provider.mode} />
          <Mini
            label="Last ping"
            value={provider.lastPingAt ? new Date(provider.lastPingAt).toLocaleTimeString() : '—'}
          />
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant={provider.status === 'not_connected' ? 'primary' : 'secondary'}
            onClick={onOpen}
          >
            {provider.status === 'not_connected' ? (
              <>
                <Plus size={11} /> Connect
              </>
            ) : (
              <>
                <Settings size={11} /> Manage
              </>
            )}
          </Button>
        </div>
        {provider.status === 'error' && provider.lastPingError && (
          <div className="text-[10.5px] text-danger">{provider.lastPingError}</div>
        )}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-wider text-muted">{label}</div>
      <div className="text-[11.5px] font-semibold text-ink numeric truncate">{value}</div>
    </div>
  );
}

function ArchCard({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}): JSX.Element {
  return (
    <div className="border border-line2 rounded-lg p-3.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <div className="text-[12.5px] font-semibold text-ink">{title}</div>
      </div>
      <div className="text-[11.5px] text-muted leading-snug">{detail}</div>
    </div>
  );
}

function ConnectModal({
  provider,
  onClose,
}: {
  provider: ProviderRow;
  onClose: () => void;
}): JSX.Element {
  const gradient = gradientFor(provider.kind);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card w-[520px] max-w-[92vw] max-h-[88vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <div className={`h-1 bg-gradient-to-r ${gradient}`} />
          <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-line2">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center font-bold text-[13px] text-white shrink-0`}
                aria-hidden
              >
                {initialsFor(provider.displayName)}
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-ink truncate">
                  {provider.displayName}
                </div>
                <div className="text-[10px] text-muted uppercase tracking-wider truncate">
                  {provider.kind} · {provider.account}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-md text-muted hover:text-ink hover:bg-paper flex items-center justify-center shrink-0"
              aria-label="Close"
            >
              <XCircle size={18} />
            </button>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-muted mb-1">Status</div>
            <StatusPill
              tone={
                PROVIDER_CONN_TONE[provider.status as keyof typeof PROVIDER_CONN_TONE] ?? 'muted'
              }
            >
              {PROVIDER_CONN_LABEL[provider.status as keyof typeof PROVIDER_CONN_LABEL] ??
                provider.status}
            </StatusPill>
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-muted mb-1">Mode</div>
            <div className="text-[12px] text-ink capitalize">{provider.mode}</div>
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-muted mb-1">
              Credentials
            </div>
            <input
              type="text"
              placeholder="API key / OAuth token"
              className="w-full text-[12px] px-3 py-2 rounded border border-line2 bg-paper mono"
              disabled
              value=""
            />
            <div className="text-[10.5px] text-muted mt-1 leading-snug">
              Credentials are stored encrypted in the PII vault per-org. The registry only loads
              them at dispatch time — never persisted in the API process, and never sent to this
              browser.
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-line2">
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                toast.info(
                  `${provider.displayName} connect/save — OAuth credential flow lands in Phase 1.2`,
                );
                onClose();
              }}
            >
              <CheckCircle2 size={11} />
              {provider.status === 'not_connected' ? 'Connect' : 'Save'}
            </Button>
            <Button size="sm" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
