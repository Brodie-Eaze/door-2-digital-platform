/**
 * Catalog service — per-tenant ServiceOffering CRUD.
 *
 * READS use the tenant-scoped `prisma()`-derived delegate (the `$extends`
 * injector auto-ANDs `orgId` into every `where`, mirroring lead/daily-stats);
 * WRITES go through `tenantTx(orgId, …)` so Postgres RLS pins every row + the
 * AuditService chain captures the mutation (mirrors field-signup).
 *
 * Money: `amountCents` is BigInt in the DB → serialized to a JS number of cents
 * (`Number(x)`) on the wire; the iOS app reads `amountCents` as an integer.
 * DELETE is a SOFT delete (`active = false`) — offerings are never hard-deleted
 * so the audit chain + historic conversions keep referencing a real catalog row.
 */
import type { RegionCode, Vertical } from '@prisma/client';
import { newId, Problems, ProblemError } from '@d2d/shared-utils';
import { prisma, tenantTx } from '../../config/db';
import { AuditService } from '../audit/service';
import type { CreateOfferingRequest, UpdateOfferingRequest } from './schemas';

interface ActorContext {
  userId: string;
  orgId: string;
  regionCode: RegionCode;
}

/**
 * The shape the native Knocker app fetches. Field names are the iOS contract —
 * do not rename. `amountCents` is an integer number of cents.
 */
export interface OfferingPublic {
  id: string;
  name: string;
  blurb: string;
  amountCents: number;
  frequency: string;
  vertical: Vertical;
  highlighted: boolean;
  sortOrder: number;
}

/**
 * The org's ACTIVE offerings, ordered for display: sortOrder asc, then
 * createdAt asc as a stable tie-break. Tenant-scoped by the `$extends` injector.
 */
export async function listOfferings(actor: ActorContext): Promise<OfferingPublic[]> {
  const rows = await prisma().serviceOffering.findMany({
    where: { orgId: actor.orgId, active: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(toPublic);
}

export async function createOffering(
  input: CreateOfferingRequest,
  actor: ActorContext,
): Promise<{ id: string }> {
  const id = newId('svo');
  const amountCents = BigInt(input.amountCents);

  await tenantTx(actor.orgId, async (tx) => {
    await tx.serviceOffering.create({
      data: {
        id,
        orgId: actor.orgId,
        regionCode: actor.regionCode,
        name: input.name,
        blurb: input.blurb ?? '',
        amountCents,
        frequency: input.frequency,
        vertical: input.vertical,
        highlighted: input.highlighted ?? false,
        sortOrder: input.sortOrder ?? 0,
      },
    });
    await AuditService.recordEvent(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'service_offering.created',
      resourceType: 'ServiceOffering',
      resourceId: id,
      afterJson: {
        name: input.name,
        amountCents: amountCents.toString(),
        frequency: input.frequency,
        vertical: input.vertical,
        highlighted: input.highlighted ?? false,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  });

  return { id };
}

export async function updateOffering(
  id: string,
  input: UpdateOfferingRequest,
  actor: ActorContext,
): Promise<{ id: string }> {
  // Tenant-scoped read first so a cross-tenant id 404s rather than silently
  // touching nothing (the `$extends` injector ANDs orgId into the lookup).
  const existing = await prisma().serviceOffering.findFirst({
    where: { id, orgId: actor.orgId },
  });
  if (!existing) throw new ProblemError(Problems.notFound('ServiceOffering', id));

  await tenantTx(actor.orgId, async (tx) => {
    const next = await tx.serviceOffering.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.blurb !== undefined && { blurb: input.blurb }),
        ...(input.amountCents !== undefined && { amountCents: BigInt(input.amountCents) }),
        ...(input.frequency !== undefined && { frequency: input.frequency }),
        ...(input.highlighted !== undefined && { highlighted: input.highlighted }),
        ...(input.active !== undefined && { active: input.active }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      },
    });
    await AuditService.recordEvent(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'service_offering.updated',
      resourceType: 'ServiceOffering',
      resourceId: id,
      beforeJson: {
        name: existing.name,
        blurb: existing.blurb,
        amountCents: existing.amountCents.toString(),
        frequency: existing.frequency,
        highlighted: existing.highlighted,
        active: existing.active,
        sortOrder: existing.sortOrder,
      },
      afterJson: {
        name: next.name,
        blurb: next.blurb,
        amountCents: next.amountCents.toString(),
        frequency: next.frequency,
        highlighted: next.highlighted,
        active: next.active,
        sortOrder: next.sortOrder,
      },
    });
  });

  return { id };
}

/**
 * Soft delete — set `active = false`. The offering vanishes from the catalog
 * read but the row (and any conversions/audit rows that reference it) survives.
 */
export async function archiveOffering(id: string, actor: ActorContext): Promise<{ id: string }> {
  const existing = await prisma().serviceOffering.findFirst({
    where: { id, orgId: actor.orgId },
  });
  if (!existing) throw new ProblemError(Problems.notFound('ServiceOffering', id));

  await tenantTx(actor.orgId, async (tx) => {
    await tx.serviceOffering.update({
      where: { id },
      data: { active: false },
    });
    await AuditService.recordEvent(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'service_offering.archived',
      resourceType: 'ServiceOffering',
      resourceId: id,
      beforeJson: { active: existing.active },
      afterJson: { active: false },
    });
  });

  return { id };
}

function toPublic(r: {
  id: string;
  name: string;
  blurb: string;
  amountCents: bigint;
  frequency: string;
  vertical: Vertical;
  highlighted: boolean;
  sortOrder: number;
}): OfferingPublic {
  return {
    id: r.id,
    name: r.name,
    blurb: r.blurb,
    // BigInt cents → JS number of cents. Catalog amounts (giving tiers / plan
    // prices) are far below Number.MAX_SAFE_INTEGER, so this is lossless.
    amountCents: Number(r.amountCents),
    frequency: r.frequency,
    vertical: r.vertical,
    highlighted: r.highlighted,
    sortOrder: r.sortOrder,
  };
}
