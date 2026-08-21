/**
 * Live fleet types + status palette — shared by the HQ and per-account
 * satellite maps (HQLiveMapImpl / AccountLiveMapImpl), command-centre's KPI
 * tiles, and the reassign drawer.
 *
 * Pre-W3 this lived in `fleet-reps.ts` and also held the FLEET_REPS /
 * AI_ZONES fixtures (renamed on removal — this module is no longer "reps",
 * it's live-fleet types + a converter). Both maps now source real positions
 * from /api/fleet (platform, cross-tenant) and /api/orgs/[slug]/fleet
 * (per-account) — active KnockSession rows joined to each knocker's most
 * recent Knock.geo. See those routes for the query + PII geo-coarsening.
 * There is no backing table for "AI suggested zones" yet (see
 * schema.prisma), so that concept has no home here anymore either.
 */

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

export const STATUS_COLORS: Record<FleetRep['status'], string> = {
  active: '#22C55E',
  break: '#F59E0B',
  idle: '#EF4444',
  offline: '#64748B',
};

/** Shape returned by /api/fleet and /api/orgs/[slug]/fleet — see those routes. */
export interface ApiFleetEntry {
  id: string;
  userId: string;
  initials: string;
  name: string;
  territory: string;
  account: string;
  status: 'active' | 'idle' | 'offline';
  lat: number | null;
  lng: number | null;
  knocksToday: number;
  lastKnockMin: number;
  shiftStart: string;
}

/**
 * Texas centroid — the fallback map anchor for the HQ (cross-account) fleet
 * view, used only when a rep has no Knock.geo yet today (new shift, zero
 * knocks logged). Never (0,0) — that's the Gulf of Guinea.
 */
export const HQ_FALLBACK_CENTER: { lat: number; lng: number } = { lat: 31.0, lng: -97.0 };

/**
 * Convert a live /api/fleet(/orgs/[slug]) entry into the FleetRep shape the
 * map pins + reassign drawer render.
 */
export function apiFleetEntryToRep(
  r: ApiFleetEntry,
  fallbackCenter: { lat: number; lng: number },
): FleetRep {
  return {
    id: r.userId,
    name: r.name,
    initials: r.initials,
    account: r.account,
    territory: r.territory,
    status: r.status,
    lat: r.lat ?? fallbackCenter.lat,
    lng: r.lng ?? fallbackCenter.lng,
    knocksToday: r.knocksToday,
    // Not yet tracked by the fleet endpoints — conversions require a
    // per-rep disposition rollup that only /api/activity currently computes
    // org-wide. Surfacing a per-rep count here needs a groupBy addition to
    // /api/fleet; out of scope for this pass.
    conversionsToday: 0,
    shiftStart: new Date(r.shiftStart).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    hoursToday: '',
    lastKnockMin: r.lastKnockMin,
  };
}
