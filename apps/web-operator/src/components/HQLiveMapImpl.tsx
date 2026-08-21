'use client';

/**
 * Real interactive Leaflet map. Loaded only client-side via the
 * `HQLiveMap` dynamic wrapper. Renders:
 *  - Streets (OSM) + Satellite (Esri World Imagery) base layers via switcher
 *  - Optional Places/Boundaries label overlay on satellite
 *  - Rep pins as CircleMarkers, with pulse halos for active reps — sourced from
 *    live /api/fleet data, polled every 30 seconds.
 *  - Built-in zoom + scale + attribution controls
 *
 * Fleet data: GET /api/fleet returns active KnockSessions with the latest
 * Knock.geo parsed into lat/lng. An empty array is an honest "nobody's
 * clocked in" answer, not a loading state — it still marks the badge LIVE.
 *
 * There is no backing table for "AI suggested next zones" yet (see
 * schema.prisma) — this map no longer renders that overlay; command-centre
 * shows the honest empty state via AiNextZonesPanel instead.
 */

import { Fragment, useEffect, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Tooltip,
  LayersControl,
  ZoomControl,
  ScaleControl,
  useMap,
} from 'react-leaflet';
import { Phone, MessageSquare, Coffee, Play } from 'lucide-react';
import {
  STATUS_COLORS,
  HQ_FALLBACK_CENTER,
  apiFleetEntryToRep,
  type ApiFleetEntry,
  type FleetRep,
} from '@/lib/fleet';
import { toast } from '@/components/Toaster';
import { DataSourceBadge, useDataFreshness } from '@/components/DataSourceBadge';

const TEXAS_CENTER: [number, number] = [31.0, -97.0];
const INITIAL_ZOOM = 6;

const STATUS_LABEL: Record<FleetRep['status'], string> = {
  active: 'Active · knocking',
  break: 'On break / lunch',
  idle: 'Idle > 15min',
  offline: 'Offline',
};

/** Imperative map controller — keyed on `target`, flies the map there. */
function FlyController({
  target,
}: {
  target: { lat: number; lng: number; zoom?: number } | null;
}): null {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lng], target.zoom ?? 13, { duration: 0.8 });
    // Re-fly whenever the target identity changes (lat/lng/zoom).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.lat, target?.lng, target?.zoom]);
  return null;
}

export interface HQLiveMapProps {
  /** When set, the map flies to these coordinates (signature interaction). */
  flyTarget?: { lat: number; lng: number; zoom?: number } | null;
  /**
   * When set, draws a pulsing amber highlight ring directly at these
   * coordinates. Keying off coords rather than a rep id keeps the highlight
   * working even as reps drop off/rejoin the polled /api/fleet response.
   */
  highlightCoords?: { lat: number; lng: number } | null;
}

