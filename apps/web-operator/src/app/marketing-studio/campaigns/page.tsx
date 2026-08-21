'use client';

import { useCallback, useEffect, useState } from 'react';
import { Megaphone, X, FileCheck2, RefreshCw, DollarSign, Calendar, Users } from 'lucide-react';
import { Banner, Button, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { MarketingStudioTabs } from '@/components/marketing-studio-tabs';
import { DataSourceBadge, useDataFreshness } from '@/components/DataSourceBadge';
import { pickCreativeImage, inferTheme } from '@/lib/creative-images';
import { CampaignsEmpty } from '@/components/MarketingEmptyStates';

/**
 * Marketing campaigns dashboard — every `AdCampaign` row across HQ orgs.
 *
 * The fixture version showed spend/impressions/clicks/ROAS/attribution-source
 * and a 14-day daily-spend sparkline — none of that exists on `AdCampaign`.
 * The real columns are objective, provider, adAccountId, audienceJson,
 * budgetCents, status, started/endedAt, plus its `Creative[]` children. Once
 * delivery metrics land on a real model this page reads that table too.
 */

interface CampaignCreative {
  id: string;
  type: string;
  assetKey: string;
  prompt: string | null;
  costCents: string;
  approvedAt: string | null;
  c2paManifestId: string | null;
}

interface CampaignRow {
  id: string;
  account: string;
  campaignId: string | null;
  adAccountId: string;
  adAccount: { provider: string; externalId: string; status: string } | null;
  provider: string;
  objective: string;
  audienceJson: unknown;
  budgetCents: string;
  status: string;
  externalCampaignId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  creatives: CampaignCreative[];
}

function statusTone(s: string): 'success' | 'warn' | 'info' | 'muted' {
  switch (s) {
    case 'active':
      return 'success';
    case 'paused':
      return 'warn';
    case 'draft':
      return 'info';
    default:
      return 'muted';
  }
}

export default function CampaignsPage(): JSX.Element {
  const { source, updatedAt, markFresh } = useDataFreshness('live');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

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
      console.error('[campaigns] fetch failed:', err);
      setLoadError('Could not load campaigns — try refreshing.');
    } finally {
      setLoading(false);
    }
  }, [markFresh]);

  useEffect(() => {
    void load();
  }, [load]);

  const opened = openId ? campaigns.find((c) => c.id === openId) : null;
  const active = campaigns.filter((c) => c.status === 'active').length;
  const totalBudgetCents = campaigns.reduce((s, c) => s + BigInt(c.budgetCents || '0'), 0n);
  const totalCreatives = campaigns.reduce((s, c) => s + c.creatives.length, 0);

  return (
    <PlatformShell pageTitle="Campaigns — every provider">
      <div className="space-y-5 max-w-[1700px]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <MarketingStudioTabs active="campaigns" />
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
            <Megaphone size={14} className="text-accent" />
            <span>
              Every row is a real <span className="font-semibold">AdCampaign</span>. Delivery
              metrics (spend, impressions, ROAS) aren&apos;t on this model yet — once a delivery
              webhook writes them, they render here.
            </span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Campaigns" value={campaigns.length} hint={`${active} active`} />
          <KpiCard label="Total budget" value={<Money cents={totalBudgetCents} region="US" />} />
          <KpiCard label="Creatives attached" value={totalCreatives} />
          <KpiCard label="Providers used" value={new Set(campaigns.map((c) => c.provider)).size} />
        </div>

        <Section
          title={`Campaigns · ${campaigns.length}`}
          subtitle="Row click loads creatives + audience detail in the side panel"
          paddedBody={false}
        >
          {loading ? (
            <div className="text-center py-12 text-[12.5px] text-muted">Loading…</div>
          ) : campaigns.length === 0 ? (
            <CampaignsEmpty />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Account</th>
                  <th>Provider</th>
                  <th>Objective</th>
                  <th>Budget</th>
                  <th>Creatives</th>
                  <th>Status</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr
                    key={c.id}
                    className="cursor-pointer hover:bg-paper"
                    onClick={() => setOpenId(c.id)}
                  >
                    <td>
                      <span className="mono text-[10px] !w-auto !px-2">{c.id}</span>
                    </td>
                    <td className="text-[12px] text-ink">{c.account}</td>
                    <td className="text-[12px] text-muted">{c.provider}</td>
                    <td className="text-[12px] text-ink">{c.objective}</td>
                    <td className="text-[12px] text-ink">
                      <Money cents={BigInt(c.budgetCents || '0')} region="US" emptyAsDash />
                    </td>
                    <td className="text-[12px] text-ink numeric">{c.creatives.length}</td>
                    <td>
                      <StatusPill tone={statusTone(c.status)}>{c.status}</StatusPill>
                    </td>
                    <td className="text-[11.5px] text-muted numeric">
                      {c.startedAt ? new Date(c.startedAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>

      {opened && <CampaignDrawer campaign={opened} onClose={() => setOpenId(null)} />}
    </PlatformShell>
  );
}

function CampaignDrawer({
  campaign,
  onClose,
}: {
  campaign: CampaignRow;
  onClose: () => void;
}): JSX.Element {
  const audienceText = (() => {
    try {
      return JSON.stringify(campaign.audienceJson, null, 2);
    } catch {
      return String(campaign.audienceJson);
    }
  })();

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-ink/40 backdrop-blur-sm" />
      <aside
        className="w-[640px] max-w-[92vw] bg-surface border-l border-line2 h-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-line2 sticky top-0 bg-surface z-10">
          <div>
            <div className="text-[13px] font-semibold text-ink">{campaign.objective}</div>
            <div className="text-[10.5px] text-muted font-mono">
              {campaign.id} · {campaign.account}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded hover:bg-paper flex items-center justify-center text-soft"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <DrawerMetric
              label="Budget"
              value={<Money cents={BigInt(campaign.budgetCents || '0')} region="US" emptyAsDash />}
              icon={<DollarSign size={11} className="text-accent" />}
            />
            <DrawerMetric
              label="Status"
              value={<StatusPill tone={statusTone(campaign.status)}>{campaign.status}</StatusPill>}
              icon={<Megaphone size={11} className="text-accent" />}
            />
            <DrawerMetric
              label="Started"
              value={campaign.startedAt ? new Date(campaign.startedAt).toLocaleDateString() : '—'}
              icon={<Calendar size={11} className="text-accent" />}
            />
          </div>

          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-muted font-medium mb-1.5 flex items-center gap-1.5">
              <Users size={11} /> Audience
            </div>
            <pre className="border border-line2 rounded-md p-3 bg-paper text-[10.5px] text-ink font-mono overflow-x-auto whitespace-pre-wrap">
              {audienceText}
            </pre>
          </div>

          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-muted font-medium mb-2">
              Creatives in this campaign · {campaign.creatives.length}
            </div>
            {campaign.creatives.length === 0 ? (
              <div className="text-[11.5px] text-muted">No creatives attached yet.</div>
            ) : (
              <div className="grid grid-cols-3 gap-2.5">
                {campaign.creatives.map((cr) => (
                  <div key={cr.id} className="card overflow-hidden">
                    <div className="aspect-square relative overflow-hidden bg-paper">
                      <img
                        src={pickCreativeImage(
                          inferTheme({ headline: cr.prompt ?? cr.id, copy: cr.prompt ?? '' }),
                          cr.id,
                          { w: 300, h: 300 },
                        )}
                        alt={cr.prompt ?? cr.id}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      {cr.c2paManifestId && (
                        <div className="absolute top-1.5 right-1.5">
                          <span
                            className="inline-flex items-center gap-1 bg-surface/95 rounded text-[8.5px] uppercase tracking-wider px-1.5 py-0.5 font-semibold text-success"
                            title="C2PA signed"
                          >
                            <FileCheck2 size={8} /> C2PA
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-1.5 flex items-center justify-between text-[10px] text-muted">
                      <span className="font-mono">{cr.id}</span>
                      <span className="capitalize">{cr.type}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function DrawerMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
}): JSX.Element {
  return (
    <div className="border border-line2 rounded-md p-2">
      <div className="flex items-center gap-1 text-[9.5px] uppercase tracking-wider text-muted font-medium">
        {icon}
        {label}
      </div>
      <div className="text-[13px] font-semibold text-ink mt-0.5 numeric">{value}</div>
    </div>
  );
}
