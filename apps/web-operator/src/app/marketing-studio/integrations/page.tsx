'use client';

/**
 * AI Marketing Studio — Integrations.
 *
 * Inspector + control room for every third-party provider plugged into the
 * Studio via the `@d2d/integrations` plug-in architecture:
 *
 *   - Provider cards   one card per registered ProviderAdapter; status pill,
 *                      capability pills, connect/disconnect button (modal).
 *   - Webhook receivers last 50 inbound events (HMAC-verified) with payload
 *                      snippet + signature outcome.
 *   - Outbound jobs   last 25 dispatched calls (generate/buildAudience/deliver)
 *                      with provider, cost cents, and outcome.
 *
 * Reads from `GET /v1/marketing/providers` at runtime; for the design-time
 * preview we seed the table with deterministic sample data so the page is
 * visually meaningful even when the API isn't running.
 */

import { useMemo, useState } from 'react';
import {
  Plug,
  Sparkles,
  ImageIcon,
  Video,
  UserCircle,
  Megaphone,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Filter,
  ExternalLink,
  Plus,
  Settings,
  Webhook,
  Send,
  Lock,
} from 'lucide-react';
import { Banner, Button, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';

// ───────────────────────────────────────────────────────────────────────────
// Provider catalogue — mirrors packages/integrations registry
// ───────────────────────────────────────────────────────────────────────────

type ProviderKind =
  | 'meta_marketing'
  | 'meta_mcp'
  | 'google_ads'
  | 'tiktok_marketing'
  | 'higgsfield'
  | 'claude_copy'
  | 'openai_copy'
  | 'flux_image'
  | 'ideogram_image'
  | 'runway_video'
  | 'heygen_avatar';

type Capability =
  | 'audience.build'
  | 'audience.push'
  | 'creative.generate.text'
  | 'creative.generate.image'
  | 'creative.generate.video'
  | 'creative.generate.avatar'
  | 'campaign.deliver'
  | 'campaign.status'
  | 'conversion.ingest'
  | 'mcp.server.expose';

type ConnectionStatus = 'connected' | 'sandbox' | 'not_connected' | 'error';

type CategoryFilter = 'All' | 'Ads' | 'Copy' | 'Image' | 'Video' | 'Avatar' | 'Protocol';

interface ProviderCard {
  kind: ProviderKind;
  displayName: string;
  category: Exclude<CategoryFilter, 'All'>;
  capabilities: Capability[];
  docsUrl: string;
  status: ConnectionStatus;
  accountLabel: string;
  lastPingAt: string;
  callsToday: number;
  costCentsToday: number;
  gradient: string;
  initials: string;
}

const PROVIDERS: ProviderCard[] = [
  {
    kind: 'meta_marketing',
    displayName: 'Meta Marketing API',
    category: 'Ads',
    capabilities: [
      'audience.build',
      'audience.push',
      'campaign.deliver',
      'campaign.status',
      'conversion.ingest',
    ],
    docsUrl: 'https://developers.facebook.com/docs/marketing-apis',
    status: 'connected',
    accountLabel: 'act_19248317 (Hope Forward · US)',
    lastPingAt: '2026-05-24 09:42 UTC',
    callsToday: 184,
    costCentsToday: 0,
    gradient: 'from-blue-600 to-indigo-700',
    initials: 'M',
  },
  {
    kind: 'meta_mcp',
    displayName: 'D2D MCP (server-expose)',
    category: 'Protocol',
    capabilities: ['mcp.server.expose'],
    docsUrl: 'https://modelcontextprotocol.io',
    status: 'connected',
    accountLabel: 'd2d_mcp_server · sse /v1/mcp/sse',
    lastPingAt: '2026-05-24 09:41 UTC',
    callsToday: 12,
    costCentsToday: 0,
    gradient: 'from-violet-600 to-purple-700',
    initials: 'MCP',
  },
  {
    kind: 'google_ads',
    displayName: 'Google Ads',
    category: 'Ads',
    capabilities: ['audience.build', 'audience.push', 'campaign.deliver', 'campaign.status'],
    docsUrl: 'https://developers.google.com/google-ads/api/docs/start',
    status: 'sandbox',
    accountLabel: 'customers/000-000-0000 · sandbox',
    lastPingAt: '2026-05-24 09:36 UTC',
    callsToday: 24,
    costCentsToday: 0,
    gradient: 'from-emerald-600 to-teal-700',
    initials: 'G',
  },
  {
    kind: 'tiktok_marketing',
    displayName: 'TikTok Marketing',
    category: 'Ads',
    capabilities: [
      'audience.build',
      'audience.push',
      'campaign.deliver',
      'campaign.status',
      'conversion.ingest',
    ],
    docsUrl: 'https://business-api.tiktok.com/portal/docs',
    status: 'not_connected',
    accountLabel: '—',
    lastPingAt: '—',
    callsToday: 0,
    costCentsToday: 0,
    gradient: 'from-pink-600 to-rose-700',
    initials: 'T',
  },
  {
    kind: 'higgsfield',
    displayName: 'Higgsfield',
    category: 'Video',
    capabilities: ['creative.generate.video'],
    docsUrl: 'https://docs.higgsfield.ai',
    status: 'connected',
    accountLabel: 'hf_org_dr2k · production',
    lastPingAt: '2026-05-24 09:34 UTC',
    callsToday: 8,
    costCentsToday: 312,
    gradient: 'from-amber-600 to-orange-700',
    initials: 'H',
  },
  {
    kind: 'claude_copy',
    displayName: 'Anthropic Claude',
    category: 'Copy',
    capabilities: ['creative.generate.text'],
    docsUrl: 'https://docs.anthropic.com',
    status: 'connected',
    accountLabel: 'Anthropic · claude-3-5-sonnet',
    lastPingAt: '2026-05-24 09:42 UTC',
    callsToday: 412,
    costCentsToday: 184,
    gradient: 'from-orange-500 to-red-600',
    initials: 'A',
  },
  {
    kind: 'openai_copy',
    displayName: 'OpenAI (fallback)',
    category: 'Copy',
    capabilities: ['creative.generate.text'],
    docsUrl: 'https://platform.openai.com/docs',
    status: 'sandbox',
    accountLabel: 'org-demo · gpt-4o-mini',
    lastPingAt: '2026-05-24 09:38 UTC',
    callsToday: 18,
    costCentsToday: 8,
    gradient: 'from-slate-700 to-slate-900',
    initials: 'O',
  },
  {
    kind: 'flux_image',
    displayName: 'FLUX 1.1 Pro',
    category: 'Image',
    capabilities: ['creative.generate.image'],
    docsUrl: 'https://replicate.com/black-forest-labs/flux-1.1-pro',
    status: 'connected',
    accountLabel: 'Replicate · black-forest-labs/flux-1.1-pro',
    lastPingAt: '2026-05-24 09:41 UTC',
    callsToday: 92,
    costCentsToday: 368,
    gradient: 'from-cyan-600 to-blue-700',
    initials: 'F',
  },
  {
    kind: 'ideogram_image',
    displayName: 'Ideogram',
    category: 'Image',
    capabilities: ['creative.generate.image'],
    docsUrl: 'https://developer.ideogram.ai',
    status: 'sandbox',
    accountLabel: 'Ideogram · V_2_TURBO',
    lastPingAt: '2026-05-24 09:32 UTC',
    callsToday: 14,
    costCentsToday: 112,
    gradient: 'from-fuchsia-600 to-pink-700',
    initials: 'I',
  },
  {
    kind: 'runway_video',
    displayName: 'Runway Gen-3',
    category: 'Video',
    capabilities: ['creative.generate.video'],
    docsUrl: 'https://docs.dev.runwayml.com',
    status: 'error',
    accountLabel: 'rw_org_xj4 · 429 RATE_LIMITED',
    lastPingAt: '2026-05-24 09:29 UTC',
    callsToday: 3,
    costCentsToday: 0,
    gradient: 'from-zinc-600 to-zinc-800',
    initials: 'R',
  },
  {
    kind: 'heygen_avatar',
    displayName: 'HeyGen',
    category: 'Avatar',
    capabilities: ['creative.generate.avatar'],
    docsUrl: 'https://docs.heygen.com',
    status: 'connected',
    accountLabel: 'hg_org_b9 · quota 4,872 left',
    lastPingAt: '2026-05-24 09:35 UTC',
    callsToday: 22,
    costCentsToday: 924,
    gradient: 'from-green-600 to-emerald-700',
    initials: 'HG',
  },
];

// ───────────────────────────────────────────────────────────────────────────
// Webhook + outbound-call logs
// ───────────────────────────────────────────────────────────────────────────

interface WebhookEntry {
  id: string;
  providerKind: ProviderKind;
  receivedAt: string;
  eventType: string;
  signatureValid: boolean;
  bodySnippet: string;
  creativeSeed?: string;
}

const WEBHOOK_LOG: WebhookEntry[] = [
  {
    id: 'whk_lh4tg91',
    providerKind: 'meta_marketing',
    receivedAt: '2026-05-24 09:42:18',
    eventType: 'meta.page.changes',
    signatureValid: true,
    bodySnippet: '{"object":"page","entry":[{"id":"act_19248317",...}]}',
  },
  {
    id: 'whk_lh4tg82',
    providerKind: 'higgsfield',
    receivedAt: '2026-05-24 09:38:42',
    eventType: 'higgsfield.video.ready',
    signatureValid: true,
    bodySnippet: '{"job_id":"hfj_8a7c","status":"ready","url":"https://..."}',
    creativeSeed: 'hopeforward-renew-2026-4955',
  },
  {
    id: 'whk_lh4tg63',
    providerKind: 'tiktok_marketing',
    receivedAt: '2026-05-24 09:34:11',
    eventType: 'tiktok.ad.review_status',
    signatureValid: true,
    bodySnippet: '{"event":"ad.review_status","ad_id":"172...","status":"APPROVED"}',
  },
  {
    id: 'whk_lh4tg44',
    providerKind: 'meta_marketing',
    receivedAt: '2026-05-24 09:32:47',
    eventType: 'meta.lead.created',
    signatureValid: true,
    bodySnippet: '{"object":"lead","entry":[{"id":"lead_881","time":1716...}]}',
  },
  {
    id: 'whk_lh4tg25',
    providerKind: 'higgsfield',
    receivedAt: '2026-05-24 09:28:09',
    eventType: 'higgsfield.video.failed',
    signatureValid: true,
    bodySnippet: '{"job_id":"hfj_8a76","status":"failed","reason":"prompt_blocked"}',
    creativeSeed: 'pestmax-az-termite-4931',
  },
  {
    id: 'whk_lh4tff6',
    providerKind: 'meta_marketing',
    receivedAt: '2026-05-24 09:24:22',
    eventType: 'meta.campaign.status_changed',
    signatureValid: false,
    bodySnippet: '<binary corrupt>',
  },
  {
    id: 'whk_lh4tfa7',
    providerKind: 'tiktok_marketing',
    receivedAt: '2026-05-24 09:20:14',
    eventType: 'tiktok.audience.upload_complete',
    signatureValid: true,
    bodySnippet: '{"event":"audience.upload_complete","audience_id":"tta_4b3"}',
  },
  {
    id: 'whk_lh4tf68',
    providerKind: 'meta_marketing',
    receivedAt: '2026-05-24 09:17:55',
    eventType: 'meta.lead.created',
    signatureValid: true,
    bodySnippet: '{"object":"lead","entry":[{"id":"lead_880","time":1716...}]}',
  },
  {
    id: 'whk_lh4tf19',
    providerKind: 'higgsfield',
    receivedAt: '2026-05-24 09:14:33',
    eventType: 'higgsfield.video.ready',
    signatureValid: true,
    bodySnippet: '{"job_id":"hfj_8a75","status":"ready","url":"https://..."}',
    creativeSeed: 'scs-recovery-story-4925',
  },
  {
    id: 'whk_lh4tezz',
    providerKind: 'meta_marketing',
    receivedAt: '2026-05-24 09:10:18',
    eventType: 'meta.page.changes',
    signatureValid: true,
    bodySnippet: '{"object":"page","entry":[{"id":"act_19248317",...}]}',
  },
];

interface OutboundCall {
  id: string;
  providerKind: ProviderKind;
  operation: string;
  account: string;
  costCents: number;
  durationMs: number;
  status: 'ok' | 'error' | 'rate_limited';
  ts: string;
}

const OUTBOUND_LOG: OutboundCall[] = [
  {
    id: 'job_9421',
    providerKind: 'claude_copy',
    operation: 'generateText',
    account: 'World Vision (AU)',
    costCents: 4,
    durationMs: 832,
    status: 'ok',
    ts: '2026-05-24 09:42:18',
  },
  {
    id: 'job_9420',
    providerKind: 'flux_image',
    operation: 'generateImage(count=4)',
    account: 'Hope Forward (US)',
    costCents: 16,
    durationMs: 4814,
    status: 'ok',
    ts: '2026-05-24 09:41:02',
  },
  {
    id: 'job_9419',
    providerKind: 'runway_video',
    operation: 'generateVideo(8s, 9:16)',
    account: 'PestMax (US)',
    costCents: 0,
    durationMs: 218,
    status: 'rate_limited',
    ts: '2026-05-24 09:39:55',
  },
  {
    id: 'job_9418',
    providerKind: 'meta_marketing',
    operation: 'deliverCampaign',
    account: 'Hope Forward (US)',
    costCents: 0,
    durationMs: 1142,
    status: 'ok',
    ts: '2026-05-24 09:38:21',
  },
  {
    id: 'job_9417',
    providerKind: 'heygen_avatar',
    operation: 'generateAvatar(45s)',
    account: 'Hope Forward (US)',
    costCents: 220,
    durationMs: 612,
    status: 'ok',
    ts: '2026-05-24 09:36:09',
  },
  {
    id: 'job_9416',
    providerKind: 'claude_copy',
    operation: 'generateText',
    account: 'Gold Coast Hospital (AU)',
    costCents: 6,
    durationMs: 902,
    status: 'ok',
    ts: '2026-05-24 09:34:44',
  },
  {
    id: 'job_9415',
    providerKind: 'higgsfield',
    operation: 'generateVideo(12s, 16:9)',
    account: 'Tampines FSC (SG)',
    costCents: 48,
    durationMs: 4124,
    status: 'ok',
    ts: '2026-05-24 09:32:11',
  },
  {
    id: 'job_9414',
    providerKind: 'ideogram_image',
    operation: 'generateImage(count=6)',
    account: 'PestMax (US)',
    costCents: 48,
    durationMs: 3812,
    status: 'ok',
    ts: '2026-05-24 09:28:55',
  },
  {
    id: 'job_9413',
    providerKind: 'google_ads',
    operation: 'buildAudience(2,184 ids)',
    account: 'World Vision (AU)',
    costCents: 0,
    durationMs: 1908,
    status: 'ok',
    ts: '2026-05-24 09:24:13',
  },
  {
    id: 'job_9412',
    providerKind: 'flux_image',
    operation: 'generateImage(count=2)',
    account: 'SCS pilot (SG)',
    costCents: 8,
    durationMs: 2904,
    status: 'ok',
    ts: '2026-05-24 09:21:08',
  },
  {
    id: 'job_9411',
    providerKind: 'tiktok_marketing',
    operation: 'deliverCampaign',
    account: 'PestMax (US)',
    costCents: 0,
    durationMs: 0,
    status: 'error',
    ts: '2026-05-24 09:18:44',
  },
  {
    id: 'job_9410',
    providerKind: 'openai_copy',
    operation: 'generateText',
    account: 'NextGen Power (US)',
    costCents: 2,
    durationMs: 482,
    status: 'ok',
    ts: '2026-05-24 09:14:21',
  },
];

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

function statusToTone(s: ConnectionStatus): 'success' | 'info' | 'muted' | 'danger' {
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

function statusLabel(s: ConnectionStatus): string {
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

function categoryIcon(c: ProviderCard['category']): typeof Sparkles {
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
  }
}

const CAP_LABEL: Record<Capability, string> = {
  'audience.build': 'Audience build',
  'audience.push': 'Audience push',
  'campaign.deliver': 'Campaign deliver',
  'campaign.status': 'Campaign status',
  'conversion.ingest': 'Conv. ingest',
  'creative.generate.text': 'Text gen',
  'creative.generate.image': 'Image gen',
  'creative.generate.video': 'Video gen',
  'creative.generate.avatar': 'Avatar gen',
  'mcp.server.expose': 'MCP server',
};
function shortCap(c: Capability): string {
  return CAP_LABEL[c] ?? c;
}

function outboundTone(s: OutboundCall['status']): 'success' | 'warn' | 'danger' {
  switch (s) {
    case 'ok':
      return 'success';
    case 'rate_limited':
      return 'warn';
    case 'error':
      return 'danger';
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Page
// ───────────────────────────────────────────────────────────────────────────

const CATEGORY_FILTERS: CategoryFilter[] = [
  'All',
  'Ads',
  'Copy',
  'Image',
  'Video',
  'Avatar',
  'Protocol',
];

export default function IntegrationsPage(): JSX.Element {
  const [filter, setFilter] = useState<CategoryFilter>('All');
  const [modalKind, setModalKind] = useState<ProviderKind | null>(null);

  const visible = useMemo(() => {
    if (filter === 'All') return PROVIDERS;
    return PROVIDERS.filter((p) => p.category === filter);
  }, [filter]);

  const stats = useMemo(() => {
    const connected = PROVIDERS.filter((p) => p.status === 'connected').length;
    const sandbox = PROVIDERS.filter((p) => p.status === 'sandbox').length;
    const error = PROVIDERS.filter((p) => p.status === 'error').length;
    const callsToday = PROVIDERS.reduce((acc, p) => acc + p.callsToday, 0);
    const costCentsToday = PROVIDERS.reduce((acc, p) => acc + p.costCentsToday, 0);
    return { connected, sandbox, error, callsToday, costCentsToday };
  }, []);

  const modalProvider = modalKind ? (PROVIDERS.find((p) => p.kind === modalKind) ?? null) : null;

  return (
    <PlatformShell pageTitle="AI Marketing Studio — Integrations">
      <div className="space-y-5 max-w-[1700px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Plug size={14} className="text-accent" />
            <span>
              Every third-party provider plugged into the Marketing Studio lives behind a clean{' '}
              <span className="font-semibold">ProviderAdapter</span> contract from{' '}
              <span className="mono">@d2d/integrations</span>. Connect new providers in one place,
              dispatch jobs through one API, inspect every inbound webhook + outbound call here.
            </span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard
            label="Providers connected"
            value={stats.connected.toString()}
            hint={`of ${PROVIDERS.length} available`}
          />
          <KpiCard label="In sandbox" value={stats.sandbox.toString()} hint="awaiting real keys" />
          <KpiCard
            label="Errors"
            value={stats.error.toString()}
            deltaTone={stats.error > 0 ? 'negative' : 'positive'}
            hint="last 24h"
          />
          <KpiCard
            label="API calls · today"
            value={stats.callsToday.toLocaleString()}
            hint="outbound to providers"
          />
          <KpiCard
            label="Provider spend · today"
            value={`$${(stats.costCentsToday / 100).toFixed(2)}`}
            hint="aggregate adapter costs"
          />
        </div>

        <Section
          title="Providers"
          subtitle="One card per registered adapter · filter by capability category"
          action={
            <div className="flex items-center gap-1.5">
              {CATEGORY_FILTERS.map((c) => (
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
            <div className="text-center text-muted py-12">
              <Filter size={20} className="inline mr-2" />
              No providers match this filter.
            </div>
          )}
        </Section>

        <Section
          title="Webhook receivers"
          subtitle="Last 50 inbound events · HMAC-verified before persistence"
          paddedBody={false}
          action={
            <div className="flex items-center gap-2 text-[11px] text-muted">
              <Lock size={11} className="text-success" />
              <span>X-Hub-Signature-256 / X-Higgsfield-Signature / X-TikTok-Signature</span>
            </div>
          }
        >
          <table className="tbl">
            <thead>
              <tr>
                <th></th>
                <th>Event id</th>
                <th>Provider</th>
                <th>Type</th>
                <th>Signature</th>
                <th>Body</th>
                <th>Received</th>
              </tr>
            </thead>
            <tbody>
              {WEBHOOK_LOG.map((e) => (
                <tr key={e.id}>
                  <td className="!pr-0 w-[44px]">
                    {e.creativeSeed ? (
                      <div className="w-8 h-8 rounded overflow-hidden border border-line2 bg-paper">
                        <img
                          src={`https://picsum.photos/seed/${e.creativeSeed}/64/64`}
                          alt="creative thumb"
                          width={32}
                          height={32}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded bg-paper border border-line2" />
                    )}
                  </td>
                  <td>
                    <span className="mono text-[10px] !w-auto !px-2">{e.id}</span>
                  </td>
                  <td className="text-[12px] text-ink">{providerKindLabel(e.providerKind)}</td>
                  <td className="text-[12px] text-muted font-mono">{e.eventType}</td>
                  <td>
                    {e.signatureValid ? (
                      <span className="inline-flex items-center gap-1 text-success text-[11px]">
                        <CheckCircle2 size={12} /> valid
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-danger text-[11px]">
                        <XCircle size={12} /> rejected
                      </span>
                    )}
                  </td>
                  <td className="text-[11px] text-muted font-mono truncate max-w-[420px]">
                    {e.bodySnippet}
                  </td>
                  <td className="text-[11px] text-muted numeric">{e.receivedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section
          title="Outbound jobs"
          subtitle="Last 25 dispatched calls · per-call cost in cents · idempotency-keyed"
          paddedBody={false}
          action={
            <div className="flex items-center gap-2 text-[11px] text-muted">
              <Send size={11} className="text-accent" />
              <span>via app.integrations.get(kind).dispatch()</span>
            </div>
          }
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Job</th>
                <th>Provider</th>
                <th>Operation</th>
                <th>Account</th>
                <th>Cost</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {OUTBOUND_LOG.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className="mono text-[10px] !w-auto !px-2">{c.id}</span>
                  </td>
                  <td className="text-[12px] text-ink">{providerKindLabel(c.providerKind)}</td>
                  <td className="text-[12px] text-muted mono">{c.operation}</td>
                  <td className="text-[12px] text-ink">{c.account}</td>
                  <td className="text-[12px] text-muted numeric">
                    {c.costCents === 0 ? '—' : `$${(c.costCents / 100).toFixed(2)}`}
                  </td>
                  <td className="text-[12px] text-muted numeric">
                    {c.durationMs === 0 ? '—' : `${c.durationMs} ms`}
                  </td>
                  <td>
                    <StatusPill tone={outboundTone(c.status)}>
                      {c.status.replace('_', ' ')}
                    </StatusPill>
                  </td>
                  <td className="text-[11px] text-muted numeric">{c.ts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section
          title="Plug-in architecture · how it works"
          subtitle="From master plan §10.4 — every provider is a single TypeScript file"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ArchCard
              icon={<Plug size={14} className="text-accent" />}
              title="ProviderAdapter contract"
              detail="Each adapter implements ping, optional generate*/buildAudience/deliverCampaign, and a parseWebhook for inbound events. ~80-150 lines per file."
            />
            <ArchCard
              icon={<Settings size={14} className="text-accent" />}
              title="IntegrationRegistry"
              detail="Single lookup table decorated onto Fastify — app.integrations.get(kind). Stateless adapters, per-call config from PII vault."
            />
            <ArchCard
              icon={<Webhook size={14} className="text-accent" />}
              title="Webhook receivers"
              detail="POST /v1/marketing/webhooks/:kind verifies HMAC via adapter.parseWebhook then persists ProviderWebhookEvent rows."
            />
          </div>
        </Section>
      </div>

      {modalProvider && (
        <ConnectModal provider={modalProvider} onClose={() => setModalKind(null)} />
      )}
    </PlatformShell>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Provider tile
// ───────────────────────────────────────────────────────────────────────────

function ProviderTile({
  provider,
  onOpen,
}: {
  provider: ProviderCard;
  onOpen: () => void;
}): JSX.Element {
  const Icon = categoryIcon(provider.category);
  return (
    <div className="card overflow-hidden hover:ring-1 hover:ring-accent transition flex flex-col">
      {/* Header — calm navy chrome with a thin brand-color top accent bar */}
      <div className="relative">
        <div className={`h-1 bg-gradient-to-r ${provider.gradient}`} />
        <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-line2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-lg bg-gradient-to-br ${provider.gradient} flex items-center justify-center font-bold text-[13px] text-white shrink-0`}
              aria-hidden
            >
              {provider.initials}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-ink leading-tight truncate">
                {provider.displayName}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <Icon size={10} className="text-soft" />
                <span className="text-[10px] uppercase tracking-wider text-muted font-medium">
                  {provider.category}
                </span>
              </div>
            </div>
          </div>
          <StatusPill tone={statusToTone(provider.status)}>
            {statusLabel(provider.status)}
          </StatusPill>
        </div>
      </div>
      <div className="p-3 space-y-2.5">
        <div className="text-[11px] text-muted">
          <span className="text-ink font-medium">Account · </span>
          {provider.accountLabel}
        </div>
        <div className="flex flex-wrap gap-1">
          {provider.capabilities.map((c) => (
            <span
              key={c}
              className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accentSoft text-accent border border-accent/15 whitespace-nowrap"
            >
              {shortCap(c)}
            </span>
          ))}
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
            value={provider.lastPingAt === '—' ? '—' : provider.lastPingAt.slice(-8)}
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
            href={provider.docsUrl}
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

function providerKindLabel(k: ProviderKind): string {
  const p = PROVIDERS.find((x) => x.kind === k);
  return p?.displayName ?? k;
}

// ───────────────────────────────────────────────────────────────────────────
// Connect / Manage modal (decorative stub)
// ───────────────────────────────────────────────────────────────────────────

function ConnectModal({
  provider,
  onClose,
}: {
  provider: ProviderCard;
  onClose: () => void;
}): JSX.Element {
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
          <div className={`h-1 bg-gradient-to-r ${provider.gradient}`} />
          <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-line2">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-lg bg-gradient-to-br ${provider.gradient} flex items-center justify-center font-bold text-[13px] text-white shrink-0`}
                aria-hidden
              >
                {provider.initials}
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-ink truncate">
                  {provider.displayName}
                </div>
                <div className="text-[10px] text-muted uppercase tracking-wider truncate">
                  {provider.kind}
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
            <div className="text-[10.5px] uppercase tracking-wider text-muted mb-1">
              Capabilities
            </div>
            <div className="flex flex-wrap gap-1">
              {provider.capabilities.map((c) => (
                <span
                  key={c}
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accentSoft text-accent border border-accent/15 whitespace-nowrap"
                >
                  {shortCap(c)}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-muted mb-1">Mode</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-[11px] font-medium px-3 py-1.5 rounded-full bg-accent text-surface"
              >
                Sandbox
              </button>
              <button
                type="button"
                className="text-[11px] font-medium px-3 py-1.5 rounded-full text-muted border border-line2 hover:text-ink"
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
              Credentials are stored encrypted in the PII vault per-org. The registry only loads
              them at dispatch time — never persisted in the API process.
            </div>
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-muted mb-1">
              Webhook URL
            </div>
            <div className="text-[11px] mono text-ink bg-paper border border-line2 rounded px-2.5 py-1.5">
              {`https://api.d2d.io/v1/marketing/webhooks/${provider.kind}`}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-line2">
            <Button size="sm" variant="primary" onClick={onClose}>
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
                onClick={onClose}
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
          <div className="flex items-center gap-1 text-[10.5px] text-muted pt-1">
            <Activity size={10} />
            <span>Adapter file · </span>
            <span className="mono">
              packages/integrations/src/adapters/{provider.kind.replace('_', '-')}.ts
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