export function HQLiveMapImpl({
  flyTarget = null,
  highlightCoords = null,
}: HQLiveMapProps): JSX.Element {
  // Live fleet data, polled every 30s from /api/fleet. Starts empty — there
  // is no fixture fallback; a genuinely empty fleet is an honest answer.
  const [fleet, setFleet] = useState<FleetRep[]>([]);
  const { source, updatedAt, markFresh } = useDataFreshness('fixture');
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchFleet(): Promise<void> {
      // Skip when the previous poll is still in flight (prevents out-of-order
      // responses overwriting newer data) or the tab is backgrounded.
      if (inFlight.current || document.visibilityState === 'hidden') return;
      inFlight.current = true;
      try {
        const res = await fetch('/api/fleet');
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { fleet?: ApiFleetEntry[] };
        // Any successful, well-formed response — including a genuinely empty
        // fleet (nobody clocked in) — is real live data, so it marks fresh.
        if (Array.isArray(data.fleet)) {
          setFleet(data.fleet.map((r) => apiFleetEntryToRep(r, HQ_FALLBACK_CENTER)));
          markFresh();
        }
      } catch {
        // Network failure — keep current state; staleness timer downgrades the
        // badge automatically if we'd previously gone live.
      } finally {
        inFlight.current = false;
      }
    }

    void fetchFleet();
    const interval = setInterval(() => void fetchFleet(), 30_000);
    return (): void => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeCount = fleet.filter((r) => r.status === 'active').length;
  const breakCount = fleet.filter((r) => r.status === 'break').length;
  const idleCount = fleet.filter((r) => r.status === 'idle').length;
  const offlineCount = fleet.filter((r) => r.status === 'offline').length;
  const totalKnocks = fleet.reduce((s, r) => s + r.knocksToday, 0);
  // Per-rep conversions aren't tracked by /api/fleet yet (see
  // apiFleetEntryToRep) — never sum a hardcoded 0 into a headline stat.

  return (
    <div className="relative w-full" style={{ height: 640 }}>
      <div className="absolute inset-0 rounded-2xl overflow-hidden border border-line2 bg-ink">
        <MapContainer
          center={TEXAS_CENTER}
          zoom={INITIAL_ZOOM}
          scrollWheelZoom={true}
          zoomControl={false}
          style={{ height: '100%', width: '100%', background: '#0b1220' }}
          attributionControl={true}
        >
          <FlyController target={flyTarget} />

          <LayersControl position="topright">
            <LayersControl.BaseLayer name="Streets (OSM)">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
              />
            </LayersControl.BaseLayer>

            <LayersControl.BaseLayer checked name="Satellite (Esri)">
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

          {/* Amber highlight ring — drawn directly at the anomaly's coordinates
              (not by matching a rendered pin), so it survives the fixture→live
              fleet swap where rep ids change. */}
          {highlightCoords && (
            <CircleMarker
              center={[highlightCoords.lat, highlightCoords.lng]}
              radius={20}
              pathOptions={{
                color: '#F59E0B',
                weight: 3,
                fillColor: '#F59E0B',
                fillOpacity: 0.12,
                className: 'd2d-knock-pulse',
              }}
              interactive={false}
            />
          )}

          {/* Rep pins — polled from /api/fleet every 30s. An empty array
              (nobody clocked in) simply renders no pins. */}
          {fleet.map((r) => {
            const color = STATUS_COLORS[r.status];
            const isActive = r.status === 'active';
            return (
              <Fragment key={r.id}>
                {isActive && (
                  <CircleMarker
                    center={[r.lat, r.lng]}
                    radius={14}
                    pathOptions={{
                      color: color,
                      weight: 1,
                      fillColor: color,
                      fillOpacity: 0.2,
                      className: 'd2d-knock-pulse',
                    }}
                    interactive={false}
                  />
                )}
                <CircleMarker
                  center={[r.lat, r.lng]}
                  radius={8}
                  pathOptions={{
                    color: '#ffffff',
                    weight: 2,
                    fillColor: color,
                    fillOpacity: 1,
                  }}
                >
                  <Tooltip direction="top" offset={[0, -6]}>
                    <span style={{ fontWeight: 600 }}>
                      {r.initials} · {r.name}
                    </span>
                  </Tooltip>
                  <Popup minWidth={260} maxWidth={300}>
                    <RepPopupCard rep={r} />
                  </Popup>
                </CircleMarker>
              </Fragment>
            );
          })}

          <ZoomControl position="bottomleft" />
          <ScaleControl position="bottomleft" imperial={true} metric={true} />
        </MapContainer>

        {/* Floating legends — outside the map flow but inside the rounded frame */}
        <div className="absolute top-3 left-3 z-[400] bg-surface/95 backdrop-blur rounded-lg px-3 py-2 border border-line2 shadow-sm pointer-events-none">
          <div className="text-[10px] uppercase tracking-wider text-muted mb-1.5 font-semibold">
            Fleet status
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" /> Active{' '}
              <span className="text-soft numeric">({activeCount})</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Break{' '}
              <span className="text-soft numeric">({breakCount})</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500" /> Idle{' '}
              <span className="text-soft numeric">({idleCount})</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-500" /> Offline{' '}
              <span className="text-soft numeric">({offlineCount})</span>
            </span>
          </div>
        </div>

        <div className="absolute bottom-3 right-3 z-[400] bg-surface/95 backdrop-blur rounded-lg px-3 py-2 border border-line2 shadow-sm pointer-events-none max-w-[220px]">
          <div className="mb-1">
            <DataSourceBadge source={source} updatedAt={updatedAt} />
          </div>
          <div className="text-[14px] font-bold text-ink numeric flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                source === 'live'
                  ? 'bg-green-500 animate-pulse'
                  : source === 'stale'
                    ? 'bg-rose-500'
                    : 'bg-amber-500'
              }`}
            />
            {activeCount} active iPads
          </div>
          <div className="text-[10px] text-muted">{totalKnocks} knocks today</div>
          <div className="text-[9px] text-soft mt-1 leading-snug">
            Live tracking activates when realtime is configured — positions refresh via 30s poll,
            not push.
          </div>
        </div>
      </div>
    </div>
  );
}

function RepPopupCard({ rep }: { rep: FleetRep }): JSX.Element {
  const color = STATUS_COLORS[rep.status];

  return (
    <div style={{ minWidth: 240 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: color,
            color: '#fff',
            fontWeight: 700,
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {rep.initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{rep.name}</div>
          <div style={{ fontSize: 10, color: '#64748b' }}>
            {rep.account} · {rep.territory}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 11, display: 'grid', gap: 4, marginBottom: 10 }}>
        <Row
          label="Status"
          value={
            <span
              style={{
                color,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  background: color,
                  display: 'inline-block',
                }}
              />
              {STATUS_LABEL[rep.status]}
            </span>
          }
        />
        <Row label="Shift" value={`${rep.shiftStart} · ${rep.hoursToday}`} />
        <Row
          label="Last knock"
          value={rep.lastKnockMin < 999 ? `${rep.lastKnockMin}m ago` : 'No knocks today'}
        />
        <Row
          label="Today"
          value={
            <span>
              <strong>{rep.knocksToday}</strong> knocks
            </span>
          }
        />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <PopupButton
          onClick={() => toast.info(`Dialling ${rep.name}… telephony wiring lands in Phase 1.2`)}
          icon={<Phone size={11} />}
          label="Call"
          primary
        />
        <PopupButton
          onClick={() => toast.info(`Message composer for ${rep.name} lands in Phase 1.2`)}
          icon={<MessageSquare size={11} />}
          label="Msg"
        />
        <PopupButton
          onClick={() =>
            toast.info(
              rep.status === 'break'
                ? `Resume command for ${rep.name} lands in Phase 1.2`
                : `Break command for ${rep.name} lands in Phase 1.2`,
            )
          }
          icon={rep.status === 'break' ? <Play size={11} /> : <Coffee size={11} />}
          label={rep.status === 'break' ? 'Resume' : 'Break'}
        />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }): JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ color: '#0f172a' }}>{value}</span>
    </div>
  );
}

function PopupButton({
  onClick,
  icon,
  label,
  primary,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '6px 8px',
        borderRadius: 6,
        background: primary ? '#0f172a' : '#f1f5f9',
        color: primary ? '#ffffff' : '#0f172a',
        border: primary ? 'none' : '1px solid #e2e8f0',
        fontSize: 11,
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        cursor: 'pointer',
      }}
    >
      {icon} {label}
    </button>
  );
}
