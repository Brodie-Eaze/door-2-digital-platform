/**
 * Sale service — Phase 1.3 real (read + installer-handoff).
 */
import type { RegionCode } from '@prisma/client';
import { Problems, ProblemError } from '@d2d/shared-utils';
import { prisma } from '../../config/db';
import { AuditService } from '../audit/service';
import type { CancelSaleRequest, InstallerHandoffRequest } from './schemas';

interface ActorContext {
  userId: string;
  orgId: string;
  regionCode: RegionCode;
}

export interface SalePublic {
  id: string;
  conversionId: string;
  productSku: string;
  installerOrgId: string | null;
  scheduledInstallAt: string | null;
  status: string;
}

async function loadSaleAndAssertTenant(
  id: string,
  actor: ActorContext,
): Promise<{
  row: {
    id: string;
    conversionId: string;
    productSku: string;
    installerOrgId: string | null;
    scheduledInstallAt: Date | null;
    status: string;
  };
}> {
  const sale = await prisma().sale.findUnique({
    where: { id },
    include: { conversion: { select: { orgId: true } } },
  });
  if (!sale) throw new ProblemError(Problems.notFound('Sale', id));
  if (sale.conversion.orgId !== actor.orgId) {
    throw new ProblemError(Problems.tenantMismatch(sale.conversion.orgId));
  }
  return { row: sale };
}

export async function getSale(id: string, actor: ActorContext): Promise<SalePublic> {
  const { row } = await loadSaleAndAssertTenant(id, actor);
  return toPublic(row);
}

export async function installerHandoff(
  id: string,
  input: InstallerHandoffRequest,
  actor: ActorContext,
): Promise<SalePublic> {
  const { row } = await loadSaleAndAssertTenant(id, actor);
  if (row.status === 'cancelled') {
    throw new ProblemError(Problems.conflict('Cannot handoff a cancelled sale'));
  }
  const updated = await prisma().$transaction(async (tx) => {
    const next = await tx.sale.update({
      where: { id },
      data: {
        installerOrgId: input.installerOrgId,
        scheduledInstallAt: new Date(input.scheduledInstallAt),
      },
    });
    await AuditService.recordEvent(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'sale.installer_handoff',
      resourceType: 'Sale',
      resourceId: id,
      beforeJson: {
        installerOrgId: row.installerOrgId,
        scheduledInstallAt: row.scheduledInstallAt?.toISOString() ?? null,
      },
      afterJson: {
        installerOrgId: next.installerOrgId,
        scheduledInstallAt: next.scheduledInstallAt?.toISOString() ?? null,
      },
      ...(input.notes && { metadata: { notes: input.notes } }),
    });
    return next;
  });
  return toPublic(updated);
}

const VALID_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  pending_install: ['installed', 'cancelled'],
  installed: ['cancelled'],
  cancelled: [],
};

export async function updateSaleStatus(
  id: string,
  newStatus: string,
  actor: ActorContext,
): Promise<SalePublic> {
  const { row } = await loadSaleAndAssertTenant(id, actor);

  const allowed = VALID_STATUS_TRANSITIONS[row.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new ProblemError(
      Problems.conflict(`Cannot transition sale from ${row.status} to ${newStatus}`),
    );
  }

  const updated = await prisma().$transaction(async (tx) => {
    const next = await tx.sale.update({
      where: { id },
      data: { status: newStatus },
    });
    await AuditService.recordEvent(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'sale.status_updated',
      resourceType: 'Sale',
      resourceId: id,
      beforeJson: { status: row.status },
      afterJson: { status: newStatus },
    });
    return next;
  });

  return toPublic(updated);
}

export async function cancelSale(
  id: string,
  input: CancelSaleRequest,
  actor: ActorContext,
): Promise<SalePublic> {
  const { row } = await loadSaleAndAssertTenant(id, actor);
  if (row.status === 'cancelled') return toPublic(row);

  const allowed = VALID_STATUS_TRANSITIONS[row.status] ?? [];
  if (!allowed.includes('cancelled')) {
    throw new ProblemError(Problems.conflict(`Cannot cancel a sale with status ${row.status}`));
  }

  const updated = await prisma().$transaction(async (tx) => {
    const next = await tx.sale.update({
      where: { id },
      data: { status: 'cancelled' },
    });

    if (input.clawbackCommissions) {
      // Mark accrued commissions on this conversion as clawback-pending.
      await tx.commission.updateMany({
        where: { conversionId: next.conversionId, status: 'accrued' },
        data: { status: 'clawback_pending' },
      });
    }

    await AuditService.recordEvent(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'sale.cancelled',
      resourceType: 'Sale',
      resourceId: id,
      beforeJson: { status: row.status },
      afterJson: { status: 'cancelled' },
      metadata: {
        reason: input.reason,
        clawbackCommissions: input.clawbackCommissions,
      },
    });
    return next;
  });
  return toPublic(updated);
}

function toPublic(s: {
  id: string;
  conversionId: string;
  productSku: string;
  installerOrgId: string | null;
  scheduledInstallAt: Date | null;
  status: string;
}): SalePublic {
  return {
    id: s.id,
    conversionId: s.conversionId,
    productSku: s.productSku,
    installerOrgId: s.installerOrgId,
    scheduledInstallAt: s.scheduledInstallAt?.toISOString() ?? null,
    status: s.status,
  };
}
