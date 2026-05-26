/**
 * D2D canonical taxonomy.
 *
 * Single source of truth for every status pill / filter chip / category
 * label rendered in the operator UI. Adding a new status REQUIRES touching
 * this file plus the matching StatusPill tone mapping — drift here is
 * exactly what Polish sprint F was created to prevent.
 *
 * Tone values map 1:1 onto `@d2d/ui-web`'s StatusPill component tone enum
 * (`success | warn | danger | info | muted`). Do not invent new tones —
 * extend the enum at the StatusPill source if a sixth tone is needed.
 *
 * Naming canon (see PLATFORM_NAMING below) is enforced via
 * `scripts/check-taxonomy.sh` and ESLint review.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Lead lifecycle (mirrors services/lead state-machine)
// ─────────────────────────────────────────────────────────────────────────────

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'appointment_set'
  | 'converted'
  | 'lost'
  | 'do_not_contact';

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  appointment_set: 'Appointment',
  converted: 'Converted',
  lost: 'Lost',
  do_not_contact: 'Do not contact',
};

export const LEAD_STATUS_TONE: Record<
  LeadStatus,
  'info' | 'success' | 'warn' | 'muted' | 'danger'
> = {
  new: 'info',
  contacted: 'info',
  qualified: 'success',
  appointment_set: 'success',
  converted: 'success',
  lost: 'muted',
  do_not_contact: 'danger',
};

// ─────────────────────────────────────────────────────────────────────────────
// Conversion attribution source
// ─────────────────────────────────────────────────────────────────────────────

export type AttributionSource = 'door' | 'inside_sales' | 'retargeting' | 'other';

export const ATTRIBUTION_LABEL: Record<AttributionSource, string> = {
  door: 'Door',
  inside_sales: 'Inside sales',
  retargeting: 'Retargeting',
  other: 'Other',
};

// ─────────────────────────────────────────────────────────────────────────────
// Knock disposition (from KnockDisposition enum)
// ─────────────────────────────────────────────────────────────────────────────

export type KnockDisposition =
  | 'no_answer'
  | 'not_interested'
  | 'callback'
  | 'do_not_knock'
  | 'appointment'
  | 'converted_donation'
  | 'converted_sale'
  | 'hostile'
  | 'invalid_address';

export const KNOCK_DISPOSITION_LABEL: Record<KnockDisposition, string> = {
  no_answer: 'No answer',
  not_interested: 'Not interested',
  callback: 'Callback',
  do_not_knock: 'Do not knock',
  appointment: 'Appointment',
  converted_donation: 'Converted · donation',
  converted_sale: 'Converted · sale',
  hostile: 'Hostile',
  invalid_address: 'Invalid address',
};

export const KNOCK_DISPOSITION_TONE: Record<
  KnockDisposition,
  'success' | 'info' | 'warn' | 'muted' | 'danger'
> = {
  no_answer: 'muted',
  not_interested: 'muted',
  callback: 'info',
  do_not_knock: 'danger',
  appointment: 'info',
  converted_donation: 'success',
  converted_sale: 'success',
  hostile: 'danger',
  invalid_address: 'warn',
};

// ─────────────────────────────────────────────────────────────────────────────
// Knocker / rep live status (field ops)
// ─────────────────────────────────────────────────────────────────────────────

export type RepStatus = 'active' | 'break' | 'idle' | 'offline';

export const REP_STATUS_LABEL: Record<RepStatus, string> = {
  active: 'Active',
  break: 'On break',
  idle: 'Idle',
  offline: 'Offline',
};

export const REP_STATUS_TONE: Record<RepStatus, 'success' | 'warn' | 'danger' | 'muted'> = {
  active: 'success',
  break: 'warn',
  idle: 'danger',
  offline: 'muted',
};

// ─────────────────────────────────────────────────────────────────────────────
// Creative status (Marketing Studio)
// ─────────────────────────────────────────────────────────────────────────────

export type CreativeStatus = 'draft' | 'review' | 'approved' | 'published' | 'blocked';

export const CREATIVE_STATUS_LABEL: Record<CreativeStatus, string> = {
  draft: 'Draft',
  review: 'In review',
  approved: 'Approved',
  published: 'Published',
  blocked: 'Blocked',
};

export const CREATIVE_STATUS_TONE: Record<
  CreativeStatus,
  'muted' | 'warn' | 'info' | 'success' | 'danger'
> = {
  draft: 'muted',
  review: 'warn',
  approved: 'info',
  published: 'success',
  blocked: 'danger',
};

// ─────────────────────────────────────────────────────────────────────────────
// Campaign status
// ─────────────────────────────────────────────────────────────────────────────

export type CampaignStatus = 'active' | 'paused' | 'scheduled' | 'ended' | 'pending_review';

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  scheduled: 'Scheduled',
  ended: 'Ended',
  pending_review: 'Pending review',
};

export const CAMPAIGN_STATUS_TONE: Record<CampaignStatus, 'success' | 'warn' | 'info' | 'muted'> = {
  active: 'success',
  paused: 'warn',
  scheduled: 'info',
  ended: 'muted',
  pending_review: 'info',
};

// ─────────────────────────────────────────────────────────────────────────────
// Provider connection status (integrations)
// ─────────────────────────────────────────────────────────────────────────────

export type ProviderConnStatus = 'connected' | 'sandbox' | 'not_connected' | 'error';

export const PROVIDER_CONN_LABEL: Record<ProviderConnStatus, string> = {
  connected: 'Connected',
  sandbox: 'Sandbox',
  not_connected: 'Not connected',
  error: 'Error',
};

export const PROVIDER_CONN_TONE: Record<
  ProviderConnStatus,
  'success' | 'info' | 'muted' | 'danger'
> = {
  connected: 'success',
  sandbox: 'info',
  not_connected: 'muted',
  error: 'danger',
};

// ─────────────────────────────────────────────────────────────────────────────
// Org plan tier
// ─────────────────────────────────────────────────────────────────────────────

export type OrgPlan = 'Trial' | 'Growth' | 'Enterprise';

// ─────────────────────────────────────────────────────────────────────────────
// Account health (cross-account roll-up signal)
// ─────────────────────────────────────────────────────────────────────────────

export type AccountHealth = 'healthy' | 'attention' | 'critical';

export const ACCOUNT_HEALTH_LABEL: Record<AccountHealth, string> = {
  healthy: 'Healthy',
  attention: 'Needs attention',
  critical: 'Critical',
};

export const ACCOUNT_HEALTH_TONE: Record<AccountHealth, 'success' | 'warn' | 'danger'> = {
  healthy: 'success',
  attention: 'warn',
  critical: 'danger',
};

// ─────────────────────────────────────────────────────────────────────────────
// Anomaly severity
// ─────────────────────────────────────────────────────────────────────────────

export type AnomalySeverity = 'critical' | 'warn' | 'info';

export const ANOMALY_SEVERITY_LABEL: Record<AnomalySeverity, string> = {
  critical: 'Critical',
  warn: 'Warning',
  info: 'Info',
};

export const ANOMALY_SEVERITY_TONE: Record<AnomalySeverity, 'danger' | 'warn' | 'info'> = {
  critical: 'danger',
  warn: 'warn',
  info: 'info',
};

// ─────────────────────────────────────────────────────────────────────────────
// Generic naming canon — terms that MUST appear consistently in operator copy
// ─────────────────────────────────────────────────────────────────────────────

export const PLATFORM_NAMING = {
  /** Singular. Never "rep", "salesperson", "agent" in user-facing copy. */
  fieldRep: 'Knocker',
  fieldRepPlural: 'Knockers',
  /** Never "telesales", "phone team". */
  insideSales: 'Inside sales',
  account: 'Account',
  accountPlural: 'Accounts',
  /** Outbound paid campaign. Never "blast" or "send". */
  campaign: 'Campaign',
  /** Outgoing nurture sequence — never "drip" in display copy (the code path may still use `drip`). */
  drip: 'Sequence',
  /** Marketing Studio asset. Never "ad" or "post" in user-facing copy. */
  ad: 'Creative',
  /** Single field event. Singular. */
  doorVisit: 'Knock',
} as const;

export const PLATFORM_NAMING_PLURALS = {
  // Used in section titles and KPI labels.
  knock: 'knocks',
  lead: 'leads',
  conversion: 'conversions',
  conversation: 'conversations',
  appointment: 'appointments',
  payout: 'payouts',
  invoice: 'invoices',
} as const;
