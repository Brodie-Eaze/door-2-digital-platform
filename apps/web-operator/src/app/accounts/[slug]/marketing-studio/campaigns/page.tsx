'use client';

/**
 * Per-account campaigns — real AdCampaign rows. The schema has no
 * impressions/clicks/conversions/ROAS fields (no ad-performance ingestion
 * exists yet), so this page shows only what's real: provider, objective,
 * budget, status, dates, and the linked creatives. Pause/resume/new-campaign
 * remain disclosed toast placeholders until the publish-service write path
 * ships.
 *
 * Live wire: GET /api/orgs/[slug]/marketing/campaigns (resolveAccountOrg-scoped).
 */
import { use, useCallback, useEffect, useState } from 'react';
import { Megaphone, ExternalLink, Plus, X } from 'lucide-react';
import { Banner, Button, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { MarketingStudioTabs } from '@/components/marketing-studio-tabs';
import { MarketingCampaignsEmpty } from '@/components/AccountEmptyStates';
import { firstRunSnapshot } from '@/lib/first-run';
import { toast } from '@/components/Toaster';
import { DataSourceBadge } from '@/components/DataSourceBadge';

interface ApiCreativeRef {
  id: string;
  type: string;
  prompt: string | null;
  c2paManifestId: string | null;
}

interface ApiCampaign {
  id: string;
  campaignId: string | null;
  provider: string;
  objective: string;
  audienceJson: unknown;
  budgetCents: string;
  status: string;
  externalCampaignId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  adAccount: { provider: string; externalId: string; status: string };
  creatives: ApiCreativeRef[];
}

function statusTone(s: string): 'success' | 'muted' | 'warn' | 'info' {
  switch (s) {
    case 'active':
      return 'success';
    case 'ended':
      return 'muted';
    case 'paused':
      return 'warn';
    default:
      return 'info';
  }
}

export default function Page({
  params: paramsPromise,
}: {
  params: Promise<{ slug: string }>;
}): JSX.Element {
  const params = use(paramsPromise);
  const firstRun = firstRunSnapshot(params.slug);
  const [campaigns, setCampaigns] = useState<ApiCampaign[] | null>(null);
  const [region, setRegion] = useState<'AU' | 'US' | 'SG'>('US');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoadError(null);
    try {
      const res = await fetch(`/api/orgs/${encodeURIComponent(params.slug)}/marketing/campaigns`, {
        credentials: 'include',
      });
      if (!res.ok) {
        setLoadError('Could not load campaigns — please retry.');
        setCampaigns([]);
        return;
      }
      const json = (await res.json()) as {
        campaigns: ApiCampaign[];
        org?: { regionCode?: 'AU' | 'US' | 'SG' };
      };
      setCampaigns(json.campaigns);
      if (json.org?.regionCode) setRegion(json.org.regionCode);
    } catch {
      setLoadError('Could not load campaigns — please retry.');
      setCampaigns([]);
    }
  }, [params.slug]);

  useEffect(() => {
    // W3 fix: no longer gated on the fixture-keyed firstRunSnapshot — see
    // brand-safety/page.tsx for the full rationale. Real "empty" is decided
    // below from `rows.length === 0` (the actual API result).
    void load();
  }, [load]);

  const rows = campaigns ?? [];
  const opened = openId ? rows.find((c) => c.id === openId) : null;
  const totalBudget = rows.reduce((s, c) => s + BigInt(c.budgetCents), 0n);
  const active = rows.filter((c) => c.status === 'active').length;

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Marketing Studio · Campaigns">
      <div className="space-y-5 max-w-[1700px]">
        <MarketingStudioTabs slug={params.slug} active="campaigns" />

        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Megaphone size={14} className="text-accent" />
            <span>
              {rows.length} campaign{rows.length === 1 ? '' : 's'} for this account. Ad-performance
              ingestion (spend/impressions/conversions/ROAS) isn&apos;t wired yet — this shows what
              the platform actually tracks: budget, status, and linked creatives.
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
        ) : campaigns === null ? (
          <div className="card card-pad text-center py-10 text-[12px] text-muted">
            Loading campaigns…
          </div>
        ) : rows.length === 0 ? (
          <MarketingCampaignsEmpty
            slug={params.slug}
            accountName={firstRun.accountName}
            placement="page"
          />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <KpiCard label="Campaigns" value={rows.length} hint={`${active} active`} />
              <KpiCard
                label="Budget allocated"
                value={<Money cents={totalBudget} region={region} />}
              />
              <KpiCard label="Active" value={active} deltaTone="positive" />
            </div>

            <Section
              title={`Campaigns · ${rows.length}`}
              subtitle="Row click opens creative + audience detail"
              paddedBody={false}
              action={
                <div className="flex items-center gap-2">
                  <DataSourceBadge source="live" />
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Plus size={13} />}
                    onClick={() => toast.info('New campaign builder — not wired yet')}
                  >
                    New campaign
                  </Button>
                </div>
              }
            >
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Provider</th>
                    <th>Objective</th>
                    <th>Budget</th>
                    <th>Creatives</th>
                    <th>Status</th>
                    <th>Started</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr
                      key={c.id}
                      className="cursor-pointer hover:bg-paper"
                      onClick={() => setOpenId(c.id)}
                    >
                      <td>
                        <div className="text-[10px] text-muted font-mono">{c.id}</div>
                        {c.externalCampaignId && (
                          <div className="text-[10px] text-soft">ext: {c.externalCampaignId}</div>
                        )}
                      </td>
                      <td className="text-[12px] text-ink capitalize">{c.provider}</td>
                      <td className="text-[12px] text-ink">{c.objective}</td>
                      <td className="text-[12px] text-ink">
                        <Money cents={BigInt(c.budgetCents)} region={region} emptyAsDash />
                      </td>
                      <td className="text-[12px] text-ink numeric">{c.creatives.length}</td>
                      <td>
                        <StatusPill tone={statusTone(c.status)}>{c.status}</StatusPill>
                      </td>
                      <td className="text-[11.5px] text-muted numeric">
                        {c.startedAt ? new Date(c.startedAt).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toast.info(`Open ${c.provider} campaign manager — not wired yet`);
                          }}
                          className="w-6 h-6 rounded hover:bg-paper flex items-center justify-center text-soft"
                          title="Open in channel dashboard"
                        >
                          <ExternalLink size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          </>
        )}
      </div>

      {opened && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setOpenId(null)}>
          <div className="flex-1 bg-ink/40 backdrop-blur-sm" />
          <aside
            className="w-[520px] max-w-[92vw] bg-surface border-l border-line2 h-full overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-line2 sticky top-0 bg-surface z-10">
              <div>
                <div className="text-[12.5px] font-semibold text-ink">{opened.objective}</div>
                <div className="text-[10.5px] text-muted font-mono">{opened.id}</div>
              </div>
              <button
                type="button"
                onClick={() => setOpenId(null)}
                className="w-7 h-7 rounded hover:bg-paper flex items-center justify-center text-soft"
                title="Close"
              >
                <X size={14} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                <Meta label="Provider" value={opened.provider} />
                <Meta label="Status" value={opened.status} />
                <Meta
                  label="Budget"
                  value={<Money cents={BigInt(opened.budgetCents)} region={region} emptyAsDash />}
                />
                <Meta
                  label="Started"
                  value={opened.startedAt ? new Date(opened.startedAt).toLocaleDateString() : '—'}
                />
                <Meta label="Ad account" value={opened.adAccount.externalId} />
                <Meta label="Ad account status" value={opened.adAccount.status} />
              </div>
              <div>
                <div className="text-[10.5px] uppercase tracking-wider text-muted font-medium mb-2">
                  Audience (audienceJson)
                </div>
                <pre className="text-[10px] font-mono text-ink bg-paper border border-line2 rounded-md p-2.5 whitespace-pre-wrap leading-relaxed">
                  {JSON.stringify(opened.audienceJson, null, 2)}
                </pre>
              </div>
              <div>
                <div className="text-[10.5px] uppercase tracking-wider text-muted font-medium mb-2">
                  Creatives · {opened.creatives.length}
                </div>
                {opened.creatives.length === 0 ? (
                  <div className="text-[11.5px] text-muted">No creatives linked yet.</div>
                ) : (
                  <ul className="space-y-1.5">
                    {opened.creatives.map((cr) => (
                      <li
                        key={cr.id}
                        className="text-[11.5px] text-ink border border-line2 rounded p-2"
                      >
                        <div className="font-medium line-clamp-1">{cr.prompt ?? cr.id}</div>
                        <div className="text-[10px] text-muted font-mono">
                          {cr.id} · {cr.type} {cr.c2paManifestId ? '· C2PA signed' : ''}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </AccountShell>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }): JSX.Element {
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-wider text-muted">{label}</div>
      <div className="text-[11.5px] font-semibold text-ink capitalize">{value}</div>
    </div>
  );
}
