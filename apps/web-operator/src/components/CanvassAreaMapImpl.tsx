'use client';

/**
 * Real interactive Leaflet map for the manager's CANVASS-AREA tool.
 *
 * Loaded client-side only via the CanvassAreaMap dynamic wrapper (Leaflet
 * needs the DOM). It layers three things on one map:
 *
 *  1. The NEIGHBOURHOOD PROPENSITY HEATMAP — real PropensityScore points from
 *     /api/orgs/[slug]/propensity, rendered as colour-banded CircleMarkers
 *     (high = red/strong, medium = amber, low = cool). This is the intel that
 *     INFORMS where to set the area.
 *  2. The DRAFT area the manager is defining — a radius circle (click center →
 *     drag/enter radius) OR a polygon (click to add vertices, click first
 *     vertex / double-click to close).
 *  3. The SAVED area of the selected territory — drawn distinctly so the
 *     manager always sees "what reps will get".
 *
 * It owns NO persistence — it surfaces draft geometry up via callbacks; the
 * parent CanvassAreaTool posts to the BFF. No leaflet-draw dep: we use native
 * Leaflet click handlers via react-leaflet's useMapEvents.
 */

import { useMemo } from 'react';
import {
  Circle,
  CircleMarker,
  MapContainer,
  Polygon,
  Polyline,
  TileLayer,
  Tooltip,
  useMapEvents,
} from 'react-leaflet';

export interface PropensityPoint {
  geoKey: string;
  centroidLat: number | null;
  centroidLng: number | null;
  score: number;
  band: 'high' | 'medium' | 'low' | string | null;
  scoped: boolean;
}

/** Draft radius circle being defined (center + metres), or null. */
export interface RadiusDraft {
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
}

/** A saved area to render read-only ("what reps will get"). */
export interface SavedArea {
  areaType: 'polygon' | 'radius';
  /** [lat, lng] center (radius mode) — derived from centroid. */
  center: [number, number] | null;
  radiusMeters: number | null;
  /** [lat, lng][] ring (polygon mode). */
  ring: Array<[number, number]> | null;
}

export type DrawMode = 'radius' | 'polygon';

type Props = {
  points: PropensityPoint[];
  /** Map center [lat, lng]. */
  center: [number, number];
  defaultZoom: number;
  drawMode: DrawMode;
  /** Current draft radius (radius mode). */
  radiusDraft: RadiusDraft | null;
  /** Current draft polygon vertices [lat, lng][] (polygon mode). */
  polygonDraft: Array<[number, number]>;
  /** The selected territory's already-saved area, or null. */
  savedArea: SavedArea | null;
  /** Map click — sets center (radius) or appends a vertex (polygon). */
  onMapClick: (lat: number, lng: number) => void;
  /** Double-click closes a polygon (parent decides what that means). */
  onMapDoubleClick: () => void;
};

const BAND_COLOR: Record<string, string> = {
  high: '#ef4444', // red — strongest propensity
  medium: '#f59e0b', // amber
  low: '#3b82f6', // cool blue — weakest
};

function bandColor(p: PropensityPoint): string {
  if (p.band && BAND_COLOR[p.band]) return BAND_COLOR[p.band]!;
  if (p.score >= 0.66) return BAND_COLOR.high!;
  if (p.score >= 0.33) return BAND_COLOR.medium!;
  return BAND_COLOR.low!;
}

/** Bridges native Leaflet map clicks to the parent without a map ref. */
function ClickCapture({
  onClick,
  onDoubleClick,
}: {
  onClick: (lat: number, lng: number) => void;
  onDoubleClick: () => void;
}): null {
  useMapEvents({
    click: (e) => onClick(e.latlng.lat, e.latlng.lng),
    dblclick: () => onDoubleClick(),
  });
  return null;
}

