/**
 * Central KPI rollup — single source of truth for "what does this account
 * (or HQ) look like by the numbers". Every other surface (command-centre,
 * /today, /reports, /conversions, /invoices) reads these so figures
 * reconcile across views.
 *
 * Sizing rationale (Pilot-Charlie scale):
 *  - Hope Forward (Enterprise · TX charity) — 247 reps, ~3,100 conv/mo
 *  - World Vision  (Enterprise · AU charity) — 198 reps, ~2,600 conv/mo
 *  - PestMax       (Growth     · US pest)    —  64 reps, ~  410 conv/mo
 *  - Gold Coast    (Trial      · AU health)  —  22 reps, ~   72 conv/mo
 *
 * HQ total ≈ 531 reps · ~6,200 conv/mo · ~$2.7M MTD revenue. These are the
 * "realistic for a 2026 multi-tenant ISO-backed platform with one Tier-1
 * pilot + a handful of expansion accounts" numbers Brodie demos to buyers.
 */

import { dailySeries, totalOf, type DailyPoint } from './time-series';
import type { Vertical } from './time-series';

export interface AccountSeedConfig {
  slug: string;
  vertical: Vertical;
  /** Roster size (active + idle + offline). */
  rosterSize: number;
  /** Inside-sales / call-centre team size. */
  insideSalesSize: number;
  /** Active territories count (clusters being worked). */
  territoriesActive: number;
  /** Average daily conversions today (peak weekday). */
  dailyConvPeak: number;
  /** Average revenue per conversion in cents (USD or AUD). */
  avgTicketCents: number;
  /** Lifetime-value multiplier — sustainer programs are 12x ticket. */
  ltvMultiplier: number;
  /** Plan tier. */
  plan: 'Enterprise' | 'Growth' | 'Trial';
}

export const ACCOUNT_SEEDS: Record<string, AccountSeedConfig> = {
  'hope-forward': {
    slug: 'hope-forward',
    vertical: 'charity',
    rosterSize: 247,
    insideSalesSize: 18,
    territoriesActive: 14,
    dailyConvPeak: 138,
    avgTicketCents: 32_00, // $32 monthly recurring
    ltvMultiplier: 14,
    plan: 'Enterprise',
  },
  'world-vision': {
    slug: 'world-vision',
    vertical: 'charity',
    rosterSize: 198,
    insideSalesSize: 14,
    territoriesActive: 16,
    dailyConvPeak: 118,
    avgTicketCents: 48_00, // A$48 monthly recurring (child sponsorship)
    ltvMultiplier: 18,
    plan: 'Enterprise',
  },
  pestmax: {
    slug: 'pestmax',
    vertical: 'commercial',
    rosterSize: 64,
    insideSalesSize: 6,
    territoriesActive: 7,
    dailyConvPeak: 22,
    avgTicketCents: 320_00, // $320 quarterly contract or termite scope
    ltvMultiplier: 6,
    plan: 'Growth',
  },
  'gold-coast-hospital': {
    slug: 'gold-coast-hospital',
    vertical: 'healthcare',
    rosterSize: 22,
    insideSalesSize: 3,
    territoriesActive: 6,
    dailyConvPeak: 6,
    avgTicketCents: 850_00, // A$850 capital pledge over 12mo
    ltvMultiplier: 12,
    plan: 'Trial',
  },
};

export interface AccountRollup {
  slug: string;
  /** Roster + staffing. */
  rosterSize: number;
  insideSalesSize: number;
  territoriesActive: number;
  /** 14-day conversion series. */
  conversions14d: DailyPoint[];
  /** Conversions for today (= series[last].value). */
  conversionsToday: number;
  /** Conversions in the last 7 days. */
  conversionsWeek: number;
  /** Conversions MTD (May 2026 to today; calendar-aware). */
  conversionsMTD: number;
  /** Revenue series (cents) — same shape as conversions but multiplied by avg ticket. */
  revenueCents14d: DailyPoint[];
  /** Revenue today (cents). */
  revenueCentsToday: bigint;
  /** Revenue MTD (cents). */
  revenueCentsMTD: bigint;
  /** Lifetime value MTD (recurring) — revenueMTD * ltvMultiplier. */
  ltvCentsMTD: bigint;
  /** Knocks today — derived from conversions / typical 8% conv rate. */
  knocksToday: number;
  /** Active reps right now (active + break, excludes idle/offline). */
  activeReps: number;
  /** Leads in inbox today. */
  leadsInboxToday: number;
  /** Conv rate today (%). */
  convRateToday: number;
}

/**
 * Build the canonical rollup for a single account. Deterministic given the
 * slug, so /command-centre, /today, /reports all see identical numbers on
 * a single render.
 *
 * `today` is parameterised for testability — defaults to the current date.
 */
