/**
 * Demo fixtures — static seed data so the operator console renders
 * realistic content without a backend. Replace with API calls in Phase 1.1.
 */

export const PILOT = {
  id: 'org_01HXJZP1PILOTCHARLIE',
  legalName: 'Hope Forward International',
  tradingName: 'HopeForward',
  slug: 'pilot-charlie',
  vertical: 'charity' as const,
  region: 'US' as const,
  knockers: 218,
  insideSalesReps: 14,
  monthlyConversions: 5240,
  monthlyRevenueCents: 1_847_500_00n,
  contractedAt: '2026-04-01',
  goLiveAt: '2026-09-15',
};

export const ORGS = [
  {
    id: PILOT.id,
    name: 'Hope Forward International',
    slug: 'pilot-charlie',
    vertical: 'charity',
    region: 'US',
    plan: 'Enterprise',
    knockers: 218,
    conversionsMTD: 4831,
    revenueCentsMTD: 1_605_240_00n,
    health: 'healthy',
    addedAt: '2026-04-01',
  },
  {
    id: 'org_demo_pestmax',
    name: 'PestMax Services',
    slug: 'pestmax',
    vertical: 'commercial',
    region: 'US',
    plan: 'Growth',
    knockers: 32,
    conversionsMTD: 412,
    revenueCentsMTD: 124_800_00n,
    health: 'healthy',
    addedAt: '2026-04-22',
  },
  {
    id: 'org_demo_solar',
    name: 'SunHaven Solar',
    slug: 'sunhaven',
    vertical: 'commercial',
    region: 'US',
    plan: 'Trial',
    knockers: 6,
    conversionsMTD: 31,
    revenueCentsMTD: 18_400_00n,
    health: 'attention',
    addedAt: '2026-05-15',
  },
];

export const ANOMALIES = [
  {
    severity: 'critical' as const,
    title: 'Pilot-Charlie SSO/SAML metadata pending',
    description:
      'Required for go-live. Last follow-up with their IT admin: 2026-05-22. Escalate today.',
    timestamp: '1 day ago',
  },
  {
    severity: 'warning' as const,
    title: 'Paid-solicitor registration pending — CA, NY, IL',
    description:
      'Counsel filed 2026-05-12. ETAs: CA week 4, NY week 6, IL week 7. Campaigns blocked from those states until cleared.',
    timestamp: '12 days ago',
  },
  {
    severity: 'warning' as const,
    title: 'MiCamp Gateway sandbox credentials not received',
    description:
      'Kickoff call held 2026-05-20. Sandbox + recurring billing API access expected by EOW. Gates Phase 1.3.',
    timestamp: '3 days ago',
  },
  {
    severity: 'info' as const,
    title: 'SunHaven Solar trial — 3 days remaining',
    description: 'Conversion to paid plan recommended. Current usage: 31 conversions, 6 knockers.',
    timestamp: '2 hours ago',
  },
];

export const KPIS = {
  activeOrgs: 3,
  activeKnockers: 256,
  conversionsMTD: 5274,
  conversionsDelta: '+18.2%',
  revenueCentsMTD: 1_748_440_00n,
  revenueDelta: '+22.4%',
  processorResidualMTD: 18_240_50n, // MiCamp ISO residuals
};

export const STATE_CLEARANCE = [
  { state: 'TX', status: 'approved', bondCents: 1_500_000n, approvedAt: '2026-04-18' },
  { state: 'FL', status: 'approved', bondCents: 1_000_000n, approvedAt: '2026-04-22' },
  { state: 'GA', status: 'approved', bondCents: 500_000n, approvedAt: '2026-05-01' },
  { state: 'AZ', status: 'approved', bondCents: 250_000n, approvedAt: '2026-05-08' },
  { state: 'CA', status: 'pending', bondCents: 2_500_000n, filedAt: '2026-05-12' },
  { state: 'NY', status: 'submitted', bondCents: 5_000_000n, filedAt: '2026-05-14' },
  { state: 'IL', status: 'pending', bondCents: 1_500_000n, filedAt: '2026-05-15' },
  { state: 'NC', status: 'submitted', bondCents: 500_000n, filedAt: '2026-05-18' },
  { state: 'CO', status: 'pending', bondCents: 750_000n, filedAt: '2026-05-20' },
  { state: 'OH', status: 'pending', bondCents: 1_000_000n, filedAt: '2026-05-20' },
];

export const RECENT_AUDIT = [
  {
    occurredAt: '2026-05-24T18:42:11Z',
    actor: 'brodie@door2digital.io',
    action: 'org.brandkit.updated',
    resource: 'BrandKit:hopeforward',
  },
  {
    occurredAt: '2026-05-24T17:28:03Z',
    actor: 'sarah@hopeforward.org',
    action: 'territory.created',
    resource: 'Territory:austin-east-residential',
  },
  {
    occurredAt: '2026-05-24T17:22:54Z',
    actor: 'system',
    action: 'campaign.state_clearance.updated',
    resource: 'Campaign:fall-pledge-drive-2026',
  },
  {
    occurredAt: '2026-05-24T16:01:09Z',
    actor: 'brodie@door2digital.io',
    action: 'pii.unmask.approved',
    resource: 'Lead:lead_01HXJZP1ABCDEF',
  },
  {
    occurredAt: '2026-05-24T15:47:28Z',
    actor: 'jordan@hopeforward.org',
    action: 'conversion.created',
    resource: 'Conversion:cnv_01HXJZP1XYZ123',
  },
  {
    occurredAt: '2026-05-24T15:47:28Z',
    actor: 'system',
    action: 'commission.accrued',
    resource: 'Commission:com_01HXJZP1QWE456',
  },
  {
    occurredAt: '2026-05-24T15:46:12Z',
    actor: 'kim@hopeforward.org',
    action: 'knock.disposition.recorded',
    resource: 'Knock:knk_01HXJZP1ASD789',
  },
];
