'use client';

/**
 * Real interactive Leaflet map scoped to a single sub-account's fleet.
 * Loaded only client-side via the `AccountLiveMap` dynamic wrapper. Renders:
 *  - Streets (OSM) + Satellite (Esri World Imagery) base layers via switcher
 *  - Optional Places/Boundaries label overlay on satellite
 *  - Rep pins as CircleMarkers, with pulse halos for active reps — sourced
 *    from live /api/orgs/[slug]/fleet, polled every 30 seconds.
 *  - Built-in zoom + scale + attribution controls
 *  - Floating fleet-status legend (top-left) + Live · {scope} badge (bottom-right)
 *
 * center/zoom/scopeLabel are hand-authored per-account map camera config
 * (lib/account-fleet.ts) — legitimate UI placement, not fleet/rep data.
 * There is no backing table for "AI suggested next zones" yet (see
 * schema.prisma), so that overlay no longer renders here.
 */

import { useEffect, useRef, useState, Fragment } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Tooltip,
  LayersControl,
  ZoomControl,
  ScaleControl,
} from 'react-leaflet';
import { Phone, MessageSquare, Coffee, Play } from 'lucide-react';
import { STATUS_COLORS, apiFleetEntryToRep, type ApiFleetEntry, type FleetRep } from '@/lib/fleet';
import { getAccountMapConfig } from '@/lib/account-fleet';
import { DataSourceBadge, useDataFreshness } from '@/components/DataSourceBadge';

interface AccountLiveMapImplProps {
  accountSlug: string;
}

const STATUS_LABEL: Record<FleetRep['status'], string> = {
  active: 'Active · knocking',
  break: 'On break / lunch',
  idle: 'Idle > 15min',
  offline: 'Offline',
};

export function AccountLiveMapImpl({ accountSlug }: AccountLiveMapImplProps): JSX.Element {
  const mapConfig = getAccountMapConfig(accountSlug);
  const fallbackCenter = mapConfig
    ? { lat: mapConfig.center[0], lng: mapConfig.center[1] }
    : { lat: 0, lng: 0 };

  const [reps, setReps] = useState<FleetRep[]>([]);
  const { source, updatedAt, markFresh } = useDataFreshness('fixture');
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchFleet(): Promise<void> {
      if (inFlight.current || document.visibilityState === 'hidden') return;
      inFlight.current = true;
      try {
        const res = await fetch(`/api/orgs/${accountSlug}/fleet`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { fleet?: ApiFleetEntry[] };
        // An empty array (nobody clocked in) is still a real live answer.
        if (Array.isArray(data.fleet)) {
          setReps(data.fleet.map((r) => apiFleetEntryToRep(r, fallbackCenter)));
          markFresh();
        }
      } catch {
        // Network failure — keep current state; staleness timer downgrades.
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
  }, [accountSlug]);

  if (!mapConfig) {
    return (
      <div
        className="relative w-full rounded-2xl overflow-hidden border border-line2 bg-ink flex items-center justify-center text-soft text-[12px]"
        style={{ height: 560 }}
      >
        No live fleet data configured for this account yet.
      </div>
    );
  }

  const { center, zoom, scopeLabel } = mapConfig;
  const activeCount = reps.filter((r) => r.status === 'active').length;
  const breakCount = reps.filter((r) => r.status === 'break').length;
  const idleCount = reps.filter((r) => r.status === 'idle').length;
  const offlineCount = reps.filter((r) => r.status === 'offline').length;
  const totalKnocks = reps.reduce((s, r) => s + r.knocksToday, 0);

  return (
    <div className="relative w-full" style={{ height: 560 }}>
      <div className="absolute inset-0 rounded-2xl overflow-hidden border border-line2 bg-ink">
        <MapContainer
          center={center}
          zoom={zoom}
          scrollWheelZoom={true}
          zoomControl={false}
          style={{ height: '100%', width: '100%', background: '#0b1220' }}
          attributionControl={true}
        >
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

          {/* Rep pins — react-leaflet requires Leaflet components as direct children,
              so we use Fragment (no DOM wrapper) for the active-pulse halo + pin pair. */}
          {reps.map((r) => {
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

        {/* Floating fleet status legend */}
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

        {/* Live · {scope} badge */}
        <div className="absolute bottom-3 right-3 z-[400] bg-surface/95 backdrop-blur rounded-lg px-3 py-2 border border-line2 shadow-sm pointer-events-none max-w-[220px]">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-wider text-muted font-semibold">
              {scopeLabel}
            </span>
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
          onClick={() => alert(`Calling ${rep.name}…`)}
          icon={<Phone size={11} />}
          label="Call"
          primary
        />
        <PopupButton
          onClick={() => alert(`Messaging ${rep.name}…`)}
          icon={<MessageSquare size={11} />}
          label="Msg"
        />
        <PopupButton
          onClick={() =>
            alert(
              rep.status === 'break'
                ? `Resuming ${rep.name}'s shift…`
                : `Sending ${rep.name} on break…`,
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
