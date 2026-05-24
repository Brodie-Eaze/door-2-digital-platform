'use client';

/**
 * Real interactive Leaflet propensity heatmap.
 *
 * Loaded only client-side via the `TerritoryHeatmap` dynamic wrapper.
 * Renders:
 *  - Streets (OSM) + Satellite (Esri World Imagery) base layers via switcher
 *  - Esri Reference labels overlay so place names show without zooming
 *  - ~60-80 propensity cells as colored Rectangle overlays
 *  - Each cell has hover tooltip + click popup + onSelect callback
 *  - Built-in zoom + scale + attribution controls
 *  - Floating legend (bottom-right) + status counts (top-right)
 */

import { Fragment, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Rectangle,
  Popup,
  Tooltip,
  LayersControl,
  ZoomControl,
  ScaleControl,
} from 'react-leaflet';
import { Sparkles } from 'lucide-react';

const TEXAS_CENTER: [number, number] = [31.5, -97.5];
const INITIAL_ZOOM = 5;

export type CellStatus = 'ai_suggested' | 'active' | 'blocked' | 'low_yield';

export type ZoneSelection = {
  id: string;
  name: string;
  bounds: [[number, number], [number, number]];
  propensity: number;
  medianIncomeCents: number;
  estLiftPp: number | null;
  knockableDoors: number;
  saturationPercent: number;
  status: CellStatus;
  densityLabel: 'High' | 'Medium' | 'Low';
};

const STATUS_LABEL: Record<CellStatus, string> = {
  ai_suggested: 'AI suggested',
  active: 'Active',
  blocked: 'Blocked',
  low_yield: 'Low-yield',
};

// ----- Cell generation ------------------------------------------------------

// Real anchor zones from the existing zones table — these get exact coords +
// the known propensity. All other cells are deterministically generated to
// fill out the Texas grid + a few surrounding spots so the map looks alive.
const ANCHOR_CELLS: ZoneSelection[] = [
  {
    id: 'anchor-austin-south',
    name: 'Austin South · 78704',
    bounds: [
      [30.21, -97.79],
      [30.27, -97.73],
    ],
    propensity: 0.81,
    medianIncomeCents: 9_400_000,
    estLiftPp: 14,
    knockableDoors: 4280,
    saturationPercent: 0,
    status: 'ai_suggested',
    densityLabel: 'High',
  },
  {
    id: 'anchor-plano',
    name: 'Plano · 75024',
    bounds: [
      [33.07, -96.83],
      [33.13, -96.77],
    ],
    propensity: 0.78,
    medianIncomeCents: 11_800_000,
    estLiftPp: 11,
    knockableDoors: 3140,
    saturationPercent: 0,
    status: 'ai_suggested',
    densityLabel: 'Medium',
  },
  {
    id: 'anchor-sugar-land',
    name: 'Sugar Land · 77479',
    bounds: [
      [29.55, -95.66],
      [29.61, -95.6],
    ],
    propensity: 0.74,
    medianIncomeCents: 11_200_000,
    estLiftPp: 9,
    knockableDoors: 2890,
    saturationPercent: 8,
    status: 'ai_suggested',
    densityLabel: 'Medium',
  },
  {
    id: 'anchor-austin-east',
    name: 'Austin East · 78702',
    bounds: [
      [30.25, -97.72],
      [30.31, -97.66],
    ],
    propensity: 0.62,
    medianIncomeCents: 5_800_000,
    estLiftPp: null,
    knockableDoors: 3240,
    saturationPercent: 42,
    status: 'active',
    densityLabel: 'High',
  },
  {
    id: 'anchor-dallas-metro',
    name: 'Dallas Metro · 75201',
    bounds: [
      [32.77, -96.82],
      [32.83, -96.76],
    ],
    propensity: 0.59,
    medianIncomeCents: 7_100_000,
    estLiftPp: null,
    knockableDoors: 5140,
    saturationPercent: 38,
    status: 'active',
    densityLabel: 'High',
  },
  {
    id: 'anchor-houston-se',
    name: 'Houston SE · 77033',
    bounds: [
      [29.66, -95.36],
      [29.72, -95.3],
    ],
    propensity: 0.48,
    medianIncomeCents: 4_800_000,
    estLiftPp: null,
    knockableDoors: 4120,
    saturationPercent: 64,
    status: 'active',
    densityLabel: 'Medium',
  },
  {
    id: 'anchor-highland-park',
    name: 'Highland Park · 75205',
    bounds: [
      [32.82, -96.81],
      [32.88, -96.75],
    ],
    propensity: 0.42,
    medianIncomeCents: 21_400_000,
    estLiftPp: null,
    knockableDoors: 1240,
    saturationPercent: 12,
    status: 'low_yield',
    densityLabel: 'Low',
  },
  {
    id: 'anchor-la-west',
    name: 'LA West · 90049',
    bounds: [
      [34.04, -118.5],
      [34.1, -118.43],
    ],
    propensity: 0.71,
    medianIncomeCents: 14_200_000,
    estLiftPp: 12,
    knockableDoors: 3520,
    saturationPercent: 0,
    status: 'blocked',
    densityLabel: 'Medium',
  },
];