export function rollupFor(slug: string, today: Date = new Date()): AccountRollup {
  const cfg = ACCOUNT_SEEDS[slug];
  if (!cfg) {
    throw new Error(`rollupFor: unknown account slug "${slug}"`);
  }

  const conversions14d = dailySeries(
    {
      days: 14,
      vertical: cfg.vertical,
      baseline: cfg.dailyConvPeak,
      weeklyTrend: 0.022, // +2.2% WoW campaign ramp
      noise: 0.07,
      seed: `${slug}:conv:v2`,
    },
    today,
  );

  const revenue14d = conversions14d.map((p) => ({
    ...p,
    value: p.value * cfg.avgTicketCents,
  }));

  const conversionsToday = conversions14d[conversions14d.length - 1]?.value ?? 0;
  const conversionsWeek = conversions14d.slice(-7).reduce((s, p) => s + p.value, 0);

  // MTD: figure out how many days into the current month we are, then
  // generate enough history. Cap at 31 to stay within the 14-day buffer
  // when relevant.
  const dayOfMonth = today.getDate();
  const monthSeries = dailySeries(
    {
      days: dayOfMonth,
      vertical: cfg.vertical,
      baseline: cfg.dailyConvPeak,
      weeklyTrend: 0.022,
      noise: 0.07,
      seed: `${slug}:mtd:v2`,
    },
    today,
  );
  const conversionsMTD = totalOf(monthSeries);

  const revenueCentsToday = BigInt(conversionsToday) * BigInt(cfg.avgTicketCents);
  const revenueCentsMTD = BigInt(conversionsMTD) * BigInt(cfg.avgTicketCents);
  const ltvCentsMTD = revenueCentsMTD * BigInt(cfg.ltvMultiplier);

  // Conversion-to-knock ratio differs by vertical — charity ~14-18%,
  // commercial ~8-12% (B2B doors are tougher), healthcare ~10%.
  const convRateBase =
    cfg.vertical === 'charity' ? 0.16 : cfg.vertical === 'commercial' ? 0.1 : 0.12;
  const knocksToday = Math.round(conversionsToday / convRateBase);

  // Active reps: ~75-85% of roster is on shift on a peak weekday, ~10% on
  // break, ~5% idle, ~5% offline/PTO. Active+break is the "fielded" count.
  const fieldedFrac = today.getDay() === 0 ? 0.05 : today.getDay() === 6 ? 0.32 : 0.82;
  const activeReps = Math.round(cfg.rosterSize * fieldedFrac);

  // Inbox sizing — charity gets steady inbound, commercial leaner.
  const inboxBase =
    cfg.vertical === 'charity'
      ? Math.round(knocksToday * 0.42)
      : cfg.vertical === 'commercial'
        ? Math.round(knocksToday * 0.55)
        : Math.round(knocksToday * 0.48);

  return {
    slug,
    rosterSize: cfg.rosterSize,
    insideSalesSize: cfg.insideSalesSize,
    territoriesActive: cfg.territoriesActive,
    conversions14d,
    conversionsToday,
    conversionsWeek,
    conversionsMTD,
    revenueCents14d: revenue14d,
    revenueCentsToday,
    revenueCentsMTD,
    ltvCentsMTD,
    knocksToday,
    activeReps,
    leadsInboxToday: inboxBase,
    convRateToday: knocksToday > 0 ? (conversionsToday / knocksToday) * 100 : 0,
  };
}

export interface HqRollup {
  /** Sum across all accounts. */
  totalReps: number;
  totalActiveReps: number;
  totalKnocksToday: number;
  totalConvToday: number;
  totalConvWeek: number;
  totalConvMTD: number;
  totalRevenueCentsMTD: bigint;
  totalLtvCentsMTD: bigint;
  totalTerritories: number;
  perAccount: AccountRollup[];
}

/**
 * Cross-account rollup — sum of every per-account rollup. Used on
 * /command-centre and any HQ-scoped chart. Numbers reconcile exactly with
 * the sum of per-account values.
 */
export function hqRollup(today: Date = new Date()): HqRollup {
  const perAccount = Object.keys(ACCOUNT_SEEDS).map((slug) => rollupFor(slug, today));
  return {
    perAccount,
    totalReps: perAccount.reduce((s, r) => s + r.rosterSize, 0),
    totalActiveReps: perAccount.reduce((s, r) => s + r.activeReps, 0),
    totalKnocksToday: perAccount.reduce((s, r) => s + r.knocksToday, 0),
    totalConvToday: perAccount.reduce((s, r) => s + r.conversionsToday, 0),
    totalConvWeek: perAccount.reduce((s, r) => s + r.conversionsWeek, 0),
    totalConvMTD: perAccount.reduce((s, r) => s + r.conversionsMTD, 0),
    totalRevenueCentsMTD: perAccount.reduce((s, r) => s + r.revenueCentsMTD, 0n),
    totalLtvCentsMTD: perAccount.reduce((s, r) => s + r.ltvCentsMTD, 0n),
    totalTerritories: perAccount.reduce((s, r) => s + r.territoriesActive, 0),
  };
}
