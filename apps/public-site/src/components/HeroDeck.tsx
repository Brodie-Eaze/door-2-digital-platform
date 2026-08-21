'use client';

import { DoorOpen, TrendingUp, Radio } from 'lucide-react';
import { CountUp } from './CountUp';
import { SatMap } from './SatMap';

/**
 * The hero's signature surface — a miniature, living "Command Centre" deck:
 * a REAL satellite field map with pulsing tracked pins, count-up KPI tiles, and
 * a scrolling live-activity ticker. Conveys the product in one glance the way a
 * static screenshot can't, inside the navy DNA (no glass-pane chrome, no aurora).
 */

const PINS: { x: number; y: number; t: 'sale' | 'lead' | 'idle' }[] = [
  { x: 28, y: 34, t: 'sale' },
  { x: 52, y: 22, t: 'lead' },
  { x: 71, y: 41, t: 'sale' },
  { x: 40, y: 58, t: 'idle' },
  { x: 63, y: 66, t: 'lead' },
  { x: 84, y: 28, t: 'idle' },
  { x: 19, y: 62, t: 'lead' },
];

const FEED: { who: string; what: string; tag: string }[] = [
  { who: 'M. Okeke', what: 'logged a donation — recurring $40/mo', tag: 'CONVERT' },
  { who: 'Crew 4', what: 'cleared territory NE-12 · 84 doors', tag: 'KNOCK' },
  { who: 'Retarget', what: 'audience synced to Meta — 1,204 matched', tag: 'AI' },
  { who: 'Inside sales', what: 'booked appointment from door lead', tag: 'CRM' },
  { who: 'D. Rivera', what: 'commission accrued — door bucket 15%', tag: 'PAYOUT' },
  { who: 'Compliance', what: 'TX cleared — campaign now delivering', tag: 'STATE' },
];

export function HeroDeck(): JSX.Element {
  return (
    <div className="loop-wrap relative mx-auto w-full max-w-[560px]">
      <div className="deck mk-sheen mk-float rounded-2xl p-3 sm:p-4">
        {/* Title bar */}
        <div className="flex items-center justify-between px-1 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#475569]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#475569]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#475569]" />
            </span>
            <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.16em] text-surface/45">
              Command Centre
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-surface/55">
            <span className="mk-blink inline-block h-1.5 w-1.5 rounded-full bg-accent" />
            PRODUCT PREVIEW
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.5fr_1fr]">
          {/* Real satellite field map */}
          <SatMap
            area="phoenix"
            territory
            route
            pins={PINS}
            label="Field view · illustrative"
            aspect="aspect-[1.5/1]"
          />

          {/* KPI rail */}
          <div className="flex flex-col gap-2.5">
            <DeckKpi
              icon={<DoorOpen size={13} />}
              label="Knocks today"
              value={<CountUp value={2841} />}
            />
            <DeckKpi
              icon={<TrendingUp size={13} />}
              label="Conversions"
              value={<CountUp value={317} />}
            />
            <DeckKpi
              icon={<Radio size={13} />}
              label="Pipeline"
              value={<CountUp value={184.6} decimals={1} prefix="$" suffix="k" />}
            />
          </div>
        </div>

        {/* Live activity ticker — duplicated feed scrolls continuously. */}
        <div className="mt-3 overflow-hidden rounded-xl border border-surface/10 bg-[#0B1220] px-3.5 py-1">
          <div className="h-[66px] overflow-hidden">
            <div className="mk-ticker-track flex flex-col">
              {[...FEED, ...FEED].map((f, i) => (
                <div key={i} className="flex h-[22px] shrink-0 items-center gap-2 text-[11px]">
                  <span className="shrink-0 rounded bg-accent/15 px-1.5 font-mono text-[8px] font-semibold uppercase tracking-[0.10em] text-[#93C5FD]">
                    {f.tag}
                  </span>
                  <span className="truncate text-surface/80">
                    <span className="font-medium text-surface">{f.who}</span> {f.what}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* floor shadow anchor */}
      <div
        aria-hidden
        className="mx-auto mt-2 h-8 w-3/4 rounded-[50%] opacity-60"
        style={{
          background: 'radial-gradient(50% 100% at 50% 0%, rgba(0,0,0,0.45), transparent 70%)',
        }}
      />
    </div>
  );
}

function DeckKpi({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}): JSX.Element {
  return (
    <div className="flex-1 rounded-xl border border-surface/10 bg-[#0B1220] px-3 py-2.5">
      <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-surface/45">
        <span className="text-accent">{icon}</span>
        {label}
      </div>
      <div className="numeric mt-1 font-mono text-[20px] font-semibold tracking-tight text-surface">
        {value}
      </div>
    </div>
  );
}
