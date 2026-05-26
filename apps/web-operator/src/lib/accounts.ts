/**
 * Accounts fixtures — Brodie's team's sub-accounts (GHL model).
 *
 * Each account is its own "tiny operating system" with full CRM, territories,
 * Knockers, leads, pipeline, campaigns, drip. The whole Door 2 Digital OS team
 * (sales, tech, admin) drills in from the top-level accounts list.
 *
 * Headline numbers (rosterSize, conversionsMTD, revenueCentsMTD) come from
 * the central seed rollup so they reconcile with every per-account surface
 * and the HQ command-centre totals. Account metadata (slug, branding,
 * contractedAt, notes) stays hand-authored.
 */

import { rollupFor } from './seed/kpis';

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
  knockers: number;
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

interface StaticAccountFields {
  slug: string;
  name: string;
  shortName: string;
  vertical: Vertical;
  region: 'AU' | 'US' | 'SG';
  avatarBg: string;
  avatarFg: string;
  plan: 'Enterprise' | 'Growth' | 'Trial';
  health: AccountHealth;
  contractedAt: string;
  notes: string;
}

const STATIC_ACCOUNTS: StaticAccountFields[] = [
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
    contractedAt: '2026-05-15',
    notes: 'Hospital foundation. Capital campaign for new wing.',
  },
];

function buildAccount(s: StaticAccountFields): Account {
  const r = rollupFor(s.slug);
  return {
    ...s,
    knockers: r.rosterSize,
    insideSalesReps: r.insideSalesSize,
    territoriesActive: r.territoriesActive,
    leadsInboxToday: r.leadsInboxToday,
    conversionsMTD: r.conversionsMTD,
    revenueCentsMTD: r.revenueCentsMTD,
    ltvCentsMTD: r.ltvCentsMTD,
  };
}

export const ACCOUNTS: Account[] = STATIC_ACCOUNTS.map(buildAccount);

export function getAccount(slug: string): Account | undefined {
  return ACCOUNTS.find((a) => a.slug === slug);
}
