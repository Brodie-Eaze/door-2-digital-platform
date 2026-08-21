'use client';

/**
 * Per-account retargeting — there is no dedicated retargeting-cohort model.
 * The only real audience data D2D has is `AdCampaign.audienceJson`, so this
 * surface lists campaigns that carry an audience definition instead of
 * fabricating cohort volumes, match rates, or a rake ledger.
 *
 * Live wire: GET /api/orgs/[slug]/marketing/campaigns (shared with the
 * Campaigns tab — resolveAccountOrg-scoped).
 */
import { use, useCallback, useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import { Banner, Button, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { MarketingStudioTabs } from '@/components/marketing-studio-tabs';
import { RetargetingEmpty } from '@/components/AccountMarketingEmptyStates';
import { firstRunSnapshot } from '@/lib/first-run';
import { DataSourceBadge } from '@/components/DataSourceBadge';

interface ApiCampaign {
  id: string;
  provider: string;
  objective: string;
  audienceJson: unknown;
  budgetCents: string;
  status: string;
  createdAt: string;
}

export default function Page({
  params: paramsPromise,
}: {
  params: Promise<{ slug: string }>;
}): JSX.Element {
  const params = use(paramsPromise);
  const firstRun = firstRunSnapshot(params.slug);
  const [campaigns, setCampaigns] = useState<ApiCampaign[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [region, setRegion] = useState<'AU' | 'US' | 'SG'>('US');

  const load = useCallback(async (): Promise<void> => {
    setLoadError(null);
    try {
      const res = await fetch(`/api/orgs/${encodeURIComponent(params.slug)}/marketing/campaigns`, {
        credentials: 'include',
      });
      if (!res.ok) {
        setLoadError('Could not load retargeting data — please retry.');
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
      setLoadError('Could not load retargeting data — please retry.');
      setCampaigns([]);
    }
  }, [params.slug]);

  useEffect(() => {
    // W3 fix: no longer gated on the fixture-keyed firstRunSnapshot — see
    // brand-safety/page.tsx for the full rationale. Real "empty" is decided
    // below from `withAudience.length === 0` (the actual API result).
    void load();
  }, [load]);

  const withAudience = (campaigns ?? []).filter(
    (c) => c.audienceJson !== null && typeof c.audienceJson === 'object',
  );
  const totalBudget = withAudience.reduce((s, c) => s + BigInt(c.budgetCents), 0n);
  const activeCount = withAudience.filter((c) => c.status === 'active').length;

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Marketing Studio · Retargeting">
      <div className="space-y-5 max-w-[1700px]">
        <MarketingStudioTabs slug={params.slug} active="retargeting" />

        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Target size={14} className="text-accent" />
            <span>
              Retargeting audiences live on the campaign that targets them —{' '}
              <span className="font-semibold mono">AdCampaign.audienceJson</span>. There is no
              separate cohort, reach, or match-rate model yet; this lists every campaign that
              carries an audience definition.
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
            Loading retargeting audiences…
          </div>
        ) : withAudience.length === 0 ? (
          <RetargetingEmpty
            slug={params.slug}
            accountName={firstRun.accountName}
            placement="page"
          />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <KpiCard label="Campaigns with an audience" value={withAudience.length} />
              <KpiCard label="Active" value={activeCount} />
              <KpiCard
                label="Budget allocated"
                value={<Money cents={totalBudget} region={region} />}
                hint="sum of AdCampaign.budgetCents"
              />
            </div>

            <Section
              title={`Campaigns · ${withAudience.length}`}
              subtitle="audienceJson is the account's audience definition — shown as recorded, not interpreted"
              paddedBody={false}
              action={<DataSourceBadge source="live" />}
            >
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Provider</th>
                    <th>Objective</th>
                    <th>Budget</th>
                    <th>Status</th>
                    <th>Audience</th>
                  </tr>
                </thead>
                <tbody>
                  {withAudience.map((c) => (
                    <tr key={c.id}>
                      <td className="mono text-[11px] text-ink">{c.id}</td>
                      <td className="text-[12px] text-muted capitalize">{c.provider}</td>
                      <td className="text-[12px] text-ink">{c.objective}</td>
                      <td className="text-[12px] text-ink">
                        <Money cents={BigInt(c.budgetCents)} region={region} emptyAsDash />
                      </td>
                      <td>
                        <StatusPill tone={c.status === 'active' ? 'success' : 'muted'}>
                          {c.status}
                        </StatusPill>
                      </td>
                      <td>
                        <pre className="text-[10px] font-mono text-muted whitespace-pre-wrap max-w-[360px] leading-snug">
                          {JSON.stringify(c.audienceJson, null, 0)}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          </>
        )}
      </div>
    </AccountShell>
  );
}
