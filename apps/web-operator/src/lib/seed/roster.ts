/**
 * Per-account roster generator — produces N knockers with realistic tenure
 * distribution, varied conv rate, and varied current-day activity.
 *
 * Tenure curve (Pilot-Charlie reference):
 *  - 30% rookies (0-30 days) — bottom-third conversion rates
 *  - 35% intermediates (1-6mo) — average rates
 *  - 25% veterans (6mo-2yr) — top of the curve
 *  - 10% lifers (2yr+) — managers / trainers, lower active knock count
 *
 * Conversion rate distribution (charity):
 *  - 3-6% rookies, 8-14% intermediates, 14-22% veterans, 18-28% lifers
 *  - Top performer ~32-38% (1-2 outliers per 100 reps)
 *
 * Output rows fit the existing `Knocker` shape in account-fixtures plus
 * extra metadata (tenure, joinedAt) for surfaces that need it.
 */

import { ACCOUNT_SEEDS, type AccountSeedConfig } from './kpis';
import { fixturePhone, getAccountGeo, snapToCluster } from './geo';
import { buildNamePool } from './names';
import { rngFor } from './time-series';
import type { Rng } from './rng';

export type KnockerStatus = 'active' | 'break' | 'idle' | 'offline';

export interface SeededKnocker {
  id: string;
  initials: string;
  name: string;
  phone: string;
  /** Days since they joined. */
  tenureDays: number;
  /** ISO date they joined. */
  joinedAt: string;
  /** Live status today. */
  status: KnockerStatus;
  /** Knocks completed today (0 for offline / new-hires-not-on-shift). */
  knocksToday: number;
  /** Conversions captured today. */
  conversionsToday: number;
  /** Cents earned today (avgTicket × conversions). */
  revenueCentsToday: bigint;
  /** Their lifetime conversion rate, %. */
  lifetimeConvRate: number;
  /** Cluster/territory label. */
  territory: string;
  /** Live lat/lng (snapped into a cluster). */
  lat: number;
  lng: number;
  /** Shift start (HH:mm) or `—` if offline. */
  shiftStart: string;
  /** Total hours on-shift today, formatted. */
  hoursToday: string;
  /** Minutes since last knock (used by anomaly detection). */
  lastKnockMin: number;
}

interface BuildOptions {
  slug: string;
  /** Hint at the current weekday so weekend rosters look light. */
  today?: Date;
}

/**
 * Produce a deterministic roster sized by `ACCOUNT_SEEDS[slug].rosterSize`.
 */
