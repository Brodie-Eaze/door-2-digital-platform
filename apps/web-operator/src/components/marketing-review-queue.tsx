'use client';

/**
 * Shared review-queue board — rendered by both the HQ and per-account
 * Review queue pages. Renders draft AdCampaigns as cards (each with its
 * grouped creatives) and a per-provider Publish button.
 *
 * Honest-by-design:
 *   - Publish → POST /api/marketing/publish.
 *   - { published:false } → inline "Connect <provider> to publish" notice +
 *     a link to Integrations + toast.info. NEVER a silent fake success.
 *   - { published:true } → toast.success and the card flips to 'active'.
 *
 * The publish adapters (graph.facebook.com / googleads) are deterministic
 * STUBS. No real ad spend can occur until Meta Business Verification +
 * ad-account OAuth and a Google Ads developer token + OAuth refresh token land.
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  ListChecks,
  FileText,
  Image as ImageIcon,
  Film,
  ShieldCheck,
  Plug,
  RefreshCw,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { Button, Skeleton, StatusPill } from '@d2d/ui-web';
import { toast } from '@/components/Toaster';

export interface DraftCreative {
  id: string;
  type: string;
  assetKey: string;
  approvedAt: string | null;
  approvedBy: string | null;
}

export interface DraftCampaign {
  id: string;
  provider: string;
  objective: string;
  adAccountId: string;
  status: string;
  createdAt: string;
  creatives: DraftCreative[];
}

const PROVIDERS: Array<{ key: 'meta' | 'google'; label: string }> = [
  { key: 'meta', label: 'Meta' },
  { key: 'google', label: 'Google' },
];

function creativeTypeIcon(type: string): JSX.Element {
  switch (type) {
    case 'image':
      return <ImageIcon size={12} className="text-blue-600" />;
    case 'video':
      return <Film size={12} className="text-rose-600" />;
    default:
      return <FileText size={12} className="text-violet-600" />;
  }
}

interface PublishState {
  // Per-(campaignId+provider) inline notice when publish is gated.
  notConnectedProvider: 'meta' | 'google' | null;
  publishing: 'meta' | 'google' | null;
}

export function ReviewQueueBoard({
  campaigns,
  loading,
  integrationsHref,
  orgId,
  onPublished,
}: {
  campaigns: DraftCampaign[];
  loading: boolean;
  integrationsHref: string;
  /** Cross-tenant operators pass an explicit orgId through to the publish call. */
  orgId?: string;
  onPublished: (campaignId: string) => void;
}): JSX.Element {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card p-4 space-y-3">
            <Skeleton height="h-4" width="w-1/3" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Array.from({ length: 3 }).map((__, j) => (
                <Skeleton key={j} height="h-16" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16 px-6">
        <div className="w-12 h-12 rounded-2xl bg-accentSoft/40 flex items-center justify-center mb-4">
          <ListChecks size={20} className="text-accent" />
        </div>
        <div className="text-[14px] font-semibold text-ink mb-1">No drafts in the queue</div>
        <p className="text-[12px] text-muted max-w-[360px] leading-relaxed">
          Approve creatives in the Generator to queue them here. Approved variants are grouped under
          a draft campaign you can review and publish to Meta or Google.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {campaigns.map((c) => (
        <CampaignCard
          key={c.id}
          campaign={c}
          integrationsHref={integrationsHref}
          orgId={orgId}
          onPublished={onPublished}
        />
      ))}
    </div>
  );
}

function CampaignCard({
  campaign,
  integrationsHref,
  orgId,
  onPublished,
}: {
  campaign: DraftCampaign;
  integrationsHref: string;
  orgId?: string;
  onPublished: (campaignId: string) => void;
}): JSX.Element {
  const [state, setState] = useState<PublishState>({
    notConnectedProvider: null,
    publishing: null,
  });
  const isActive = campaign.status === 'active';
  const pendingConnection = campaign.adAccountId === 'pending_connection';

  async function publish(provider: 'meta' | 'google'): Promise<void> {
    setState((s) => ({ ...s, publishing: provider, notConnectedProvider: null }));
    const providerLabel = provider === 'meta' ? 'Meta' : 'Google';
    try {
      const qs = orgId ? `?orgId=${encodeURIComponent(orgId)}` : '';
      const res = await fetch(`/api/marketing/publish${qs}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ campaignId: campaign.id, provider }),
      });
      if (res.ok) {
        const data = (await res.json()) as { published?: boolean; reason?: string };
        if (data.published) {
          toast.success(`Published to ${providerLabel} · campaign live`);
          onPublished(campaign.id);
        } else {
          // Honest gated state — provider not connected.
          setState((s) => ({ ...s, notConnectedProvider: provider }));
          toast.info(`Connect your ${providerLabel} ad account in Integrations to publish.`);
        }
      } else {
        toast.error(`Could not publish to ${providerLabel} — try again.`);
      }
    } catch (err) {
      console.error('[review-queue publish] failed:', err);
      toast.error(`Could not publish to ${providerLabel} — try again.`);
    } finally {
      setState((s) => ({ ...s, publishing: null }));
    }
  }

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-accent" />
            <span className="text-[13px] font-semibold text-ink">
              {campaign.objective} · {campaign.creatives.length} creative
              {campaign.creatives.length === 1 ? '' : 's'}
            </span>
            <StatusPill tone={isActive ? 'success' : 'info'}>
              {isActive ? 'active' : 'draft'}
            </StatusPill>
          </div>
          <div className="text-[10.5px] text-muted font-mono mt-0.5">
            {campaign.id} · provider {campaign.provider} · {campaign.adAccountId}
          </div>
        </div>
        {!isActive && (
          <div className="flex items-center gap-2">
            {PROVIDERS.map((p) => (
              <Button
                key={p.key}
                variant={p.key === 'meta' ? 'primary' : 'ghost'}
                size="sm"
                leftIcon={
                  state.publishing === p.key ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : (
                    <Plug size={12} />
                  )
                }
                onClick={() => void publish(p.key)}
                disabled={state.publishing !== null}
              >
                Publish to {p.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Creatives in this draft campaign */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {campaign.creatives.map((cr) => (
          <div key={cr.id} className="border border-line2 rounded-md p-2 bg-paper">
            <div className="flex items-center gap-1.5 mb-1">
              {creativeTypeIcon(cr.type)}
              <span className="text-[11px] font-semibold text-ink capitalize">{cr.type}</span>
              <span
                className="ml-auto inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-success font-semibold"
                title="Approved · safety pass"
              >
                <ShieldCheck size={9} /> ok
              </span>
            </div>
            <div className="text-[9.5px] text-muted font-mono truncate" title={cr.assetKey}>
              {cr.id}
            </div>
          </div>
        ))}
      </div>

      {isActive && (
        <div className="mt-3 flex items-center gap-1.5 text-[11.5px] text-success">
          <CheckCircle2 size={13} />
          Published — delivery + CAPI attribution now flow on the Campaigns surface.
        </div>
      )}

      {/* Honest gated notice */}
      {state.notConnectedProvider && (
        <div className="mt-3 flex items-start gap-2 text-[11.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-2">
          <Plug size={13} className="shrink-0 mt-0.5" />
          <span>
            <span className="font-semibold">
              {state.notConnectedProvider === 'meta' ? 'Meta' : 'Google'} ad account not connected.
            </span>{' '}
            No ad spend can occur until your ad account is connected and verified.{' '}
            <Link href={integrationsHref} className="underline font-semibold text-accent">
              Connect your {state.notConnectedProvider === 'meta' ? 'Meta' : 'Google'} ad account to
              publish
            </Link>
            .
          </span>
        </div>
      )}

      {pendingConnection && !state.notConnectedProvider && !isActive && (
        <div className="mt-3 text-[11px] text-muted flex items-center gap-1.5">
          <Plug size={11} className="text-soft" />
          No ad account linked yet — publishing will prompt you to connect one in Integrations.
        </div>
      )}
    </div>
  );
}