// Texas-ish region labels by approximate lat/lng. Used to give the
// generated cells a believable neighborhood-style name.
const METRO_REGIONS: Array<{
  name: string;
  zipPrefix: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}> = [
  {
    name: 'Austin',
    zipPrefix: '787',
    minLat: 30.0,
    maxLat: 30.6,
    minLng: -97.95,
    maxLng: -97.55,
  },
  {
    name: 'San Antonio',
    zipPrefix: '782',
    minLat: 29.3,
    maxLat: 29.7,
    minLng: -98.8,
    maxLng: -98.3,
  },
  {
    name: 'Dallas / FW',
    zipPrefix: '752',
    minLat: 32.55,
    maxLat: 33.2,
    minLng: -97.4,
    maxLng: -96.5,
  },
  {
    name: 'Houston',
    zipPrefix: '770',
    minLat: 29.55,
    maxLat: 30.05,
    minLng: -95.7,
    maxLng: -95.15,
  },
  {
    name: 'Corpus Christi',
    zipPrefix: '784',
    minLat: 27.6,
    maxLat: 28.0,
    minLng: -97.55,
    maxLng: -97.25,
  },
];

const COMPASS = ['North', 'South', 'East', 'West', 'Central', 'NW', 'NE', 'SW', 'SE'];

function regionFor(lat: number, lng: number): { name: string; zipPrefix: string } | null {
  for (const r of METRO_REGIONS) {
    if (lat >= r.minLat && lat <= r.maxLat && lng >= r.minLng && lng <= r.maxLng) {
      return { name: r.name, zipPrefix: r.zipPrefix };
    }
  }
  return null;
}

function deterministicNoise(i: number, j: number): number {
  // 0..1 noise-ish from sin/cos so identical coords always produce identical cells
  const v = 0.5 + 0.5 * Math.sin(i * 0.7 + 0.3) * Math.cos(j * 0.31 + 0.7);
  return Math.min(1, Math.max(0, v));
}

