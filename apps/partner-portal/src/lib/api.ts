import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type {
  AttributionSource,
  PaymentProvider,
  PlatformRole,
  RegionCode,
} from '@d2d/shared-types';

interface ProblemDetails {
  title?: unknown;
  detail?: unknown;
  status?: unknown;
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function problemText(problem: ProblemDetails): string | null {
  const detail = typeof problem.detail === 'string' ? problem.detail : null;
  const title = typeof problem.title === 'string' ? problem.title : null;
  if (title && detail) return `${title}: ${detail}`;
  return detail ?? title;
}

/**
 * Server-side fetch to the D2D API. Forwards the `d2d_at` access cookie,
 * never caches, and redirects to /login on 401/403 (session expired or
 * absent). RFC 7807 problem+json bodies are parsed for the error message.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = cookies().get('d2d_at')?.value;
  const headers = new Headers(init?.headers);
  if (accessToken) {
    headers.set('cookie', `d2d_at=${accessToken}`);
  }

  const apiBase =
    process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3010';
  const response = await fetch(`${apiBase}/v1${path}`, {
    ...init,
    cache: 'no-store',
    headers,
  });

  if (response.status === 401 || response.status === 403) {
    redirect('/login');
  }

  if (!response.ok) {
    let message = `API request failed with ${response.status}`;
    try {
      const problem = (await response.json()) as ProblemDetails;
      message = problemText(problem) ?? message;
    } catch {
      // Keep the status-derived message when the response body is not JSON.
    }
    throw new ApiError(response.status, message);
  }

  return (await response.json()) as T;
}

/** True when `err` is an apiFetch failure with the given HTTP status. */
export function isApiErrorStatus(err: unknown, status: number): boolean {
  return err instanceof ApiError && err.status === status;
}

export interface PageResponse<T> {
  data: T[];
  nextCursor: string | null;
}

export function wireCents(cents: string): bigint {
  return BigInt(cents);
}

export function sumWireCents<T>(items: readonly T[], select: (item: T) => string): bigint {
  return items.reduce((sum, item) => sum + wireCents(select(item)), 0n);
}

// ─── Auth / identity ────────────────────────────────────────────────────────

export interface UserPublic {
  id: string;
  orgId: string;
  email: string;
  givenName: string;
  familyName: string;
  phone: string | null;
  role: PlatformRole;
  managerId: string | null;
  status: string;
  regionCode: RegionCode;
  brandCode: string;
  lastLoginAt: string | null;
  createdAt: string;
}

// ─── Org ────────────────────────────────────────────────────────────────────

export interface OrgPublic {
  id: string;
  legalName: string;
  tradingName: string;
  vertical: string;
  type: string;
  regionCode: RegionCode;
  brandCode: string;
  status: string;
  abnAcnUen: string | null;
  aiBudgetCents: string;
  aiRetargetingOptOut: boolean;
  ssoProvider: string | null;
  createdAt: string;
  archivedAt: string | null;
}

export interface Session {
  user: UserPublic;
  org: OrgPublic;
}

/**
 * The org is ALWAYS derived server-side from the session — never hardcoded.
 * GET /auth/me resolves the logged-in user, then GET /orgs/:id resolves the
 * org that portal renders for.
 */
export async function getSession(): Promise<Session> {
  const { user } = await apiFetch<{ user: UserPublic }>('/auth/me');
  const { org } = await apiFetch<{ org: OrgPublic }>(`/orgs/${user.orgId}`);
  return { user, org };
}

// ─── Billing ────────────────────────────────────────────────────────────────

export interface InvoiceLineItemPublic {
  id: string;
  kind: string;
  description: string;
  amountCents: string;
  currency: string;
  conversionCount: number;
}

export interface InvoicePublic {
  id: string;
  orgId: string;
  regionCode: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  platformFeeCents: string;
  doorRakeCents: string;
  insideSalesRakeCents: string;
  retargetingRakeCents: string;
  additionalCents: string;
  totalCents: string;
  currency: string;
  idempotencyKey: string;
  sentAt: string | null;
  paidAt: string | null;
  lineItems: InvoiceLineItemPublic[];
  createdAt: string;
  updatedAt: string;
}

// ─── Payouts ────────────────────────────────────────────────────────────────

export interface PayoutBatchPublic {
  id: string;
  orgId: string;
  regionCode: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  totalCents: string;
  currency: string;
  instructionFileKey: string | null;
  instructedAt: string | null;
  acknowledgedAt: string | null;
  lineCount: number;
}

// ─── Conversions ────────────────────────────────────────────────────────────

export interface DonationPublic {
  id: string;
  conversionId: string;
  donorEmail: string;
  amountCents: string;
  currency: string;
  frequency: string | null;
  status: string;
  receiptNumber: string | null;
  deductibleGiftRecipientNo: string | null;
  einOrEquivalent: string | null;
  startedAt: string;
  cancelledAt: string | null;
}

export interface SalePublic {
  id: string;
  conversionId: string;
  productSku: string;
  installerOrgId: string | null;
  scheduledInstallAt: string | null;
  status: string;
}

export interface ConversionPublic {
  id: string;
  orgId: string;
  regionCode: RegionCode;
  leadId: string;
  knockId: string | null;
  campaignId: string | null;
  knockerId: string | null;
  closerId: string | null;
  type: string;
  attributionSource: AttributionSource;
  retargetingCampaignId: string | null;
  amountCents: string;
  currency: string;
  signedAt: string;
  signatureKey: string | null;
  paymentProvider: PaymentProvider;
  paymentExternalId: string | null;
  processorResidualCents: string;
  d2dRakeCents: string;
  donation: DonationPublic | null;
  sale: SalePublic | null;
}

// ─── Compliance ─────────────────────────────────────────────────────────────

export type StateClearanceStatus = 'cleared' | 'expired' | 'pending_registration';

export interface StateClearanceCell {
  campaignId: string;
  campaignName: string;
  state: string;
  status: StateClearanceStatus;
  clearedAt: string | null;
  registrationId: string | null;
  registrationStatus: string | null;
  registrationExpiresAt: string | null;
}
