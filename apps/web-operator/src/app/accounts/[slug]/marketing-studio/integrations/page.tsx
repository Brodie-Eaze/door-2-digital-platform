'use client';

/**
 * Per-account integrations — real ProviderConnection rows for this account.
 * "Calls today" / "cost today" are derived server-side from today's
 * ContentGenerationJob rows (the only place API usage is actually recorded)
 * — never invented. Connect/disconnect/mode-switch remain disclosed
 * placeholders (toast) until the OAuth/credential-vault write path ships;
 * this mirrors the same honest-deferral pattern used by the platform-level
 * marketing routes elsewhere in this app.
 *
 * Live wire: GET /api/orgs/[slug]/marketing/providers (resolveAccountOrg-scoped).
 */
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plug,
  Sparkles,
  Image as ImageIcon,
  Video,
  UserCircle,
  Megaphone,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Settings,
  XCircle,
  Lock,
} from 'lucide-react';
import { Banner, Button, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { MarketingStudioTabs } from '@/components/marketing-studio-tabs';
import { MarketingIntegrationsEmpty } from '@/components/AccountEmptyStates';
import { PROVIDER_LABEL } from '@/lib/marketing-taxonomy';
import { firstRunSnapshot } from '@/lib/first-run';
import { toast } from '@/components/Toaster';
import { DataSourceBadge } from '@/components/DataSourceBadge';

type Category = 'All' | 'Ads' | 'Copy' | 'Image' | 'Video' | 'Avatar' | 'Safety';

const CATEGORIES: Category[] = ['All', 'Ads', 'Copy', 'Image', 'Video', 'Avatar', 'Safety'];

const PROVIDER_CATEGORY: Record<string, Exclude<Category, 'All'>> = {
  meta_marketing: 'Ads',
  google_ads: 'Ads',
  tiktok_marketing: 'Ads',
  youtube: 'Ads',
  claude_copy: 'Copy',
  openai_copy: 'Copy',
  flux_image: 'Image',
  ideogram_image: 'Image',
  higgsfield_video: 'Video',
  runway_video: 'Video',
  heygen_avatar: 'Avatar',
  anthropic_mod: 'Safety',
};

const PROVIDER_DOCS: Record<string, string> = {
  meta_marketing: 'https://developers.facebook.com/docs/marketing-apis',
  google_ads: 'https://developers.google.com/google-ads/api/docs/start',
  tiktok_marketing: 'https://business-api.tiktok.com/portal/docs',
  youtube: 'https://developers.google.com/youtube',
  claude_copy: 'https://docs.anthropic.com',
  openai_copy: 'https://platform.openai.com/docs',
  flux_image: 'https://replicate.com/black-forest-labs/flux-1.1-pro',
  ideogram_image: 'https://developer.ideogram.ai',
  higgsfield_video: 'https://docs.higgsfield.ai',
  runway_video: 'https://docs.dev.runwayml.com',
  heygen_avatar: 'https://docs.heygen.com',
  anthropic_mod: 'https://docs.anthropic.com/en/docs/build-with-claude/safety',
};

interface ApiProvider {
  id: string;
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
  callsToday: number;
  costCentsToday: string;
}

function statusTone(s: string): 'success' | 'info' | 'muted' | 'danger' {
  switch (s) {
    case 'connected':
      return 'success';
    case 'error':
      return 'danger';
    case 'disconnected':
      return 'muted';
    default:
      return 'info';
  }
}

function categoryIcon(c: Exclude<Category, 'All'>): typeof Sparkles {
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
    case 'Safety':
      return Lock;
  }
}

