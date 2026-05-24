'use client';

/**
 * Real interactive Leaflet map. Loaded only client-side via the
 * `HQLiveMap` dynamic wrapper. Renders:
 *  - Streets (OSM) + Satellite (Esri World Imagery) base layers via switcher
 *  - Optional Places/Boundaries label overlay on satellite
 *  - Rep pins as CircleMarkers, with pulse halos for active reps
 *  - AI suggestion zones as labelled CircleMarkers with permanent tooltips
 *  - Built-in zoom + scale + attribution controls
 */

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
import { Phone, MessageSquare, Coffee, Play, Zap } from 'lucide-react';
import { FLEET_REPS, AI_ZONES, STATUS_COLORS, type FleetRep } from '@/lib/fleet-reps';

const TEXAS_CENTER: [number, number] = [31.0, -97.0];
const INITIAL_ZOOM = 6;

const STATUS_LABEL: Record<FleetRep['status'], string> = {
  active: 'Active · knocking',
  break: 'On break / lunch',
  idle: 'Idle > 15min',
  offline: 'Offline',
};

export function HQLiveMapImpl(): JSX.Element {
  const activeCount = FLEET_REPS.filter((r) => r.status === 'active').length;
  const breakCount = FLEET_REPS.filter((r) => r.status === 'break').length;
  const idleCount = FLEET_REPS.filter((r) => r.status === 'idle').length;
  const offlineCount = FLEET_REPS.filter((r) => r.status === 'offline').length;
  const totalKnocks = FLEET_REPS.reduce((s, r) => s + r.knocksToday, 0);
  const totalConv = FLEET_REPS.reduce((s, r) => s + r.conversionsToday, 0);

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

          {/* AI suggestion zones — pulsing accent circles */}
          {AI_ZONES.map((z) => (
            <CircleMarker
              key={z.label}
              center={[z.lat, z.lng]}
              radius={30}
              pathOptions={{
                color: '#3B82F6',
                weight: 2,
                fillColor: '#3B82F6',
                fillOpacity: 0.18,
              }}
            >
              <Tooltip permanent direction="top" offset={[0, -6]} className="d2d-ai-tooltip">
                <span style={{ fontWeight: 600, fontSize: 11 }}>{z.label}</span>
              </Tooltip>
              <Popup>
                <div style={{ minWidth: 200 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
                    AI zone · {z.label}
                  </div>
                  <div style={{ fontSize: 11, color: '#475569' }}>{z.reason}</div>
                </div>
              </Popup>
            </CircleMarker>
          ))}

          {/* Rep pins */}
          {FLEET_REPS.map((r) => {
            const color = STATUS_COLORS[r.status];
            const isActive = r.status === 'active';
            return (
              <div key={r.id}>
                {isActive && (
                  <CircleMarker
                    center={[r.lat, r.lng]}
                    radius={14}
                    pathOptions={{
                      color: color,
                      weight: 1,
                      fillColor: color,
                      fillOpacity: 0.2,
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
              </div>
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

        <div className="absolute top-3 right-14 z-[400] bg-surface/95 backdrop-blur rounded-lg px-3 py-2 border border-accent/30 shadow-sm pointer-events-none">
          <div className="text-[10px] uppercase tracking-wider text-accent mb-1 font-semibold flex items-center gap-1">
            <Zap size={11} /> AI suggested next zones
          </div>
          <div className="text-[10px] text-muted">
            {AI_ZONES.length} high-propensity neighbourhoods · click to inspect
          </div>
        </div>

        <div className="absolute bottom-3 right-3 z-[400] bg-surface/95 backdrop-blur rounded-lg px-3 py-2 border border-line2 shadow-sm pointer-events-none">
          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">
            Live · all accounts
          </div>
          <div className="text-[14px] font-bold text-ink numeric flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            {activeCount} active iPads
          </div>
          <div className="text-[10px] text-muted">
            {totalKnocks} knocks today · {totalConv} conversions
          </div>
        </div>
      </div>
    </div>
  );
}

function RepPopupCard({ rep }: { rep: FleetRep }): JSX.Element {
  const color = STATUS_COLORS[rep.status];
  const convRate =
    rep.knocksToday > 0 ? `${((rep.conversionsToday / rep.knocksToday) * 100).toFixed(1)}%` : '—';

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
              <strong>{rep.knocksToday}</strong> knocks · <strong>{rep.conversionsToday}</strong>{' '}
              conv
            </span>
          }
        />
        <Row label="Conv. rate" value={<strong style={{ color: '#16a34a' }}>{convRate}</strong>} />
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
