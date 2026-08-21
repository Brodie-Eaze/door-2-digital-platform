/*
 * DigitalEngine — "the digital side", illustrated. Field signals (knocks, calls,
 * conversions) flow into the intelligence layer (event bus → warehouse → AI
 * models) and back out as the things that make the next campaign smarter:
 * propensity heatmaps, retargeting audiences, next-area targeting, anomaly
 * alerts. Renders on a navy section; animated connectors via marketing.css.
 */
import type { ReactNode } from 'react';
import {
  DoorOpen,
  Phone,
  CircleDollarSign,
  Database,
  Cpu,
  Radio,
  MapPinned,
  Target,
  Megaphone,
  TriangleAlert,
} from 'lucide-react';

function Connector(): JSX.Element {
  return (
    <div className="flex items-center justify-center">
      {/* horizontal on desktop, vertical on mobile */}
      <svg className="hidden h-6 w-12 lg:block" viewBox="0 0 48 24" aria-hidden>
        <line
          x1="2"
          y1="12"
          x2="40"
          y2="12"
          stroke="rgba(147,197,253,0.45)"
          strokeWidth="1.5"
          className="mk-flow"
        />
        <path
          d="M40 7 L46 12 L40 17"
          fill="none"
          stroke="rgba(147,197,253,0.8)"
          strokeWidth="1.5"
        />
      </svg>
      <svg className="h-8 w-6 lg:hidden" viewBox="0 0 24 32" aria-hidden>
        <line
          x1="12"
          y1="2"
          x2="12"
          y2="24"
          stroke="rgba(147,197,253,0.45)"
          strokeWidth="1.5"
          className="mk-flow"
        />
        <path
          d="M7 24 L12 30 L17 24"
          fill="none"
          stroke="rgba(147,197,253,0.8)"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}

function Node({ icon, title, sub }: { icon: ReactNode; title: string; sub: string }): JSX.Element {
  return (
    <div className="deck flex items-center gap-2.5 rounded-xl px-3 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-[#93C5FD]">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="truncate text-[12px] font-semibold tracking-tight text-surface">
          {title}
        </div>
        <div className="truncate font-mono text-[9px] uppercase tracking-[0.10em] text-surface/45">
          {sub}
        </div>
      </div>
    </div>
  );
}

export function DigitalEngine(): JSX.Element {
  return (
    <div>
      <div className="grid items-center gap-3 lg:grid-cols-[1fr_auto_1.25fr_auto_1fr]">
        {/* Inputs */}
        <div className="space-y-2.5">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-surface/45">
            Signals in
          </div>
          <Node
            icon={<DoorOpen size={15} />}
            title="Knock events"
            sub="GPS · disposition · photo"
          />
          <Node icon={<Phone size={15} />} title="Call outcomes" sub="inside-sales dispositions" />
          <Node
            icon={<CircleDollarSign size={15} />}
            title="Conversions"
            sub="donation | sale + source"
          />
        </div>

        <Connector />

        {/* Engine */}
        <div className="deck mk-sheen relative overflow-hidden rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#93C5FD]">
              Intelligence layer
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[9px] text-surface/55">
              <span className="mk-blink inline-block h-1.5 w-1.5 rounded-full bg-accent" /> live
            </span>
          </div>
          <div className="mt-3 space-y-2">
            <Node
              icon={<Radio size={15} />}
              title="Event bus + outbox"
              sub="exactly-once fan-out"
            />
            <Node
              icon={<Database size={15} />}
              title="Per-region warehouse"
              sub="residency-pinned"
            />
            <Node
              icon={<Cpu size={15} />}
              title="AI models"
              sub="propensity · audiences · anomaly"
            />
          </div>
        </div>

        <Connector />

        {/* Outputs */}
        <div className="space-y-2.5">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-surface/45">
            Intelligence out
          </div>
          <Node
            icon={<MapPinned size={15} />}
            title="Propensity heatmaps"
            sub="which blocks convert"
          />
          <Node
            icon={<Target size={15} />}
            title="Retargeting audiences"
            sub="hashed, cross-network"
          />
          <Node
            icon={<Megaphone size={15} />}
            title="Next-area targeting"
            sub="warm the next territory"
          />
          <Node
            icon={<TriangleAlert size={15} />}
            title="Anomaly alerts"
            sub="fraud + performance"
          />
        </div>
      </div>
    </div>
  );
}