export default function Page({
  params: paramsPromise,
}: {
  params: Promise<{ slug: string }>;
}): JSX.Element {
  const params = use(paramsPromise);
  const firstRun = firstRunSnapshot(params.slug);
  const [providers, setProviders] = useState<ApiProvider[] | null>(null);
  const [region, setRegion] = useState<'AU' | 'US' | 'SG'>('US');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Category>('All');
  const [modalId, setModalId] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoadError(null);
    try {
      const res = await fetch(`/api/orgs/${encodeURIComponent(params.slug)}/marketing/providers`, {
        credentials: 'include',
      });
      if (!res.ok) {
        setLoadError('Could not load providers — please retry.');
        setProviders([]);
        return;
      }
      const json = (await res.json()) as {
        providers: ApiProvider[];
        org?: { regionCode?: 'AU' | 'US' | 'SG' };
      };
      setProviders(json.providers);
      if (json.org?.regionCode) setRegion(json.org.regionCode);
    } catch {
      setLoadError('Could not load providers — please retry.');
      setProviders([]);
    }
  }, [params.slug]);

  useEffect(() => {
    // W3 fix: no longer gated on the fixture-keyed firstRunSnapshot — see
    // brand-safety/page.tsx for the full rationale. Real "empty" is decided
    // below from `rows.length === 0` (the actual API result).
    void load();
  }, [load]);

  const rows = providers ?? [];
  const visible = useMemo(() => {
    if (filter === 'All') return rows;
    return rows.filter((p) => PROVIDER_CATEGORY[p.kind] === filter);
  }, [rows, filter]);

  const connected = rows.filter((p) => p.status === 'connected').length;
  const errors = rows.filter((p) => p.status === 'error').length;
  const callsToday = rows.reduce((s, p) => s + p.callsToday, 0);
  const costCentsToday = rows.reduce((s, p) => s + BigInt(p.costCentsToday), 0n);
  const modalProvider = modalId ? rows.find((p) => p.id === modalId) : null;

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Marketing Studio · Integrations">
      <div className="space-y-5 max-w-[1700px]">
        <MarketingStudioTabs slug={params.slug} active="integrations" />

        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Plug size={14} className="text-accent" />
            <span>
              {rows.length} provider{rows.length === 1 ? '' : 's'} configured for this account.
              Credentials are stored encrypted in the PII vault, scoped per-account.
            </span>
          </span>
        </Banner>

        {loadError ? (
          <div className="card card-pad text-center py-8">
            <div className="text-[13px] text-ink mb-2" role="alert">
              {loadError}
            </div>
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : providers === null ? (
          <div className="card card-pad text-center py-10 text-[12px] text-muted">
            Loading providers…
          </div>
        ) : rows.length === 0 ? (
          <MarketingIntegrationsEmpty
            slug={params.slug}
            accountName={firstRun.accountName}
            placement="page"
          />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Connected" value={connected} hint={`of ${rows.length} configured`} />
              <KpiCard
                label="Errors"
                value={errors}
                deltaTone={errors > 0 ? 'negative' : 'positive'}
              />
              <KpiCard label="API calls · today" value={callsToday.toLocaleString()} />
              <KpiCard
                label="Provider spend · today"
                value={<Money cents={costCentsToday} region={region} emptyAsDash />}
              />
            </div>

            <Section
              title="Providers"
              subtitle="One card per adapter connected for this account"
              action={
                <div className="flex items-center gap-1.5 flex-wrap">
                  <DataSourceBadge source="live" className="mr-1" />
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFilter(c)}
                      className={
                        filter === c
                          ? 'text-[10.5px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-ink text-surface transition'
                          : 'text-[10.5px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full text-muted hover:text-ink transition border border-line2'
                      }
                      aria-pressed={filter === c}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              }
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {visible.map((p) => (
                  <ProviderTile
                    key={p.id}
                    provider={p}
                    region={region}
                    onOpen={() => setModalId(p.id)}
                  />
                ))}
              </div>
              {visible.length === 0 && (
                <div className="text-center text-muted py-12 text-[12.5px]">
                  No providers match this filter.
                </div>
              )}
            </Section>
          </>
        )}
      </div>

      {modalProvider && <ConnectModal provider={modalProvider} onClose={() => setModalId(null)} />}
    </AccountShell>
  );
}

