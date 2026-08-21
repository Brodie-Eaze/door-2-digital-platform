'use client';

import { use, useMemo, useState } from 'react';
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
  Plus,
  Settings,
  XCircle,
  Lock,
  Activity,
} from 'lucide-react';
import { Banner, Button, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { MarketingStudioTabs } from '@/components/marketing-studio-tabs';
import { MarketingIntegrationsEmpty, FirstRunBanner } from '@/components/AccountEmptyStates';
import { getAccount } from '@/lib/accounts';
import { firstRunSnapshot } from '@/lib/first-run';
import {
  getAccountMarketing,
  PROVIDER_LABEL,
  PROVIDER_INITIALS,
  PROVIDER_GRADIENT,
  type ScopedProvider,
} from '@/lib/account-marketing';
import { toast } from '@/components/Toaster';
import { DataSourceBadge } from '@/components/DataSourceBadge';

/**
 * Per-account integrations — provider cards filtered to this account's
 * stack. Hope Forward has no TikTok (charity brand restriction), Gold
 * Coast Hospital has no video gen yet (capacity), PestMax has TikTok
 * enabled, etc.
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

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

function statusTone(s: ScopedProvider['status']): 'success' | 'info' | 'muted' | 'danger' {
  switch (s) {
    case 'connected':
      return 'success';
    case 'sandbox':
      return 'info';
    case 'not_connected':
      return 'muted';
    case 'error':
      return 'danger';
  }
}

function statusLabel(s: ScopedProvider['status']): string {
  switch (s) {
    case 'connected':
      return 'Connected';
    case 'sandbox':
      return 'Sandbox';
    case 'not_connected':
      return 'Not connected';
    case 'error':
      return 'Error';
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

export default function Page({ params: paramsPromise }: PageProps): JSX.Element {
  const params = use(paramsPromise);
  const account = getAccount(params.slug);
  const data = getAccountMarketing(params.slug);
  const [filter, setFilter] = useState<Category>('All');
  const [modalKind, setModalKind] = useState<string | null>(null);

  const visible = useMemo(() => {
    if (!data) return [];
    if (filter === 'All') return data.providers;
    return data.providers.filter((p) => PROVIDER_CATEGORY[p.kind] === filter);
  }, [data, filter]);

  const firstRun = firstRunSnapshot(params.slug);
  if (!account || !data || firstRun.isFirstRun) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Marketing Studio · Integrations">
        <div className="space-y-5 max-w-[1400px]">
          {firstRun.isFirstRun && (
            <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          )}
          <MarketingIntegrationsEmpty slug={params.slug} accountName={firstRun.accountName} />
        </div>
      </AccountShell>
    );
  }

  const connected = data.providers.filter((p) => p.status === 'connected').length;
  const sandbox = data.providers.filter((p) => p.status === 'sandbox').length;
  const errors = data.providers.filter((p) => p.status === 'error').length;
  const callsToday = data.providers.reduce((s, p) => s + p.callsToday, 0);
  const costCentsToday = data.providers.reduce((s, p) => s + p.costCentsToday, 0);

  const modalProvider = modalKind ? data.providers.find((p) => p.kind === modalKind) : null;

  return (
    <AccountShell
      accountSlug={params.slug}
      pageTitle={`Marketing Studio · ${account.shortName} · Integrations`}
    >
      <div className="space-y-5 max-w-[1700px]">
        <MarketingStudioTabs slug={params.slug} active="integrations" />

        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Plug size={14} className="text-accent" />
            <span>
              <span className="font-semibold">{data.scopeLabel}</span> integration stack —{' '}
              {data.providers.length} providers configured for this account. Connect new ones below;
              every adapter is per-account, so no cross-account credential leakage.
            </span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard
            label="Connected"
            value={connected.toString()}
            hint={`of ${data.providers.length} configured`}
          />
          <KpiCard label="Sandbox" value={sandbox.toString()} hint="awaiting real keys" />
          <KpiCard
            label="Errors"
            value={errors.toString()}
            deltaTone={errors > 0 ? 'negative' : 'positive'}
            hint="last 24h"
          />
          <KpiCard
            label="API calls · today"
            value={callsToday.toLocaleString()}
            hint="this account only"
          />
          <KpiCard
            label="Provider spend · today"
            value={`$${(costCentsToday / 100).toFixed(2)}`}
            hint="aggregate adapter costs"
          />
        </div>

        <Section
          title="Providers"
          subtitle={`One card per adapter active for ${account.shortName}`}
          action={
            <div className="flex items-center gap-1.5 flex-wrap">
              <DataSourceBadge source="fixture" className="mr-1" />
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
              <ProviderTile key={p.kind} provider={p} onOpen={() => setModalKind(p.kind)} />
            ))}
          </div>
          {visible.length === 0 && (
            <div className="text-center text-muted py-12 text-[12.5px]">
              No providers match this filter for {account.shortName}.
            </div>
          )}
        </Section>

        <Section
          title="Plug-in architecture · how it works"
          subtitle="Adapter pattern · same contracts across every account"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ArchCard
              icon={<Plug size={14} className="text-accent" />}
              title="Per-account adapter config"
              detail={`${account.shortName}'s credentials are stored encrypted in the PII vault, scoped to this account only. No cross-account leakage.`}
            />
            <ArchCard
              icon={<Settings size={14} className="text-accent" />}
              title="Capability filtering"
              detail={`This account runs ${data.channels.length} channels. Providers outside that set are hidden from the generator + library by default.`}
            />
            <ArchCard
              icon={<Activity size={14} className="text-accent" />}
              title="Per-account spend tracking"
              detail={`AI spend is rolled up to ${account.shortName}'s ledger separately from other accounts — Brodie sees per-org bills, not blended.`}
            />
          </div>
        </Section>
      </div>

      {modalProvider && (
        <ConnectModal
          provider={modalProvider}
          accountShort={account.shortName}
          onClose={() => setModalKind(null)}
        />
      )}
    </AccountShell>
  );
}

function ProviderTile({
  provider,
  onOpen,
}: {
  provider: ScopedProvider;
  onOpen: () => void;
}): JSX.Element {
  const cat = PROVIDER_CATEGORY[provider.kind] ?? 'Ads';
  const Icon = categoryIcon(cat);
  const gradient = PROVIDER_GRADIENT[provider.kind] ?? 'from-slate-700 to-slate-900';
  const initials = PROVIDER_INITIALS[provider.kind] ?? '??';
  const label = PROVIDER_LABEL[provider.kind] ?? provider.kind;
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
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-ink leading-tight truncate">
                {label}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <Icon size={10} className="text-soft" />
                <span className="text-[10px] uppercase tracking-wider text-muted font-medium">
                  {cat}
                </span>
              </div>
            </div>
          </div>
          <StatusPill tone={statusTone(provider.status)}>{statusLabel(provider.status)}</StatusPill>
        </div>
      </div>
      <div className="p-3 space-y-2.5">
        <div className="text-[11px] text-muted">
          <span className="text-ink font-medium">Account · </span>
          {provider.accountLabel}
        </div>
        <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-line2">
          <Mini label="Calls · today" value={provider.callsToday.toString()} />
          <Mini
            label="Cost · today"
            value={
              provider.costCentsToday === 0 ? '—' : `$${(provider.costCentsToday / 100).toFixed(2)}`
            }
          />
          <Mini
            label="Last ping"
            value={provider.lastPingAt === '—' ? '—' : provider.lastPingAt.slice(-9)}
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
  accountShort,
  onClose,
}: {
  provider: ScopedProvider;
  accountShort: string;
  onClose: () => void;
}): JSX.Element {
  const gradient = PROVIDER_GRADIENT[provider.kind] ?? 'from-slate-700 to-slate-900';
  const initials = PROVIDER_INITIALS[provider.kind] ?? '??';
  const label = PROVIDER_LABEL[provider.kind] ?? provider.kind;
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
                {initials}
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-ink truncate">{label}</div>
                <div className="text-[10px] text-muted uppercase tracking-wider truncate">
                  {accountShort} · {provider.kind}
                </div>
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
        </div>
        <div className="p-4 space-y-3">
          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-muted mb-1">Account</div>
            <div className="text-[12px] font-mono text-ink bg-paper border border-line2 rounded px-2.5 py-1.5">
              {provider.accountLabel}
            </div>
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-muted mb-1">Mode</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toast.info(`${label}: mode switch needs a live adapter — Phase 1.2`)}
                className={
                  provider.status === 'sandbox'
                    ? 'text-[11px] font-medium px-3 py-1.5 rounded-full bg-accent text-surface'
                    : 'text-[11px] font-medium px-3 py-1.5 rounded-full text-muted border border-line2 hover:text-ink'
                }
              >
                Sandbox
              </button>
              <button
                type="button"
                onClick={() => toast.info(`${label}: mode switch needs a live adapter — Phase 1.2`)}
                className={
                  provider.status === 'connected'
                    ? 'text-[11px] font-medium px-3 py-1.5 rounded-full bg-accent text-surface'
                    : 'text-[11px] font-medium px-3 py-1.5 rounded-full text-muted border border-line2 hover:text-ink'
                }
              >
                Production
              </button>
            </div>
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
              Credentials are stored encrypted in the PII vault scoped to {accountShort}. The
              registry loads them at dispatch time — never persisted in process memory.
            </div>
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-muted mb-1">
              Webhook URL
            </div>
            <div className="text-[11px] mono text-ink bg-paper border border-line2 rounded px-2.5 py-1.5">
              {`https://api.d2d.io/v1/marketing/webhooks/${provider.kind}?account=${accountShort
                .toLowerCase()
                .replace(/\s+/g, '-')}`}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-line2">
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                toast.info(
                  `${label}: real OAuth/credential provisioning required — no live connection made yet (Phase 1.2).`,
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
            {provider.status !== 'not_connected' && (
              <button
                type="button"
                className="text-[11px] text-danger ml-auto hover:underline"
                onClick={() => {
                  toast.info(
                    `${label}: disconnect needs a real credential-revocation call — not wired yet (Phase 1.2).`,
                  );
                  onClose();
                }}
              >
                Disconnect
              </button>
            )}
          </div>
          {provider.status === 'error' && (
            <div className="flex items-center gap-2 text-[11px] text-danger bg-danger/10 px-3 py-2 rounded">
              <AlertTriangle size={12} />
              <span>Last ping returned RATE_LIMITED. Retry after backoff completes.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
