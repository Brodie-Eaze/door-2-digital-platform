'use client';

import { use, useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Banner, KpiCard, Section, Skeleton, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { AccountLiveMap } from '@/components/AccountLiveMap';
import { TerritoriesEmpty } from '@/components/AccountEmptyStates';
import { TerritoryAssignments } from '@/components/TerritoryAssignments';
import { CanvassAreaTool } from '@/components/CanvassAreaTool';
import { useAccountMeta, prettifySlug } from '@/lib/use-account-meta';

function regionLabel(region: string): string {
  if (region === 'AU') return 'Australia';
  if (region === 'US') return 'United States';
  if (region === 'SG') return 'Singapore';
  return region;
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

export default function AccountTerritoriesPage({
  params: paramsPromise,
}: {
  params: Promise<{ slug: string }>;
}): JSX.Element {
  const params = use(paramsPromise);
  const meta = useAccountMeta(params.slug);
  const accountName = meta?.name ?? prettifySlug(params.slug);
  const accountRegion = meta?.region ?? 'US';
  const accountVertical = meta?.vertical ?? 'commercial';

  const [territories, setTerritories] = useState<ApiTerritory[] | null>(null);

  useEffect(() => {
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
  }, [params.slug]);

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
          <TerritoriesEmpty slug={params.slug} accountName={accountName} />
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
              Propensity scores for <span className="font-semibold">{accountName}</span> are
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
            hint={`across ${regionLabel(accountRegion)}`}
          />
          <KpiCard label="Active" value={activeCount} hint="canvass areas live" />
          <KpiCard label="Reps assigned" value={assignedRepCount} hint="across all zones" />
        </div>

        {/* Keep the live-map section — that's the rep/operator view */}
        <Section
          title={`Live territory map · ${accountName}`}
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
          subtitle={`Reference only · no ${accountRegion} enrichment feed is connected yet`}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(accountRegion === 'AU'
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
              : accountRegion === 'SG'
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
                        accountVertical === 'commercial'
                          ? 'Pest infestation index'
                          : accountVertical === 'healthcare'
                            ? 'CDC public health'
                            : 'Charity Navigator',
                      detail: 'Vertical-specific signal',
                      status: 'not configured',
                    },
                  ]
            )
              .concat([
                {
                  name: `${accountName} knock/conversion history`,
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
                    <span className="tag !text-[9px]">{accountRegion}</span>
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
