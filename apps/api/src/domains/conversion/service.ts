/**
 * Conversion service — Phase 1.3 real.
 *
 * Polymorphic root row that points at one of (Donation | Sale). The
 * `attributionSource` enum drives the billing rake bucket (door / inside
 * sales / retargeting / other) — set on the Conversion row at create time.
 *
 * `processorResidualCents` is the cents we ledger as the payment-processor
 * residual. For MiCamp ISO accounts we ledger 0.5% of `amountCents` as a
 * stub — the real number lands in the BullMQ finaliser worker.
 *
 * All mutations write an AuditEvent in the same TX via AuditService.
 */
import { Prisma } from '@prisma/client';
import type {
  AttributionSource,
  ConversionType,
  PaymentProvider,
  RegionCode,
} from '@prisma/client';
import { computeRake, money, newId, Problems, ProblemError } from '@d2d/shared-utils';
import { PiiVaultService } from '../pii-vault/service';
import { prisma, tenantTx } from '../../config/db';
import { AuditService } from '../audit/service';
import { assertStateCleared } from '../compliance/service';
import type { CreateConversionRequest, ListConversionsQuery } from './schemas';

interface ActorContext {
  userId: string;
  orgId: string;
  regionCode: RegionCode;
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

export interface DonationPublic {
  id: string;
  conversionId: string;
  // donorEmail is vaulted — plaintext is never returned in normal responses.
  // Unmask via POST /v1/pii/unmask-request with rowType='Donation', field='email'.
  donorEmailDigest: string | null;
  amountCents: string;
  currency: string;
  frequency: string | null;
  // SEC-009: paymentMethodToken is vaulted — raw token never returned.
  // paymentMethodTokenDigest is safe for operational display / recurring lookups.
  paymentMethodTokenDigest: string | null;
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

/**
 * Compute the payment processor's residual based on provider. MiCamp ISO
 * boards us at 0.5% of the gross — Stripe AU/SG bill via Stripe Connect
 * direct so we record 0 here and reconcile in billing.
 */
function computeProcessorResidualCents(provider: PaymentProvider, amountCents: bigint): bigint {
  switch (provider) {
    case 'micamp':
      // 0.5 % = amount * 5 / 1000.
      return (amountCents * 5n) / 1000n;
    case 'stripe_au':
    case 'stripe_sg':
      // Stripe Connect — billing reconciles from Stripe BalanceTransactions.
      return 0n;
  }
}

export async function createConversion(
  input: CreateConversionRequest,
  actor: ActorContext,
): Promise<ConversionPublic> {
  // Validate the lead lives in the same org. Pull the address region so the
  // paid-solicitor clearance gate can derive the donor's state authoritatively.
  const lead = await prisma().lead.findUnique({
    where: { id: input.leadId },
    select: {
      orgId: true,
      status: true,
      regionCode: true,
      brandCode: true,
      address: { select: { region: true } },
    },
  });
  if (!lead) throw new ProblemError(Problems.notFound('Lead', input.leadId));
  if (lead.orgId !== actor.orgId) {
    throw new ProblemError(Problems.tenantMismatch(lead.orgId));
  }

  // Paid-solicitor state-clearance hard-gate (legal P0). A charity conversion
  // (which carries a campaignId) MUST be cleared for the donor's state before
  // any row is written. Donor state is the lead's address.region when present
  // (authoritative); else the caller-supplied donorState fallback. Commercial
  // sales carry no campaignId and skip the gate inside assertStateCleared.
  const donorState = lead.address?.region ?? input.donorState ?? null;
  await assertStateCleared(actor.orgId, input.campaignId, donorState);

  // Validate the donation/sale child payload aligns with the conversion type.
  if (input.type === 'sale_commercial' && !input.saleDetails) {
    throw new ProblemError(Problems.validation('saleDetails required for sale_commercial'));
  }
  if (
    (input.type === 'donation_recurring' || input.type === 'donation_oneoff') &&
    !input.donationDetails
  ) {
    throw new ProblemError(
      Problems.validation('donationDetails required for donation conversions'),
    );
  }

  const amountCents = input.amountCents;
  const processorResidualCents = computeProcessorResidualCents(input.paymentProvider, amountCents);
  const rakeMoney = computeRake(money(amountCents, input.currency), input.attributionSource);
  const rake = rakeMoney.cents;
  const conversionId = newId('cnv');
  const signedAt = input.signedAt ? new Date(input.signedAt) : new Date();

  // Reuse the Idempotency-Key header as the per-conversion unique key so
  // accidental double-clicks don't book two MiCamp charges. The middleware
  // already replays the response, but the DB-level UNIQUE is belt+suspenders.
  const idempotencyKey = newId('cnvidem');

  // SEC-005 — run the finalise inside a tenant-pinned transaction. tenantTx
  // sets the `app.current_org_id` GUC so Postgres RLS scopes every row written
  // here to actor.orgId at the database layer (the "belt"). Under the current
  // owner DB role RLS is a no-op and this behaves exactly as the prior
  // $transaction; after the d2d_app cutover (docs/runbooks/rls-cutover.md) the
  // database itself enforces tenant isolation on this money path.
  const result = await tenantTx(actor.orgId, async (tx) => {
    const conv = await tx.conversion.create({
      data: {
        id: conversionId,
        orgId: actor.orgId,
        regionCode: actor.regionCode,
        brandCode: 'd2d',
        leadId: input.leadId,
        knockId: input.knockId ?? null,
        campaignId: input.campaignId ?? null,
        knockerId: input.knockerId ?? null,
        closerId: input.closerId ?? null,
        type: input.type,
        attributionSource: input.attributionSource,
        retargetingCampaignId: input.retargetingCampaignId ?? null,
        amountCents,
        currency: input.currency,
        signedAt,
        signatureKey: input.signatureKey ?? null,
        paymentProvider: input.paymentProvider,
        paymentExternalId: input.paymentExternalId ?? null,
        processorResidualCents,
        d2dRakeCents: rake,
        idempotencyKey,
      },
    });

    let donation = null;
    let sale = null;
    if (input.type === 'donation_recurring' || input.type === 'donation_oneoff') {
      const donationId = newId('don');
      // F-004: envelope-encrypt the donor email before persisting. The AAD binds
      // the ciphertext to this exact row (rowType='Donation', rowId=donationId)
      // so the blob is useless if relocated. donorEmailDigest allows future
      // de-dup / DNC lookups without decrypting.
      const donorEmailVault = input.donationDetails?.donorEmail
        ? PiiVaultService.encryptForRow('Donation', donationId, input.donationDetails.donorEmail)
        : null;
      const donorEmailDigest = input.donationDetails?.donorEmail
        ? PiiVaultService.digest(input.donationDetails.donorEmail)
        : null;
      // SEC-009: vault-encrypt the payment method token before persistence.
      // The raw token (MiCamp tok_* / Stripe pm_*) is PII that enables
      // charges; it must never rest in plaintext. The digest allows recurring-
      // charge lookup without decryption.
      const rawToken = input.paymentMethodToken ?? input.paymentExternalId ?? null;
      const paymentMethodTokenVault = rawToken
        ? PiiVaultService.encryptForRow('Donation', donationId, rawToken)
        : null;
      const paymentMethodTokenDigest = rawToken ? PiiVaultService.digest(rawToken) : null;
      donation = await tx.donation.create({
        data: {
          id: donationId,
          conversionId,
          donorEmailVault: donorEmailVault
            ? (donorEmailVault as unknown as Prisma.InputJsonValue)
            : Prisma.DbNull,
          donorEmailDigest: donorEmailDigest ?? undefined,
          amountCents,
          currency: input.currency,
          frequency:
            input.type === 'donation_recurring' && input.donationDetails?.frequency
              ? input.donationDetails.frequency
              : null,
          paymentMethodTokenVault: paymentMethodTokenVault
            ? (paymentMethodTokenVault as unknown as Prisma.InputJsonValue)
            : Prisma.DbNull,
          paymentMethodTokenDigest: paymentMethodTokenDigest ?? undefined,
          status: 'active',
          deductibleGiftRecipientNo: input.donationDetails?.deductibleGiftRecipientNo ?? null,
          einOrEquivalent: input.donationDetails?.einOrEquivalent ?? null,
          startedAt: signedAt,
        },
      });
    } else {
      sale = await tx.sale.create({
        data: {
          id: newId('sal'),
          conversionId,
          productSku: input.saleDetails!.productSku,
          installerOrgId: input.saleDetails?.installerOrgId ?? null,
          scheduledInstallAt: input.saleDetails?.scheduledInstallAt
            ? new Date(input.saleDetails.scheduledInstallAt)
            : null,
          status: 'pending_install',
        },
      });
    }

    // Flip the lead status to converted (any open status → converted).
    if (lead.status !== 'converted') {
      await tx.lead.update({
        where: { id: input.leadId },
        data: { status: 'converted' },
      });
    }

    await AuditService.recordEvent(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'conversion.created',
      resourceType: 'Conversion',
      resourceId: conversionId,
      afterJson: {
        type: input.type,
        attributionSource: input.attributionSource,
        amountCents: amountCents.toString(),
        currency: input.currency,
        paymentProvider: input.paymentProvider,
        processorResidualCents: processorResidualCents.toString(),
        d2dRakeCents: rake.toString(),
      },
    });

    return { conv, donation, sale };
  });

