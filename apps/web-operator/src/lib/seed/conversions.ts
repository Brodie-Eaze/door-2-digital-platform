/**
 * Per-account conversion ledger — recent conversions in reverse-chrono
 * order. Used by /accounts/[slug]/conversions and the live activity feed
 * on the HQ map.
 *
 * Mix of attribution sources follows the same 60/25/15 door/inside/retarget
 * split as `leads.ts`. Amount distribution follows the configured avg-ticket
 * with realistic spread (charity has tight spread, healthcare has long
 * right tail for capital pledges).
 */

import { ACCOUNT_SEEDS } from './kpis';
import { buildNamePool } from './names';
import { getAccountGeo } from './geo';
import { rngFor } from './time-series';
import type { AttributionKey } from './leads';

export interface SeededConversion {
  id: string;
  donorName: string;
  donorEmailMasked: string;
  amountCents: bigint;
  /** Recurring frequency, or 'one-off'. */
  frequency: 'monthly' | 'quarterly' | 'annual' | 'one-off';
  attribution: AttributionKey;
  territory: string;
  /** Initials of the rep credited. */
  repInitials: string;
  capturedAt: string;
  /** Days since captured. */
  daysOld: number;
  /** Whether the payment cleared (95% yes). */
  paymentStatus: 'cleared' | 'pending' | 'declined';
}

const ATTRIBUTION_MIX: { source: AttributionKey; weight: number }[] = [
  { source: 'door', weight: 60 },
  { source: 'inside_sales', weight: 25 },
  { source: 'retargeting', weight: 15 },
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
 * Build a recent conversion ledger. Defaults to the last 30 days × peak
 * × seasonality which yields ~250-800 entries for an Enterprise account
 * — the page only renders the top 60 by recency.
 */
export function buildConversions({
  slug,
  count = 60,
  today = new Date(),
}: {
  slug: string;
  count?: number;
  today?: Date;
}): SeededConversion[] {
  const cfg = ACCOUNT_SEEDS[slug];
  if (!cfg) return [];
  const rng = rngFor(`${slug}:conv:ledger:v2`);
  const geo = getAccountGeo(slug);
  const names = buildNamePool(rng, count, geo.region);

  const out: SeededConversion[] = [];
  for (let i = 0; i < count; i++) {
    const { name } = names[i]!;
    const cluster = rng.pick(geo.clusters);
    const attribution = pickWeighted(rng, ATTRIBUTION_MIX).source;

    // Tight log-normal-ish around the avg ticket. Healthcare gets a long
    // right tail (capital pledges $5k-$25k); commercial gets quarterly
    // chunks.
    let amountCents: number;
    let frequency: SeededConversion['frequency'];
    if (cfg.vertical === 'healthcare') {
      if (rng.bool(0.18)) {
        amountCents = Math.round(cfg.avgTicketCents * (4 + rng.next() * 28));
        frequency = 'one-off';
      } else {
        amountCents = Math.round(cfg.avgTicketCents * (0.6 + rng.next() * 1.4));
        frequency = rng.bool(0.6) ? 'monthly' : 'one-off';
      }
    } else if (cfg.vertical === 'commercial') {
      amountCents = Math.round(cfg.avgTicketCents * (0.5 + rng.next() * 1.5));
      frequency = rng.bool(0.65) ? 'quarterly' : rng.bool(0.5) ? 'monthly' : 'annual';
    } else {
      // Charity — recurring monthly dominates, occasional one-off uplift.
      if (rng.bool(0.12)) {
        amountCents = Math.round(cfg.avgTicketCents * (3 + rng.next() * 12));
        frequency = 'one-off';
      } else {
        amountCents = Math.round(cfg.avgTicketCents * (0.7 + rng.next() * 1.2));
        frequency = 'monthly';
      }
    }

    // Distribute back in time: most recent first, exponential decay so the
    // top 10 fit "today" feel.
    const minutesBack = Math.round(rng.next() * rng.next() * 60 * 24 * 14); // last 14d
    const ts = new Date(today.getTime() - minutesBack * 60 * 1000);
    const daysOld = Math.floor(minutesBack / (60 * 24));

    // Rep initials: synth two-letter blob; we don't need 1:1 against the
    // roster for the ledger view (the roster page joins by name).
    const repFirst = name.split(' ')[0]![0]!;
    const repLast = (name.split(' ')[1] ?? 'X')[0]!;
    const repInitials = (repFirst + repLast).toUpperCase();

    // Payment status — 95% cleared, 3% pending, 2% declined.
    const r = rng.next();
    const paymentStatus: SeededConversion['paymentStatus'] =
      r < 0.95 ? 'cleared' : r < 0.98 ? 'pending' : 'declined';

    // Email mask — first letter, asterisks, domain.
    const [given, ...rest] = name.split(' ');
    const family = rest.join('');
    const domain = rng.pick(['gmail.com', 'yahoo.com', 'outlook.com', 'icloud.com']);
    const donorEmailMasked = `${(given ?? '')[0]!.toLowerCase()}***${family[family.length - 1]!.toLowerCase()}@${domain}`;

    out.push({
      id: `${slug}_cv_${String(i).padStart(5, '0')}`,
      donorName: name,
      donorEmailMasked,
      amountCents: BigInt(amountCents),
      frequency,
      attribution,
      territory: cluster.territory,
      repInitials,
      capturedAt: ts.toISOString(),
      daysOld,
      paymentStatus,
    });
  }
  // Reverse-chrono.
  return out.sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));
}
