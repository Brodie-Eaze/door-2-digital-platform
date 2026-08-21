/**
 * Partner Portal — representative engagement data.
 *
 * HONESTY NOTE: every figure here is demonstration data for a fictional client
 * ("Hope Forward International", the same demo tenant used in web-org). It is
 * NOT a real customer's revenue. Rake rates and the platform fee below ARE the
 * D2D default contract structure from the master plan (OrgBilling), and all
 * invoice / remittance totals are DERIVED from the bucket gross values via the
 * functions in this module — they are never hand-typed, so the math always ties
 * out to the cent. When this surface is wired to the API (Phase 1.3 billing
 * service), these fixtures are replaced by live `Conversion` + `Invoice` rows;
 * the derivation functions stay.
 */

import type { RegionCode } from '@d2d/ui-web';

// ---------------------------------------------------------------------------
// Client identity (demo tenant)
// ---------------------------------------------------------------------------

export const CLIENT = {
  legalName: 'Hope Forward International',
  tradingName: 'Hope Forward',
  region: 'US' as RegionCode,
  vertical: 'Charity + Commercial',
  accountManager: 'D2D Operator Team',
  portalContact: { name: 'Dana Okafor', role: 'Finance lead', email: 'dana@hopeforward.org' },
} as const;

// ---------------------------------------------------------------------------
// Billing configuration — D2D default contract (master plan §1, item 8)
//   Platform fee: $2,500/mo · door 15% · inside-sales 10% · retargeting 5%
// Rake is held in basis points so all arithmetic stays in integer BigInt cents.
// ---------------------------------------------------------------------------

export const PLATFORM_FEE_CENTS = 250_000n; // $2,500.00 / month

export const RAKE_BPS = {
  door: 1500, // 15%
  insideSales: 1000, // 10%
  retargeting: 500, // 5%
} as const;

export type AttributionBucket = keyof typeof RAKE_BPS;

export const BUCKET_LABEL: Record<AttributionBucket, string> = {
  door: 'Door-closed',
  insideSales: 'Inside-sales',
  retargeting: 'Retargeting',
};

export const BUCKET_DESCRIPTION: Record<AttributionBucket, string> = {
  door: 'Closed at the door by a D2D knocker.',
  insideSales: 'Closed by the inside-sales desk after a warm field lead.',
  retargeting: 'Closed via an AI-retargeting ad after a knocked-not-converted visit.',
};

// ---------------------------------------------------------------------------
// Billing periods — each carries the per-bucket conversion count + GROSS value.
// Everything downstream (rake, invoice total, remittance net) is computed.
// ---------------------------------------------------------------------------

export interface BucketActivity {
  count: number;
  grossCents: bigint;
}

export type InvoiceStatus = 'open' | 'paid' | 'overdue';

export interface BillingPeriod {
  id: string; // 'INV-2026-05'
  label: string; // 'May 2026'
  periodStart: string; // ISO date
  periodEnd: string;
  issuedAt: string | null;
  dueAt: string;
  paidAt: string | null;
  status: InvoiceStatus;
  buckets: Record<AttributionBucket, BucketActivity>;
  /** Estimated MiCamp processing for the remittance view; reconciled to the
   *  settlement file at close. Held per-period so the net always derives. */
  processingFeeCents: bigint;
  /** Net funds remitted to the client (charity) for this period, once settled. */
  remittanceStatus: 'pending' | 'settled';
  remittanceSettledAt: string | null;
}

