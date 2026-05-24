/**
 * Fleet rep fixtures with real lat/lng across Texas (Austin / Dallas / Houston).
 * Used by the HQ Command Centre live map + KPI tiles.
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

export const FLEET_REPS: FleetRep[] = [
  // Austin cluster (30.27, -97.74)
  {
    id: 'r1',
    initials: 'JM',
    name: 'Jordan Mosley',
    account: 'Hope Forward',
    lat: 30.2672,
    lng: -97.7431,
    status: 'active',
    shiftStart: '09:00',
    hoursToday: '4h 12m',
    knocksToday: 84,
    conversionsToday: 31,
    lastKnockMin: 3,
    territory: 'Austin East',
  },
  {
    id: 'r2',
    initials: 'JD',
    name: 'Jada Davis',
    account: 'Hope Forward',
    lat: 30.2515,
    lng: -97.7186,
    status: 'active',
    shiftStart: '09:00',
    hoursToday: '4h 08m',
    knocksToday: 91,
    conversionsToday: 22,
    lastKnockMin: 1,
    territory: 'Austin East',
  },
  {
    id: 'r3',
    initials: 'AR',
    name: 'Aaliyah Reed',
    account: 'Hope Forward',
    lat: 30.2698,
    lng: -97.7589,
    status: 'active',
    shiftStart: '09:00',
    hoursToday: '4h 15m',
    knocksToday: 78,
    conversionsToday: 18,
    lastKnockMin: 7,
    territory: 'Austin North',
  },
  {
    id: 'r4',
    initials: 'TM',
    name: 'Tomás Mendez',
    account: 'Hope Forward',
    lat: 30.2451,
    lng: -97.7299,
    status: 'break',
    shiftStart: '09:00',
    hoursToday: '3h 45m · LUNCH',
    knocksToday: 64,
    conversionsToday: 14,
    lastKnockMin: 28,
    territory: 'Austin East',
  },

  // Dallas cluster (32.78, -96.80)
  {
    id: 'r5',
    initials: 'AM',
    name: 'Asha Mehta',
    account: 'Hope Forward',
    lat: 32.7821,
    lng: -96.8005,
    status: 'active',
    shiftStart: '09:30',
    hoursToday: '3h 42m',
    knocksToday: 66,
    conversionsToday: 12,
    lastKnockMin: 5,
    territory: 'Dallas Metro',
  },
  {
    id: 'r6',
    initials: 'BC',
    name: 'Bianca Costa',
    account: 'PestMax',
    lat: 32.7901,
    lng: -96.8214,
    status: 'active',
    shiftStart: '08:00',
    hoursToday: '5h 12m',
    knocksToday: 38,
    conversionsToday: 9,
    lastKnockMin: 12,
    territory: 'Dallas North',
  },
  {
    id: 'r7',
    initials: 'HK',
    name: 'Hiroshi Kato',
    account: 'PestMax',
    lat: 32.7712,
    lng: -96.7826,
    status: 'idle',
    shiftStart: '08:00',
    hoursToday: '5h 18m',
    knocksToday: 31,
    conversionsToday: 5,
    lastKnockMin: 22,
    territory: 'Dallas North',
  },

  // Houston cluster (29.76, -95.37)
  {
    id: 'r8',
    initials: 'KP',
    name: 'Kim Park',
    account: 'Hope Forward',
    lat: 29.7589,
    lng: -95.3676,
    status: 'active',
    shiftStart: '09:00',
    hoursToday: '4h 05m',
    knocksToday: 71,
    conversionsToday: 15,
    lastKnockMin: 4,
    territory: 'Houston SE',
  },
  {
    id: 'r9',
    initials: 'DR',
    name: 'Devon Russell',
    account: 'Hope Forward',
    lat: 29.7782,
    lng: -95.3951,
    status: 'offline',
    shiftStart: '—',
    hoursToday: 'Not clocked in',
    knocksToday: 0,
    conversionsToday: 0,
    lastKnockMin: 999,
    territory: 'Houston SE',
  },
  {
    id: 'r10',
    initials: 'ML',
    name: 'Marcus Lee',
    account: 'Hope Forward',
    lat: 29.7434,
    lng: -95.3512,
    status: 'active',
    shiftStart: '09:00',
    hoursToday: '4h 11m',
    knocksToday: 58,
    conversionsToday: 11,
    lastKnockMin: 2,
    territory: 'Houston SE',
  },
];

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
