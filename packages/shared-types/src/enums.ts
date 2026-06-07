/**
 * Cross-cutting enum literal unions. Mirror Prisma enums 1:1 (kept in sync
 * by hand for Phase 0; generator from schema.prisma in Phase 1).
 */

export const REGION_CODES = ['AU', 'US', 'SG'] as const;
export type RegionCode = (typeof REGION_CODES)[number];

export const VERTICALS = ['charity', 'commercial'] as const;
export type Vertical = (typeof VERTICALS)[number];

export const ORG_TYPES = ['operator', 'client'] as const;
export type OrgType = (typeof ORG_TYPES)[number];

export const PLATFORM_ROLES = [
  'super_admin',
  'org_admin',
  'manager',
  'knocker',
  'inside_sales',
  'accountant',
  'auditor',
  'viewer',
] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const KNOCK_DISPOSITIONS = [
  'no_answer',
  'not_interested',
  'callback',
  'do_not_knock',
  'appointment',
  'converted_donation',
  'converted_sale',
  'hostile',
  'invalid_address',
] as const;
export type KnockDisposition = (typeof KNOCK_DISPOSITIONS)[number];

export const LEAD_STATUSES = [
  'new',
  'contacted',
  'qualified',
  'appointment_set',
  'converted',
  'lost',
  'do_not_contact',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const CONVERSION_TYPES = [
  'donation_recurring',
  'donation_oneoff',
  'sale_commercial',
] as const;
export type ConversionType = (typeof CONVERSION_TYPES)[number];

export const ATTRIBUTION_SOURCES = ['door', 'inside_sales', 'retargeting', 'other'] as const;
export type AttributionSource = (typeof ATTRIBUTION_SOURCES)[number];

export const DONATION_FREQUENCIES = ['weekly', 'fortnightly', 'monthly', 'annual'] as const;
export type DonationFrequency = (typeof DONATION_FREQUENCIES)[number];

export const COMMISSION_TYPES = [
  'per_knock',
  'per_appointment',
  'per_conversion',
  'override',
] as const;
export type CommissionType = (typeof COMMISSION_TYPES)[number];

export const PAYOUT_STATUSES = [
  'draft',
  'ready_to_pay',
  'instructed',
  'acknowledged',
  'archived',
] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export const CONSENT_CHANNELS = ['sms', 'email', 'phone', 'postal', 'door'] as const;
export type ConsentChannel = (typeof CONSENT_CHANNELS)[number];

export const WEBHOOK_STATUSES = ['pending', 'delivered', 'failed', 'dlq'] as const;
export type WebhookStatus = (typeof WEBHOOK_STATUSES)[number];

export const PAYMENT_PROVIDERS = ['micamp', 'stripe_au', 'stripe_sg'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const SOLICITOR_STATUSES = [
  'pending',
  'submitted',
  'approved',
  'expired',
  'rejected',
] as const;
export type SolicitorStatus = (typeof SOLICITOR_STATUSES)[number];

export const SSO_PROVIDERS = [
  'okta',
  'azuread',
  'auth0',
  'google_workspace',
  'generic_saml',
] as const;
export type SsoProvider = (typeof SSO_PROVIDERS)[number];

export const US_STATES = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
  'DC',
] as const;
export type UsState = (typeof US_STATES)[number];

export const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'] as const;
export type AuState = (typeof AU_STATES)[number];