export const BILLING_PERIODS: BillingPeriod[] = [
  {
    id: 'INV-2026-05',
    label: 'May 2026',
    periodStart: '2026-05-01',
    periodEnd: '2026-05-31',
    issuedAt: '2026-05-31',
    dueAt: '2026-06-15',
    paidAt: null,
    status: 'open',
    buckets: {
      door: { count: 642, grossCents: 11_850_000n },
      insideSales: { count: 318, grossCents: 7_420_000n },
      retargeting: { count: 196, grossCents: 4_180_000n },
    },
    processingFeeCents: 703_500n,
    remittanceStatus: 'pending',
    remittanceSettledAt: null,
  },
  {
    id: 'INV-2026-04',
    label: 'April 2026',
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
    issuedAt: '2026-04-30',
    dueAt: '2026-05-15',
    paidAt: '2026-05-12',
    status: 'paid',
    buckets: {
      door: { count: 558, grossCents: 10_200_000n },
      insideSales: { count: 286, grossCents: 6_800_000n },
      retargeting: { count: 154, grossCents: 3_400_000n },
    },
    processingFeeCents: 612_000n,
    remittanceStatus: 'settled',
    remittanceSettledAt: '2026-05-14',
  },
  {
    id: 'INV-2026-03',
    label: 'March 2026',
    periodStart: '2026-03-01',
    periodEnd: '2026-03-31',
    issuedAt: '2026-03-31',
    dueAt: '2026-04-15',
    paidAt: '2026-04-11',
    status: 'paid',
    buckets: {
      door: { count: 470, grossCents: 8_800_000n },
      insideSales: { count: 242, grossCents: 5_900_000n },
      retargeting: { count: 108, grossCents: 2_400_000n },
    },
    processingFeeCents: 514_000n,
    remittanceStatus: 'settled',
    remittanceSettledAt: '2026-04-14',
  },
];

/** The active (open) period drives the dashboard. */
export const CURRENT_PERIOD: BillingPeriod = BILLING_PERIODS[0]!;

// ---------------------------------------------------------------------------
// Derivations — pure, integer, BigInt. The portal never hand-types a total.
// ---------------------------------------------------------------------------

/** Rake on one gross figure at a basis-point rate, floored to whole cents. */
export function rakeCents(grossCents: bigint, bps: number): bigint {
  return (grossCents * BigInt(bps)) / 10_000n;
}

/** Per-bucket rake for a period. */
export function bucketRake(period: BillingPeriod): Record<AttributionBucket, bigint> {
  return {
    door: rakeCents(period.buckets.door.grossCents, RAKE_BPS.door),
    insideSales: rakeCents(period.buckets.insideSales.grossCents, RAKE_BPS.insideSales),
    retargeting: rakeCents(period.buckets.retargeting.grossCents, RAKE_BPS.retargeting),
  };
}

/** Total rake (sum across buckets), excluding the flat platform fee. */
export function totalRakeCents(period: BillingPeriod): bigint {
  const r = bucketRake(period);
  return r.door + r.insideSales + r.retargeting;
}

/** Invoice total D2D bills the client = platform fee + total rake. */
export function invoiceTotalCents(period: BillingPeriod): bigint {
  return PLATFORM_FEE_CENTS + totalRakeCents(period);
}

/** Gross conversion value collected in the period (all buckets). */
export function grossCents(period: BillingPeriod): bigint {
  return (
    period.buckets.door.grossCents +
    period.buckets.insideSales.grossCents +
    period.buckets.retargeting.grossCents
  );
}

/** Total conversions in the period. */
export function conversionCount(period: BillingPeriod): number {
  return (
    period.buckets.door.count + period.buckets.insideSales.count + period.buckets.retargeting.count
  );
}

/** Net funds remitted to the client = gross − rake − platform fee − processing. */
export function netRemittanceCents(period: BillingPeriod): bigint {
  return (
    grossCents(period) - totalRakeCents(period) - PLATFORM_FEE_CENTS - period.processingFeeCents
  );
}

/** Blended take rate (rake ÷ gross) as a percentage string, 2dp. */
export function blendedTakeRate(period: BillingPeriod): string {
  const gross = grossCents(period);
  if (gross === 0n) return '0.00%';
  // basis points to 2dp without floats: rake * 10000 / gross
  const bps = (totalRakeCents(period) * 10_000n) / gross;
  return `${(Number(bps) / 100).toFixed(2)}%`;
}

export function findPeriod(id: string): BillingPeriod | undefined {
  return BILLING_PERIODS.find((p) => p.id === id);
}

// ---------------------------------------------------------------------------
// State-clearance matrix — PaidSolicitorRegistration (master plan §4.2, §8).
// D2D registers as a paid solicitor per state; campaigns deliver ONLY to
// 'approved' states. This is the P0 legal gate enforced by WS3 in code.
// ---------------------------------------------------------------------------

export type SolicitorStatus = 'approved' | 'submitted' | 'pending' | 'expired';

export interface StateRegistration {
  state: string; // 'CA'
  name: string; // 'California'
  status: SolicitorStatus;
  registrationNumber: string | null;
  filedAt: string | null;
  approvedAt: string | null;
  expiresAt: string | null;
  bondCents: bigint;
  note?: string;
}

