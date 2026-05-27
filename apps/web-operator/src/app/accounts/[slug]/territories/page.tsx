'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, MapPin, Eye, Plus, Filter, Send, Check, X } from 'lucide-react';
import { Banner, Button, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { AccountLiveMap } from '@/components/AccountLiveMap';
import {
  TerritoryHeatmap,
  type CellStatus,
  type ZoneSelection,
} from '@/components/TerritoryHeatmap';
import { TerritoriesEmpty, FirstRunBanner } from '@/components/AccountEmptyStates';
import { getAccount, type Account } from '@/lib/accounts';
import { getAccountTerritory } from '@/lib/account-territory-cells';
import { firstRunSnapshot } from '@/lib/first-run';

type StatusFilter = 'all' | CellStatus;

function regionLabel(region: 'AU' | 'US' | 'SG'): string {
  if (region === 'AU') return 'Australia';
  if (region === 'US') return 'United States';
  return 'Singapore';
}

function currencyForRegion(region: 'AU' | 'US' | 'SG'): 'AUD' | 'USD' {
  return region === 'AU' ? 'AUD' : 'USD';
}

function formatIncomeShort(cents: number, currency: 'AUD' | 'USD'): string {
  const dollars = cents / 100;
  const symbol = currency === 'AUD' ? 'A$' : '$';
  if (dollars >= 1000) return `${symbol}${Math.round(dollars / 1000)}k`;
  return `${symbol}${Math.round(dollars)}`;
}

export default function AccountTerritoriesPage({
  params,
}: {
  params: { slug: string };
}): JSX.Element {
  const account = getAccount(params.slug);
  const territory = getAccountTerritory(params.slug);

  const [selectedCell, setSelectedCell] = useState<ZoneSelection | null>(null);
  const [assignedSet, setAssignedSet] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showNewZoneBanner, setShowNewZoneBanner] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const cellCounts = useMemo(() => {
    if (!territory) return { total: 0, ai_suggested: 0, active: 0, blocked: 0, low_yield: 0 };
    return territory.cells.reduce(
      (acc, c) => {
        acc.total += 1;
        acc[c.status] += 1;
        return acc;
      },
      { total: 0, ai_suggested: 0, active: 0, blocked: 0, low_yield: 0 },
    );
  }, [territory]);

  // Top-N AI suggested zones for the table below the heatmap
  const topZones = useMemo(() => {
    if (!territory) return [];
    const aiSuggested = territory.cells
      .filter((c) => c.status === 'ai_suggested')
      .sort((a, b) => b.propensity - a.propensity)
      .slice(0, 8);
    if (aiSuggested.length >= 4) return aiSuggested;
    // Pad with top active cells if there aren't enough AI suggestions
    const padding = territory.cells
      .filter((c) => c.status === 'active')
      .sort((a, b) => b.propensity - a.propensity)
      .slice(0, 8 - aiSuggested.length);
    return [...aiSuggested, ...padding];
  }, [territory]);

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
        const target = e.target as HTMLElement | null;
        if (target?.closest('.leaflet-container')) return;
        if (target?.closest('[data-zone-row]')) return;
        if (target?.closest('[data-keep-panel-open]')) return;
        setSelectedCell(null);
      }
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', onClick), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', onClick);
    };
  }, [selectedCell]);

  const firstRun = firstRunSnapshot(params.slug);
  if (!account || firstRun.isFirstRun || !territory || territory.cells.length === 0) {
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

  const currency = currencyForRegion(account.region);

  const handleSendRep = (zoneName: string): void => {
    setAssignedSet((prev) => {
      const next = new Set(prev);
      next.add(zoneName);
      return next;
    });
  };

  // Build display KPIs from the real cell set
  const totalKnockableDoors = territory
    ? territory.cells.reduce((s, c) => s + c.knockableDoors, 0)
    : 0;
  const avgPropensity =
    territory && territory.cells.length > 0
      ? territory.cells.reduce((s, c) => s + c.propensity, 0) / territory.cells.length
      : 0;
  const totalLiftPp = territory
    ? territory.cells.filter((c) => c.estLiftPp != null).reduce((s, c) => s + (c.estLiftPp ?? 0), 0)
    : 0;

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Territories">
      <div className="space-y-5 max-w-[1700px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Sparkles size={13} className="text-accent" />
            <span>
              Propensity scores for <span className="font-semibold">{account.shortName}</span> blend
              external data (
              {account.region === 'AU'
                ? 'ABS SEIFA, CoreLogic AU'
                : account.region === 'SG'
                  ? 'SingStat planning area'
                  : 'ACS census income, ESRI Tapestry'}
              ) with your last {account.conversionsMTD.toLocaleString()} conversions to rank zones.
            </span>
          </span>
        </Banner>

        {showNewZoneBanner && (
          <Banner tone="warn">
            <span className="text-[13px]">
              Draw mode coming in Phase 1.2 — for now, click any cell on the map to drill in and
              assign a rep.
            </span>
          </Banner>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard
            label="Zones tracked"
            value={territory?.cells.length ?? 0}
            hint={`across ${regionLabel(account.region)}`}
          />
          <KpiCard
            label="AI-suggested"
            value={cellCounts.ai_suggested}
            delta={
              cellCounts.ai_suggested > 0 ? `+${Math.min(cellCounts.ai_suggested, 4)} today` : '—'
            }
            deltaTone={cellCounts.ai_suggested > 0 ? 'positive' : 'neutral'}
          />
          <KpiCard label="Active" value={cellCounts.active} hint="reps deployed" />
          <KpiCard
            label="Avg propensity"
            value={avgPropensity.toFixed(2)}
            delta="+0.04"
            deltaTone="positive"
            hint="vs LM"
          />
          <KpiCard
            label="Knockable doors"
            value={totalKnockableDoors.toLocaleString()}
            hint={`across ${account.region}`}
          />
        </div>

        {/* Keep the live-map section — that's the rep/operator view */}
        <Section
          title={`Live territory map · ${account.shortName}`}
          subtitle="Real reps on real ground · AI zones flagged with blue halos · toggle Satellite ↔ Streets top-right"
        >
          <AccountLiveMap accountSlug={params.slug} />
        </Section>

        {/* Real Leaflet propensity heatmap (replaces the old SVG grid) */}
        <Section
          title={`Propensity heatmap · ${territory?.scopeLabel ?? regionLabel(account.region)}`}
          subtitle="Census-tract granularity · click any cell to drill in · same engine as HQ territory intel"
        >
          {territory ? (
            <>
              <div className="flex flex-wrap items-center gap-1.5 mb-3">
                <span className="text-[10px] uppercase tracking-wider text-muted mr-1 font-semibold">
                  Show
                </span>
                {(
                  [
                    { v: 'all', label: 'All zones', n: cellCounts.total },
                    { v: 'ai_suggested', label: 'AI suggested', n: cellCounts.ai_suggested },
                    { v: 'active', label: 'Active', n: cellCounts.active },
                    { v: 'low_yield', label: 'Low yield', n: cellCounts.low_yield },
                    { v: 'blocked', label: 'Blocked', n: cellCounts.blocked },
                  ] as Array<{ v: StatusFilter; label: string; n: number }>
                ).map((f) => (
                  <button
                    key={f.v}
                    onClick={() => setStatusFilter(f.v)}
                    className={
                      statusFilter === f.v
                        ? 'px-2.5 py-1 rounded-full bg-ink text-surface text-[11px] font-semibold transition'
                        : 'px-2.5 py-1 rounded-full bg-paper text-muted hover:text-ink text-[11px] font-medium border border-line2 transition'
                    }
                  >
                    {f.label} <span className="numeric opacity-70">({f.n})</span>
                  </button>
                ))}
              </div>
              <TerritoryHeatmap
                cells={territory.cells}
                center={territory.center}
                defaultZoom={territory.defaultZoom}
                scopeLabel={territory.scopeLabel}
                onSelect={setSelectedCell}
                assignedSet={assignedSet}
                statusFilter={statusFilter}
              />
            </>
          ) : (
            <div className="bg-paper rounded-xl border border-line2 px-6 py-12 text-center">
              <div className="text-[13px] font-semibold text-ink mb-1">
                No propensity cells configured yet
              </div>
              <div className="text-[12px] text-muted max-w-md mx-auto">
                The propensity heatmap for {account.shortName} is being seeded. Connect ACS / SEIFA
                data sources to populate this region.
              </div>
            </div>
          )}
        </Section>

        {/* Zones table — derived from the real cells (top AI suggested) */}
        <Section
          title={`${account.shortName} zones · ranked by AI propensity`}
          subtitle="Click any row to open detail · click 'Send Knockers' to deploy a team"
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
          {topZones.length > 0 ? (
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
                {topZones.map((z) => {
                  const assigned = assignedSet.has(z.name);
                  const statusLabel = assigned
                    ? 'Assigned ✓'
                    : z.status === 'ai_suggested'
                      ? 'AI suggested'
                      : z.status === 'active'
                        ? 'Active'
                        : z.status === 'blocked'
                          ? 'Blocked'
                          : 'Low-yield';
                  const tone: 'success' | 'info' | 'muted' | 'danger' = assigned
                    ? 'success'
                    : z.status === 'ai_suggested'
                      ? 'success'
                      : z.status === 'active'
                        ? 'info'
                        : z.status === 'blocked'
                          ? 'danger'
                          : 'muted';
                  return (
                    <tr
                      key={z.id}
                      data-zone-row
                      onClick={() => setSelectedCell(z)}
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
                        className={`text-[12px] font-medium ${z.estLiftPp != null ? 'text-success' : 'text-soft'}`}
                      >
                        {z.estLiftPp != null ? `+${z.estLiftPp}pp` : '—'}
                      </td>
                      <td className="text-[12px] text-ink numeric">
                        {formatIncomeShort(z.medianIncomeCents, currency)}
                      </td>
                      <td className="text-[12px] text-muted">{z.densityLabel}</td>
                      <td className="text-[12px] text-muted numeric">{z.saturationPercent}%</td>
                      <td className="text-[12px] text-ink numeric">
                        {z.knockableDoors.toLocaleString()}
                      </td>
                      <td>
                        <StatusPill tone={tone}>{statusLabel}</StatusPill>
                      </td>
                      <td>
                        {z.status === 'ai_suggested' && !assigned ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSendRep(z.name);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
                          >
                            <Send size={11} /> Send Knockers
                          </button>
                        ) : assigned ? (
                          <span className="text-[11px] font-semibold text-success inline-flex items-center gap-1">
                            <Check size={11} /> Sent
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCell(z);
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
          ) : (
            <div className="px-6 py-8 text-center text-[12px] text-muted">
              No zones available yet.
            </div>
          )}
        </Section>

        <Section
          title="External data feeding propensity model"
          subtitle={`Region-specific sources for ${account.region} · attribution preserved`}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(account.region === 'AU'
              ? [
                  {
                    name: 'ABS SEIFA',
                    detail: 'AU socio-economic indexes by SA1',
                    status: 'connected',
                  },
                  {
                    name: 'CoreLogic AU',
                    detail: 'AU property values + rents',
                    status: 'connected',
                  },
                  {
                    name: 'ACNC donor data',
                    detail: 'Charity giving propensity',
                    status: 'connected',
                  },
                  { name: 'Mapbox AU', detail: 'Postal + LGA polygons', status: 'connected' },
                  {
                    name: `${account.shortName} cohorts`,
                    detail: `Your last ${account.conversionsMTD.toLocaleString()} conversions`,
                    status: 'connected',
                  },
                  { name: 'AusPost addresses', detail: 'Door-level corpus', status: 'connected' },
                ]
              : account.region === 'SG'
                ? [
                    {
                      name: 'SingStat',
                      detail: 'SG demographics + planning area',
                      status: 'connected',
                    },
                    { name: 'OneMap', detail: 'SG addresses + polygons', status: 'connected' },
                    {
                      name: `${account.shortName} cohorts`,
                      detail: 'Your historical conversions',
                      status: 'connected',
                    },
                  ]
                : [
                    {
                      name: 'ACS / US Census',
                      detail: 'Income · age · density · housing',
                      status: 'connected',
                    },
                    {
                      name: 'ESRI Tapestry',
                      detail: '67 lifestyle segments by tract',
                      status: 'connected',
                    },
                    {
                      name: 'Mapbox Boundaries',
                      detail: 'Postal + admin polygons',
                      status: 'connected',
                    },
                    { name: 'OpenAddresses', detail: 'Door-level corpus', status: 'connected' },
                    {
                      name: `${account.shortName} cohorts`,
                      detail: `Your last ${account.conversionsMTD.toLocaleString()} conversions`,
                      status: 'connected',
                    },
                    {
                      name:
                        account.vertical === 'commercial'
                          ? 'Pest infestation index'
                          : account.vertical === 'healthcare'
                            ? 'CDC public health'
                            : 'Charity Navigator',
                      detail: 'Vertical-specific signal',
                      status: 'connected',
                    },
                  ]
            ).map((s) => (
              <div key={s.name} className="card card-pad">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-semibold text-ink truncate">{s.name}</div>
                    <div className="text-[10.5px] text-muted mt-0.5">{s.detail}</div>
                  </div>
                  <span className="tag !text-[9px]">{account.region}</span>
                </div>
                <div className="mt-2">
                  <StatusPill tone="success">{s.status}</StatusPill>
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
          account={account}
          currency={currency}
          totalLiftPp={totalLiftPp}
        />
      )}
    </AccountShell>
  );
}

function ZoneDetailPanel({
  panelRef,
  cell,
  isAssigned,
  onClose,
  onSendRep,
  account,
  currency,
  totalLiftPp: _totalLiftPp,
}: {
  panelRef: React.RefObject<HTMLDivElement>;
  cell: ZoneSelection;
  isAssigned: boolean;
  onClose: () => void;
  onSendRep: () => void;
  account: Account;
  currency: 'AUD' | 'USD';
  totalLiftPp: number;
}): JSX.Element {
  const incomeLabel = formatIncomeShort(cell.medianIncomeCents, currency);
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

  const dataSource =
    account.region === 'AU'
      ? 'ABS 2021 census · CoreLogic AU'
      : account.region === 'SG'
        ? 'SingStat 2023'
        : '2024 ACS 5-year';

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
            Zone detail · {account.shortName}
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
              Blended {account.region === 'AU' ? 'SEIFA + CoreLogic' : 'ACS + Tapestry'} + your
              conversions
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
          <DetailStat label="Source" value={dataSource} />
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
