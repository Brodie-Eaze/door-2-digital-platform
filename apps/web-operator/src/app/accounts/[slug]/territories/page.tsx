'use client';

import { use, useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Banner, KpiCard, Section, Skeleton, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { AccountLiveMap } from '@/components/AccountLiveMap';
import { TerritoriesEmpty, FirstRunBanner } from '@/components/AccountEmptyStates';
import { TerritoryAssignments } from '@/components/TerritoryAssignments';
import { CanvassAreaTool } from '@/components/CanvassAreaTool';
import { getAccount } from '@/lib/accounts';
import { firstRunSnapshot } from '@/lib/first-run';

function regionLabel(region: 'AU' | 'US' | 'SG'): string {
  if (region === 'AU') return 'Australia';
  if (region === 'US') return 'United States';
  return 'Singapore';
}

/** Shape returned by GET /api/orgs/[slug]/territories (live Territory rows) —
 *  only the fields this page's KPIs need; CanvassAreaTool and
 *  TerritoryAssignments fetch the same route independently for their own
 *  (richer) needs. */
type ApiTerritory = {
  id: string;
  status: string;
  assignments: Array<{ id: string }>;
};

type AccountIdentity = {
  shortName: string;
  region: 'AU' | 'US' | 'SG';
  vertical: 'charity' | 'commercial' | 'healthcare';
};

/** GET /api/orgs/[slug] response — used only for the identity fallback below. */
type ApiOrg = { tradingName: string; regionCode: 'AU' | 'US' | 'SG'; vertical: string | null };

export default function AccountTerritoriesPage({
  params: paramsPromise,
}: {
  params: Promise<{ slug: string }>;
}): JSX.Element {
  const params = use(paramsPromise);
  const staticAccount = getAccount(params.slug);
  const firstRun = firstRunSnapshot(params.slug);

  // W3 fix: `staticAccount` only resolves for the 4 seeded demo slugs.
  // Any other slug is a REAL org — fetch its identity from the DB instead of
  // treating "not in the fixture" as "doesn't exist / has no data".
  const [liveAccount, setLiveAccount] = useState<AccountIdentity | null | undefined>(undefined);

  useEffect(() => {
    if (staticAccount) return;
    let cancelled = false;
    (async (): Promise<void> => {
      try {
        const res = await fetch(`/api/orgs/${encodeURIComponent(params.slug)}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          if (!cancelled) setLiveAccount(null);
          return;
        }
        const org = (await res.json()) as ApiOrg;
        if (!cancelled) {
          setLiveAccount({
            shortName: org.tradingName,
            region: org.regionCode,
            vertical: (org.vertical as AccountIdentity['vertical']) ?? 'commercial',
          });
        }
      } catch {
        if (!cancelled) setLiveAccount(null);
      }
    })();
    return (): void => {
      cancelled = true;
    };
  }, [params.slug, staticAccount]);

  const account: AccountIdentity | null = staticAccount ?? liveAccount ?? null;
  // Still resolving a real (non-fixture) org's identity — wait before either
  // fetching territories or declaring "no account" (avoids a false empty
  // flash for a real org that just hasn't loaded yet).
  const resolvingAccount = !staticAccount && liveAccount === undefined;
  const skipFetch = resolvingAccount || !account;

  const [territories, setTerritories] = useState<ApiTerritory[] | null>(null);

  useEffect(() => {
    if (skipFetch) return;
    let cancelled = false;
    (async (): Promise<void> => {
      try {
        const res = await fetch(`/api/orgs/${encodeURIComponent(params.slug)}/territories`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`territories ${res.status}`);
        const json = (await res.json()) as { territories?: ApiTerritory[] };
        if (!cancelled) setTerritories(Array.isArray(json.territories) ? json.territories : []);
      } catch {
        if (!cancelled) setTerritories([]);
      }
    })();
    return (): void => {
      cancelled = true;
    };
  }, [params.slug, skipFetch]);

  // Still resolving a real org's identity — show a skeleton, never an empty
  // state, so a real org's data can never flash as "not found".
  if (resolvingAccount) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Territories">
        <div className="space-y-5 max-w-[1700px]">
          <Skeleton height="h-24" rounded="rounded-2xl" />
          <Skeleton height="h-[420px]" rounded="rounded-2xl" />
        </div>
      </AccountShell>
    );
  }

  // Identity resolution finished and found nothing (unknown slug, no DB row)
  // — this is a genuinely nonexistent account, not a data-hiding case.
  if (!account) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Territories">
        <div className="space-y-5 max-w-[1400px]">
          {firstRun.isFirstRun && (
            <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          )}
          <TerritoriesEmpty slug={params.slug} accountName={firstRun.accountName} />
        </div>
      </AccountShell>
    );
  }

  if (territories === null) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Territories">
        <div className="space-y-5 max-w-[1700px]">
          <Skeleton height="h-24" rounded="rounded-2xl" />
          <Skeleton height="h-[420px]" rounded="rounded-2xl" />
        </div>
      </AccountShell>
    );
  }

  if (territories.length === 0) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Territories">
        <div className="space-y-5 max-w-[1400px]">
          <TerritoriesEmpty slug={params.slug} accountName={account.shortName} />
        </div>
      </AccountShell>
    );
  }

  const activeCount = territories.filter((t) => t.status === 'active').length;
  const assignedRepCount = territories.reduce((s, t) => s + t.assignments.length, 0);

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Territories">
      <div className="space-y-5 max-w-[1700px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Sparkles size={13} className="text-accent" />
            <span>
              Propensity scores for <span className="font-semibold">{account.shortName}</span> are
              computed from real knock and conversion history — see the heatmap in the canvass-area
              tool below. External enrichment feeds (census, socio-economic indexes) are on the
              roadmap and not connected yet.
            </span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard
            label="Zones tracked"
            value={territories.length}
            hint={`across ${regionLabel(account.region)}`}
          />
          <KpiCard label="Active" value={activeCount} hint="canvass areas live" />
          <KpiCard label="Reps assigned" value={assignedRepCount} hint="across all zones" />
        </div>

        {/* Keep the live-map section — that's the rep/operator view */}
        <Section
          title={`Live territory map · ${account.shortName}`}
          subtitle="Real reps on real ground · AI zones flagged with blue halos · toggle Satellite ↔ Streets top-right"
        >
          <AccountLiveMap accountSlug={params.slug} />
        </Section>

        {/* Manager canvass-area tool — set the AREA (radius/polygon) reps
            canvass, guided by the real propensity heatmap (real PropensityScore
            rows via /api/orgs/[slug]/propensity); pushes to iOS. This is the
            live replacement for the old fixture-driven "propensity heatmap"
            section — territory-level propensity ranking (AI-suggested /
            low-yield) isn't in the DB at per-territory granularity yet, so we
            don't fabricate a ranked zones table here. */}
        <CanvassAreaTool slug={params.slug} />

        {/* Live knocker → territory assignment (writes to the iOS map) */}
        <TerritoryAssignments slug={params.slug} />

        <Section
          title="External data feeding the propensity model — roadmap"
          subtitle={`Reference only · no ${account.region} enrichment feed is connected yet`}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(account.region === 'AU'
              ? [
                  {
                    name: 'ABS SEIFA',
                    detail: 'AU socio-economic indexes by SA1',
                    status: 'roadmap',
                  },
                  { name: 'CoreLogic AU', detail: 'AU property values + rents', status: 'roadmap' },
                  {
                    name: 'ACNC donor data',
                    detail: 'Charity giving propensity',
                    status: 'roadmap',
                  },
                  { name: 'Mapbox AU', detail: 'Postal + LGA polygons', status: 'roadmap' },
                  { name: 'AusPost addresses', detail: 'Door-level corpus', status: 'roadmap' },
                ]
              : account.region === 'SG'
                ? [
                    {
                      name: 'SingStat',
                      detail: 'SG demographics + planning area',
                      status: 'roadmap',
                    },
                    { name: 'OneMap', detail: 'SG addresses + polygons', status: 'roadmap' },
                  ]
                : [
                    {
                      name: 'ACS / US Census',
                      detail: 'Income · age · density · housing',
                      status: 'not configured',
                    },
                    {
                      name: 'ESRI Tapestry',
                      detail: '67 lifestyle segments by tract',
                      status: 'not configured',
                    },
                    {
                      name: 'Mapbox Boundaries',
                      detail: 'Postal + admin polygons',
                      status: 'not configured',
                    },
                    {
                      name: 'OpenAddresses',
                      detail: 'Door-level corpus',
                      status: 'not configured',
                    },
                    {
                      name:
                        account.vertical === 'commercial'
                          ? 'Pest infestation index'
                          : account.vertical === 'healthcare'
                            ? 'CDC public health'
                            : 'Charity Navigator',
                      detail: 'Vertical-specific signal',
                      status: 'not configured',
                    },
                  ]
            )
              .concat([
                {
                  name: `${account.shortName} knock/conversion history`,
                  detail: 'Real — powers the propensity signal today',
                  status: 'live',
                },
              ])
              .map((s) => (
                <div key={s.name} className="card card-pad">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-semibold text-ink truncate">{s.name}</div>
                      <div className="text-[10.5px] text-muted mt-0.5">{s.detail}</div>
                    </div>
                    <span className="tag !text-[9px]">{account.region}</span>
                  </div>
                  <div className="mt-2">
                    <StatusPill tone={s.status === 'live' ? 'success' : 'muted'}>
                      {s.status}
                    </StatusPill>
                  </div>
                </div>
              ))}
          </div>
        </Section>
      </div>
    </AccountShell>
  );
}