export const STATE_REGISTRATIONS: StateRegistration[] = [
  {
    state: 'CA',
    name: 'California',
    status: 'approved',
    registrationNumber: 'CA-RCT-2026-04417',
    filedAt: '2026-01-12',
    approvedAt: '2026-03-03',
    expiresAt: '2027-03-03',
    bondCents: 2_500_000n,
  },
  {
    state: 'TX',
    name: 'Texas',
    status: 'approved',
    registrationNumber: 'TX-SOS-883201',
    filedAt: '2026-01-15',
    approvedAt: '2026-02-20',
    expiresAt: '2027-02-20',
    bondCents: 1_000_000n,
  },
  {
    state: 'FL',
    name: 'Florida',
    status: 'approved',
    registrationNumber: 'FL-FDACS-CH61124',
    filedAt: '2026-01-10',
    approvedAt: '2026-02-28',
    expiresAt: '2027-02-28',
    bondCents: 1_500_000n,
  },
  {
    state: 'OH',
    name: 'Ohio',
    status: 'approved',
    registrationNumber: 'OH-AG-CR-22910',
    filedAt: '2026-01-20',
    approvedAt: '2026-03-10',
    expiresAt: '2027-03-10',
    bondCents: 1_000_000n,
  },
  {
    state: 'GA',
    name: 'Georgia',
    status: 'approved',
    registrationNumber: 'GA-SOS-CH-50882',
    filedAt: '2026-01-22',
    approvedAt: '2026-03-12',
    expiresAt: '2027-03-12',
    bondCents: 1_000_000n,
  },
  {
    state: 'NC',
    name: 'North Carolina',
    status: 'approved',
    registrationNumber: 'NC-SL-018844',
    filedAt: '2026-02-01',
    approvedAt: '2026-03-25',
    expiresAt: '2027-03-25',
    bondCents: 1_000_000n,
  },
  {
    state: 'MI',
    name: 'Michigan',
    status: 'approved',
    registrationNumber: 'MI-AG-CS-33019',
    filedAt: '2026-02-03',
    approvedAt: '2026-04-02',
    expiresAt: '2027-04-02',
    bondCents: 1_000_000n,
  },
  {
    state: 'CO',
    name: 'Colorado',
    status: 'approved',
    registrationNumber: 'CO-SOS-20268841',
    filedAt: '2026-02-05',
    approvedAt: '2026-04-08',
    expiresAt: '2027-04-08',
    bondCents: 1_000_000n,
  },
  {
    state: 'NY',
    name: 'New York',
    status: 'submitted',
    registrationNumber: 'NY-CHAR-2026-pending',
    filedAt: '2026-03-18',
    approvedAt: null,
    expiresAt: null,
    bondCents: 5_000_000n,
    note: 'Strictest review + highest bond. Counsel estimates approval mid-Q3.',
  },
  {
    state: 'NJ',
    name: 'New Jersey',
    status: 'submitted',
    registrationNumber: 'NJ-DCA-2026-pending',
    filedAt: '2026-03-22',
    approvedAt: null,
    expiresAt: null,
    bondCents: 2_500_000n,
  },
  {
    state: 'IL',
    name: 'Illinois',
    status: 'submitted',
    registrationNumber: 'IL-AG-2026-pending',
    filedAt: '2026-04-04',
    approvedAt: null,
    expiresAt: null,
    bondCents: 1_000_000n,
  },
  {
    state: 'WA',
    name: 'Washington',
    status: 'pending',
    registrationNumber: null,
    filedAt: null,
    approvedAt: null,
    expiresAt: null,
    bondCents: 1_000_000n,
    note: 'Filing package in preparation with counsel.',
  },
  {
    state: 'MA',
    name: 'Massachusetts',
    status: 'pending',
    registrationNumber: null,
    filedAt: null,
    approvedAt: null,
    expiresAt: null,
    bondCents: 1_000_000n,
    note: 'Queued behind the active filings.',
  },
  {
    state: 'PA',
    name: 'Pennsylvania',
    status: 'expired',
    registrationNumber: 'PA-BCO-77412',
    filedAt: '2025-04-30',
    approvedAt: '2025-05-15',
    expiresAt: '2026-05-15',
    bondCents: 2_500_000n,
    note: 'Annual renewal filed; campaigns paused in PA until re-approval lands.',
  },
];

