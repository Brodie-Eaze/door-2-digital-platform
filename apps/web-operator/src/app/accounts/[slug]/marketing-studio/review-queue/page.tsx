'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { ListChecks, RefreshCw } from 'lucide-react';
import { Banner, Button, Section } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { MarketingStudioTabs } from '@/components/marketing-studio-tabs';
import { DataSourceBadge, useDataFreshness } from '@/components/DataSourceBadge';
import { useAccountMeta } from '@/lib/use-account-meta';
import { firstRunSnapshot } from '@/lib/first-run';
import { ReviewQueueBoard, type DraftCampaign } from '@/components/marketing-review-queue';

/**
 * Per-account review queue — draft AdCampaigns awaiting publish, scoped to the
 * caller's tenant (the BFF tenant-scopes to session.orgId; the slug is the UI
 * scope). Same board + honest publish gating as HQ. Publishing stays blocked
 * until a real Meta / Google ad-account connection exists in Integrations.
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function Page({ params: paramsPromise }: PageProps): JSX.Element {
  const params = use(paramsPromise);
  // Display name only — live meta answers async; a real org still gets a
  // reasonable name via firstRun's prettify-slug fallback meanwhile, and the
  // fetch below is never gated on this.
  const meta = useAccountMeta(params.slug);
  const firstRun = firstRunSnapshot(params.slug);
  const accountName = meta?.name ?? firstRun.accountName;
  const { source, updatedAt, markFresh } = useDataFreshness('live');
  const [campaigns, setCampaigns] = useState<DraftCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      // No ?orgId= — the slug is a display route param, not a real org id;
      // the route scopes to the signed-in session's own org, same as before.
      const res = await fetch('/api/marketing/review-queue', { method: 'GET' });
      const data = res.ok
        ? ((await res.json()) as { campaigns?: DraftCampaign[] })
        : { campaigns: [] };
      // Honest either way: persisted rows or an honest empty queue — never a
      // fabricated fallback. ReviewQueueBoard renders its own empty state.
      setCampaigns(Array.isArray(data.campaigns) ? data.campaigns : []);
      markFresh();
    } catch (err) {
      console.error('[review-queue] fetch failed:', err);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, [markFresh]);

  useEffect(() => {
    // W3 fix: no longer gated on `!account || firstRun.isFirstRun` — that
    // blocked every real (non-demo-seed) org from ever loading its queue.
    void load();
  }, [load]);

  const base = `/accounts/${params.slug}/marketing-studio`;

  return (
    <AccountShell
      accountSlug={params.slug}
      pageTitle={`Marketing Studio · ${accountName} · Review queue`}
    >
      <div className="space-y-5 max-w-[1500px]">
        <MarketingStudioTabs slug={params.slug} active="review-queue" />

        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <ListChecks size={14} className="text-accent" />
            <span>
              Approved creatives for <span className="font-semibold">{accountName}</span> queue here
              as draft campaigns. Review the grouped creatives, then publish to Meta or Google.
              Publishing is gated on a live provider connection — no ad spend leaves this surface
              until your ad account is connected and verified.
            </span>
          </span>
        </Banner>

        <Section
          title={`Draft campaigns · ${campaigns.length}`}
          subtitle="Approve in the Generator → group → publish per provider"
          action={
            <div className="flex items-center gap-2">
              <DataSourceBadge source={source} updatedAt={updatedAt} />
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
          }
        >
          <ReviewQueueBoard
            campaigns={campaigns}
            loading={loading}
            integrationsHref={`${base}/integrations`}
            onPublished={(campaignId) =>
              setCampaigns((cs) =>
                cs.map((c) => (c.id === campaignId ? { ...c, status: 'active' } : c)),
              )
            }
          />
        </Section>
      </div>
    </AccountShell>
  );
}
