/**
 * Per-account fixture data. In production this is API-driven and scoped
 * by account context. For the demo we shape data per slug so each
 * account feels distinct.
 */
import { getAccount } from './accounts';

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
  status: 'active' | 'idle' | 'training';
  knocks: number;
  conversions: number;
  revenueCents: bigint;
  territory: string;
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

const SAMPLE_NAMES = [
  'Maria Santos',
  'David Chen',
  'Aisha Williams',
  'Robert Kim',
  'Jennifer López',
  'Marcus Brown',
  'Sophia Patel',
  'Kevin Murphy',
  'Olivia Park',
  'James Walker',
  'Priya Sharma',
  'Daniel Foster',
  'Emma Thompson',
  'Liam Nguyen',
  'Zara Ahmed',
  'Noah Cooper',
  'Ava Singh',
  'Ethan Brooks',
  'Mia González',
  'Lucas Wright',
];

const SAMPLE_ADDRESSES_US = [
  '4218 Lakeview Dr, Austin TX',
  '887 Maple Ave, Dallas TX',
  '1502 Cedar St, Austin TX',
  '3098 Birch Ln, Houston TX',
  '2204 Oak St, Phoenix AZ',
  '1855 Pine Rd, Atlanta GA',
  '4502 Walnut Cir, Atlanta GA',
  '729 Elm Pl, Dallas TX',
  '3318 Magnolia Way, Austin TX',
  '927 Sycamore Ave, Phoenix AZ',
  '1141 Willow Ln, Houston TX',
  '2266 Aspen Dr, Atlanta GA',
];

const SAMPLE_ADDRESSES_AU = [
  '12 Bourke St, Melbourne VIC',
  '88 George St, Sydney NSW',
  '5 Queen St, Brisbane QLD',
  '23 Adelaide Tce, Perth WA',
  '45 Hindley St, Adelaide SA',
  '102 Surfers Pde, Gold Coast QLD',
  '7 Collins St, Melbourne VIC',
  '14 Pitt St, Sydney NSW',
  '99 Ann St, Brisbane QLD',
];

function pseudoLeads(
  count: number,
  region: 'US' | 'AU',
  startIdx: number,
  assigneePool: string[],
): LeadRow[] {
  const statuses: LeadRow['status'][] = [
    'new',
    'new',
    'new',
    'contacted',
    'contacted',
    'qualified',
    'qualified',
    'appointment_set',
    'converted',
    'converted',
    'lost',
  ];
  const sources: LeadRow['source'][] = [
    'door',
    'door',
    'door',
    'door',
    'inside_sales',
    'retargeting',
  ];
  const tiers: LeadRow['tier'][] = ['high', 'high', 'medium', 'medium', 'medium', 'low'];
  const addrs = region === 'AU' ? SAMPLE_ADDRESSES_AU : SAMPLE_ADDRESSES_US;
  return Array.from({ length: count }, (_, i) => {
    const idx = (startIdx + i) % SAMPLE_NAMES.length;
    return {
      id: `lead_${region}_${idx}`,
      name: SAMPLE_NAMES[idx]!,
      status: statuses[(startIdx + i) % statuses.length]!,
      source: sources[(startIdx + i) % sources.length]!,
      address: addrs[(startIdx + i) % addrs.length]!,
      phone:
        region === 'AU'
          ? `+614${(50000000 + idx * 13).toString().slice(0, 8)}`
          : `+1${(2125550100 + idx * 17).toString().slice(0, 10)}`,
      assignee: assigneePool[(startIdx + i) % assigneePool.length]!,
      tier: tiers[(startIdx + i) % tiers.length]!,
      capturedAt: new Date(Date.now() - i * 1000 * 60 * 30).toISOString(),
    };
  });
}

function pseudoKnockers(count: number): Knocker[] {
  const names = [
    ['JM', 'Jordan Mosley'],
    ['AR', 'Aaliyah Reed'],
    ['TM', 'Tomás Mendez'],
    ['JD', 'Jada Davis'],
    ['AM', 'Asha Mehta'],
    ['KP', 'Kim Park'],
    ['DR', 'Devon Russell'],
    ['ML', 'Marcus Lee'],
    ['BC', 'Bianca Costa'],
    ['HK', 'Hiroshi Kato'],
    ['EN', 'Eva Novak'],
    ['RT', 'Reuben Tate'],
  ];
  const territories = ['Austin East', 'Dallas Metro', 'Phoenix West', 'Atlanta N', 'Houston SE'];
  return Array.from({ length: count }, (_, i) => {
    const [initials, name] = names[i % names.length]!;
    const isIdle = i % 7 === 0;
    return {
      initials: initials!,
      name: name!,
      status: isIdle ? 'idle' : 'active',
      knocks: isIdle ? 0 : 50 + ((i * 13) % 60),
      conversions: isIdle ? 0 : 8 + ((i * 7) % 22),
      revenueCents: isIdle ? 0n : BigInt(2000_00 + ((i * 199) % 7000_00)),
      territory: territories[i % territories.length]!,
    };
  });
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

  const anomalies: Anomaly[] = [
    {
      severity: 'critical',
      title: `${slug === 'hope-forward' ? '17' : slug === 'world-vision' ? '11' : '4'} missed callbacks past SLA`,
      description: `Callbacks promised today not yet contacted. Reassign or auto-dial?`,
      timestamp: '15m ago',
    },
    {
      severity: 'warning',
      title: `${acct.shortName} ${acct.region === 'AU' ? 'Melbourne CBD' : 'Austin-East'} conversion below baseline`,
      description: 'Two Knockers report unusual resistance. Check pitch script.',
      timestamp: '1h ago',
    },
    {
      severity: 'info',
      title: `Top Knocker today: ${slug === 'pestmax' ? 'Devon R' : 'Jordan M'} · ${slug === 'pestmax' ? '14' : '31'} conversions`,
      description: `${slug === 'pestmax' ? '$4,180' : '$8,940'} of recurring giving in one shift. Recognise on leaderboard.`,
      timestamp: '2h ago',
    },
  ];

  const assigneePool = ['JD', 'AM', 'TM', 'SH', 'BR'];
  const leadCount = Math.min(acct.leadsInboxToday, 18);
  const leads = pseudoLeads(leadCount, acct.region === 'AU' ? 'AU' : 'US', 0, assigneePool);
  const knockers = pseudoKnockers(Math.min(acct.knockers, 12));

  return { account: acct, anomalies, leads, knockers };
}
