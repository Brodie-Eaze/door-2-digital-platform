'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles, MapPin, Eye, Plus, Filter, X, Check } from 'lucide-react';
import { Banner, Button, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { TerritoryHeatmap, type ZoneSelection } from '@/components/TerritoryHeatmap';

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
  cellStatus: 'ai_suggested' | 'active' | 'blocked' | 'low_yield';
  bounds: [[number, number], [number, number]];
};

const ZONES: ZoneRow[] = [
  {
    name: 'Austin South · 78704',
    propensity: 0.81,
    medianIncome: '$94k',
    medianIncomeCents: 9_400_000,
    density: 'High',
    saturation: 0,
    estLift: '+14pp',
    estLiftPp: 14,
    knockable: 4280,
    status: 'AI suggested',
    tone: 'success',
    cellStatus: 'ai_suggested',
    bounds: [
      [30.21, -97.79],
      [30.27, -97.73],
    ],
  },
  {
    name: 'Plano · 75024',
    propensity: 0.78,
    medianIncome: '$118k',
    medianIncomeCents: 11_800_000,
    density: 'Medium',
    saturation: 0,
    estLift: '+11pp',
    estLiftPp: 11,
    knockable: 3140,
    status: 'AI suggested',
    tone: 'success',
    cellStatus: 'ai_suggested',
    bounds: [
      [33.07, -96.83],
      [33.13, -96.77],
    ],
  },
  {
    name: 'Sugar Land · 77479',
    propensity: 0.74,
    medianIncome: '$112k',
    medianIncomeCents: 11_200_000,
    density: 'Medium',
    saturation: 8,
    estLift: '+9pp',
    estLiftPp: 9,
    knockable: 2890,
    status: 'AI suggested',
    tone: 'success',
    cellStatus: 'ai_suggested',
    bounds: [
      [29.55, -95.66],
      [29.61, -95.6],
    ],
  },
  {
    name: 'Austin East · 78702',
    propensity: 0.62,
    medianIncome: '$58k',
    medianIncomeCents: 5_800_000,
    density: 'High',
    saturation: 42,
    estLift: '—',
    estLiftPp: null,
    knockable: 3240,
    status: 'Active',
    tone: 'info',
    cellStatus: 'active',
    bounds: [
      [30.25, -97.72],
      [30.31, -97.66],
    ],
  },
  {
    name: 'Dallas Metro · 75201',
    propensity: 0.59,
    medianIncome: '$71k',
    medianIncomeCents: 7_100_000,
    density: 'High',
    saturation: 38,
    estLift: '—',
    estLiftPp: null,
    knockable: 5140,
    status: 'Active',
    tone: 'info',
    cellStatus: 'active',
    bounds: [
      [32.77, -96.82],
      [32.83, -96.76],
    ],
  },
  {
    name: 'Houston SE · 77033',
    propensity: 0.48,
    medianIncome: '$48k',
    medianIncomeCents: 4_800_000,
    density: 'Medium',
    saturation: 64,
    estLift: '—',
    estLiftPp: null,
    knockable: 4120,
    status: 'Active',
    tone: 'info',
    cellStatus: 'active',
    bounds: [
      [29.66, -95.36],
      [29.72, -95.3],
    ],
  },
  {
    name: 'Highland Park · 75205',
    propensity: 0.42,
    medianIncome: '$214k',
    medianIncomeCents: 21_400_000,
    density: 'Low',
    saturation: 12,
    estLift: '—',
    estLiftPp: null,
    knockable: 1240,
    status: 'Low-yield',
    tone: 'muted',
    cellStatus: 'low_yield',
    bounds: [
      [32.82, -96.81],
      [32.88, -96.75],
    ],
  },
  {
    name: 'LA West · 90049',
    propensity: 0.71,
    medianIncome: '$142k',
    medianIncomeCents: 14_200_000,
    density: 'Medium',
    saturation: 0,
    estLift: '+12pp',
    estLiftPp: 12,
    knockable: 3520,
    status: 'Blocked (CA reg pending)',
    tone: 'danger',
    cellStatus: 'blocked',
    bounds: [
      [34.07, -118.5],
      [34.1, -118.43],
    ],
  },
];

