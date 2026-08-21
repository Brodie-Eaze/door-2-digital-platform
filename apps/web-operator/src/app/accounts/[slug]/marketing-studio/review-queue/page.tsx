'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { ListChecks, RefreshCw } from 'lucide-react';
import { Banner, Button, Section } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { MarketingStudioTabs } from '@/components/marketing-studio-tabs';
import { DataSourceBadge, useDataFreshness } from '@/components/DataSourceBadge';
import { MarketingStudioEmpty, FirstRunBanner } from '@/components/AccountEmptyStates';
import { getAccount } from '@/lib/accounts';
import { firstRunSnapshot } from '@/lib/first-run';
import {
  ReviewQueueBoard,
  DEMO_DRAFT_CAMPAIGNS,
  type DraftCampaign,
} from '@/components/marketing-review-queue';

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
  const account = getAccount(params.slug);
  const firstRun = firstRunSnapshot(params.slug);
  const { source, updatedAt, markFresh, markFixture } = useDataFreshness('fixture');
  const [campaigns, setCampaigns] = useState<DraftCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await fetch('/api/marketing/review-queue', { method: 'GET' });
      if (res.ok) {
        const data = (await res.json()) as {
          campaigns?: DraftCampaign[];
          persisted?: boolean;
        };
        if (data.persisted && Array.isArray(data.campaigns)) {
          setCampaigns(data.campaigns);
          markFresh();
          return;
        }
      }
      setCampaigns(DEMO_DRAFT_CAMPAIGNS);
      markFixture();
    } catch (err) {
      console.error('[review-queue] fetch failed:', err);
      setCampaigns(DEMO_DRAFT_CAMPAIGNS);
      markFixture();
    } finally {
      setLoading(false);
    }
  }, [markFresh, markFixture]);

  useEffect(() => {
    if (!account || firstRun.isFirstRun) return;
    void load();
  }, [account, firstRun.isFirstRun, load]);

  if (!account || firstRun.isFirstRun) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Marketing Studio · Review queue">
        <div className="space-y-5 max-w-[1400px]">
          {firstRun.isFirstRun && (
            <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          )}
          <MarketingStudioEmpty slug={params.slug} accountName={firstRun.accountName} />
        </div>
      </AccountShell>
    );
  }

  const base = `/accounts/${params.slug}/marketing-studio`;

  return (
    <AccountShell
      accountSlug={params.slug}
      pageTitle={`Marketing Studio · ${account.shortName} · Review queue`}
    >
      <div className="space-y-5 max-w-[1500px]">
        <MarketingStudioTabs slug={params.slug} active="review-queue" />

        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <ListChecks size={14} className="text-accent" />
            <span>
              Approved creatives for <span className="font-semibold">{account.shortName}</span>{' '}
              queue here as draft campaigns. Review the grouped creatives, then publish to Meta or
              Google. Publishing is gated on a live provider connection — no ad spend leaves this
              surface until your ad account is connected and verified.
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