function ProviderTile({
  provider,
  region,
  onOpen,
}: {
  provider: ApiProvider;
  region: 'AU' | 'US' | 'SG';
  onOpen: () => void;
}): JSX.Element {
  const cat = PROVIDER_CATEGORY[provider.kind] ?? 'Ads';
  const Icon = categoryIcon(cat);
  const label = PROVIDER_LABEL[provider.kind] ?? provider.kind;
  return (
    <div className="card overflow-hidden hover:ring-1 hover:ring-accent transition flex flex-col">
      <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-line2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-accentSoft text-accent flex items-center justify-center shrink-0">
            <Icon size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-ink leading-tight truncate">{label}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted font-medium">
              {cat} · {provider.mode}
            </div>
          </div>
        </div>
        <StatusPill tone={statusTone(provider.status)}>{provider.status}</StatusPill>
      </div>
      <div className="p-3 space-y-2.5">
        <div className="text-[11px] text-muted">
          <span className="text-ink font-medium">Account · </span>
          {provider.accountLabel ?? '—'}
        </div>
        <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-line2">
          <Mini label="Calls · today" value={provider.callsToday.toString()} />
          <Mini
            label="Cost · today"
            value={<Money cents={BigInt(provider.costCentsToday)} region={region} emptyAsDash />}
          />
          <Mini
            label="Last ping"
            value={provider.lastPingAt ? new Date(provider.lastPingAt).toLocaleDateString() : '—'}
          />
        </div>
        {provider.status === 'error' && provider.lastPingError && (
          <div className="flex items-center gap-1.5 text-[10.5px] text-danger bg-dangerSoft px-2 py-1 rounded">
            <AlertTriangle size={11} /> {provider.lastPingError}
          </div>
        )}
        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" variant="secondary" onClick={onOpen}>
            <Settings size={11} /> Manage
          </Button>
          <a
            href={PROVIDER_DOCS[provider.kind] ?? '#'}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-muted hover:text-ink inline-flex items-center gap-1 transition"
          >
            Docs
            <ExternalLink size={10} />
          </a>
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: React.ReactNode }): JSX.Element {
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-wider text-muted">{label}</div>
      <div className="text-[11.5px] font-semibold text-ink numeric truncate">{value}</div>
    </div>
  );
}

function ConnectModal({
  provider,
  onClose,
}: {
  provider: ApiProvider;
  onClose: () => void;
}): JSX.Element {
  const label = PROVIDER_LABEL[provider.kind] ?? provider.kind;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card w-[480px] max-w-[92vw] max-h-[88vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-line2">
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-ink truncate">{label}</div>
            <div className="text-[10px] text-muted uppercase tracking-wider truncate">
              {provider.kind} · {provider.accountLabel ?? 'no account label'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-md text-muted hover:text-ink hover:bg-paper flex items-center justify-center shrink-0"
            aria-label="Close"
          >
            <XCircle size={18} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-muted mb-1">Status</div>
            <StatusPill tone={statusTone(provider.status)}>{provider.status}</StatusPill>
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-muted mb-1">Mode</div>
            <div className="text-[12px] text-ink capitalize">{provider.mode}</div>
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-muted mb-1">Connected</div>
            <div className="text-[12px] text-ink">
              {new Date(provider.connectedAt).toLocaleString()}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-line2">
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                toast.info(`${label}: credential rotation isn't wired yet — no change was made.`);
                onClose();
              }}
            >
              <CheckCircle2 size={11} />
              Rotate credentials
            </Button>
            <Button size="sm" variant="secondary" onClick={onClose}>
              Close
            </Button>
            <button
              type="button"
              className="text-[11px] text-danger ml-auto hover:underline"
              onClick={() => {
                toast.info(`${label}: disconnect isn't wired yet — no change was made.`);
                onClose();
              }}
            >
              Disconnect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
