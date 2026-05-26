'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Card } from './Card';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  /** Optional delta string ('+12.4%' or '-3') with implied tone. */
  delta?: string;
  deltaTone?: 'positive' | 'negative' | 'neutral';
  /** Optional sparkline or small chart slot. */
  sparkline?: ReactNode;
  /** Optional sub-label below the value. */
  hint?: ReactNode;
  /** Disable the count-up animation. Defaults to enabled when value parses as numeric. */
  animate?: boolean;
}

/**
 * Numeric prefix/digits/suffix parser. Returns { target, render } when the
 * value can be animated, else null. Handles $1,605,240.00, +12pp, 94.2%,
 * 184hr, 5.2x, plain integers, etc.
 */
function extractTarget(value: ReactNode): { target: number; render: (n: number) => string } | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { target: value, render: (n) => Math.round(n).toLocaleString('en-US') };
  }
  if (typeof value !== 'string') return null;
  const m = value.match(/^(\D*?)(-?\d[\d,]*(?:\.\d+)?)(.*)$/);
  if (!m) return null;
  const prefix = m[1] ?? '';
  const digits = m[2] ?? '';
  const suffix = m[3] ?? '';
  const parsed = parseFloat(digits.replace(/,/g, ''));
  if (!Number.isFinite(parsed)) return null;
  const hasDecimal = digits.includes('.');
  const decimals = hasDecimal ? digits.split('.')[1]!.length : 0;
  return {
    target: parsed,
    render: (n) => {
      const formatted =
        decimals > 0
          ? n.toLocaleString('en-US', {
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals,
            })
          : Math.round(n).toLocaleString('en-US');
      return `${prefix}${formatted}${suffix}`;
    },
  };
}

/**
 * Count-up hook. Animates 0 → target over `durationMs` using ease-out cubic.
 * Honours `prefers-reduced-motion` (jumps straight to target).
 */
function useCountUp(target: number, durationMs = 700): number {
  const [current, setCurrent] = useState(0);
  const reducedRef = useRef(false);
  useEffect(() => {
    reducedRef.current =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducedRef.current) {
      setCurrent(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number): void => {
      const t = Math.min(1, (now - start) / durationMs);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setCurrent(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return current;
}

function AnimatedValue({
  target,
  render,
}: {
  target: number;
  render: (n: number) => string;
}): JSX.Element {
  const current = useCountUp(target);
  return <>{render(current)}</>;
}

/**
 * KPI card — uppercase label, large numeric value, optional delta + spark.
 * Numeric values animate once on mount (ease-out cubic over 700ms). Pass
 * `animate={false}` to disable. Respects `prefers-reduced-motion`.
 */
export function KpiCard({
  label,
  value,
  delta,
  deltaTone = 'neutral',
  sparkline,
  hint,
  animate = true,
}: KpiCardProps): JSX.Element {
  const deltaClass =
    deltaTone === 'positive'
      ? 'text-success'
      : deltaTone === 'negative'
        ? 'text-rose-600'
        : 'text-muted';

  const extracted = animate ? extractTarget(value) : null;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="h-section">{label}</div>
          <div className="mt-2 text-[20px] leading-tight font-semibold text-ink tracking-tight numeric">
            {extracted ? (
              <AnimatedValue target={extracted.target} render={extracted.render} />
            ) : (
              value
            )}
          </div>
          {(delta || hint) && (
            <div className="mt-1 flex items-center gap-2 text-[11px]">
              {delta && <span className={`${deltaClass} numeric`}>{delta}</span>}
              {hint && <span className="text-muted">{hint}</span>}
            </div>
          )}
        </div>
        {sparkline && <div className="shrink-0">{sparkline}</div>}
      </div>
    </Card>
  );
}
