/**
 * Donation service — Phase 1.3 real (pause / cancel / change-amount + read).
 *
 * Donations are children of Conversion rows; we load the parent on every
 * mutation to honour tenant isolation.
 */
import type { RegionCode } from '@prisma/client';
import { Problems, ProblemError } from '@d2d/shared-utils';
import { prisma, tenantPrismaTx, tenantTx } from '../../config/db';
import { AuditService } from '../audit/service';
import type {
  CancelDonationRequest,
  ChangeDonationAmountRequest,
  PauseDonationRequest,
} from './schemas';

interface ActorContext {
  userId: string;
  orgId: string;
  regionCode: RegionCode;
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
  startedAt: string;
  cancelledAt: string | null;
}

async function loadDonationAndAssertTenant(
  id: string,
  actor: ActorContext,
): Promise<{
  row: {
    id: string;
    conversionId: string;
    donorEmail: string;
    amountCents: bigint;
    currency: string;
    frequency: string | null;
    status: string;
    receiptNumber: string | null;
    startedAt: Date;
    cancelledAt: Date | null;
  };
  orgId: string;
}> {
  // Donation carries no orgId — RLS is DISABLED on it (it has no tenant column),
  // so tenancy lives entirely on the parent Conversion. We must NOT `include` the
  // parent in one read: under the RLS belt (d2d_app, no GUC) the required
  // `conversion` relation is invisible → Prisma throws "inconsistent query result"
  // (a 500) for every donation. Instead, read the (un-scoped) Donation row, then
  // prove its parent Conversion is visible THROUGH the belt as a separate scoped
  // read. A foreign parent is RLS-invisible → null → 404 (never 403: withholding
  // cross-tenant existence is the whole point of tenant isolation).
  const donation = await prisma().donation.findUnique({ where: { id } });
  if (!donation) throw new ProblemError(Problems.notFound('Donation', id));
  const parent = await tenantPrismaTx(actor.orgId).conversion.findUnique({
    where: { id: donation.conversionId },
    select: { orgId: true },
  });
  if (!parent) throw new ProblemError(Problems.notFound('Donation', id));
  return { row: donation, orgId: parent.orgId };
}

export async function getDonation(id: string, actor: ActorContext): Promise<DonationPublic> {
  const { row } = await loadDonationAndAssertTenant(id, actor);
  return toPublic(row);
}

export async function pauseDonation(
  id: string,
  input: PauseDonationRequest,
  actor: ActorContext,
): Promise<DonationPublic> {
  const { row } = await loadDonationAndAssertTenant(id, actor);
  if (row.status === 'paused') return toPublic(row);
  if (row.status === 'cancelled') {
    throw new ProblemError(Problems.conflict('Cannot pause a cancelled donation'));
  }
  const updated = await tenantTx(actor.orgId, async (tx) => {
    const next = await tx.donation.update({
      where: { id },
      data: { status: 'paused' },
    });
    await AuditService.recordEvent(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'donation.paused',
      resourceType: 'Donation',
      resourceId: id,
      beforeJson: { status: row.status },
      afterJson: { status: 'paused' },
      ...(input.resumeAt || input.reason
        ? {
            metadata: {
              ...(input.resumeAt && { resumeAt: input.resumeAt }),
              ...(input.reason && { reason: input.reason }),
            },
          }
        : {}),
    });
    return next;
  });
  return toPublic(updated);
}

export async function cancelDonation(
  id: string,
  input: CancelDonationRequest,
  actor: ActorContext,
): Promise<DonationPublic> {
  const { row } = await loadDonationAndAssertTenant(id, actor);
  if (row.status === 'cancelled') return toPublic(row);
  const updated = await tenantTx(actor.orgId, async (tx) => {
    const next = await tx.donation.update({
      where: { id },
      data: { status: 'cancelled', cancelledAt: new Date() },
    });
    await AuditService.recordEvent(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'donation.cancelled',
      resourceType: 'Donation',
      resourceId: id,
      beforeJson: { status: row.status },
      afterJson: { status: 'cancelled' },
      metadata: {
        reason: input.reason,
        ...(input.refundLastChargeCents !== undefined && {
          refundLastChargeCents: input.refundLastChargeCents.toString(),
        }),
      },
    });
    return next;
  });
  return toPublic(updated);
}

export async function changeDonationAmount(
  id: string,
  input: ChangeDonationAmountRequest,
  actor: ActorContext,
): Promise<DonationPublic> {
  const { row } = await loadDonationAndAssertTenant(id, actor);
  if (!row.frequency) {
    throw new ProblemError(
      Problems.validation('Amount change only applies to recurring donations'),
    );
  }
  if (row.status === 'cancelled') {
    throw new ProblemError(Problems.conflict('Cannot change amount of a cancelled donation'));
  }
  const newAmount = input.newAmountCents;
  if (newAmount <= 0n) {
    throw new ProblemError(Problems.validation('newAmountCents must be > 0'));
  }
  const updated = await tenantTx(actor.orgId, async (tx) => {
    const next = await tx.donation.update({
      where: { id },
      data: { amountCents: newAmount },
    });
    await AuditService.recordEvent(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'donation.amount_changed',
      resourceType: 'Donation',
      resourceId: id,
      beforeJson: { amountCents: row.amountCents.toString() },
      afterJson: { amountCents: newAmount.toString() },
      ...(input.effectiveAt || input.reason
        ? {
            metadata: {
              ...(input.effectiveAt && { effectiveAt: input.effectiveAt }),
              ...(input.reason && { reason: input.reason }),
            },
          }
        : {}),
    });
    return next;
  });
  return toPublic(updated);
}

function toPublic(r: {
  id: string;
  conversionId: string;
  donorEmail: string;
  amountCents: bigint;
  currency: string;
  frequency: string | null;
  status: string;
  receiptNumber: string | null;
  startedAt: Date;
  cancelledAt: Date | null;
}): DonationPublic {
  return {
    id: r.id,
    conversionId: r.conversionId,
    donorEmail: r.donorEmail,
    amountCents: r.amountCents.toString(),
    currency: r.currency,
    frequency: r.frequency,
    status: r.status,
    receiptNumber: r.receiptNumber,
    startedAt: r.startedAt.toISOString(),
    cancelledAt: r.cancelledAt?.toISOString() ?? null,
  };
}