export function CanvassAreaMapImpl({
  points,
  center,
  defaultZoom,
  drawMode,
  radiusDraft,
  polygonDraft,
  savedArea,
  onMapClick,
  onMapDoubleClick,
}: Props): JSX.Element {
  // Only render points that carry real coordinates.
  const geo = useMemo(
    () => points.filter((p) => p.centroidLat != null && p.centroidLng != null),
    [points],
  );

  return (
    <div className="relative w-full" style={{ height: 560 }}>
      <div className="absolute inset-0 rounded-2xl overflow-hidden border border-line2 bg-ink">
        <MapContainer
          key={`${center[0]}_${center[1]}_${defaultZoom}`}
          center={center}
          zoom={defaultZoom}
          minZoom={3}
          maxZoom={18}
          scrollWheelZoom
          doubleClickZoom={false}
          style={{ height: '100%', width: '100%', background: '#0b1220' }}
          attributionControl
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />

          <ClickCapture onClick={onMapClick} onDoubleClick={onMapDoubleClick} />

          {/* Propensity heatmap — colour-banded neighbourhood scores. */}
          {geo.map((p) => {
            const color = bandColor(p);
            return (
              <CircleMarker
                key={p.geoKey}
                center={[p.centroidLat as number, p.centroidLng as number]}
                radius={9}
                pathOptions={{
                  color,
                  weight: p.scoped ? 1.4 : 0.5,
                  fillColor: color,
                  fillOpacity: 0.55,
                }}
              >
                <Tooltip direction="top" offset={[0, -4]}>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>
                    Propensity {p.score.toFixed(2)} · {p.band ?? '—'}
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>
                    {p.scoped ? 'Your model' : 'Baseline'} · {p.geoKey}
                  </div>
                </Tooltip>
              </CircleMarker>
            );
          })}

          {/* SAVED area for the selected territory — what reps see today. */}
          {savedArea?.areaType === 'radius' && savedArea.center && savedArea.radiusMeters ? (
            <Circle
              center={savedArea.center}
              radius={savedArea.radiusMeters}
              pathOptions={{
                color: '#0F172A',
                weight: 2,
                dashArray: '6 4',
                fillColor: '#0F172A',
                fillOpacity: 0.06,
              }}
            />
          ) : null}
          {savedArea?.areaType === 'polygon' && savedArea.ring && savedArea.ring.length >= 3 ? (
            <Polygon
              positions={savedArea.ring}
              pathOptions={{
                color: '#0F172A',
                weight: 2,
                dashArray: '6 4',
                fillColor: '#0F172A',
                fillOpacity: 0.06,
              }}
            />
          ) : null}

          {/* DRAFT radius circle being defined. */}
          {drawMode === 'radius' && radiusDraft ? (
            <Circle
              center={[radiusDraft.centerLat, radiusDraft.centerLng]}
              radius={radiusDraft.radiusMeters}
              pathOptions={{
                color: '#3B82F6',
                weight: 2,
                fillColor: '#3B82F6',
                fillOpacity: 0.12,
              }}
            />
          ) : null}

          {/* DRAFT polygon being drawn — vertices + closing edge preview. */}
          {drawMode === 'polygon' && polygonDraft.length > 0 ? (
            <>
              {polygonDraft.length >= 3 ? (
                <Polygon
                  positions={polygonDraft}
                  pathOptions={{
                    color: '#3B82F6',
                    weight: 2,
                    fillColor: '#3B82F6',
                    fillOpacity: 0.12,
                  }}
                />
              ) : (
                <Polyline positions={polygonDraft} pathOptions={{ color: '#3B82F6', weight: 2 }} />
              )}
              {polygonDraft.map((v, i) => (
                <CircleMarker
                  key={`vtx_${i}`}
                  center={v}
                  radius={4}
                  pathOptions={{
                    color: '#3B82F6',
                    weight: 2,
                    fillColor: '#ffffff',
                    fillOpacity: 1,
                  }}
                />
              ))}
            </>
          ) : null}
        </MapContainer>

        {/* Legend — bottom-right, house style. */}
        <div className="absolute bottom-3 right-3 z-[400] bg-surface/95 backdrop-blur rounded-lg px-3 py-2 border border-line2 shadow-sm pointer-events-none">
          <div className="text-[10px] uppercase tracking-wider text-muted mb-1.5 font-semibold">
            Propensity · {geo.length} neighbourhoods
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full" style={{ background: BAND_COLOR.high }} /> High
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full" style={{ background: BAND_COLOR.medium }} />{' '}
              Medium
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full" style={{ background: BAND_COLOR.low }} /> Low
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
