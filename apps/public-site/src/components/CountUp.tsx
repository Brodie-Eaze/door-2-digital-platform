'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Count a number up to `value` once it scrolls into view. Pure rAF, no deps.
 * Respects prefers-reduced-motion (renders the final value immediately) and
 * keeps tabular-nums so the digits don't jitter the layout while counting.
 */
export function CountUp({
  value,
  durationMs = 1400,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
}: {
  value: number;
  durationMs?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}): JSX.Element {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setDisplay(value);
      return;
    }

    const run = (): void => {
      if (started.current) return;
      started.current = true;
      const start = performance.now();
      const tick = (now: number): void => {
        // Clamp to [0,1]: a rAF timestamp can be marginally BEFORE the start
        // captured with performance.now() (frame began before run() was called),
        // which would make easeOutExpo dip negative and flash a negative number.
        const t = Math.min(1, Math.max(0, (now - start) / durationMs));
        // easeOutExpo — fast then settles, reads as "snapping into place".
        const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
        setDisplay(value * eased);
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) run();
      },
      { threshold: 0.4 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [value, durationMs]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
