'use client';

/**
 * DataSourceBadge — the honest-data indicator.
 *
 * Every operator surface showing operational data renders one of these so
 * a user can always tell live DB data from seeded demo data from stale data.
 * Pattern lifted from the leads inbox (the platform's reference page) and
 * standardised here for every other surface.
 *
 *   <DataSourceBadge source="live" updatedAt={lastFetched} />
 *   <DataSourceBadge source="fixture" />
 */

import { useEffect, useState, useCallback } from 'react';

export type DataSource = 'live' | 'fixture' | 'stale';

const STALE_AFTER_MS = 90_000;

/**
 * Tracks data freshness for polled surfaces. Call `markFresh()` on every
 * successful poll; the returned source flips to 'stale' automatically when
 * no successful poll lands within 90s.
 */
export function useDataFreshness(initial: DataSource = 'fixture'): {
  source: DataSource;
  updatedAt: Date | null;
  markFresh: () => void;
  markFixture: () => void;
} {
  const [source, setSource] = useState<DataSource>(initial);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (source !== 'live') return;
    const interval = setInterval(() => {
      if (updatedAt && Date.now() - updatedAt.getTime() > STALE_AFTER_MS) {
        setSource('stale');
      }
    }, 10_000);
    return (): void => clearInterval(interval);
  }, [source, updatedAt]);

  // Memoized so their identity is STABLE across renders. Consumers put these
  // in useCallback/useEffect dependency arrays (the live-fetch pattern); an
  // unstable identity there caused an infinite fetch loop that left every
  // wired surface stuck on 'Loading…' (found in the visual audit).
  const markFresh = useCallback((): void => {
    setUpdatedAt(new Date());
    setSource('live');
  }, []);
  const markFixture = useCallback((): void => setSource('fixture'), []);

  return { source, updatedAt, markFresh, markFixture };
}

function ago(d: Date): string {
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return `${m}m ago`;
}

export function DataSourceBadge({
  source,
  updatedAt,
  className = '',
}: {
  source: DataSource;
  updatedAt?: Date | null;
  className?: string;
}): JSX.Element {
  // Re-render every 10s so the "Xs ago" stays current.
  const [, tick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => tick((n) => n + 1), 10_000);
    return (): void => clearInterval(interval);
  }, []);

  const config = {
    live: {
      dot: 'bg-emerald-500',
      text: 'text-emerald-700',
      bg: 'bg-emerald-50 border-emerald-200',
      label: updatedAt ? `LIVE · ${ago(updatedAt)}` : 'LIVE',
    },
    fixture: {
      dot: 'bg-amber-500',
      text: 'text-amber-700',
      bg: 'bg-amber-50 border-amber-200',
      label: 'DEMO DATA',
    },
    stale: {
      dot: 'bg-rose-500',
      text: 'text-rose-700',
      bg: 'bg-rose-50 border-rose-200',
      label: updatedAt ? `STALE · ${ago(updatedAt)}` : 'STALE',
    },
  }[source];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9.5px] font-semibold tracking-wider uppercase ${config.bg} ${config.text} ${className}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${config.dot} ${source === 'live' ? 'animate-pulse' : ''}`}
      />
      {config.label}
    </span>
  );
}
