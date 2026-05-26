/**
 * Per-account fixture data. In production this is API-driven and scoped
 * by account context. For the demo we shape data per slug from the central
 * seed (`lib/seed/`) so each account feels distinct and figures reconcile
 * across pages.
 *
 * The legacy shape (LeadRow / Knocker / Anomaly) is preserved so the page
 * components don't need to refactor — `accountData()` adapts the new
 * generators into the old contract.
 */
import { getAccount } from './accounts';
import { seedFor } from './seed';
import type { SeededKnocker } from './seed/roster';
import type { SeededLead } from './seed/leads';

export interface Anomaly {
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  timestamp: string;
}

export interface LeadRow {
  id: string;
  name: string;
  status:
    | 'new'
    | 'contacted'
    | 'qualified'
    | 'appointment_set'
    | 'converted'
    | 'lost'
    | 'do_not_contact';
  source: 'door' | 'inside_sales' | 'retargeting';
  address: string;
  phone: string;
  assignee: string;
  tier: 'high' | 'medium' | 'low';
  capturedAt: string;
}

export interface Knocker {
  initials: string;
  name: string;
  status: 'active' | 'idle' | 'training' | 'break' | 'offline';
  knocks: number;
  conversions: number;
  revenueCents: bigint;
  territory: string;
  /** Conversion rate, % — lifetime. */
  convRate: number;
  tenureDays: number;
}

export interface PipelineStage {
  stage: string;
  status: LeadRow['status'];
  description: string;
}

export const PIPELINE_STAGES: PipelineStage[] = [
  { stage: 'New', status: 'new', description: 'Just captured · awaiting first touch' },
  { stage: 'Contacted', status: 'contacted', description: 'First SMS / call attempted' },
  { stage: 'Qualified', status: 'qualified', description: 'Interest confirmed' },
  { stage: 'Appointment', status: 'appointment_set', description: 'Call/meeting scheduled' },
  { stage: 'Converted', status: 'converted', description: 'Donated / purchased' },
];

function adaptKnocker(k: SeededKnocker): Knocker {
  // Map the new 4-state status onto the legacy 3-state expected by some pages.
  let legacy: Knocker['status'];
  if (k.status === 'active') legacy = 'active';
  else if (k.status === 'break') legacy = 'break';
  else if (k.status === 'idle') legacy = 'idle';
  else legacy = 'offline';
  return {
    initials: k.initials,
    name: k.name,
    status: legacy,
    knocks: k.knocksToday,
    conversions: k.conversionsToday,
    revenueCents: k.revenueCentsToday,
    territory: k.territory,
    convRate: k.lifetimeConvRate,
    tenureDays: k.tenureDays,
  };
}

function adaptLead(l: SeededLead): LeadRow {
  return {
    id: l.id,
    name: l.name,
    status: l.status,
    source: l.source,
    address: l.address,
    phone: l.phone,
    assignee: l.assigneeInitials,
    tier: l.tier,
    capturedAt: l.capturedAt,
  };
}

export function accountData(slug: string) {
  const acct = getAccount(slug);
  if (!acct) {
    return {
      account: null,
      anomalies: [] as Anomaly[],
      leads: [] as LeadRow[],
      knockers: [] as Knocker[],
    };
  }

  const seed = seedFor(slug);
  const knockers = seed.knockers.map(adaptKnocker);
  const leads = seed.leads.map(adaptLead);

  // Tailor the anomaly copy per-account using the seed so the count matches
  // the leads list.
  const stuckCount = seed.leads.filter((l) => l.status === 'contacted' && l.daysOld > 5).length;
  const topRep = [...seed.knockers]
    .filter((k) => k.status === 'active')
    .sort((a, b) => b.conversionsToday - a.conversionsToday)[0];
  const topRepRev = topRep
    ? Number(topRep.revenueCentsToday / 100n).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
    : '—';

  const anomalies: Anomaly[] = [
    {
      severity: 'critical',
      title: `${stuckCount} missed callbacks past SLA`,
      description: `Callbacks promised this week not yet contacted. Reassign or auto-dial?`,
      timestamp: '15m ago',
    },
    {
      severity: 'warning',
      title: `${acct.shortName} ${acct.region === 'AU' ? 'Melbourne CBD' : 'Austin East'} conversion below baseline`,
      description: 'Two Knockers report unusual resistance. Check pitch script.',
      timestamp: '1h ago',
    },
    {
      severity: 'info',
      title: `Top Knocker today: ${topRep?.name.split(' ')[0] ?? '—'} · ${topRep?.conversionsToday ?? 0} conversions`,
      description: `${topRepRev} of recurring giving in one shift. Recognise on leaderboard.`,
      timestamp: '2h ago',
    },
  ];

  return { account: acct, anomalies, leads, knockers };
}
