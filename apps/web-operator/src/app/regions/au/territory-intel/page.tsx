'use client';

import { useEffect, useState } from 'react';
import { Sparkles, MapPin, Database } from 'lucide-react';
import { Banner, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { DataSourceBadge, useDataFreshness } from '@/components/DataSourceBadge';
import { RegionTerritoryEmpty } from '@/components/RegionEmptyStates';

/** Real Territory row for the region, from GET /api/regions/AU/territory-intel. */
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

/** Static reference — which external datasets feed the AU propensity model.
 *  No live "connected" claim: there is no feed-sync table backing this. */
const AU_DATA_SOURCES = [
  {
    name: 'ABS SEIFA 2021',
    detail: 'Index of Relative Socio-Economic Disadvantage · decile per SA1',
  },
  { name: 'ABS Mesh Blocks', detail: '~358k boundaries · finest census geography' },
  { name: 'ABS Census 2021', detail: 'Income · age · household · dwelling cross-tabs per SA2' },
  { name: 'Australia Post PAF', detail: 'Postal Address File · deliverable addresses · DPID' },
  { name: 'CoreLogic AU', detail: 'Property values · rental yields · transactions per LGA' },
  { name: 'CHOICE DNK registry', detail: 'Address-level Do Not Knock opt-out flags' },
  { name: 'ACMA DNCR', detail: 'Do Not Call Register · live wash on phone fields' },
];

/** Anchor points for the decorative silhouette — geographic labels only, not
 *  business data. */
interface AuCity {
  name: string;
  x: number;
  y: number;
}

const AU_CITIES: AuCity[] = [
  { name: 'Perth', x: 12, y: 60 },
  { name: 'Darwin', x: 38, y: 18 },
  { name: 'Adelaide', x: 52, y: 75 },
  { name: 'Melbourne', x: 68, y: 86 },
  { name: 'Canberra', x: 76, y: 78 },
  { name: 'Sydney', x: 82, y: 70 },
  { name: 'Brisbane', x: 82, y: 50 },
  { name: 'Hobart', x: 70, y: 96 },
];

export default function AuTerritoryIntelPage(): JSX.Element {
  const [data, setData] = useState<TerritoryIntelResponse | null>(null);
  const { source, markFresh, markFixture } = useDataFreshness('fixture');

  useEffect(() => {
    let cancelled = false;
    (async (): Promise<void> => {
      try {
        const res = await fetch('/api/regions/AU/territory-intel', {
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
    <PlatformShell pageTitle="AU territory intelligence">
      <div className="space-y-5 max-w-[1700px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Sparkles size={13} className="text-accent" />
            <span>
              AU zone propensity blends <span className="font-semibold">ABS SEIFA</span> (decile per
              SA1), <span className="font-semibold">Mesh Block</span> density, ABS Census income
              cross-tabs, CoreLogic dwelling values, and your AU conversion history. Zones in WA are
              gated until the WA paid-solicitor registration clears.
            </span>
          </span>
        </Banner>

        <div className="flex items-center justify-end">
          <DataSourceBadge source={source} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Territories tracked" value={territories.length} hint="across AU" />
          <KpiCard
            label="Mean propensity score"
            value={meanScore}
            hint={`${scores.length} PropensityScore rows`}
          />
          <KpiCard label="Active" value={active} hint="knockers deployed" />
          <KpiCard label="Blocked" value={blocked} hint="registration pending" />
        </div>

        <Section
          title="AU coverage map"
          subtitle="Capital cities labelled — see the zone table below for real propensity scores"
        >
          <div className="bg-ink rounded-xl overflow-hidden relative" style={{ height: 340 }}>
            <div
              className="absolute inset-0 grid"
              style={{
                gridTemplateColumns: 'repeat(22, 1fr)',
                gridTemplateRows: 'repeat(14, 1fr)',
                gap: 1,
              }}
            >
              {Array.from({ length: 22 * 14 }).map((_, i) => {
                const col = i % 22;
                const row = Math.floor(i / 22);
                const onLand = isAuLand(col, row);
                return (
                  <div
                    key={i}
                    style={{ background: onLand ? 'rgba(148,163,184,0.18)' : 'transparent' }}
                  />
                );
              })}
            </div>

            {AU_CITIES.map((c) => (
              <div
                key={c.name}
                className="absolute text-surface text-[11px] font-semibold drop-shadow-md pointer-events-none flex items-center gap-1"
                style={{ left: `${c.x}%`, top: `${c.y}%`, transform: 'translate(-50%, -50%)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-surface shadow" />
                {c.name}
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="AU territories"
          subtitle="Real Territory rows for this region — no fabricated SEIFA/knockable-door figures"
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
          title="AU data feeding the propensity model · reference"
          subtitle="Nightly ingest — see zone table above for real per-territory scores"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {AU_DATA_SOURCES.map((s) => (
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

/** Cheap AU silhouette mask for the 22×14 decorative background grid. */
function isAuLand(col: number, row: number): boolean {
  // Rough cells inside an Australia-shaped polygon. Hand-tuned.
  if (row === 0) return col >= 8 && col <= 16;
  if (row === 1) return col >= 5 && col <= 18;
  if (row === 2) return col >= 4 && col <= 19;
  if (row === 3) return col >= 4 && col <= 19;
  if (row === 4) return col >= 4 && col <= 19;
  if (row === 5) return col >= 3 && col <= 19;
  if (row === 6) return col >= 3 && col <= 19;
  if (row === 7) return col >= 3 && col <= 19;
  if (row === 8) return col >= 4 && col <= 18;
  if (row === 9) return col >= 5 && col <= 17;
  if (row === 10) return col >= 7 && col <= 17;
  if (row === 11) return col >= 9 && col <= 17;
  if (row === 12) return (col >= 11 && col <= 16) || (col >= 14 && col <= 15);
  if (row === 13) return col >= 14 && col <= 15; // Tasmania
  return false;
}
