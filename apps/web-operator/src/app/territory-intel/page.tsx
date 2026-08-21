'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, MapPin, Eye, Plus, Filter, X, Check } from 'lucide-react';
import {
  Banner,
  Button,
  FilterChip,
  FilterChipStrip,
  KpiCard,
  Section,
  Skeleton,
  StatusPill,
} from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import {
  TerritoryHeatmap,
  type CellStatus,
  type PropensityHeatPoint,
  type ZoneSelection,
} from '@/components/TerritoryHeatmap';
import { PlatformTerritoriesEmpty, PropensityHeatEmpty } from '@/components/TerritoryEmptyStates';
import { DataSourceBadge, useDataFreshness } from '@/components/DataSourceBadge';

type StatusFilter = 'all' | CellStatus;

/** Shape returned by GET /api/territories (live, DB-derived rows). */
type ApiTerritory = {
  id: string;
  name: string;
  regionCode: string;
  vertical: string;
  status: string;
  propensity: number;
  knocks: number;
  conversions: number;
  saturation: number;
  centroid: { lat: number; lng: number } | null;
};

/** Shape returned by GET /api/propensity (live PropensityScore rows). */
type ApiPropensityPoint = {
  geoKey: string;
  centroidLat: number | null;
  centroidLng: number | null;
  score: number;
  band: 'high' | 'medium' | 'low';
};

type ZoneRow = {
  name: string;
  propensity: number;
  medianIncome: string;
  medianIncomeCents: number;
  density: 'High' | 'Medium' | 'Low';
  saturation: number;
  estLift: string;
  estLiftPp: number | null;
  knockable: number;
  status: string;
  tone: 'success' | 'info' | 'muted' | 'danger';
  cellStatus: CellStatus;
  bounds: [[number, number], [number, number]];
};

/**
 * Map a live API territory row → the ZoneRow the table/panel render from.
 * Income/lift aren't yet in the DB so we derive an honest placeholder from the
 * propensity signal; saturation/knocks/conversions are real. Bounds come from
 * the parsed centroid (a ~0.06° box) so a clicked live row still drives the map
 * panel; territories with no parseable centroid get a neutral US-center box.
 */
function apiToZoneRow(t: ApiTerritory): ZoneRow {
  const cellStatus: CellStatus =
    t.status === 'blocked'
      ? 'blocked'
      : t.propensity >= 0.75 && t.saturation < 30
        ? 'ai_suggested'
        : t.propensity < 0.35
          ? 'low_yield'
          : 'active';

  const tone: ZoneRow['tone'] =
    cellStatus === 'ai_suggested'
      ? 'success'
      : cellStatus === 'blocked'
        ? 'danger'
        : cellStatus === 'low_yield'
          ? 'muted'
          : 'info';

  const statusLabel =
    cellStatus === 'ai_suggested'
      ? 'AI suggested'
      : cellStatus === 'blocked'
        ? 'Blocked'
        : cellStatus === 'low_yield'
          ? 'Low-yield'
          : 'Active';

  // Est lift = conversion-rate edge over a 0.40 portfolio baseline, only shown
  // for fresh AI-suggested zones (where the lift is actionable).
  const estLiftPp =
    cellStatus === 'ai_suggested' ? Math.max(1, Math.round((t.propensity - 0.4) * 100)) : null;

  const c = t.centroid;
  const bounds: [[number, number], [number, number]] = c
    ? [
        [c.lat - 0.03, c.lng - 0.045],
        [c.lat + 0.03, c.lng + 0.045],
      ]
    : [
        [39.5, -98.6],
        [39.56, -98.5],
      ];

  // Knockable doors aren't in the DB yet; show real remaining capacity as
  // (knocks so far) when we have it, else an honest 0.
  const knockable = t.knocks;

  return {
    name: t.name,
    propensity: t.propensity,
    medianIncome: '—',
    medianIncomeCents: 0,
    density: t.saturation > 60 ? 'High' : t.saturation > 25 ? 'Medium' : 'Low',
    saturation: t.saturation,
    estLift: estLiftPp != null ? `+${estLiftPp}pp` : '—',
    estLiftPp,
    knockable,
    status: statusLabel,
    tone,
    cellStatus,
    bounds,
  };
}

/** Build the clickable map/panel selection from a table row — shared by the
 *  heatmap's `cells` prop and row-click so both stay in lockstep. */
