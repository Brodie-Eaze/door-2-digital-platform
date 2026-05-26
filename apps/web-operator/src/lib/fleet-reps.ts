/**
 * HQ fleet aggregate — every rep across every account, displayed on the
 * `/command-centre` live satellite map.
 *
 * The pre-Sprint-B version hard-coded 10 reps across Austin/Dallas/Houston.
 * Pilot-Charlie scale is ~530 reps across 4 accounts; the HQ map renders up
 * to MAX_VISIBLE pins so it's legible, sourcing from the deterministic
 * per-account rosters in `lib/seed/roster.ts`.
 */

import { buildRoster } from './seed/roster';
import { ACCOUNT_SEEDS } from './seed/kpis';

export interface FleetRep {
  id: string;
  initials: string;
  name: string;
  account: string;
  /** Real-world coordinates */
  lat: number;
  lng: number;
  status: 'active' | 'break' | 'idle' | 'offline';
  shiftStart: string;
  hoursToday: string;
  knocksToday: number;
  conversionsToday: number;
  lastKnockMin: number;
  territory: string;
}

export interface AiZone {
  lat: number;
  lng: number;
  label: string;
  reason: string;
}

export const STATUS_COLORS: Record<FleetRep['status'], string> = {
  active: '#22C55E',
  break: '#F59E0B',
  idle: '#EF4444',
  offline: '#64748B',
};

// Display name per account for the `account` field on pins.
const ACCOUNT_DISPLAY: Record<string, string> = {
  'hope-forward': 'Hope Forward',
  'world-vision': 'World Vision',
  pestmax: 'PestMax',
  'gold-coast-hospital': 'Gold Coast Hospital',
};

// Max pins on the HQ map — beyond this it becomes a blob. Per-account
// proportional sampling keeps each tenant represented even when one
// account dwarfs the others.
const MAX_VISIBLE = 120;

function buildHqFleet(): FleetRep[] {
  const cfgs = Object.values(ACCOUNT_SEEDS);
  const totalRoster = cfgs.reduce((s, c) => s + c.rosterSize, 0);
  const out: FleetRep[] = [];
  for (const cfg of cfgs) {
    const display = ACCOUNT_DISPLAY[cfg.slug] ?? cfg.slug;
    const proportional = Math.max(
      8, // minimum representation per account so tiny tenants aren't invisible
      Math.round((cfg.rosterSize / totalRoster) * MAX_VISIBLE),
    );
    const roster = buildRoster({ slug: cfg.slug });
    // Prefer on-shift reps for the live map; backfill with offline if needed.
    const onShift = roster.filter((k) => k.status !== 'offline');
    const offline = roster.filter((k) => k.status === 'offline');
    const picked = [
      ...onShift.slice(0, proportional),
      ...offline.slice(0, Math.max(0, proportional - onShift.length)),
    ];
    for (const k of picked) {
      out.push({
        id: k.id,
        initials: k.initials,
        name: k.name,
        account: display,
        lat: k.lat,
        lng: k.lng,
        status: k.status,
        shiftStart: k.shiftStart,
        hoursToday: k.hoursToday,
        knocksToday: k.knocksToday,
        conversionsToday: k.conversionsToday,
        lastKnockMin: k.lastKnockMin,
        territory: k.territory,
      });
    }
  }
  return out;
}

export const FLEET_REPS: FleetRep[] = buildHqFleet();

/** AI-suggested next territories (pulsing highlights on the map) */
export const AI_ZONES: AiZone[] = [
  {
    lat: 30.2415,
    lng: -97.7689,
    label: 'Austin South · 78704',
    reason: 'Propensity 0.81 · ACS median income $94k · 14% conv (similar)',
  },
  {
    lat: 33.0198,
    lng: -96.6989,
    label: 'Plano · 75024',
    reason: 'Propensity 0.78 · lookalike to Highland Park (top cohort)',
  },
  {
    lat: 29.6197,
    lng: -95.6349,
    label: 'Sugar Land · 77479',
    reason: 'Propensity 0.74 · low cannibalisation w/ Houston SE',
  },
];
