import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type {
  AttributionSource,
  ConversionType,
  PaymentProvider,
  PlatformRole,
  RegionCode,
  Vertical,
} from '@d2d/shared-types';

interface ProblemDetails {
  title?: unknown;
  detail?: unknown;
}

function problemText(problem: ProblemDetails): string | null {
  const detail = typeof problem.detail === 'string' ? problem.detail : null;
  const title = typeof problem.title === 'string' ? problem.title : null;
  if (title && detail) return `${title}: ${detail}`;
  return detail ?? title;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = (await cookies()).get('d2d_at')?.value;
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
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export interface PageResponse<T> {
  data: T[];
  nextCursor: string | null;
}

export interface LeadPublic {
  id: string;
  orgId: string;
  regionCode: RegionCode;
  brandCode: string;
  status: string;
  vertical: Vertical;
  campaignId: string | null;
  sourceKnockId: string | null;
  addressId: string | null;
  assignedToId: string | null;
  givenName: string;
  familyName: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadActivityPublic {
  id: string;
  leadId: string;
  userId: string | null;
  type: string;
  outcome: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface LeadWithActivities extends LeadPublic {
  activities: LeadActivityPublic[];
}

export interface LeadDetailResponse {
  lead: LeadWithActivities;
}

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
  type: ConversionType;
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

export interface TerritoryPublic {
  id: string;
  orgId: string;
  regionCode: RegionCode;
  brandCode: string;
  name: string;
  vertical: Vertical;
  polygonWkt: string | null;
  centroid: { lng: number; lat: number } | null;
  s2CellIds: string[];
  campaignId: string | null;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CommissionPublic {
  id: string;
  orgId: string;
  userId: string;
  planId: string;
  type: string;
  conversionId: string | null;
  knockId: string | null;
  amountCents: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  payoutBatchId: string | null;
  status: string;
}

export interface CommissionsResponse {
  commissions: CommissionPublic[];
  nextCursor: string | null;
  totalCents: string;
}

export function wireCents(cents: string): bigint {
  return BigInt(cents);
}

export function sumWireCents<T>(items: readonly T[], select: (item: T) => string): bigint {
  return items.reduce((sum, item) => sum + wireCents(select(item)), 0n);
}
