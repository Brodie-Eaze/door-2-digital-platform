'use client';

import { Megaphone, DoorOpen, Headset, Target, CircleDollarSign, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * D2D's signature loop — the full motion, the way Brodie tells it:
 *
 *   MARKET the area  →  KNOCK (field team)  →  CALL CENTRE (inside sales)
 *        →  RETARGET (AI)  →  CONVERT (donation | sale)  →  COMMISSION  ↺
 *
 * and the hub is the data + attribution that trains the NEXT area's targeting,
 * so the whole thing compounds. Geometry is parametric (6 nodes evenly placed
 * on the ring; arcs computed with a gap near each node) so it stays exact. An
 * accent pulse orbits the ring (SVG pathLength=1000 → one lap per cycle); hover
 * pauses it. Reduced-motion users get the static ring.
 */

const C = 220;
const R = 150;
const VB = 440;
const GAP_DEG = 17;

const polar = (deg: number, r = R): { x: number; y: number } => {
  const a = (deg * Math.PI) / 180;
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
};

type Node = { key: string; step: string; label: string; sub: string; icon: ReactNode };

const NODES: Node[] = [
  {
    key: 'market',
    step: '01',
    label: 'Market the area',
    sub: 'Geo-targeted ads',
    icon: <Megaphone size={17} />,
  },
  { key: 'knock', step: '02', label: 'Knock', sub: 'Field team', icon: <DoorOpen size={17} /> },
  {
    key: 'call',
    step: '03',
    label: 'Call centre',
    sub: 'Inside sales',
    icon: <Headset size={17} />,
  },
  {
    key: 'retarget',
    step: '04',
    label: 'Retarget',
    sub: 'AI audiences',
    icon: <Target size={17} />,
  },
  {
    key: 'convert',
    step: '05',
    label: 'Convert',
    sub: 'Donation | sale',
    icon: <CircleDollarSign size={17} />,
  },
  { key: 'commission', step: '06', label: 'Commission', sub: 'Payout', icon: <Wallet size={17} /> },
];

// Node angle: start at top (-90°), clockwise, 60° apart for 6 nodes.
const angleFor = (i: number): number => -90 + i * (360 / NODES.length);

// Arc segments between consecutive nodes, with a gap so they don't touch the boxes.
const ARCS = NODES.map((_, i) => {
  const a1 = angleFor(i) + GAP_DEG;
  const a2 = angleFor(i + 1) - GAP_DEG;
  const p1 = polar(a1);
  const p2 = polar(a2);
  return `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} A ${R} ${R} 0 0 1 ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
});

export function AnimatedLoop(): JSX.Element {
  return (
    <div className="loop-wrap relative mx-auto aspect-square w-full max-w-[480px]">
      <svg
        viewBox={`0 0 ${VB} ${VB}`}
        className="absolute inset-0 h-full w-full"
        fill="none"
        aria-hidden
      >
        <defs>
          <marker
            id="loop-arrow"
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10 z" fill="#3B82F6" />
          </marker>
          <linearGradient id="orbit-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="1" />
          </linearGradient>
        </defs>

        <circle cx={C} cy={C} r={R} stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="2 7" />

        {ARCS.map((d) => (
          <path
            key={d}
            d={d}
            stroke="#3B82F6"
            strokeWidth="1.75"
            strokeLinecap="round"
            markerEnd="url(#loop-arrow)"
          />
        ))}

        <circle
          className="mk-orbit"
          cx={C}
          cy={C}
          r={R}
          pathLength={1000}
          stroke="url(#orbit-grad)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </svg>

      {/* Hub — the compounding feedback */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
        <div className="flex h-[128px] w-[128px] flex-col items-center justify-center rounded-full border border-line bg-surface px-3 shadow-[0_1px_0_rgba(15,23,42,0.04),0_0_0_1px_rgba(15,23,42,0.04)]">
          <span className="font-mono text-[8px] uppercase tracking-[0.18em] text-soft">
            One source of truth
          </span>
          <span className="mt-1 text-[13px] font-semibold leading-tight tracking-tight text-ink">
            Data + attribution
          </span>
          <span className="mt-1.5 font-mono text-[8px] leading-tight text-accent">
            trains the next area&apos;s targeting
          </span>
        </div>
      </div>

      {/* Stage nodes */}
      {NODES.map((n, i) => {
        const p = polar(angleFor(i));
        return (
          <div
            key={n.key}
            className="absolute flex w-[104px] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center"
            style={{ left: `${(p.x / VB) * 100}%`, top: `${(p.y / VB) * 100}%` }}
          >
            <div className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-ink shadow-[0_1px_0_rgba(15,23,42,0.04),0_0_0_1px_rgba(15,23,42,0.04)]">
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-ink font-mono text-[8px] font-semibold text-surface">
                {n.step}
              </span>
              <span className="text-accent">{n.icon}</span>
            </div>
            <div className="mt-2 text-[12px] font-semibold leading-tight tracking-tight text-ink">
              {n.label}
            </div>
            <div className="font-mono text-[9px] uppercase tracking-[0.10em] text-soft">
              {n.sub}
            </div>
          </div>
        );
      })}
    </div>
  );
}
