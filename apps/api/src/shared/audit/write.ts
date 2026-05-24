/**
 * Legacy audit writer — delegates to the canonical `AuditService.recordEvent`.
 *
 * Per ADR-0008: every regulated mutation writes an audit row in the same
 * Prisma transaction. The chain is verified weekly + the Merkle root
 * committed to docs/audits/merkle-roots/.
 *
 * Older services call `writeAudit(tx, …)` and expect a `ulid` string back.
 * New code should call `AuditService.recordEvent(tx, …)` directly so it
 * also gets prevHash / rowHash returned.
 */
import type { Prisma } from '@prisma/client';
import type { RegionCode } from '@prisma/client';
import { AuditService } from '../../domains/audit/service';

export interface AuditWriteInput {
  orgId?: string | null;
  regionCode: RegionCode;
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  beforeJson?: unknown;
  afterJson?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Write an audit row inside the caller's Prisma transaction. Returns the
 * row's ulid for callers that want to thread it through to a webhook or
 * log line.
 */
export async function writeAudit(
  tx: Prisma.TransactionClient,
  input: AuditWriteInput,
): Promise<string> {
  const row = await AuditService.recordEvent(tx, input);
  return row.ulid;
}