export function stateCounts(): Record<SolicitorStatus, number> {
  return STATE_REGISTRATIONS.reduce(
    (acc, r) => {
      acc[r.status] += 1;
      return acc;
    },
    { approved: 0, submitted: 0, pending: 0, expired: 0 } as Record<SolicitorStatus, number>,
  );
}

// ---------------------------------------------------------------------------
// Brand kit (white-label) — BrandKit entity (master plan §4.2).
// ---------------------------------------------------------------------------

export interface BrandKit {
  displayName: string;
  primaryColor: string;
  accentColor: string;
  customDomain: string;
  domainVerified: boolean;
  supportEmail: string;
  supportPhone: string;
  privacyPolicyUrl: string;
  termsUrl: string;
  iosBundleId: string;
  androidPackage: string;
  assets: { label: string; spec: string; status: 'uploaded' | 'missing' }[];
}

export const BRAND_KIT: BrandKit = {
  displayName: 'Hope Forward',
  primaryColor: '#0F3D6E',
  accentColor: '#2E9E7B',
  customDomain: 'give.hopeforward.org',
  domainVerified: true,
  supportEmail: 'support@hopeforward.org',
  supportPhone: '+1 (415) 555-0142',
  privacyPolicyUrl: 'https://hopeforward.org/privacy',
  termsUrl: 'https://hopeforward.org/terms',
  iosBundleId: 'org.hopeforward.field',
  androidPackage: 'org.hopeforward.field',
  assets: [
    { label: 'Logo · light', spec: 'SVG or PNG · ≥ 512px wide', status: 'uploaded' },
    { label: 'Logo · dark', spec: 'SVG or PNG · ≥ 512px wide', status: 'uploaded' },
    { label: 'App icon', spec: 'PNG · 1024×1024', status: 'uploaded' },
    { label: 'Favicon', spec: 'ICO or PNG · 64×64', status: 'uploaded' },
  ],
};

// ---------------------------------------------------------------------------
// SSO / SAML — SsoConfiguration entity (master plan §9.1, WS4).
// D2D is the SAML service provider; the client's IdP (Okta) federates in.
// ---------------------------------------------------------------------------

export interface SsoConfig {
  status: 'configured' | 'not_configured';
  provider: string;
  // D2D-side service-provider metadata (what IT pastes into the IdP).
  spEntityId: string;
  spAcsUrl: string;
  spMetadataUrl: string;
  // Client-side IdP details D2D holds.
  idpEntityId: string;
  idpSsoUrl: string;
  certThumbprint: string;
  certExpiresAt: string;
  jitProvisioning: boolean;
  lastValidatedAt: string;
  attributeMapping: { claim: string; samlAttribute: string }[];
  roleMapping: { idpGroup: string; platformRole: string }[];
}

export const SSO_CONFIG: SsoConfig = {
  status: 'configured',
  provider: 'Okta',
  spEntityId: 'https://app.door2digital.io/saml/hope-forward',
  spAcsUrl: 'https://app.door2digital.io/saml/hope-forward/acs',
  spMetadataUrl: 'https://app.door2digital.io/saml/hope-forward/metadata.xml',
  idpEntityId: 'http://www.okta.com/exk1a2b3c4HOPEFWD',
  idpSsoUrl: 'https://hopeforward.okta.com/app/hopeforward_d2d/exk1a2b3c4/sso/saml',
  certThumbprint: 'B2:14:9F:0C:8A:33:E1:77:4D:A0:6B:91:2C:5E:88:10:F3:7A:44:D9',
  certExpiresAt: '2028-03-18',
  jitProvisioning: true,
  lastValidatedAt: '2026-05-28',
  attributeMapping: [
    { claim: 'Email', samlAttribute: 'NameID (emailAddress)' },
    { claim: 'First name', samlAttribute: 'user.firstName' },
    { claim: 'Last name', samlAttribute: 'user.lastName' },
    { claim: 'Role group', samlAttribute: 'user.d2dRole' },
  ],
  roleMapping: [
    { idpGroup: 'D2D-Admins', platformRole: 'org_admin' },
    { idpGroup: 'D2D-Finance', platformRole: 'accountant' },
    { idpGroup: 'D2D-Managers', platformRole: 'manager' },
    { idpGroup: 'D2D-Viewers', platformRole: 'viewer' },
  ],
};

// ---------------------------------------------------------------------------
// Small date helper — consistent display across pages.
// ---------------------------------------------------------------------------

export function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
