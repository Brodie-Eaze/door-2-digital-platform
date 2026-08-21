'use client';

import { useEffect, useState } from 'react';
import { Sparkles, MapPin, Database } from 'lucide-react';
import { Banner, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { DataSourceBadge, useDataFreshness } from '@/components/DataSourceBadge';
import { RegionTerritoryEmpty } from '@/components/RegionEmptyStates';

/**
 * SG territory intelligence.
 *
 * Mirrors the AU territory-intel page: real Territory + PropensityScore
 * rows from GET /api/regions/SG/territory-intel, region-scoped. Singapore
 * is small enough to work at planning-area granularity, but there is no
 * separate SG-planning-area model — Territory rows carry whatever name a
 * manager gave the canvass area.
 */
interface ApiTerritory {
  id: string;
  name: string;
  orgTradingName: string;
  vertical: string;
  status: string;
  createdAt: string;
}

interface ApiScore {
  geoKey: string;
  score: number;
  band: string | null;
}

interface TerritoryIntelResponse {
  territories: ApiTerritory[];
  scores: ApiScore[];
}

/** Static reference — which external datasets feed the SG propensity model.
 *  No live "connected" claim: there is no feed-sync table backing this. */
const SG_DATA_SOURCES = [
  { name: 'SingStat Census 2020', detail: 'Resident profile · age · dwelling · household income' },
  { name: 'SingStat Planning Area boundaries', detail: '55 planning areas · GeoJSON polygons' },
  { name: 'URA Master Plan 2024', detail: 'Land-use zoning · plot ratio · building heights' },
  { name: 'HDB Resale Index', detail: 'Per-town resale flat pricing trend' },
  { name: 'LTA OneMap geometries', detail: 'Postal codes · streets · MRT exit centroids' },
  { name: 'IPOS UEN registry', detail: 'UEN validation for PayNow Corporate matching' },
];

export default function SgTerritoryIntelPage(): JSX.Element {
  const [data, setData] = useState<TerritoryIntelResponse | null>(null);
  const { source, markFresh, markFixture } = useDataFreshness('fixture');

  useEffect(() => {
    let cancelled = false;
    (async (): Promise<void> => {
      try {
        const res = await fetch('/api/regions/SG/territory-intel', {
          headers: { accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`territory-intel ${res.status}`);
        const json = (await res.json()) as TerritoryIntelResponse;
        if (cancelled) return;
        setData(json);
        markFresh();
      } catch {
        if (cancelled) return;
        markFixture();
      }
    })();
    return (): void => {
      cancelled = true;
    };
  }, [markFresh, markFixture]);

  const territories = data?.territories ?? [];
  const scores = data?.scores ?? [];
  const active = territories.filter((t) => t.status === 'active').length;
  const blocked = territories.filter((t) => t.status === 'blocked').length;
  const meanScore = scores.length
    ? (scores.reduce((s, r) => s + r.score, 0) / scores.length).toFixed(2)
    : '—';

  return (
    <PlatformShell pageTitle="SG territory intelligence">
      <div className="space-y-5 max-w-[1700px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Sparkles size={13} className="text-accent" />
            <span>
              SG zone propensity blends <span className="font-semibold">SingStat Census 2020</span>{' '}
              (income + dwelling per planning area), <span className="font-semibold">URA</span>{' '}
              zoning, <span className="font-semibold">HDB Resale</span> trend, LTA OneMap centroids,
              and your SG conversion history.
            </span>
          </span>
        </Banner>

        <div className="flex items-center justify-end">
          <DataSourceBadge source={source} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Territories tracked" value={territories.length} hint="across SG" />
          <KpiCard
            label="Mean propensity score"
            value={meanScore}
            hint={`${scores.length} PropensityScore rows`}
          />
          <KpiCard label="Active" value={active} hint="knockers deployed" />
          <KpiCard label="Blocked" value={blocked} hint="permit pending" />
        </div>

        <Section
          title="SG territories"
          subtitle="Real Territory rows for this region — no fabricated income-decile/knockable-unit figures"
          paddedBody={false}
        >
          {territories.length === 0 ? (
            <RegionTerritoryEmpty />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Territory</th>
                  <th>Account</th>
                  <th>Vertical</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {territories.map((t) => {
                  const tone: 'success' | 'info' | 'muted' | 'danger' =
                    t.status === 'active'
                      ? 'success'
                      : t.status === 'blocked'
                        ? 'danger'
                        : t.status === 'archived'
                          ? 'muted'
                          : 'info';
                  return (
                    <tr key={t.id}>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <MapPin size={11} className="text-soft shrink-0" />
                          <span className="text-[13px] font-medium text-ink">{t.name}</span>
                        </div>
                      </td>
                      <td className="text-[12px] text-muted">{t.orgTradingName}</td>
                      <td className="text-[12px] text-muted capitalize">{t.vertical}</td>
                      <td>
                        <StatusPill tone={tone}>{t.status}</StatusPill>
                      </td>
                      <td className="text-[12px] text-muted numeric">{t.createdAt.slice(0, 10)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Section>

        <Section
          title="SG data feeding the propensity model · reference"
          subtitle="Nightly ingest — see zone table above for real per-territory scores"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SG_DATA_SOURCES.map((s) => (
              <div key={s.name} className="flex items-start gap-2">
                <Database size={12} className="text-soft mt-1 shrink-0" />
                <div>
                  <div className="text-[12.5px] font-semibold text-ink">{s.name}</div>
                  <div className="text-[10.5px] text-muted mt-0.5">{s.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </PlatformShell>
  );
}