export default function TerritoryIntelPage(): JSX.Element {
  const [selectedCell, setSelectedCell] = useState<ZoneSelection | null>(null);
  const [assignedSet, setAssignedSet] = useState<Set<string>>(new Set());
  const [showNewZoneBanner, setShowNewZoneBanner] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

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
    setSelectedCell({
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
    });
  };

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
              reps.
            </span>
          </span>
        </Banner>

        {showNewZoneBanner && (
          <Banner tone="warning">
            <span className="text-[13px]">
              Draw mode coming in Phase 1.2 — for now, click any cell on the map to drill in and
              assign a rep.
            </span>
          </Banner>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard label="Zones tracked" value={ZONES.length} hint="across US Phase 1" />
          <KpiCard
            label="AI-suggested"
            value={ZONES.filter((z) => z.status === 'AI suggested').length}
            delta="+1 today"
            deltaTone="positive"
          />
          <KpiCard
            label="Active"
            value={ZONES.filter((z) => z.status === 'Active').length}
            hint="reps deployed"
          />
          <KpiCard
            label="Avg propensity"
            value="0.64"
            delta="+0.03"
            deltaTone="positive"
            hint="vs LM"
          />
          <KpiCard label="Knockable doors" value="27,580" hint="across US zones" />
        </div>

        {/* Real Leaflet heatmap */}
        <Section
          title="Propensity heatmap · Texas"
          subtitle="Census tract level · click any cell to drill in"
        >
          <TerritoryHeatmap onSelect={setSelectedCell} assignedSet={assignedSet} />
        </Section>

        {/* Zone table */}
        <Section
          title="All zones · ranked by AI propensity"
          subtitle="Click any row to open detail · click 'Send rep' to assign"
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
              {ZONES.map((z) => {
                const assigned = assignedSet.has(z.name);
                const displayStatus = assigned ? 'Assigned ✓' : z.status;
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
                    <td className="text-[12px] text-ink numeric">{z.knockable.toLocaleString()}</td>
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
                          Send rep →
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

        {/* External data sources */}
        <Section
          title="External data feeding propensity model"
          subtitle="Updated nightly · attribution preserved"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                name: 'ACS / US Census',
                detail: 'Income · age · density · housing tenure',
                region: 'US',
                status: 'connected',
              },
              {
                name: 'ESRI Tapestry',
                detail: '67 lifestyle segments by tract',
                region: 'US',
                status: 'connected',
              },
              {
                name: 'Mapbox Boundaries',
                detail: 'Postal + admin polygons',
                region: 'Global',
                status: 'connected',
              },
              {
                name: 'OpenAddresses',
                detail: 'Door-level address corpus',
                region: 'Global',
                status: 'connected',
              },
              {
                name: 'ABS SEIFA',
                detail: 'AU socio-economic indexes',
                region: 'AU',
                status: 'phase 2',
              },
              {
                name: 'CoreLogic AU',
                detail: 'AU property values + rents',
                region: 'AU',
                status: 'phase 2',
              },
              {
                name: 'SingStat',
                detail: 'SG demographics + planning area',
                region: 'SG',
                status: 'phase 3',
              },
              {
                name: 'Internal cohorts',
                detail: 'Your last 30k conversions',
                region: 'D2D',
                status: 'connected',
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
                  <StatusPill tone={s.status === 'connected' ? 'success' : 'muted'}>
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
      className="fixed top-0 right-0 h-full w-[380px] bg-surface border-l border-line2 shadow-2xl z-50 flex flex-col"
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
          <StatusPill tone={statusTone}>{isAssigned ? 'Assigned ✓' : statusLabel}</StatusPill>
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
            {cell.status === 'blocked' ? 'Blocked' : 'Send rep →'}
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
