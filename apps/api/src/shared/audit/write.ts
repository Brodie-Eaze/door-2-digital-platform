/**
 * Audit-event writer — appends a hash-chained row to AuditEvent in the
 * same TX as the caller's mutation.
 *
 * Per ADR-0008: every regulated mutation writes an audit row in the
 * same Prisma transaction. The chain is verified weekly + the Merkle
 * root committed to docs/audits/merkle-roots/.
 */
import { Prisma } from '@prisma/client';
import type { RegionCode } from '@prisma/client';
import { computeRowHash, GENESIS_PREV_HASH, newId } from '@d2d/shared-utils';
import { env } from '../../config/env';

export interface AuditWriteInput {
  orgId?: string | null;
  regionCode: RegionCode;
  actorUserId?: string | null;
  action: string; // e.g. 'org.created', 'user.invited', 'auth.login_success'
  resourceType: string;
  resourceId: string;
  beforeJson?: unknown;
  afterJson?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Write an audit row inside the caller's Prisma transaction. Computes
 * `prevHash` from the last row (scoped by orgId where present) and
 * `rowHash` via HMAC-SHA256(prevHash || canonical(rest)).
 */
export async function writeAudit(
  tx: Prisma.TransactionClient,
  input: AuditWriteInput,
): Promise<string> {
  const ulid = newId('aud');
  const occurredAt = new Date();

  // Pull last row for chain continuity (scoped to org when present, else
  // to region — this keeps cross-tenant chains decoupled).
  const last = await tx.auditEvent.findFirst({
    where: input.orgId ? { orgId: input.orgId } : { orgId: null, regionCode: input.regionCode },
    orderBy: { id: 'desc' },
    select: { rowHash: true },
  });
  const prevHash = last?.rowHash ?? GENESIS_PREV_HASH;

  const forHash = {
    id: ulid,
    orgId: input.orgId ?? null,
    regionCode: input.regionCode,
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    beforeJson: input.beforeJson ?? null,
    afterJson: input.afterJson ?? null,
    metadata: input.metadata ?? null,
    occurredAt: occurredAt.toISOString(),
  };
  const rowHash = computeRowHash(prevHash, forHash, env().AUDIT_CHAIN_SECRET);

  await tx.auditEvent.create({
    data: {
      ulid,
      orgId: input.orgId ?? null,
      regionCode: input.regionCode,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      beforeJson:
        input.beforeJson !== undefined
          ? (input.beforeJson as Prisma.InputJsonValue)
          : Prisma.DbNull,
      afterJson:
        input.afterJson !== undefined ? (input.afterJson as Prisma.InputJsonValue) : Prisma.DbNull,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      prevHash,
      rowHash,
      occurredAt,
    },
  });

  return ulid;
}