  return toPublic(result.conv, result.donation, result.sale);
}

export async function listConversions(
  query: ListConversionsQuery,
  actor: ActorContext,
): Promise<{ data: ConversionPublic[]; nextCursor: string | null }> {
  const where: Prisma.ConversionWhereInput = { orgId: actor.orgId };
  if (query.leadId) where.leadId = query.leadId;
  if (query.type) where.type = query.type;
  if (query.attributionSource) where.attributionSource = query.attributionSource;
  if (query.from || query.to) {
    const range: Prisma.DateTimeFilter = {};
    if (query.from) range.gte = new Date(query.from);
    if (query.to) range.lte = new Date(query.to);
    where.signedAt = range;
  }
  const rows = await prisma().conversion.findMany({
    where,
    take: query.limit + 1,
    ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    orderBy: { id: 'asc' },
    include: { donation: true, sale: true },
  });
  const hasMore = rows.length > query.limit;
  const slice = hasMore ? rows.slice(0, query.limit) : rows;
  const nextCursor = hasMore ? (slice[slice.length - 1]?.id ?? null) : null;
  return {
    data: slice.map((r) => toPublic(r, r.donation, r.sale)),
    nextCursor,
  };
}

export async function getConversion(id: string, actor: ActorContext): Promise<ConversionPublic> {
  const row = await prisma().conversion.findUnique({
    where: { id },
    include: { donation: true, sale: true },
  });
  if (!row) throw new ProblemError(Problems.notFound('Conversion', id));
  if (row.orgId !== actor.orgId) {
    throw new ProblemError(Problems.tenantMismatch(row.orgId));
  }
  return toPublic(row, row.donation, row.sale);
}

// ───────────────────────────────────────────────────────────────────────────
// Mappers
// ───────────────────────────────────────────────────────────────────────────

function toPublic(
  c: {
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
    amountCents: bigint;
    currency: string;
    signedAt: Date;
    signatureKey: string | null;
    paymentProvider: PaymentProvider;
    paymentExternalId: string | null;
    processorResidualCents: bigint;
    d2dRakeCents: bigint;
  },
  donation: {
    id: string;
    conversionId: string;
    donorEmailDigest: string | null;
    amountCents: bigint;
    currency: string;
    frequency: string | null;
    paymentMethodTokenDigest: string | null;
    status: string;
    receiptNumber: string | null;
    deductibleGiftRecipientNo: string | null;
    einOrEquivalent: string | null;
    startedAt: Date;
    cancelledAt: Date | null;
  } | null,
  sale: {
    id: string;
    conversionId: string;
    productSku: string;
    installerOrgId: string | null;
    scheduledInstallAt: Date | null;
    status: string;
  } | null,
): ConversionPublic {
  return {
    id: c.id,
    orgId: c.orgId,
    regionCode: c.regionCode,
    leadId: c.leadId,
    knockId: c.knockId,
    campaignId: c.campaignId,
    knockerId: c.knockerId,
    closerId: c.closerId,
    type: c.type,
    attributionSource: c.attributionSource,
    retargetingCampaignId: c.retargetingCampaignId,
    amountCents: c.amountCents.toString(),
    currency: c.currency,
    signedAt: c.signedAt.toISOString(),
    signatureKey: c.signatureKey,
    paymentProvider: c.paymentProvider,
    paymentExternalId: c.paymentExternalId,
    processorResidualCents: c.processorResidualCents.toString(),
    d2dRakeCents: c.d2dRakeCents.toString(),
    donation: donation
      ? {
          id: donation.id,
          conversionId: donation.conversionId,
          donorEmailDigest: donation.donorEmailDigest,
          amountCents: donation.amountCents.toString(),
          currency: donation.currency,
          frequency: donation.frequency,
          paymentMethodTokenDigest: donation.paymentMethodTokenDigest,
          status: donation.status,
          receiptNumber: donation.receiptNumber,
          deductibleGiftRecipientNo: donation.deductibleGiftRecipientNo,
          einOrEquivalent: donation.einOrEquivalent,
          startedAt: donation.startedAt.toISOString(),
          cancelledAt: donation.cancelledAt?.toISOString() ?? null,
        }
      : null,
    sale: sale
      ? {
          id: sale.id,
          conversionId: sale.conversionId,
          productSku: sale.productSku,
          installerOrgId: sale.installerOrgId,
          scheduledInstallAt: sale.scheduledInstallAt?.toISOString() ?? null,
          status: sale.status,
        }
      : null,
  };
}
