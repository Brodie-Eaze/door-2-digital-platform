'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ListChecks, Megaphone, Plug, ArrowUpRight, RefreshCw, FileText } from 'lucide-react';
import { Banner, Button, Section } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { MarketingStudioTabs } from '@/components/marketing-studio-tabs';
import { DataSourceBadge, useDataFreshness } from '@/components/DataSourceBadge';
import {
  ReviewQueueBoard,
  DEMO_DRAFT_CAMPAIGNS,
  type DraftCampaign,
} from '@/components/marketing-review-queue';

/**
 * HQ review queue — draft AdCampaigns awaiting publish across all orgs the
 * operator can see. Approve creatives in the Generator → they land here grouped
 * under a draft campaign → publish to Meta / Google.
 *
 * The publish adapters are deterministic stubs; no real ad spend can occur
 * until Meta Business Verification + ad-account OAuth (Meta) and a Google Ads
 * developer token + OAuth refresh token (Google) land. Until a provider
 * connection exists, Publish returns an honest "connect in Integrations" state.
 */
export default function ReviewQueuePage(): JSX.Element {
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
      // Backend not configured / empty persisted set → demo fixtures, flagged.
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
    void load();
  }, [load]);

  return (
    <PlatformShell pageTitle="Marketing Studio · Review queue">
      <div className="space-y-5 max-w-[1500px]">
        <MarketingStudioTabs active="review-queue" />

        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <ListChecks size={14} className="text-accent" />
            <span>
              Approved creatives queue here as <span className="font-semibold">draft</span> campaigns.
              Review the grouped creatives, then publish to Meta or Google. Publishing is gated on a
              live provider connection — no ad spend leaves this surface until your ad account is
              connected and verified.
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
            integrationsHref="/marketing-studio/integrations"
            onPublished={(campaignId) =>
              setCampaigns((cs) =>
                cs.map((c) => (c.id === campaignId ? { ...c, status: 'active' } : c)),
              )
            }
          />
        </Section>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickLink
            href="/marketing-studio/generate"
            icon={<FileText size={14} className="text-accent" />}
            title="Generator"
            body="Brief → 8–12 brand-safe variants → approve into this queue."
          />
          <QuickLink
            href="/marketing-studio/campaigns"
            icon={<Megaphone size={14} className="text-accent" />}
            title="Campaigns"
            body="Live spend, ROAS and CAPI attribution once published."
          />
          <QuickLink
            href="/marketing-studio/integrations"
            icon={<Plug size={14} className="text-accent" />}
            title="Integrations"
            body="Connect Meta + Google ad accounts to enable publishing."
          />
        </div>
      </div>
    </PlatformShell>
  );
}

function QuickLink({
  href,
  icon,
  title,
  body,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}): JSX.Element {
  return (
    <Link href={href} className="card p-3.5 hover:ring-1 hover:ring-line2 transition group">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
          {icon}
          {title}
        </div>
        <ArrowUpRight size={13} className="text-soft group-hover:text-accent transition" />
      </div>
      <div className="text-[11.5px] text-muted leading-snug">{body}</div>
    </Link>
  );
}
