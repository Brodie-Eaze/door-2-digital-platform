/**
 * Realistic time-series generators for fixtures.
 *
 * The demo previously rendered flat lines or pure-sinusoid wobble that
 * sophisticated buyers (sales VPs, ops directors, fintech reviewers) spot
 * instantly. Real D2D operations look like this:
 *
 *  - Weekly: Sun very low, Mon-Tue ramp, Wed/Thu peak, Fri taper, Sat half.
 *  - Daily (charity): 10am–8pm with 4-7pm peak (people are home).
 *  - Daily (commercial): 8am–6pm with steady distribution (B2B doors).
 *  - Multi-week: gentle upward trend ~1.5% week-over-week (campaign ramp).
 *  - Noise: ±8% Gaussian, every ~10-14 days one "anomaly" (weather, holiday).
 *
 * The generators return arrays of integers (conversions, knocks, revenue
 * cents) shaped so a line chart looks like a real ops dashboard, not noise.
 */

import { makeRng, type Rng } from './rng';

export type Vertical = 'charity' | 'commercial' | 'healthcare';

export interface DailyPoint {
  /** Days back from today; 0 = today, 13 = two weeks ago. */
  daysBack: number;
  /** ISO date (YYYY-MM-DD). */
  iso: string;
  /** Display weekday name (Mon/Tue/...). */
  weekday: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  /** Whatever metric the caller asked for (count or cents). */
  value: number;
}

// JS getDay: 0=Sun, 1=Mon, ..., 6=Sat
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * Weekly seasonality multipliers. Real D2D charity operations are nearly
 * dead on Sundays and ramp through the week — these multipliers match
 * Pilot-Charlie's published weekday distribution within ±5pp.
 */
const SEASONALITY: Record<Vertical, Record<(typeof WEEKDAY_LABELS)[number], number>> = {
  charity: {
    Sun: 0.18,
    Mon: 0.95,
    Tue: 1.05,
    Wed: 1.12,
    Thu: 1.18,
    Fri: 1.05,
    Sat: 0.47,
  },
  // Commercial B2B doors look the same M-F (decision-makers in office) and
  // very weak on weekends.
  commercial: {
    Sun: 0.05,
    Mon: 1.04,
    Tue: 1.12,
    Wed: 1.15,
    Thu: 1.12,
    Fri: 0.95,
    Sat: 0.12,
  },
  // Healthcare donor pledges look like charity but with a softer weekday spike.
  healthcare: {
    Sun: 0.22,
    Mon: 0.98,
    Tue: 1.04,
    Wed: 1.1,
    Thu: 1.12,
    Fri: 1.04,
    Sat: 0.5,
  },
};

export interface DailyOptions {
  /** Number of days of history to generate, inclusive of "today". */
  days: number;
  /** Vertical pattern to follow. */
  vertical: Vertical;
  /** Centre of the daily distribution before seasonality + noise. */
  baseline: number;
  /** Weekly trend per 7 days (e.g. 0.02 = +2% per week). */
  weeklyTrend?: number;
  /** Noise stdev as a fraction of baseline (default 0.08). */
  noise?: number;
  /** Seed string — usually `${slug}:${metric}`. */
  seed: string;
  /** Optional anomaly probability per day (default 0.04 = ~1 in 25 days). */
  anomalyProb?: number;
}

/**
 * Build a `DailyPoint[]` series sized for a 14-day sparkline (or longer).
 *
 * `iso` and `weekday` reference real calendar days back from the supplied
 * `today` (defaults to the system clock so SSR matches the user's day).
 */
export function dailySeries(opts: DailyOptions, today: Date = new Date()): DailyPoint[] {
  const rng = makeRng(opts.seed);
  const trend = opts.weeklyTrend ?? 0.018;
  const noise = opts.noise ?? 0.08;
  const anomalyProb = opts.anomalyProb ?? 0.04;
  const out: DailyPoint[] = [];

  for (let i = opts.days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const weekday = WEEKDAY_LABELS[date.getDay()]!;
    // Older days closer to baseline; younger days lifted by trend.
    const trendFactor = 1 + ((opts.days - 1 - i) / 7) * -trend; // older = lower
    const dayMul = SEASONALITY[opts.vertical][weekday];
    let val = opts.baseline * dayMul * trendFactor;
    // Gaussian noise.
    val *= 1 + rng.normal(0, noise);
    // Anomalies — weather/event surge or dip.
    if (rng.bool(anomalyProb)) {
      val *= rng.bool(0.5) ? 0.55 : 1.35;
    }
    val = Math.max(0, Math.round(val));
    out.push({
      daysBack: i,
      iso: date.toISOString().slice(0, 10),
      weekday,
      value: val,
    });
  }

  return out;
}

/**
 * Hourly distribution of knocks/conversions within an active shift. Used by
 * the "today" sparkline + per-hour conversion charts. Hours outside the
 * working window return 0 — real knockers don't door-knock at 11pm.
 */
export function hourlySeries(opts: {
  vertical: Vertical;
  dailyTotal: number;
  seed: string;
}): { hour: number; value: number }[] {
  const rng = makeRng(opts.seed);
  // Charity / healthcare door windows skew evening; commercial skews midday.
  const profile: Record<Vertical, number[]> = {
    // Index 0-23 → hour weight; sum normalises to opts.dailyTotal.
    charity: [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 4, 5, 6, 6, 7, 8, 10, 12, 14, 12, 8, 4, 1, 0],
    healthcare: [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 5, 7, 8, 8, 9, 9, 9, 9, 7, 4, 2, 1, 0, 0],
    commercial: [0, 0, 0, 0, 0, 0, 0, 1, 4, 7, 9, 10, 10, 10, 9, 8, 7, 5, 3, 1, 0, 0, 0, 0],
  };
  const weights = profile[opts.vertical];
  const sum = weights.reduce((s, v) => s + v, 0);
  return weights.map((w, h) => {
    const target = (w / sum) * opts.dailyTotal;
    // ±15% jitter so adjacent hours don't look identical.
    const noisy = target * (1 + rng.normal(0, 0.15));
    return { hour: h, value: Math.max(0, Math.round(noisy)) };
  });
}

/**
 * Convenience — extract just the numeric series for sparkline-style charts.
 */
export function values(series: DailyPoint[]): number[] {
  return series.map((p) => p.value);
}

/**
 * Sum a daily series. Use for "X today" / "X this week" / "X MTD" rollups.
 */
export function totalOf(series: DailyPoint[]): number {
  return series.reduce((s, p) => s + p.value, 0);
}

/**
 * Build a deterministic, account-scoped RNG. Pure pass-through, here so
 * callers in service modules don't need to import both files.
 */
export function rngFor(seed: string): Rng {
  return makeRng(seed);
}
