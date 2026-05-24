/**
 * Sale service — Phase 1.3 real (read + installer-handoff).
 */
import type { RegionCode } from '@prisma/client';
import { Problems, ProblemError } from '@d2d/shared-utils';
import { prisma } from '../../config/db';
import { AuditService } from '../audit/service';
import type { InstallerHandoffRequest } from './schemas';

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
