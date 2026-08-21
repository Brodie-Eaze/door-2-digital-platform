'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Target, RefreshCw, Users, ArrowUpRight } from 'lucide-react';
import { Banner, Button, KpiCard, Section } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { MarketingStudioTabs } from '@/components/marketing-studio-tabs';
import { DataSourceBadge, useDataFreshness } from '@/components/DataSourceBadge';
import { RetargetingEmpty } from '@/components/MarketingEmptyStates';

/**
 * Retargeting — built from `AdCampaign.audienceJson`, the only real column
 * that models an audience today.
 *
 * The fixture version rendered a fictional 6-stage funnel (knock →
 * hashed-audience → served → click → lead → conversion), per-cohort
 * reach/CTR/revenue/"5% rake", and per-channel hash match-rates — none of
 * that has a backing model (no Lead.attributionSource = 'retargeting', no
 * rake ledger, no audience-hash table). Per the takeover brief, this surface
 * now reads real AdCampaigns whose `audienceJson` is non-empty and says so
 * plainly when there aren't any yet, instead of inventing the roundtrip.
 */

interface CampaignRow {
  id: string;
  account: string;
  provider: string;
  objective: string;
  audienceJson: unknown;
  status: string;
  createdAt: string;
}

function hasAudience(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'object') return Object.keys(v as Record<string, unknown>).length > 0;
  return true;
}

export default function RetargetingPage(): JSX.Element {
  const { source, updatedAt, markFresh } = useDataFreshness('live');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await fetch('/api/marketing/campaigns', { method: 'GET' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { campaigns?: CampaignRow[] };
      setCampaigns(Array.isArray(data.campaigns) ? data.campaigns : []);
      setLoadError(null);
      markFresh();
    } catch (err) {
      console.error('[retargeting] fetch failed:', err);
      setLoadError('Could not load campaign audiences — try refreshing.');
    } finally {
      setLoading(false);
    }
  }, [markFresh]);

  useEffect(() => {
    void load();
  }, [load]);

  const withAudience = campaigns.filter((c) => hasAudience(c.audienceJson));

  return (
    <PlatformShell pageTitle="Retargeting">
      <div className="space-y-5 max-w-[1700px]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <MarketingStudioTabs active="retargeting" />
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
            <Target size={14} className="text-accent" />
            <span>
              Retargeting audiences build from an <span className="font-semibold">AdCampaign</span>
              &apos;s <span className="font-semibold mono">audienceJson</span> — the only real
              audience data in the schema today. No hashed-match rates, reach, or rake ledger exist
              yet, so this page will not invent them.
            </span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard label="Campaigns" value={campaigns.length} />
          <KpiCard label="With an audience set" value={withAudience.length} />
          <KpiCard
            label="Providers in use"
            value={new Set(withAudience.map((c) => c.provider)).size}
          />
        </div>

        <Section
          title={`Campaign audiences · ${withAudience.length}`}
          subtitle="AdCampaign rows where audienceJson is non-empty"
        >
          {loading ? (
            <div className="text-center py-12 text-[12.5px] text-muted">Loading…</div>
          ) : withAudience.length === 0 ? (
            <RetargetingEmpty />
          ) : (
            <ul className="space-y-2">
              {withAudience.map((c) => (
                <li
                  key={c.id}
                  className="border border-line2 rounded-md p-3 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
                      <Users size={12} className="text-accent" />
                      {c.objective}
                    </div>
                    <div className="text-[10.5px] text-muted mt-0.5">
                      {c.account} · {c.provider} · {c.status}
                    </div>
                    <pre className="mt-2 text-[10.5px] font-mono text-muted bg-paper border border-line2 rounded p-2 overflow-x-auto max-w-[520px]">
                      {JSON.stringify(c.audienceJson, null, 2)}
                    </pre>
                  </div>
                  <Link
                    href="/marketing-studio/campaigns"
                    className="shrink-0 text-[11px] text-accent font-medium inline-flex items-center gap-1 hover:underline"
                  >
                    Open in Campaigns <ArrowUpRight size={11} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </PlatformShell>
  );
}
