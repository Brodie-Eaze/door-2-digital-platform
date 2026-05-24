'use client';

/**
 * HQ Command Centre — live fleet map.
 *
 * Big satellite map of all active Knocker iPads across the field, with
 * AI-suggested next-territory pulses, propensity heatmap underlay, and
 * shift-status pins (active / break / idle).
 *
 * Esri ArcGIS World Imagery static image (no client-side leaflet —
 * bulletproof rendering). For interactive pan/zoom, swap to react-leaflet
 * once we wire the live websocket feed in Phase 1.2.
 */

import { useState } from 'react';
import { Phone, MessageSquare, Coffee, Pause, Play, MapPin, Zap } from 'lucide-react';

// Texas bounding box — covers Austin + Dallas + Houston metro
const BBOX = '-99.5,29.3,-93.5,33.5';
const SIZE = '1100,640';
const SATELLITE_URL = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${BBOX}&bboxSR=4326&imageSR=4326&size=${SIZE}&format=jpg&f=image`;

export interface FleetRep {
  id: string;
  initials: string;
  name: string;
  account: string;
  /** Position as % of map width/height */
  x: number;
  y: number;
  status: 'active' | 'break' | 'idle' | 'offline';
  shiftStart: string;
  hoursToday: string;
  knocksToday: number;
  conversionsToday: number;
  lastKnockMin: number;
  territory: string;
}

const REPS: FleetRep[] = [
  // Austin cluster (-97.7, 30.3 ≈ 36% across, 76% down)
  {
    id: 'r1',
    initials: 'JM',
    name: 'Jordan Mosley',
    account: 'Hope Forward',
    x: 35,
    y: 72,
    status: 'active',
    shiftStart: '09:00',
    hoursToday: '4h 12m',
    knocksToday: 84,
    conversionsToday: 31,
    lastKnockMin: 3,
    territory: 'Austin East',
  },
  {
    id: 'r2',
    initials: 'JD',
    name: 'Jada Davis',
    account: 'Hope Forward',
    x: 34,
    y: 74,
    status: 'active',
    shiftStart: '09:00',
    hoursToday: '4h 08m',
    knocksToday: 91,
    conversionsToday: 22,
    lastKnockMin: 1,
    territory: 'Austin East',
  },
  {
    id: 'r3',
    initials: 'AR',
    name: 'Aaliyah Reed',
    account: 'Hope Forward',
    x: 36,
    y: 70,
    status: 'active',
    shiftStart: '09:00',
    hoursToday: '4h 15m',
    knocksToday: 78,
    conversionsToday: 18,
    lastKnockMin: 7,
    territory: 'Austin North',
  },
  {
    id: 'r4',
    initials: 'TM',
    name: 'Tomás Mendez',
    account: 'Hope Forward',
    x: 38,
    y: 73,
    status: 'break',
    shiftStart: '09:00',
    hoursToday: '3h 45m · LUNCH',
    knocksToday: 64,
    conversionsToday: 14,
    lastKnockMin: 28,
    territory: 'Austin East',
  },

  // Dallas cluster (-96.8, 32.8 ≈ 44%, 28%)
  {
    id: 'r5',
    initials: 'AM',
    name: 'Asha Mehta',
    account: 'Hope Forward',
    x: 44,
    y: 28,
    status: 'active',
    shiftStart: '09:30',
    hoursToday: '3h 42m',
    knocksToday: 66,
    conversionsToday: 12,
    lastKnockMin: 5,
    territory: 'Dallas Metro',
  },
  {
    id: 'r6',
    initials: 'BC',
    name: 'Bianca Costa',
    account: 'PestMax',
    x: 45,
    y: 29,
    status: 'active',
    shiftStart: '08:00',
    hoursToday: '5h 12m',
    knocksToday: 38,
    conversionsToday: 9,
    lastKnockMin: 12,
    territory: 'Dallas North',
  },
  {
    id: 'r7',
    initials: 'HK',
    name: 'Hiroshi Kato',
    account: 'PestMax',
    x: 43,
    y: 27,
    status: 'idle',
    shiftStart: '08:00',
    hoursToday: '5h 18m',
    knocksToday: 31,
    conversionsToday: 5,
    lastKnockMin: 22,
    territory: 'Dallas North',
  },

  // Houston cluster (-95.4, 29.8 ≈ 68%, 84%)
  {
    id: 'r8',
    initials: 'KP',
    name: 'Kim Park',
    account: 'Hope Forward',
    x: 68,
    y: 82,
    status: 'active',
    shiftStart: '09:00',
    hoursToday: '4h 05m',
    knocksToday: 71,
    conversionsToday: 15,
    lastKnockMin: 4,
    territory: 'Houston SE',
  },
  {
    id: 'r9',
    initials: 'DR',
    name: 'Devon Russell',
    account: 'Hope Forward',
    x: 69,
    y: 84,
    status: 'offline',
    shiftStart: '—',
    hoursToday: 'Not clocked in',
    knocksToday: 0,
    conversionsToday: 0,
    lastKnockMin: 999,
    territory: 'Houston SE',
  },
  {
    id: 'r10',
    initials: 'ML',
    name: 'Marcus Lee',
    account: 'Hope Forward',
    x: 67,
    y: 81,
    status: 'active',
    shiftStart: '09:00',
    hoursToday: '4h 11m',
    knocksToday: 58,
    conversionsToday: 11,
    lastKnockMin: 2,
    territory: 'Houston SE',
  },
];

/** AI-suggested next territories (pulsing highlights on the map) */
const AI_SUGGESTIONS: Array<{ x: number; y: number; label: string; reason: string }> = [
  {
    x: 41,
    y: 71,
    label: 'Austin South',
    reason: 'Propensity 0.81 · ACS median income $94k · 14% conv (similar)',
  },
  {
    x: 50,
    y: 32,
    label: 'Plano',
    reason: 'Propensity 0.78 · lookalike to Highland Park (top cohort)',
  },
  {
    x: 72,
    y: 78,
    label: 'Sugar Land',
    reason: 'Propensity 0.74 · low cannibalisation w/ Houston SE',
  },
];

const STATUS_COLORS: Record<FleetRep['status'], string> = {
  active: '#22C55E',
  break: '#F59E0B',
  idle: '#EF4444',
  offline: '#64748B',
};

export function HQFleetMap(): JSX.Element {
  const [selected, setSelected] = useState<FleetRep | null>(null);

  return (
    <div className="relative w-full" style={{ height: 640 }}>
      <div className="absolute inset-0 rounded-2xl overflow-hidden border border-line2 bg-ink">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={SATELLITE_URL}
          alt="Texas fleet satellite"
          className="absolute inset-0 w-full h-full object-cover"
          loading="eager"
        />

        {/* AI suggestion pulses */}
        {AI_SUGGESTIONS.map((s, i) => (
          <div
            key={i}
            className="absolute group"
            style={{ left: `${s.x}%`, top: `${s.y}%`, transform: 'translate(-50%, -50%)' }}
          >
            <div
              className="w-16 h-16 rounded-full border-2 border-accent/60 animate-ping"
              style={{ background: 'rgba(59,130,246,0.15)' }}
            />
            <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-accent flex items-center justify-center">
              <Zap size={14} className="text-accent fill-accent" />
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 bg-surface/95 backdrop-blur rounded-md text-[10px] font-semibold text-ink whitespace-nowrap shadow-sm">
              {s.label}
            </div>
          </div>
        ))}

        {/* Rep pins */}
        {REPS.map((r) => {
          const color = STATUS_COLORS[r.status];
          const isSelected = selected?.id === r.id;
          return (
            <button
              key={r.id}
              onClick={() => setSelected(r)}
              className="absolute group"
              style={{
                left: `${r.x}%`,
                top: `${r.y}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: isSelected ? 30 : 20,
              }}
              title={`${r.name} · ${r.status}`}
            >
              {/* Halo */}
              {r.status === 'active' && (
                <div
                  className="absolute inset-0 rounded-full animate-pulse"
                  style={{ background: `${color}33`, width: 36, height: 36, top: -8, left: -8 }}
                />
              )}
              {/* Pin */}
              <div
                className="relative w-5 h-5 rounded-full border-2 border-white shadow-md flex items-center justify-center text-[8px] font-bold text-white"
                style={{ background: color }}
              >
                {r.initials.slice(0, 1)}
              </div>
              {/* Label on hover or selection */}
              <div
                className={`absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap shadow ${
                  isSelected
                    ? 'bg-ink text-surface'
                    : 'bg-surface/95 backdrop-blur text-ink opacity-0 group-hover:opacity-100'
                } transition`}
              >
                {r.initials} · {r.knocksToday}/{r.conversionsToday}
              </div>
            </button>
          );
        })}

        {/* Legend */}
        <div className="absolute top-3 left-3 bg-surface/95 backdrop-blur rounded-lg px-3 py-2 border border-line2 shadow-sm">
          <div className="text-[10px] uppercase tracking-wider text-muted mb-1.5 font-semibold">
            Fleet status
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" /> Active{' '}
              <span className="text-soft numeric">
                ({REPS.filter((r) => r.status === 'active').length})
              </span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Break{' '}
              <span className="text-soft numeric">
                ({REPS.filter((r) => r.status === 'break').length})
              </span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500" /> Idle{' '}
              <span className="text-soft numeric">
                ({REPS.filter((r) => r.status === 'idle').length})
              </span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-500" /> Offline{' '}
              <span className="text-soft numeric">
                ({REPS.filter((r) => r.status === 'offline').length})
              </span>
            </span>
          </div>
        </div>

        {/* AI legend */}
        <div className="absolute top-3 right-3 bg-surface/95 backdrop-blur rounded-lg px-3 py-2 border border-accent/30 shadow-sm">
          <div className="text-[10px] uppercase tracking-wider text-accent mb-1 font-semibold flex items-center gap-1">
            <Zap size={11} /> AI suggested next zones
          </div>
          <div className="text-[10px] text-muted">
            3 high-propensity neighbourhoods · click to assign
          </div>
        </div>

        {/* Live counter */}
        <div className="absolute bottom-3 left-3 bg-surface/95 backdrop-blur rounded-lg px-3 py-2 border border-line2 shadow-sm">
          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">
            Live · all accounts
          </div>
          <div className="text-[14px] font-bold text-ink numeric flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            {REPS.filter((r) => r.status === 'active').length} active iPads
          </div>
          <div className="text-[10px] text-muted">
            {REPS.reduce((s, r) => s + r.knocksToday, 0)} knocks today ·{' '}
            {REPS.reduce((s, r) => s + r.conversionsToday, 0)} conversions
          </div>
        </div>

        {/* Selected-rep panel */}
        {selected && (
          <div className="absolute bottom-3 right-3 bg-surface rounded-xl border border-line2 shadow-2xl w-[320px] overflow-hidden">
            <div className="px-4 py-3 border-b border-line2 flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-[12px] font-bold text-surface"
                style={{ background: STATUS_COLORS[selected.status] }}
              >
                {selected.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-ink truncate">{selected.name}</div>
                <div className="text-[10px] text-muted">
                  {selected.account} · {selected.territory}
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="w-6 h-6 rounded hover:bg-paper flex items-center justify-center text-soft"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-2 text-[12px]">
              <Row
                label="Status"
                value={
                  <span
                    className="flex items-center gap-1 font-medium"
                    style={{ color: STATUS_COLORS[selected.status] }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: STATUS_COLORS[selected.status] }}
                    />
                    {selected.status === 'active'
                      ? 'Active · knocking'
                      : selected.status === 'break'
                        ? 'On break / lunch'
                        : selected.status === 'idle'
                          ? 'Idle > 15min'
                          : 'Offline'}
                  </span>
                }
              />
              <Row label="Shift" value={`${selected.shiftStart} · ${selected.hoursToday}`} />
              <Row
                label="Last knock"
                value={
                  selected.lastKnockMin < 999 ? `${selected.lastKnockMin}m ago` : 'No knocks today'
                }
              />
              <Row
                label="Today"
                value={
                  <span className="numeric">
                    <span className="text-ink font-semibold">{selected.knocksToday}</span> knocks ·{' '}
                    <span className="text-ink font-semibold">{selected.conversionsToday}</span> conv
                  </span>
                }
              />
              <Row
                label="Conv. rate"
                value={
                  <span className="numeric font-semibold text-success">
                    {selected.knocksToday > 0
                      ? `${((selected.conversionsToday / selected.knocksToday) * 100).toFixed(1)}%`
                      : '—'}
                  </span>
                }
              />
            </div>
            <div className="px-4 py-3 border-t border-line2 bg-paper/40 flex items-center gap-1.5">
              <button className="flex-1 py-1.5 rounded-md bg-ink text-surface text-[11px] font-semibold flex items-center justify-center gap-1">
                <Phone size={12} /> Call
              </button>
              <button className="flex-1 py-1.5 rounded-md bg-paper text-ink border border-line2 text-[11px] font-semibold flex items-center justify-center gap-1">
                <MessageSquare size={12} /> Msg
              </button>
              <button className="flex-1 py-1.5 rounded-md bg-paper text-ink border border-line2 text-[11px] font-semibold flex items-center justify-center gap-1">
                {selected.status === 'break' ? (
                  <>
                    <Play size={12} /> Resume
                  </>
                ) : (
                  <>
                    <Coffee size={12} /> Break
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Esri attribution */}
        <div className="absolute bottom-1 right-1 text-[8px] text-white/70 bg-black/30 px-1 rounded">
          © Esri
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }): JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

export { REPS as FLEET_REPS };