export function buildRoster({ slug, today = new Date() }: BuildOptions): SeededKnocker[] {
  const cfg = ACCOUNT_SEEDS[slug];
  if (!cfg) return [];
  const rng = rngFor(`${slug}:roster:v2`);
  const geo = getAccountGeo(slug);
  const names = buildNamePool(rng, cfg.rosterSize, geo.region);

  // Pre-compute how many of each tenure band we want.
  const counts = computeTenureCounts(cfg);
  // Pre-compute who's on-shift today based on weekday.
  const fieldedFrac = today.getDay() === 0 ? 0.05 : today.getDay() === 6 ? 0.32 : 0.82;
  const fieldedCount = Math.round(cfg.rosterSize * fieldedFrac);

  const out: SeededKnocker[] = [];
  for (let i = 0; i < cfg.rosterSize; i++) {
    const { initials, name } = names[i]!;
    // Assign tenure band by index — keeps the distribution stable.
    let tenureDays: number;
    if (i < counts.rookie) {
      tenureDays = rng.int(1, 30);
    } else if (i < counts.rookie + counts.intermediate) {
      tenureDays = rng.int(31, 180);
    } else if (i < counts.rookie + counts.intermediate + counts.veteran) {
      tenureDays = rng.int(181, 720);
    } else {
      tenureDays = rng.int(721, 1500); // ~2-4yr lifers
    }
    const joinedAt = new Date(today);
    joinedAt.setDate(today.getDate() - tenureDays);

    const lifetimeRate = pickRate(rng, cfg, tenureDays);
    const cluster = rng.pick(geo.clusters);
    const { lat, lng } = snapToCluster(rng, cluster);

    // Are they on shift today? First `fieldedCount` reps get "on shift",
    // and the remainder are offline/PTO/not clocked in. The mapping uses
    // rep index to ensure determinism per slug, but rotates so it's not
    // always the same human-readable names that show "offline".
    const onShift = i < fieldedCount;
    let status: KnockerStatus = 'offline';
    let knocksToday = 0;
    let conversionsToday = 0;
    let lastKnockMin = 999;
    let shiftStart = '—';
    let hoursToday = 'Not clocked in';

    if (onShift) {
      // Within fielded reps: 88% active, 8% break, 4% idle.
      const r = rng.next();
      if (r < 0.88) status = 'active';
      else if (r < 0.96) status = 'break';
      else status = 'idle';

      // Each rep's "today" knock count comes from their rate × ~6 hour shift
      // × ~10 knocks/hour ± noise. Higher-tenure reps knock slightly less
      // (training duties) but convert more.
      const fatigueFactor = tenureDays > 720 ? 0.85 : 1.0;
      const baseKnocks = (cfg.vertical === 'commercial' ? 38 : 62) * fatigueFactor;
      knocksToday = Math.max(8, Math.round(baseKnocks * (1 + rng.normal(0, 0.18))));
      conversionsToday = Math.round((knocksToday * lifetimeRate) / 100);
      if (status === 'idle') lastKnockMin = rng.int(18, 45);
      else if (status === 'break') lastKnockMin = rng.int(25, 55);
      else lastKnockMin = rng.int(1, 12);

      const startMin = rng.pick([0, 30]);
      const startHour = cfg.vertical === 'commercial' ? rng.pick([7, 8]) : rng.pick([9, 10]);
      shiftStart = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
      const totalH = 3.5 + rng.next() * 2.0; // 3.5-5.5h logged so far
      const hh = Math.floor(totalH);
      const mm = Math.round((totalH - hh) * 60);
      hoursToday = `${hh}h ${String(mm).padStart(2, '0')}m`;
      if (status === 'break') hoursToday += ' · LUNCH';
    }

    out.push({
      id: `${slug}_kn_${String(i).padStart(3, '0')}`,
      initials,
      name,
      phone: fixturePhone(rng, geo.phoneCountry),
      tenureDays,
      joinedAt: joinedAt.toISOString().slice(0, 10),
      status,
      knocksToday,
      conversionsToday,
      revenueCentsToday: BigInt(conversionsToday) * BigInt(cfg.avgTicketCents),
      lifetimeConvRate: +lifetimeRate.toFixed(1),
      territory: cluster.territory,
      lat,
      lng,
      shiftStart,
      hoursToday,
      lastKnockMin,
    });
  }

  return out;
}

interface TenureCounts {
  rookie: number;
  intermediate: number;
  veteran: number;
  lifer: number;
}

function computeTenureCounts(cfg: AccountSeedConfig): TenureCounts {
  // Trial accounts skew rookie-heavy; Enterprise has veteran tails.
  if (cfg.plan === 'Trial') {
    return {
      rookie: Math.round(cfg.rosterSize * 0.55),
      intermediate: Math.round(cfg.rosterSize * 0.4),
      veteran: Math.round(cfg.rosterSize * 0.05),
      lifer: 0,
    };
  }
  if (cfg.plan === 'Growth') {
    return {
      rookie: Math.round(cfg.rosterSize * 0.36),
      intermediate: Math.round(cfg.rosterSize * 0.42),
      veteran: Math.round(cfg.rosterSize * 0.18),
      lifer: Math.round(cfg.rosterSize * 0.04),
    };
  }
  return {
    rookie: Math.round(cfg.rosterSize * 0.3),
    intermediate: Math.round(cfg.rosterSize * 0.35),
    veteran: Math.round(cfg.rosterSize * 0.25),
    lifer: Math.round(cfg.rosterSize * 0.1),
  };
}

function pickRate(rng: Rng, cfg: AccountSeedConfig, tenureDays: number): number {
  const base = cfg.vertical === 'commercial' ? 9 : cfg.vertical === 'healthcare' ? 11 : 14;
  let centre: number;
  let stdev: number;
  if (tenureDays <= 30) {
    centre = base * 0.4;
    stdev = base * 0.18;
  } else if (tenureDays <= 180) {
    centre = base * 0.85;
    stdev = base * 0.22;
  } else if (tenureDays <= 720) {
    centre = base * 1.2;
    stdev = base * 0.25;
  } else {
    centre = base * 1.5;
    stdev = base * 0.2;
  }
  const v = centre + rng.normal(0, stdev);
  // Clamp 3-38%
  return Math.max(3, Math.min(38, v));
}
