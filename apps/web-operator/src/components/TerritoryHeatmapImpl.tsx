'use client';

/**
 * Real interactive Leaflet propensity heatmap.
 *
 * Loaded only client-side via the `TerritoryHeatmap` dynamic wrapper.
 * Renders:
 *  - Satellite (Esri World Imagery, default) + Streets (OSM) base layers
 *  - Esri Reference labels overlay so place names show without zooming
 *  - 200-280 propensity cells across 6 Texas metros as colored Rectangle overlays
 *  - Each cell has hover tooltip + click → onSelect callback (opens side panel)
 *  - Built-in zoom + scale + attribution controls
 *  - Floating legend (bottom-right) + status counts (top-right)
 *  - Status filter prop — filters cells in-place
 */

import { Fragment, useMemo } from 'react';
import type L from 'leaflet';
import {
  MapContainer,
  TileLayer,
  Rectangle,
  Tooltip,
  LayersControl,
  ZoomControl,
  ScaleControl,
} from 'react-leaflet';
import { Sparkles } from 'lucide-react';
import { ALL_CELLS, type CellStatus, type ZoneSelection } from './territoryCells';

const DEFAULT_CENTER: [number, number] = [31.0, -97.5];
const DEFAULT_ZOOM = 6;
const MIN_ZOOM = 4;
const MAX_ZOOM = 18;

export type { CellStatus, ZoneSelection };

function propensityColor(p: number): string {
  if (p >= 0.75) return '#22c55e'; // green-500
  if (p >= 0.5) return '#3b82f6'; // blue-500
  if (p >= 0.25) return '#f59e0b'; // amber-500
  return '#ef4444'; // red-500
}

// ----- Component ------------------------------------------------------------

type StatusFilter = 'all' | CellStatus;

type Props = {
  onSelect: (cell: ZoneSelection | null) => void;
  assignedSet: Set<string>;
  statusFilter?: StatusFilter;
  /** Override cell set (defaults to HQ Texas ALL_CELLS). */
  cells?: ZoneSelection[];
  /** Override map center (defaults to Texas). */
  center?: [number, number];
  /** Override default zoom (defaults to 6). */
  defaultZoom?: number;
  /** Optional scope label shown in the legend. */
  scopeLabel?: string;
};

export function TerritoryHeatmapImpl({
  onSelect,
  assignedSet: _assignedSet,
  statusFilter = 'all',
  cells,
  center,
  defaultZoom,
  scopeLabel,
}: Props): JSX.Element {
  const sourceCells = cells ?? ALL_CELLS;
  const mapCenter = center ?? DEFAULT_CENTER;
  const mapZoom = defaultZoom ?? DEFAULT_ZOOM;

  const counts = useMemo(() => {
    return sourceCells.reduce(
      (acc, c) => {
        if (c.status === 'ai_suggested') acc.aiSuggested += 1;
        else if (c.status === 'active') acc.active += 1;
        else if (c.status === 'blocked') acc.blocked += 1;
        else acc.lowYield += 1;
        return acc;
      },
      { aiSuggested: 0, active: 0, blocked: 0, lowYield: 0 },
    );
  }, [sourceCells]);

  const visibleCells = useMemo(
    () =>
      statusFilter === 'all' ? sourceCells : sourceCells.filter((c) => c.status === statusFilter),
    [statusFilter, sourceCells],
  );

  return (
    <div className="relative w-full" style={{ height: 620 }}>
      <div className="absolute inset-0 rounded-2xl overflow-hidden border border-line2 bg-ink">
        <MapContainer
          key={`${mapCenter[0]}_${mapCenter[1]}_${mapZoom}`}
          center={mapCenter}
          zoom={mapZoom}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          scrollWheelZoom={true}
          zoomControl={false}
          style={{ height: '100%', width: '100%', background: '#0b1220' }}
          attributionControl={true}
        >
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Satellite (Esri)">
              <TileLayer
                attribution="Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
              />
            </LayersControl.BaseLayer>

            <LayersControl.BaseLayer name="Streets (OSM)">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
          {visibleCells.map((c) => {
            const color = propensityColor(c.propensity);
            return (
              <Fragment key={c.id}>
                <Rectangle
                  bounds={c.bounds}
                  pathOptions={{
                    color,
                    weight: 0.5,
                    fillColor: color,
                    fillOpacity: 0.55,
                  }}
                  eventHandlers={{
                    click: () => onSelect(c),
                    mouseover: (e: L.LeafletMouseEvent) => {
                      (e.target as L.Path).setStyle({ weight: 2, fillOpacity: 0.78 });
                    },
                    mouseout: (e: L.LeafletMouseEvent) => {
                      (e.target as L.Path).setStyle({ weight: 0.5, fillOpacity: 0.55 });
                    },
                  }}
                >
                  <Tooltip direction="top" offset={[0, -4]} sticky>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{c.name}</div>
                    <div style={{ fontSize: 10, color: '#475569' }}>
                      Propensity {c.propensity.toFixed(2)} · {c.densityLabel} density ·{' '}
                      {c.knockableDoors.toLocaleString()} doors
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                      Click to open detail
                    </div>
                  </Tooltip>
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
            {scopeLabel
              ? `${scopeLabel} · ${visibleCells.length} cells`
              : `Propensity · ${visibleCells.length} cells`}
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(239,68,68,0.6)' }} />{' '}
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
