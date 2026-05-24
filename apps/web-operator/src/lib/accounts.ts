/**
 * Accounts fixtures — Brodie's team's sub-accounts (GHL model).
 *
 * Each account is its own "tiny operating system" with full CRM, territories,
 * Noctuas, leads, pipeline, campaigns, drip. The whole NoctuaOS team
 * (sales, tech, admin) drills in from the top-level accounts list.
 */

export type Vertical = 'charity' | 'commercial' | 'healthcare';
export type AccountHealth = 'healthy' | 'attention' | 'critical';

export interface Account {
  slug: string;
  name: string;
  shortName: string;
  vertical: Vertical;
  region: 'AU' | 'US' | 'SG';
  /** Background colour for the monogram avatar. */
  avatarBg: string;
  /** Foreground (text) colour for the monogram avatar. */
  avatarFg: string;
  plan: 'Enterprise' | 'Growth' | 'Trial';
  health: AccountHealth;
  noctuas: number;
  insideSalesReps: number;
  territoriesActive: number;
  leadsInboxToday: number;
  conversionsMTD: number;
  revenueCentsMTD: bigint;
  ltvCentsMTD: bigint;
  contractedAt: string;
  notes: string;
}

/** Build a 2-letter monogram from an account's short name. */
export function accountMonogram(shortName: string): string {
  const parts = shortName.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  return (parts[0]?.slice(0, 2) ?? '??').toUpperCase();
}

export const ACCOUNTS: Account[] = [
  {
    slug: 'hope-forward',
    name: 'Hope Forward International',
    shortName: 'Hope Forward',
    vertical: 'charity',
    region: 'US',
    avatarBg: '#0F172A',
    avatarFg: '#FFFFFF',
    plan: 'Enterprise',
    health: 'healthy',
    noctuas: 218,
    insideSalesReps: 14,
    territoriesActive: 7,
    leadsInboxToday: 84,
    conversionsMTD: 4831,
    revenueCentsMTD: 1_605_240_00n,
    ltvCentsMTD: 19_262_880_00n,
    contractedAt: '2026-04-01',
    notes: 'Pilot-Charlie enterprise launch. Charity vertical. Recurring giving.',
  },
  {
    slug: 'world-vision',
    name: 'World Vision Australia',
    shortName: 'World Vision',
    vertical: 'charity',
    region: 'AU',
    avatarBg: '#1E293B',
    avatarFg: '#FFFFFF',
    plan: 'Enterprise',
    health: 'healthy',
    noctuas: 162,
    insideSalesReps: 11,
    territoriesActive: 12,
    leadsInboxToday: 102,
    conversionsMTD: 3120,
    revenueCentsMTD: 940_800_00n,
    ltvCentsMTD: 11_289_600_00n,
    contractedAt: '2026-04-15',
    notes: 'AU charity. Child sponsorship focus. ACNC-registered.',
  },
  {
    slug: 'pestmax',
    name: 'PestMax Services',
    shortName: 'PestMax',
    vertical: 'commercial',
    region: 'US',
    avatarBg: '#475569',
    avatarFg: '#FFFFFF',
    plan: 'Growth',
    health: 'attention',
    noctuas: 32,
    insideSalesReps: 4,
    territoriesActive: 4,
    leadsInboxToday: 21,
    conversionsMTD: 412,
    revenueCentsMTD: 124_800_00n,
    ltvCentsMTD: 748_800_00n,
    contractedAt: '2026-04-22',
    notes: 'Commercial pest control. Texas + Arizona. One-shot service contracts.',
  },
  {
    slug: 'gold-coast-hospital',
    name: 'Gold Coast Hospital Foundation',
    shortName: 'Gold Coast Hospital',
    vertical: 'healthcare',
    region: 'AU',
    avatarBg: '#3B82F6',
    avatarFg: '#FFFFFF',
    plan: 'Trial',
    health: 'healthy',
    noctuas: 8,
    insideSalesReps: 2,
    territoriesActive: 3,
    leadsInboxToday: 14,
    conversionsMTD: 89,
    revenueCentsMTD: 53_400_00n,
    ltvCentsMTD: 640_800_00n,
    contractedAt: '2026-05-15',
    notes: 'Hospital foundation. Capital campaign for new wing.',
  },
];

export function getAccount(slug: string): Account | undefined {
  return ACCOUNTS.find((a) => a.slug === slug);
}