function buildGeneratedCells(): ZoneSelection[] {
  const cells: ZoneSelection[] = [];
  const step = 0.6;
  let counter = 0;
  for (let lat = 28.5; lat < 34.0; lat += step) {
    for (let lng = -100.0; lng < -94.0; lng += step) {
      const i = Math.round((lat - 28.5) / step);
      const j = Math.round((lng - -100.0) / step);
      const propensity = deterministicNoise(i, j);

      // Skip cells too close to anchors so we don't overlap
      const overlapsAnchor = ANCHOR_CELLS.some((a) => {
        const [[sLat, wLng], [nLat, eLng]] = a.bounds;
        const cLat = (sLat + nLat) / 2;
        const cLng = (wLng + eLng) / 2;
        return Math.abs(cLat - (lat + step / 2)) < step && Math.abs(cLng - (lng + step / 2)) < step;
      });
      if (overlapsAnchor) continue;

      const region = regionFor(lat + step / 2, lng + step / 2);
      const compass = COMPASS[(i + j) % COMPASS.length];
      const zipSuffix = ((i * 13 + j * 7) % 90) + 10;
      const zip = region
        ? `${region.zipPrefix}${zipSuffix}`
        : `7${50 + ((i + j) % 49)}${zipSuffix}`;
      const baseName = region ? region.name : 'TX Rural';
      const name = `${baseName} ${compass} · ${zip}`;

      // Status + lift derived from propensity + a deterministic sprinkle
      let status: CellStatus = 'active';
      let estLiftPp: number | null = null;
      if (propensity >= 0.75) {
        status = 'ai_suggested';
        estLiftPp = Math.round(8 + propensity * 12);
      } else if (propensity >= 0.5) {
        status = 'active';
      } else if (propensity >= 0.25) {
        status = 'active';
      } else {
        status = 'low_yield';
      }
      // One deterministic blocked cell — "needs state reg"
      if (i === 4 && j === 6) status = 'blocked';

      const densityLabel: 'High' | 'Medium' | 'Low' =
        region &&
        (region.name === 'Dallas / FW' || region.name === 'Houston' || region.name === 'Austin')
          ? propensity > 0.5
            ? 'High'
            : 'Medium'
          : 'Low';

      const medianIncomeCents =
        4_000_000 + Math.round(propensity * 14_000_000 + ((i * 11 + j * 17) % 30) * 100_000);
      const knockableDoors = Math.round(800 + propensity * 4000 + ((i * 5 + j * 9) % 50) * 30);
      const saturationPercent =
        status === 'active' ? Math.round(((i + j) * 13) % 65) : status === 'ai_suggested' ? 0 : 15;

      cells.push({
        id: `cell-${counter++}`,
        name,
        bounds: [
          [lat, lng],
          [lat + step, lng + step],
        ],
        propensity,
        medianIncomeCents,
        estLiftPp,
        knockableDoors,
        saturationPercent,
        status,
        densityLabel,
      });
    }
  }
  return cells;
}

const ALL_CELLS: ZoneSelection[] = [...ANCHOR_CELLS, ...buildGeneratedCells()];

// ----- Color logic ----------------------------------------------------------

function cellStyle(p: number): { color: string; fillOpacity: number } {
  if (p >= 0.75) return { color: '#22c55e', fillOpacity: 0.45 };
  if (p >= 0.5) return { color: '#3b82f6', fillOpacity: 0.4 };
  if (p >= 0.25) return { color: '#f59e0b', fillOpacity: 0.4 };
  return { color: '#ef4444', fillOpacity: 0.35 };
}

function fmtMoney(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1000) return `$${Math.round(dollars / 1000)}k`;
  return `$${Math.round(dollars)}`;
}

// ----- Component ------------------------------------------------------------

type Props = {
  onSelect: (cell: ZoneSelection | null) => void;
  assignedSet: Set<string>;
};

