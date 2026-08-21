'use client';

/**
 * CanvassAreaTool — the manager's CANVASS-AREA mapping surface for the
 * per-account Territories page.
 *
 * D2D does NOT target individual houses. A manager sets an AREA reps canvass —
 * either a center+radius circle or a drawn polygon — informed by the
 * neighbourhood PROPENSITY HEATMAP layered on the same map. The saved area is
 * pushed to that tenant's reps on Knocker iOS (GET /v1/territories/assigned).
 *
 * Data:
 *  - GET  /api/orgs/[slug]/propensity            → heatmap points
 *  - GET  /api/orgs/[slug]/territories           → territories + their areas
 *  - POST /api/orgs/[slug]/territories           → create a new area
 *  - PATCH /api/orgs/[slug]/territories/[id]      → redefine an area
 *
 * All persistence is via the same-origin BFF (tenant-scoped + audited there).
 * House style only — navy #0F172A + accent #3B82F6, @d2d/ui-web primitives.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Circle, MapPin, Pentagon, Save, Send, Trash2, Plus } from 'lucide-react';
import { Button, Input, Section, StatusPill } from '@d2d/ui-web';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { toast } from '@/components/Toaster';
import {
  CanvassAreaMap,
  type DrawMode,
  type PropensityPoint,
  type RadiusDraft,
  type SavedArea,
} from '@/components/CanvassAreaMap';

interface TerritoryRow {
  id: string;
  name: string;
  vertical: 'charity' | 'commercial' | string;
  status: string;
  areaType: 'polygon' | 'radius' | string;
  radiusMeters: number | null;
  polygon: string | null;
  centroid: string | null;
}

interface PropensityResponse {
  regionCode: 'US' | 'AU' | 'SG';
  points: PropensityPoint[];
}

// Region fallbacks when no propensity points exist yet to centre the map.
const REGION_CENTER: Record<'US' | 'AU' | 'SG', [number, number]> = {
  US: [39.5, -98.35],
  AU: [-25.27, 133.78],
  SG: [1.3521, 103.8198],
};

/** Parse a stored "lng lat" centroid into [lat, lng] for Leaflet. */
function parseCentroid(centroid: string | null): [number, number] | null {
  if (!centroid) return null;
  const parts = centroid.trim().split(/\s+/);
  if (parts.length !== 2) return null;
  const lng = Number(parts[0]);
  const lat = Number(parts[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return [lat, lng];
}

/** Parse a single-ring WKT POLYGON into [lat, lng][] for Leaflet. */
function parsePolygonRing(wkt: string | null): Array<[number, number]> | null {
  if (!wkt) return null;
  const m = /^POLYGON\s*\(\((.+)\)\)\s*$/i.exec(wkt.trim());
  if (!m || !m[1]) return null;
  const ring: Array<[number, number]> = [];
  for (const pair of m[1].split(',')) {
    const parts = pair.trim().split(/\s+/);
    if (parts.length !== 2) continue;
    const lng = Number(parts[0]);
    const lat = Number(parts[1]);
    if (Number.isFinite(lng) && Number.isFinite(lat)) ring.push([lat, lng]);
  }
  return ring.length >= 3 ? ring : null;
}

/** Map a stored territory to the read-only SavedArea the map renders. */
function toSavedArea(t: TerritoryRow): SavedArea | null {
  if (t.areaType === 'radius') {
    const center = parseCentroid(t.centroid);
    if (!center || !t.radiusMeters) return null;
    return { areaType: 'radius', center, radiusMeters: t.radiusMeters, ring: null };
  }
  const ring = parsePolygonRing(t.polygon);
  if (!ring) return null;
  return { areaType: 'polygon', center: null, radiusMeters: null, ring };
}

export function CanvassAreaTool({ slug }: { slug: string }): JSX.Element {
  const [points, setPoints] = useState<PropensityPoint[]>([]);
  const [regionCode, setRegionCode] = useState<'US' | 'AU' | 'SG'>('US');
  const [territories, setTerritories] = useState<TerritoryRow[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Draft area state.
  const [drawMode, setDrawMode] = useState<DrawMode>('radius');
  const [radiusDraft, setRadiusDraft] = useState<RadiusDraft | null>(null);
  const [polygonDraft, setPolygonDraft] = useState<Array<[number, number]>>([]);

  // New-territory naming (when no territory is selected).
  const [newName, setNewName] = useState('');

  const loadTerritories = useCallback(async (): Promise<TerritoryRow[]> => {
    const res = await fetch(`/api/orgs/${encodeURIComponent(slug)}/territories`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error('territories');
    const data = (await res.json()) as { territories: TerritoryRow[] };
    return data.territories;
  }, [slug]);

  const load = useCallback(async (): Promise<void> => {
    setLoadError(null);
    try {
      const [pRes, terrs] = await Promise.all([
        fetch(`/api/orgs/${encodeURIComponent(slug)}/propensity`, { credentials: 'include' }),
        loadTerritories(),
      ]);
      if (pRes.ok) {
        const pData = (await pRes.json()) as PropensityResponse;
        setPoints(pData.points);
        setRegionCode(pData.regionCode);
      }
      setTerritories(terrs);
      setSelectedId((prev) => prev ?? terrs[0]?.id ?? null);
    } catch {
      setLoadError('Could not load the canvass-area map — please retry.');
      setTerritories([]);
    }
  }, [slug, loadTerritories]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => territories?.find((t) => t.id === selectedId) ?? null,
    [territories, selectedId],
  );
  const savedArea = useMemo(() => (selected ? toSavedArea(selected) : null), [selected]);

  // Centre the map on the points' bbox, else the selected area, else region.
  const mapCenter = useMemo<[number, number]>(() => {
    const geo = points.filter((p) => p.centroidLat != null && p.centroidLng != null);
    if (geo.length > 0) {
      const lat = geo.reduce((s, p) => s + (p.centroidLat as number), 0) / geo.length;
      const lng = geo.reduce((s, p) => s + (p.centroidLng as number), 0) / geo.length;
      return [lat, lng];
    }
    if (savedArea?.center) return savedArea.center;
    if (savedArea?.ring && savedArea.ring[0]) return savedArea.ring[0];
    return REGION_CENTER[regionCode];
  }, [points, savedArea, regionCode]);

  const mapZoom = points.some((p) => p.centroidLat != null) ? 11 : 4;

  // ── Draft interactions ────────────────────────────────────────────────────

  function handleMapClick(lat: number, lng: number): void {
    if (drawMode === 'radius') {
      // Click sets / re-sets the centre; keep any radius already chosen.
      setRadiusDraft((prev) => ({
        centerLat: lat,
        centerLng: lng,
        radiusMeters: prev?.radiusMeters ?? 400,
      }));
    } else {
      setPolygonDraft((prev) => [...prev, [lat, lng]]);
    }
  }

  function handleMapDoubleClick(): void {
    // Double-click is a no-op signal in polygon mode (ring closes on save);
    // we keep it so doubleClickZoom stays disabled and the gesture is intentional.
  }

  function clearDraft(): void {
    setRadiusDraft(null);
    setPolygonDraft([]);
  }

  function setRadiusMeters(meters: number): void {
    setRadiusDraft((prev) => (prev ? { ...prev, radiusMeters: meters } : null));
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function save(): Promise<void> {
    // Build the area payload from the active draft.
    let areaPayload:
      | { areaType: 'radius'; centerLng: number; centerLat: number; radiusMeters: number }
      | { areaType: 'polygon'; polygonWkt: string }
      | null = null;

    if (drawMode === 'radius') {
      if (!radiusDraft) {
        toast.error('Click the map to set a centre, then choose a radius.');
        return;
      }
      areaPayload = {
        areaType: 'radius',
        centerLng: radiusDraft.centerLng,
        centerLat: radiusDraft.centerLat,
        radiusMeters: radiusDraft.radiusMeters,
      };
    } else {
      if (polygonDraft.length < 3) {
        toast.error('Click at least 3 points on the map to draw an area.');
        return;
      }
      // Leaflet rings are [lat, lng]; WKT wants "lng lat", closed.
      const ringText = polygonDraft.map(([lat, lng]) => `${lng} ${lat}`).join(', ');
      const first = polygonDraft[0]!;
      areaPayload = {
        areaType: 'polygon',
        polygonWkt: `POLYGON((${ringText}, ${first[1]} ${first[0]}))`,
      };
    }

    setSaving(true);
    try {
      let res: Response;
      if (selectedId) {
        res = await fetch(
          `/api/orgs/${encodeURIComponent(slug)}/territories/${encodeURIComponent(selectedId)}`,
          {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(areaPayload),
          },
        );
      } else {
        const name = newName.trim();
        if (!name) {
          toast.error('Name the new canvass area first.');
          setSaving(false);
          return;
        }
        res = await fetch(`/api/orgs/${encodeURIComponent(slug)}/territories`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...areaPayload, name, vertical: 'charity' }),
        });
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { detail?: string } | null;
        toast.error(body?.detail ?? 'Could not save the area — please retry.');
        return;
      }

      const body = (await res.json()) as { territory: { id: string } };
      toast.success('Canvass area saved — it’s now on your reps’ Knocker iOS app.');
      clearDraft();
      setNewName('');
      const fresh = await loadTerritories().catch(() => null);
      if (fresh) {
        setTerritories(fresh);
        setSelectedId(body.territory.id);
      }
    } catch {
      toast.error('Network error — please retry.');
    } finally {
      setSaving(false);
    }
  }

  const hasDraft = drawMode === 'radius' ? radiusDraft != null : polygonDraft.length >= 3;

  return (
    <Section
      title="Canvass area"
      subtitle="Set the AREA your reps canvass — a radius circle or a drawn polygon — guided by the neighbourhood propensity heatmap. Saved areas push to Knocker iOS."
      action={<DataSourceBadge source={territories ? 'live' : 'fixture'} />}
    >
      {loadError ? (
        <div className="px-6 py-8 text-center">
          <div className="text-[13px] text-ink mb-2" role="alert">
            {loadError}
          </div>
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : territories === null ? (
        <div className="px-6 py-10 text-center text-[12px] text-muted">Loading canvass map…</div>
      ) : (
        <div className="space-y-4">
          {/* Controls row */}
          <div className="flex flex-wrap items-end gap-3">
            {/* Target territory */}
            <div className="min-w-[220px]">
              <label
                htmlFor="canvass-territory"
                className="block text-[11px] font-medium text-ink mb-1"
              >
                Territory to set area for
              </label>
              <select
                id="canvass-territory"
                value={selectedId ?? '__new__'}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedId(v === '__new__' ? null : v);
                  clearDraft();
                }}
                className="w-full px-3 h-9 bg-surface border border-line rounded-lg text-[13px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:border-accent"
              >
                {territories.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.areaType})
                  </option>
                ))}
                <option value="__new__">＋ New canvass area…</option>
              </select>
            </div>

            {/* New-area name (only when creating) */}
            {selectedId === null && (
              <div className="min-w-[200px]">
                <label
                  htmlFor="canvass-name"
                  className="block text-[11px] font-medium text-ink mb-1"
                >
                  New area name
                </label>
                <Input
                  id="canvass-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. North Ward — Spring drive"
                />
              </div>
            )}

            {/* Mode toggle */}
            <div>
              <span className="block text-[11px] font-medium text-ink mb-1">Area type</span>
              <div
                className="inline-flex rounded-lg border border-line2 overflow-hidden"
                role="group"
                aria-label="Area type"
              >
                <button
                  type="button"
                  aria-pressed={drawMode === 'radius'}
                  onClick={() => {
                    setDrawMode('radius');
                    setPolygonDraft([]);
                  }}
                  className={
                    drawMode === 'radius'
                      ? 'inline-flex items-center gap-1.5 px-3 h-9 bg-ink text-surface text-[12px] font-semibold'
                      : 'inline-flex items-center gap-1.5 px-3 h-9 bg-paper text-muted hover:text-ink text-[12px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30'
                  }
                >
                  <Circle size={13} aria-hidden /> Radius
                </button>
                <button
                  type="button"
                  aria-pressed={drawMode === 'polygon'}
                  onClick={() => {
                    setDrawMode('polygon');
                    setRadiusDraft(null);
                  }}
                  className={
                    drawMode === 'polygon'
                      ? 'inline-flex items-center gap-1.5 px-3 h-9 bg-ink text-surface text-[12px] font-semibold border-l border-line2'
                      : 'inline-flex items-center gap-1.5 px-3 h-9 bg-paper text-muted hover:text-ink text-[12px] font-medium border-l border-line2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30'
                  }
                >
                  <Pentagon size={13} aria-hidden /> Polygon
                </button>
              </div>
            </div>

            {/* Radius slider (radius mode + a centre chosen) */}
            {drawMode === 'radius' && radiusDraft && (
              <div className="min-w-[200px]">
                <label
                  htmlFor="canvass-radius"
                  className="block text-[11px] font-medium text-ink mb-1"
                >
                  Radius · {radiusDraft.radiusMeters.toLocaleString()} m
                </label>
                <input
                  id="canvass-radius"
                  type="range"
                  min={50}
                  max={5000}
                  step={50}
                  value={radiusDraft.radiusMeters}
                  onChange={(e) => setRadiusMeters(Number(e.target.value))}
                  className="w-full accent-accent"
                />
              </div>
            )}
          </div>

          {/* Helper line */}
          <div className="text-[12px] text-muted">
            {drawMode === 'radius' ? (
              <span>
                Click the map to drop the area centre, then drag the radius. Hotter (red)
                neighbourhoods = higher propensity to convert.
              </span>
            ) : (
              <span>
                Click the map to add corner points ({polygonDraft.length} placed) — 3+ define an
                area. Use the propensity colours to enclose the hottest blocks.
              </span>
            )}
          </div>

          <CanvassAreaMap
            points={points}
            center={mapCenter}
            defaultZoom={mapZoom}
            drawMode={drawMode}
            radiusDraft={radiusDraft}
            polygonDraft={polygonDraft}
            savedArea={savedArea}
            onMapClick={handleMapClick}
            onMapDoubleClick={handleMapDoubleClick}
          />

          {/* Current-area note + actions */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[12px] text-muted">
              <Send size={13} className="text-accent" aria-hidden />
              {selected ? (
                <span>
                  <span className="font-medium text-ink">{selected.name}</span>’s current area (
                  {selected.areaType}
                  {selected.areaType === 'radius' && selected.radiusMeters
                    ? ` · ${selected.radiusMeters.toLocaleString()} m`
                    : ''}
                  ) is pushed to your reps’ Knocker iOS app. Draw a new shape to replace it.
                </span>
              ) : (
                <span>This area will be pushed to your reps’ Knocker iOS app once saved.</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Trash2 size={13} />}
                onClick={clearDraft}
                disabled={!radiusDraft && polygonDraft.length === 0}
              >
                Clear draft
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={selectedId ? <Save size={13} /> : <Plus size={13} />}
                onClick={() => void save()}
                disabled={saving || !hasDraft}
              >
                {saving ? 'Saving…' : selectedId ? 'Save area to reps' : 'Create area'}
              </Button>
            </div>
          </div>

          {/* Existing areas summary */}
          {territories.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] uppercase tracking-wider text-muted font-semibold mr-1">
                Areas
              </span>
              {territories.map((t) => {
                const active = t.id === selectedId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(t.id);
                      clearDraft();
                    }}
                    className={
                      active
                        ? 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ink text-surface text-[11px] font-semibold'
                        : 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-paper text-muted hover:text-ink text-[11px] font-medium border border-line2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30'
                    }
                  >
                    <MapPin size={11} aria-hidden /> {t.name}
                    <StatusPill tone={t.areaType === 'radius' ? 'info' : 'success'}>
                      {t.areaType}
                    </StatusPill>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
