/**
 * Per-account lead generator — produces 30-80 leads sized to feel like a
 * real inbox without overwhelming the page. Status mix follows a real
 * inside-sales funnel:
 *
 *   New (28%) · Contacted (24%) · Qualified (16%) · Appointment (12%) ·
 *   Converted (14%) · Lost (5%) · DNC (1%)
 *
 * Time-since-captured is realistic (most leads are <72h old, with a long
 * tail of "stuck > 14d" entries that drive the pipeline anomaly tiles).
 *
 * FIXTURE — not real PII. Names from `buildNamePool`, phones from
 * `fixturePhone` (US 555-line / AU reserved testing block).
 */

import { ACCOUNT_SEEDS } from './kpis';
import { rngFor } from './time-series';
import { buildNamePool } from './names';
import { fixtureAddress, fixturePhone, getAccountGeo, type GeoCluster } from './geo';
import { STAFF_NAMES } from './names';

export type LeadStatusKey =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'appointment_set'
  | 'converted'
  | 'lost'
  | 'do_not_contact';

export type AttributionKey = 'door' | 'inside_sales' | 'retargeting';

export interface SeededLead {
  id: string;
  givenName: string;
  familyName: string;
  /** "Given Family" — convenience for components that take one string. */
  name: string;
  phone: string;
  email: string;
  address: string;
  territory: string;
  status: LeadStatusKey;
  source: AttributionKey;
  /** AI-suggested follow-up priority. */
  tier: 'high' | 'medium' | 'low';
  /** Assigned BDR initials. */
  assigneeInitials: string;
  assigneeName: string;
  /** Captured at — ISO timestamp. */
  capturedAt: string;
  /** Days since capture. */
  daysOld: number;
  /** Forecast deal value, cents. */
  valueCents: bigint;
  /** AI score 0-100. */
  aiScore: number;
  daysInStage: number;
}

interface BuildOptions {
  slug: string;
  count?: number;
  today?: Date;
}

const STATUS_MIX: { status: LeadStatusKey; weight: number }[] = [
  { status: 'new', weight: 28 },
  { status: 'contacted', weight: 24 },
  { status: 'qualified', weight: 16 },
  { status: 'appointment_set', weight: 12 },
  { status: 'converted', weight: 14 },
  { status: 'lost', weight: 5 },
  { status: 'do_not_contact', weight: 1 },
];

const SOURCE_MIX: { source: AttributionKey; weight: number }[] = [
  { source: 'door', weight: 60 },
  { source: 'inside_sales', weight: 25 },
  { source: 'retargeting', weight: 15 },
];

const TIER_MIX: { tier: 'high' | 'medium' | 'low'; weight: number }[] = [
  { tier: 'high', weight: 22 },
  { tier: 'medium', weight: 48 },
  { tier: 'low', weight: 30 },
];

function pickWeighted<T extends { weight: number }>(rng: ReturnType<typeof rngFor>, table: T[]): T {
  const total = table.reduce((s, r) => s + r.weight, 0);
  let n = rng.next() * total;
  for (const row of table) {
    n -= row.weight;
    if (n <= 0) return row;
  }
  return table[table.length - 1]!;
}

/**
 * Build a deterministic lead list for an account.
 *
 * Default count scales with rosterSize — bigger ops generate more leads —
 * but clamps to [30, 80] so any single page stays scrollable.
 */
export function buildLeads({ slug, count, today = new Date() }: BuildOptions): SeededLead[] {
  const cfg = ACCOUNT_SEEDS[slug];
  if (!cfg) return [];

  const target = count ?? Math.min(80, Math.max(30, Math.round(cfg.rosterSize * 0.25)));
  const rng = rngFor(`${slug}:leads:v2`);
  const geo = getAccountGeo(slug);
  const names = buildNamePool(rng, target, geo.region);

  const out: SeededLead[] = [];
  for (let i = 0; i < target; i++) {
    const { name } = names[i]!;
    const [given, ...rest] = name.split(' ');
    const family = rest.join(' ');
    const cluster: GeoCluster = rng.pick(geo.clusters);
    const status = pickWeighted(rng, STATUS_MIX).status;
    const source = pickWeighted(rng, SOURCE_MIX).source;
    const tier = pickWeighted(rng, TIER_MIX).tier;
    const staff = rng.pick(STAFF_NAMES);

    // Time-since-captured distribution:
    //   60% within 72h, 25% 3-14 days, 15% >14d (the "stuck" tail).
    let daysOld: number;
    const ageRoll = rng.next();
    if (ageRoll < 0.6) {
      daysOld = rng.int(0, 3);
    } else if (ageRoll < 0.85) {
      daysOld = rng.int(4, 14);
    } else {
      daysOld = rng.int(15, 42);
    }
    const captured = new Date(today);
    captured.setDate(today.getDate() - daysOld);
    // Add some hours so the "captured" timestamp isn't all midnight.
    captured.setHours(rng.int(8, 21), rng.int(0, 59), 0, 0);

    // Lead value: per-vertical avg-ticket × ltv multiplier with ±40%
    // skew, biased high for "high" tier.
    let valueBase = cfg.avgTicketCents * cfg.ltvMultiplier;
    if (tier === 'high') valueBase *= 1.8;
    else if (tier === 'low') valueBase *= 0.45;
    const valueCents = BigInt(Math.round(valueBase * (0.75 + rng.next() * 0.5)));

    // AI score: high tier = 75-95, medium 50-75, low 25-50; slight noise.
    let aiScore: number;
    if (tier === 'high') aiScore = rng.int(75, 95);
    else if (tier === 'medium') aiScore = rng.int(50, 78);
    else aiScore = rng.int(25, 55);

    out.push({
      id: `${slug}_ld_${String(i).padStart(4, '0')}`,
      givenName: given ?? name,
      familyName: family,
      name,
      phone: fixturePhone(rng, geo.phoneCountry),
      email: `${(given ?? '').toLowerCase()}.${family.toLowerCase().replace(/\s+/g, '')}@${rng.pick(['gmail.com', 'yahoo.com', 'outlook.com', 'icloud.com'])}`,
      address: fixtureAddress(rng, cluster),
      territory: cluster.territory,
      status,
      source,
      tier,
      assigneeInitials: staff.initials,
      assigneeName: staff.name,
      capturedAt: captured.toISOString(),
      daysOld,
      valueCents,
      aiScore,
      daysInStage: Math.min(daysOld, rng.int(0, daysOld + 1)),
    });
  }

  return out;
}