export function TerritoryHeatmapImpl({ onSelect, assignedSet }: Props): JSX.Element {
  const counts = useMemo(() => {
    return ALL_CELLS.reduce(
      (acc, c) => {
        if (c.status === 'ai_suggested') acc.aiSuggested += 1;
        else if (c.status === 'active') acc.active += 1;
        else if (c.status === 'blocked') acc.blocked += 1;
        else acc.lowYield += 1;
        return acc;
      },
      { aiSuggested: 0, active: 0, blocked: 0, lowYield: 0 },
    );
  }, []);

  return (
    <div className="relative w-full" style={{ height: 520 }}>
      <div className="absolute inset-0 rounded-2xl overflow-hidden border border-line2 bg-ink">
        <MapContainer
          center={TEXAS_CENTER}
          zoom={INITIAL_ZOOM}
          minZoom={4}
          maxZoom={15}
          scrollWheelZoom={true}
          zoomControl={false}
          style={{ height: '100%', width: '100%', background: '#0b1220' }}
          attributionControl={true}
        >
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Streets (OSM)">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
              />
            </LayersControl.BaseLayer>

            <LayersControl.BaseLayer name="Satellite (Esri)">
              <TileLayer
                attribution="Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
              />
            </LayersControl.BaseLayer>

            <LayersControl.Overlay checked name="Place labels">
              <TileLayer
                attribution="Labels &copy; Esri"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
              />
            </LayersControl.Overlay>
          </LayersControl>

          {/* Propensity cells — react-leaflet wants Leaflet components as direct
              children, so we use Fragment (no DOM wrapper) per cell. */}
          {ALL_CELLS.map((c) => {
            const style = cellStyle(c.propensity);
            const isAssigned = assignedSet.has(c.name);
            return (
              <Fragment key={c.id}>
                <Rectangle
                  bounds={c.bounds}
                  pathOptions={{
                    color: style.color,
                    weight: 1,
                    fillColor: style.color,
                    fillOpacity: style.fillOpacity,
                  }}
                  eventHandlers={{
                    click: () => onSelect(c),
                  }}
                >
                  <Tooltip direction="top" offset={[0, -4]} sticky>
                    <span style={{ fontWeight: 600, fontSize: 11 }}>{c.name}</span>
                    <span style={{ color: '#475569', marginLeft: 6, fontSize: 11 }}>
                      {c.propensity.toFixed(2)}
                    </span>
                  </Tooltip>
                  <Popup minWidth={240} maxWidth={280}>
                    <CellPopupCard cell={c} isAssigned={isAssigned} onOpen={() => onSelect(c)} />
                  </Popup>
                </Rectangle>
              </Fragment>
            );
          })}

          <ZoomControl position="bottomleft" />
          <ScaleControl position="bottomleft" imperial={true} metric={true} />
        </MapContainer>

        {/* Status counts overlay — top-right (inset from layer control) */}
        <div className="absolute top-3 right-14 z-[400] bg-surface/95 backdrop-blur rounded-lg px-3 py-2 border border-accent/30 shadow-sm pointer-events-none">
          <div className="text-[10px] uppercase tracking-wider text-accent mb-1 font-semibold flex items-center gap-1">
            <Sparkles size={11} /> Zone status
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" /> AI suggested{' '}
              <span className="text-soft numeric">({counts.aiSuggested})</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-accent" /> Active{' '}
              <span className="text-soft numeric">({counts.active})</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500" /> Blocked{' '}
              <span className="text-soft numeric">({counts.blocked})</span>
            </span>
          </div>
        </div>

        {/* Propensity legend — bottom-right */}
        <div className="absolute bottom-3 right-3 z-[400] bg-surface/95 backdrop-blur rounded-lg px-3 py-2 border border-line2 shadow-sm pointer-events-none">
          <div className="text-[10px] uppercase tracking-wider text-muted mb-1.5 font-semibold">
            Propensity
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(239,68,68,0.55)' }} />{' '}
              0–0.25
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(245,158,11,0.6)' }} />{' '}
              0.25–0.5
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(59,130,246,0.6)' }} />{' '}
              0.5–0.75
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(34,197,94,0.7)' }} />{' '}
              0.75+
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CellPopupCard({
  cell,
  isAssigned,
  onOpen,
}: {
  cell: ZoneSelection;
  isAssigned: boolean;
  onOpen: () => void;
}): JSX.Element {
  const style = cellStyle(cell.propensity);
  return (
    <div style={{ minWidth: 220 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: '#0f172a' }}>
        {cell.name}
      </div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>
        {STATUS_LABEL[cell.status]} · {cell.densityLabel} density
      </div>
      <div style={{ fontSize: 11, display: 'grid', gap: 4, marginBottom: 10 }}>
        <PopupRow
          label="Propensity"
          value={
            <span style={{ color: style.color, fontWeight: 700 }}>
              {cell.propensity.toFixed(2)}
            </span>
          }
        />
        <PopupRow label="Median income" value={fmtMoney(cell.medianIncomeCents)} />
        <PopupRow
          label="Est lift"
          value={
            cell.estLiftPp != null ? (
              <span style={{ color: '#16a34a', fontWeight: 600 }}>+{cell.estLiftPp}pp</span>
            ) : (
              <span style={{ color: '#94a3b8' }}>—</span>
            )
          }
        />
        <PopupRow label="Knockable doors" value={cell.knockableDoors.toLocaleString()} />
        <PopupRow label="Saturation" value={`${cell.saturationPercent}%`} />
      </div>
      <button
        onClick={onOpen}
        style={{
          width: '100%',
          padding: '6px 8px',
          borderRadius: 6,
          background: isAssigned ? '#16a34a' : '#0f172a',
          color: '#ffffff',
          border: 'none',
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {isAssigned ? 'Assigned · open detail' : 'Open detail →'}
      </button>
    </div>
  );
}

function PopupRow({ label, value }: { label: string; value: React.ReactNode }): JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ color: '#0f172a' }}>{value}</span>
    </div>
  );
}
