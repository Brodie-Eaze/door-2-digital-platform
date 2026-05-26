/**
 * Seed entry point — single import surface for every demo page.
 *
 * Usage from a page or service:
 *
 *   import { seedFor, hqRollup } from '@/lib/seed';
 *   const seed = seedFor('hope-forward');
 *   const hq   = hqRollup();
 *
 * The seed is memoised per-slug per-date so adjacent components in the
 * same render see identical numbers without recomputation cost.
 */

import { buildLeads, type SeededLead } from './leads';
import { buildConversions, type SeededConversion } from './conversions';
import { buildRoster, type SeededKnocker } from './roster';
import { rollupFor, hqRollup, type AccountRollup, type HqRollup } from './kpis';

export type { SeededLead, SeededConversion, SeededKnocker, AccountRollup, HqRollup };
export { rollupFor, hqRollup };

export interface AccountSeed {
  slug: string;
  rollup: AccountRollup;
  knockers: SeededKnocker[];
  leads: SeededLead[];
  conversions: SeededConversion[];
}

const cache = new Map<string, AccountSeed>();

function cacheKey(slug: string, today: Date): string {
  return `${slug}:${today.toISOString().slice(0, 10)}`;
}

/**
 * Build (or fetch from cache) the full seed bundle for an account. Cache is
 * scoped to the calendar day so the demo "advances" naturally without
 * recomputing on every component render.
 */
export function seedFor(slug: string, today: Date = new Date()): AccountSeed {
  const key = cacheKey(slug, today);
  const hit = cache.get(key);
  if (hit) return hit;
  const seed: AccountSeed = {
    slug,
    rollup: rollupFor(slug, today),
    knockers: buildRoster({ slug, today }),
    leads: buildLeads({ slug, today }),
    conversions: buildConversions({ slug, today }),
  };
  cache.set(key, seed);
  return seed;
}

export { buildLeads, buildConversions, buildRoster };
