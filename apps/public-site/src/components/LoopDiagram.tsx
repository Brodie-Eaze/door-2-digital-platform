/**
 * The loop — D2D's signature diagram. Five field-sales stages arranged on a
 * clockwise ring with attribution as the hub that ties them together:
 *
 *   KNOCK → CRM → RETARGET → CONVERT → COMMISSION → (informs the next KNOCK)
 *
 * Presentational only (no client hooks). The ring + directional arcs are drawn
 * in one SVG layer; the stage nodes are HTML on top so they can use the design
 * system's type + colour tokens. Honors prefers-reduced-motion implicitly —
 * there is no animation here, only a static, legible structure.
 */
import { DoorOpen, Users, Target, CircleDollarSign, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';

type Node = {
  key: string;
  step: string;
  label: string;
  sub: string;
  icon: ReactNode;
  left: string;
  top: string;
};

const NODES: Node[] = [
  {
    key: 'knock',
    step: '01',
    label: 'Knock',
    sub: 'Field capture',
    icon: <DoorOpen size={18} />,
    left: '50%',
    top: '15.9%',
  },
  {
    key: 'crm',
    step: '02',
    label: 'CRM',
    sub: 'Lead + inside sales',
    icon: <Users size={18} />,
    left: '82.4%',
    top: '39.5%',
  },
  {
    key: 'retarget',
    step: '03',
    label: 'Retarget',
    sub: 'AI audiences',
    icon: <Target size={18} />,
    left: '70%',
    top: '77.6%',
  },
  {
    key: 'convert',
    step: '04',
    label: 'Convert',
    sub: 'Donation | sale',
    icon: <CircleDollarSign size={18} />,
    left: '30%',
    top: '77.6%',
  },
  {
    key: 'commission',
    step: '05',
    label: 'Commission',
    sub: 'Payout instruction',
    icon: <Wallet size={18} />,
    left: '17.6%',
    top: '39.5%',
  },
];

// Pre-computed arc segments (R=150, centre 220,220, 22° gap each side of a node).
const ARCS = [
  'M276.2 80.9 A150 150 0 0 1 334.9 123.6',
  'M369.6 230.5 A150 150 0 0 1 347.2 299.5',
  'M256.3 365.5 A150 150 0 0 1 183.7 365.5',
  'M92.8 299.5 A150 150 0 0 1 70.4 230.5',
  'M105.1 123.6 A150 150 0 0 1 163.8 80.9',
];

export function LoopDiagram(): JSX.Element {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[460px]">
      <svg viewBox="0 0 440 440" className="absolute inset-0 h-full w-full" fill="none" aria-hidden>
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
        </defs>
        <circle
          cx="220"
          cy="220"
          r="150"
          stroke="#E2E8F0"
          strokeWidth="1.5"
          strokeDasharray="2 7"
        />
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
      </svg>

      {/* Hub */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
        <div className="flex h-[112px] w-[112px] flex-col items-center justify-center rounded-full border border-line bg-surface shadow-[0_1px_0_rgba(15,23,42,0.04),0_0_0_1px_rgba(15,23,42,0.04)]">
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-soft">
            Single truth
          </span>
          <span className="mt-1 text-[13px] font-semibold tracking-tight text-ink">
            Attribution
          </span>
          <span className="mt-1 font-mono text-[9px] text-accent">door · is · retarget</span>
        </div>
      </div>

      {/* Stage nodes */}
      {NODES.map((n) => (
        <div
          key={n.key}
          className="absolute flex w-[112px] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center"
          style={{ left: n.left, top: n.top }}
        >
          <div className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-ink shadow-[0_1px_0_rgba(15,23,42,0.04),0_0_0_1px_rgba(15,23,42,0.04)]">
            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-ink font-mono text-[8px] font-semibold text-surface">
              {n.step}
            </span>
            <span className="text-accent">{n.icon}</span>
          </div>
          <div className="mt-2 text-[12px] font-semibold tracking-tight text-ink">{n.label}</div>
          <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-soft">{n.sub}</div>
        </div>
      ))}
    </div>
  );
}