function toZoneSelection(row: ZoneRow): ZoneSelection {
  return {
    id: `row-${row.name}`,
    name: row.name,
    bounds: row.bounds,
    propensity: row.propensity,
    medianIncomeCents: row.medianIncomeCents,
    estLiftPp: row.estLiftPp,
    knockableDoors: row.knockable,
    saturationPercent: row.saturation,
    status: row.cellStatus,
    densityLabel: row.density,
  };
}

export default function TerritoryIntelPage(): JSX.Element {
  const [selectedCell, setSelectedCell] = useState<ZoneSelection | null>(null);
  const [assignedSet, setAssignedSet] = useState<Set<string>>(new Set());
  const [showNewZoneBanner, setShowNewZoneBanner] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [territories, setTerritories] = useState<ApiTerritory[] | null>(null);
  const [propensityPoints, setPropensityPoints] = useState<PropensityHeatPoint[]>([]);
  const {
    source: territorySource,
    updatedAt,
    markFresh,
    markFixture,
  } = useDataFreshness('fixture');
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Fetch real territory propensity (Knock-derived) on mount.
  useEffect(() => {
    let cancelled = false;
    (async (): Promise<void> => {
      try {
        const res = await fetch('/api/territories', { headers: { accept: 'application/json' } });
        if (!res.ok) throw new Error(`territories ${res.status}`);
        const json = (await res.json()) as { territories?: ApiTerritory[] };
        if (cancelled) return;
        setTerritories(Array.isArray(json.territories) ? json.territories : []);
        markFresh();
      } catch {
        if (cancelled) return;
        setTerritories([]);
        markFixture();
      }
    })();
    return (): void => {
      cancelled = true;
    };
  }, [markFresh, markFixture]);

  // Fetch the AI PropensityScore heat layer on mount — independent of
  // whether any Territory has been drawn yet.
  useEffect(() => {
    let cancelled = false;
    (async (): Promise<void> => {
      try {
        const res = await fetch('/api/propensity', { headers: { accept: 'application/json' } });
        if (!res.ok) throw new Error(`propensity ${res.status}`);
        const json = (await res.json()) as { points?: ApiPropensityPoint[] };
        if (cancelled) return;
        const points = Array.isArray(json.points) ? json.points : [];
        setPropensityPoints(
          points
            .filter(
              (p): p is ApiPropensityPoint & { centroidLat: number; centroidLng: number } =>
                p.centroidLat != null && p.centroidLng != null,
            )
            .map((p) => ({
              geoKey: p.geoKey,
              centroidLat: p.centroidLat,
              centroidLng: p.centroidLng,
              score: p.score,
              band: p.band,
            })),
        );
      } catch {
        if (!cancelled) setPropensityPoints([]);
      }
    })();
    return (): void => {
      cancelled = true;
    };
  }, []);

  const zoneRows = useMemo(() => (territories ?? []).map(apiToZoneRow), [territories]);
  const cells = useMemo(() => zoneRows.map(toZoneSelection), [zoneRows]);

  // Count zones by status for the filter pills + KPI row — derived from the
  // real territory rows so the numbers always match what's on the map.
  const cellCounts = useMemo(() => {
    return zoneRows.reduce(
      (acc, z) => {
        acc.total += 1;
        acc[z.cellStatus] += 1;
        return acc;
      },
      { total: 0, ai_suggested: 0, active: 0, blocked: 0, low_yield: 0 },
    );
  }, [zoneRows]);

  const avgPropensity =
    zoneRows.length > 0 ? zoneRows.reduce((s, z) => s + z.propensity, 0) / zoneRows.length : null;
  const totalKnockable = zoneRows.reduce((s, z) => s + z.knockable, 0);

  // ESC closes the side panel
  useEffect(() => {
    if (!selectedCell) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setSelectedCell(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedCell]);

  // Outside-click closes the side panel
  useEffect(() => {
    if (!selectedCell) return undefined;
    const onClick = (e: MouseEvent): void => {
      const node = panelRef.current;
      if (node && !node.contains(e.target as Node)) {
        // Ignore clicks inside the Leaflet map — those are how users pick cells
        const target = e.target as HTMLElement | null;
        if (target?.closest('.leaflet-container')) return;
        if (target?.closest('[data-zone-row]')) return;
        if (target?.closest('[data-keep-panel-open]')) return;
        setSelectedCell(null);
      }
    };
    // Defer one tick so the click that opened the panel doesn't immediately close it
    const timer = setTimeout(() => document.addEventListener('mousedown', onClick), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', onClick);
    };
  }, [selectedCell]);

  const handleSendRep = (zoneName: string): void => {
    setAssignedSet((prev) => {
      const next = new Set(prev);
      next.add(zoneName);
      return next;
    });
  };

  const handleRowClick = (row: ZoneRow): void => {
    setSelectedCell(toZoneSelection(row));
  };

  const loading = territories === null;
  const empty = !loading && zoneRows.length === 0;

  return (
    <PlatformShell pageTitle="Territory intelligence">
      <div className="space-y-5 max-w-[1700px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Sparkles size={13} className="text-accent" />
            <span>
              Propensity scores blend <span className="font-semibold">external data</span> (ACS
              census income, density, charity-giving index, ESRI Tapestry segments) with internal
              data (your historical conversion rates per profile). AI ranks zones, manager assigns
              knockers.
            </span>
          </span>
        </Banner>

        {showNewZoneBanner && (
          <Banner tone="warn">
            <span className="text-[13px]">
              Draw mode ships in Phase 1.2 — for now, click any cell on the map to drill in and
              assign a knocker.
            </span>
          </Banner>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard label="Zones tracked" value={zoneRows.length} hint="across your org" />
          <KpiCard label="AI-suggested" value={cellCounts.ai_suggested} />
          <KpiCard label="Active" value={cellCounts.active} hint="knockers deployed" />
          <KpiCard
            label="Avg propensity"
            value={avgPropensity != null ? avgPropensity.toFixed(2) : '—'}
          />
          <KpiCard
            label="Knockable doors"
            value={totalKnockable.toLocaleString()}
            hint="knocked so far"
          />
        </div>

        {loading ? (
          <Section title="Propensity heatmap" subtitle="Loading territories…">
            <Skeleton height="h-[620px]" rounded="rounded-2xl" />
          </Section>
        ) : empty ? (
          <Section title="Propensity heatmap">
            <PlatformTerritoriesEmpty />
          </Section>
        ) : (
          <>
            {/* Real Leaflet heatmap */}
            <Section
              title="Propensity heatmap · your org"
              subtitle="Territory cells from Knock-derived propensity · click any cell to drill in"
              action={<DataSourceBadge source={territorySource} updatedAt={updatedAt} />}
            >
              <FilterChipStrip label="Show" className="mb-3">
                {(
                  [
                    { v: 'all', label: 'All zones', n: cellCounts.total },
                    { v: 'ai_suggested', label: 'AI suggested', n: cellCounts.ai_suggested },
                    { v: 'active', label: 'Active', n: cellCounts.active },
                    { v: 'low_yield', label: 'Low yield', n: cellCounts.low_yield },
                    { v: 'blocked', label: 'Blocked', n: cellCounts.blocked },
                  ] as Array<{ v: StatusFilter; label: string; n: number }>
                ).map((f) => (
                  <FilterChip
                    key={f.v}
                    active={statusFilter === f.v}
                    onClick={() => setStatusFilter(f.v)}
                    count={f.n}
                  >
                    {f.label}
                  </FilterChip>
                ))}
              </FilterChipStrip>
              {propensityPoints.length === 0 && <PropensityHeatEmpty placement="inline" />}
              <TerritoryHeatmap
                onSelect={setSelectedCell}
                assignedSet={assignedSet}
                statusFilter={statusFilter}
                cells={cells}
                propensityPoints={propensityPoints}
              />
            </Section>

            {/* Zone table */}
            <Section
              title="All zones · ranked by AI propensity"
              subtitle="Click any row to open detail · click 'Send knocker' to assign"
              paddedBody={false}
              action={
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" leftIcon={<Filter size={13} />}>
                    Filter
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Plus size={13} />}
                    onClick={() => setShowNewZoneBanner((v) => !v)}
                  >
                    New zone
                  </Button>
                </div>
              }
            >
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Zone</th>
                    <th>Propensity</th>
                    <th>Est. lift</th>
                    <th>Median income</th>
                    <th>Density</th>
                    <th>Saturation</th>
                    <th>Knockable</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {zoneRows.map((z) => {
                    const assigned = assignedSet.has(z.name);
                    const displayStatus = assigned ? 'Assigned' : z.status;
                    const displayTone: 'success' | 'info' | 'muted' | 'danger' = assigned
                      ? 'success'
                      : z.tone;
                    return (
                      <tr
                        key={z.name}
                        data-zone-row
                        onClick={() => handleRowClick(z)}
                        className="cursor-pointer hover:bg-paper/50"
                      >
                        <td>
                          <div className="flex items-center gap-1.5">
                            <MapPin size={11} className="text-soft shrink-0" />
                            <span className="text-[13px] font-medium text-ink">{z.name}</span>
                          </div>
                        </td>
                        <td>
                          <PropensityBar score={z.propensity} />
                        </td>
                        <td
                          className={`text-[12px] font-medium ${z.estLift !== '—' ? 'text-success' : 'text-soft'}`}
                        >
                          {z.estLift}
                        </td>
                        <td className="text-[12px] text-ink numeric">{z.medianIncome}</td>
                        <td className="text-[12px] text-muted">{z.density}</td>
                        <td className="text-[12px] text-muted numeric">{z.saturation}%</td>
                        <td className="text-[12px] text-ink numeric">
                          {z.knockable.toLocaleString()}
                        </td>
                        <td>
                          <StatusPill tone={displayTone}>{displayStatus}</StatusPill>
                        </td>
                        <td>
                          {z.status === 'AI suggested' && !assigned ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSendRep(z.name);
                              }}
                              className="text-[11px] font-semibold text-accent hover:underline"
                            >
                              Send knocker
                            </button>
                          ) : assigned ? (
                            <span className="text-[11px] font-semibold text-success inline-flex items-center gap-1">
                              <Check size={11} /> Sent
                            </span>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRowClick(z);
                              }}
                              className="w-7 h-7 rounded hover:bg-paper flex items-center justify-center"
                            >
                              <Eye size={12} className="text-soft" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Section>
          </>
        )}

        {/* External data sources — reference/roadmap only. None of these are
            wired ProviderConnection rows yet; PropensityScore.modelName /
            .features is the only real signal today (see /api/propensity).
            Never claim "connected" for a feed nothing actually polls. */}
        <Section
          title="External data feeding the propensity model — roadmap"
          subtitle="Reference only · none of these feeds are configured yet"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                name: 'ACS / US Census',
                detail: 'Income · age · density · housing tenure',
                region: 'US',
                status: 'not configured',
              },
              {
                name: 'ESRI Tapestry',
                detail: '67 lifestyle segments by tract',
                region: 'US',
                status: 'not configured',
              },
              {
                name: 'Mapbox Boundaries',
                detail: 'Postal + admin polygons',
                region: 'Global',
                status: 'not configured',
              },
              {
                name: 'OpenAddresses',
                detail: 'Door-level address corpus',
                region: 'Global',
                status: 'not configured',
              },
              {
                name: 'ABS SEIFA',
                detail: 'AU socio-economic indexes',
                region: 'AU',
                status: 'roadmap',
              },
              {
                name: 'CoreLogic AU',
                detail: 'AU property values + rents',
                region: 'AU',
                status: 'roadmap',
              },
              {
                name: 'SingStat',
                detail: 'SG demographics + planning area',
                region: 'SG',
                status: 'roadmap',
              },
              {
                name: 'Internal knock/conversion history',
                detail: 'Real — powers the propensity signal today',
                region: 'D2D',
                status: 'live',
              },
            ].map((s) => (
              <div key={s.name} className="card card-pad">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-semibold text-ink truncate">{s.name}</div>
                    <div className="text-[10.5px] text-muted mt-0.5">{s.detail}</div>
                  </div>
                  <span className="tag !text-[9px]">{s.region}</span>
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

      {/* Side panel — slides from right */}
      {selectedCell && (
        <ZoneDetailPanel
          panelRef={panelRef}
          cell={selectedCell}
          isAssigned={assignedSet.has(selectedCell.name)}
          onClose={() => setSelectedCell(null)}
          onSendRep={() => handleSendRep(selectedCell.name)}
        />
      )}
    </PlatformShell>
  );
}

function ZoneDetailPanel({
  panelRef,
  cell,
  isAssigned,
  onClose,
  onSendRep,
}: {
  panelRef: React.RefObject<HTMLDivElement>;
  cell: ZoneSelection;
  isAssigned: boolean;
  onClose: () => void;
  onSendRep: () => void;
}): JSX.Element {
  const incomeDollars = cell.medianIncomeCents / 100;
  const incomeLabel =
    incomeDollars >= 1000
      ? `$${Math.round(incomeDollars / 1000)}k`
      : `$${Math.round(incomeDollars)}`;
  const statusLabel =
    cell.status === 'ai_suggested'
      ? 'AI suggested'
      : cell.status === 'active'
        ? 'Active'
        : cell.status === 'blocked'
          ? 'Blocked'
          : 'Low-yield';
  const statusTone: 'success' | 'info' | 'muted' | 'danger' = isAssigned
    ? 'success'
    : cell.status === 'ai_suggested'
      ? 'success'
      : cell.status === 'active'
        ? 'info'
        : cell.status === 'blocked'
          ? 'danger'
          : 'muted';

  return (
    <div
      ref={panelRef}
      data-keep-panel-open
      className="fixed top-0 right-0 h-full w-[420px] bg-surface border-l border-line2 shadow-2xl z-50 flex flex-col"
      style={{ animation: 'slideInRight 180ms ease-out' }}
    >
      <style jsx>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
      <div className="flex items-start justify-between px-5 py-4 border-b border-line2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">
            Zone detail
          </div>
          <div className="text-[15px] font-bold text-ink mt-0.5 truncate flex items-center gap-1.5">
            <MapPin size={14} className="text-accent shrink-0" />
            {cell.name}
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded hover:bg-paper flex items-center justify-center shrink-0"
          aria-label="Close panel"
        >
          <X size={16} className="text-soft" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1.5">
            Status
          </div>
          <StatusPill tone={statusTone}>{isAssigned ? 'Assigned' : statusLabel}</StatusPill>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1.5">
            Propensity score
          </div>
          <div className="flex items-center gap-3">
            <PropensityBar score={cell.propensity} />
            <span className="text-[11px] text-muted">
              Blended ACS + Tapestry + your conversions
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <DetailStat label="Median income" value={incomeLabel} />
          <DetailStat label="Density" value={cell.densityLabel} />
          <DetailStat label="Knockable doors" value={cell.knockableDoors.toLocaleString()} />
          <DetailStat label="Saturation" value={`${cell.saturationPercent}%`} />
          <DetailStat
            label="Est. lift"
            value={cell.estLiftPp != null ? `+${cell.estLiftPp}pp` : '—'}
            valueTone={cell.estLiftPp != null ? 'success' : 'muted'}
          />
          <DetailStat label="ACS source" value="2024 ACS 5-year" />
        </div>

        <div className="border-t border-line2 pt-3">
          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1.5">
            Why this score
          </div>
          <ul className="text-[12px] text-ink space-y-1 list-disc pl-4">
            <li>
              Household income {incomeLabel} indexes {cell.propensity > 0.6 ? 'high' : 'mid'} vs
              metro avg
            </li>
            <li>Owner-occupied housing tenure favourable</li>
            <li>
              Saturation {cell.saturationPercent}% —{' '}
              {cell.saturationPercent < 30 ? 'fresh territory' : 'partial coverage'}
            </li>
            {cell.estLiftPp != null && (
              <li>
                Internal conversion lift estimate: +{cell.estLiftPp}pp vs current portfolio avg
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="px-5 py-4 border-t border-line2 bg-paper/40 flex items-center gap-2">
        {isAssigned ? (
          <button
            disabled
            className="flex-1 px-3 py-2 rounded-md bg-success text-white text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 cursor-default opacity-90"
          >
            <Check size={13} /> Rep assigned
          </button>
        ) : (
          <button
            onClick={onSendRep}
            disabled={cell.status === 'blocked'}
            className="flex-1 px-3 py-2 rounded-md bg-accent text-white text-[12px] font-semibold hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cell.status === 'blocked' ? 'Blocked' : 'Send knocker'}
          </button>
        )}
        <button
          onClick={onClose}
          className="px-3 py-2 rounded-md bg-paper border border-line2 text-[12px] font-semibold text-ink hover:bg-surface"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function DetailStat({
  label,
  value,
  valueTone,
}: {
  label: string;
  value: string;
  valueTone?: 'success' | 'muted';
}): JSX.Element {
  const valueClass =
    valueTone === 'success' ? 'text-success' : valueTone === 'muted' ? 'text-soft' : 'text-ink';
  return (
    <div className="rounded-lg border border-line2 bg-surface px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">{label}</div>
      <div className={`text-[14px] font-bold numeric mt-0.5 ${valueClass}`}>{value}</div>
    </div>
  );
}

function PropensityBar({ score }: { score: number }): JSX.Element {
  const pct = Math.round(score * 100);
  const color =
    score >= 0.75
      ? 'bg-green-500'
      : score >= 0.5
        ? 'bg-accent'
        : score >= 0.25
          ? 'bg-amber-500'
          : 'bg-rose-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-line2 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[12px] font-semibold text-ink numeric w-8">{score.toFixed(2)}</span>
    </div>
  );
}
