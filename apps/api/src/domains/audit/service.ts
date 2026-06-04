/**
 * Audit service — Phase 1.1 real.
 *
 * Hash-chained, per-org+region append-only log of regulated mutations
 * (ADR-0008). The chain replays from genesis: every row's `rowHash` is
 * HMAC-SHA256(prevHash || canonical(row)) so a break or insertion is
 * detectable in O(N) by replaying.
 *
 * `recordEvent()` is the only public way to append an audit row; legacy
 * `writeAudit()` (shared/audit/write.ts) now delegates here to keep the
 * older call sites green. New services call `AuditService.recordEvent`
 * directly so the dependency surface is obvious.
 *
 * `verifyChain()` rebuilds the per-(orgId, regionCode) chain and reports
 * the first ID where the stored rowHash disagrees with the recomputed
 * value — a tamper signal.
 */
import { Prisma } from '@prisma/client';
import type { RegionCode } from '@prisma/client';
import {
  computeRowHash,
  GENESIS_PREV_HASH,
  newId,
  type AuditEventForHash,
} from '@d2d/shared-utils';
import { prisma, tenantPrismaTx } from '../../config/db';
import { env } from '../../config/env';

export interface AuditEventInput {
  orgId?: string | null;
  regionCode: RegionCode;
  actorUserId?: string | null;
  action: string; // dot-namespaced, e.g. "conversion.created", "pii.unmask"
  resourceType: string;
  resourceId: string;
  beforeJson?: unknown;
  afterJson?: unknown;
  metadata?: Record<string, unknown>;
}

export interface AuditEventPublic {
  id: string;
  ulid: string;
  orgId: string | null;
  regionCode: RegionCode;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  beforeJson: unknown;
  afterJson: unknown;
  metadata: Record<string, unknown>;
  prevHash: string;
  rowHash: string;
  occurredAt: string;
}

export const AuditService = {
  /**
   * Append a new audit row inside the caller's TX. Returns the public shape
   * for callers that want to log/echo the ulid.
   *
   * Chain scope: per `orgId` when present, else per `regionCode` with
   * `orgId IS NULL` (i.e. platform-level events).
   */
  async recordEvent(
    tx: Prisma.TransactionClient,
    input: AuditEventInput,
  ): Promise<AuditEventPublic> {
    const ulid = newId('aud');
    const occurredAt = new Date();

    const last = await tx.auditEvent.findFirst({
      where: input.orgId ? { orgId: input.orgId } : { orgId: null, regionCode: input.regionCode },
      orderBy: { id: 'desc' },
      select: { rowHash: true },
    });
    const prevHash = last?.rowHash ?? GENESIS_PREV_HASH;

    // Canonical metadata MUST be a stable shape — we persist `{}` to the
    // DB when none provided, so the hash must compute over `{}` (not null)
    // or the verifier won't recompute the same hash.
    const canonicalMetadata = input.metadata ?? {};
    const forHash: AuditEventForHash = {
      id: ulid,
      orgId: input.orgId ?? null,
      regionCode: input.regionCode,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      beforeJson: input.beforeJson ?? null,
      afterJson: input.afterJson ?? null,
      metadata: canonicalMetadata,
      occurredAt: occurredAt.toISOString(),
    };
    const rowHash = computeRowHash(prevHash, forHash, env().AUDIT_CHAIN_SECRET);

    const row = await tx.auditEvent.create({
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
          input.afterJson !== undefined
            ? (input.afterJson as Prisma.InputJsonValue)
            : Prisma.DbNull,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        prevHash,
        rowHash,
        occurredAt,
      },
    });

    return toPublic(row);
  },

  /**
   * Replay the entire chain for (orgId, regionCode) and check every row's
   * stored `rowHash` against a recomputation. Optionally bounded by
   * `from`/`to` ulid for incremental verification.
   *
   * Returns either `{ ok: true, count }` or
   * `{ ok: false, brokenAt: ulid, expected, actual, count }` where `count`
   * is the number of rows inspected.
   */
  async verifyChain(args: {
    orgId: string | null;
    regionCode: RegionCode;
    fromUlid?: string;
    toUlid?: string;
  }): Promise<
    | { ok: true; count: number }
    | { ok: false; brokenAt: string; count: number; expected: string; actual: string }
  > {
    const where: Prisma.AuditEventWhereInput = args.orgId
      ? { orgId: args.orgId }
      : { orgId: null, regionCode: args.regionCode };

    const ulidRange: Prisma.StringFilter = {};
    if (args.fromUlid) ulidRange.gte = args.fromUlid;
    if (args.toUlid) ulidRange.lte = args.toUlid;
    if (Object.keys(ulidRange).length > 0) {
      where.ulid = ulidRange;
    }

    // An org chain reads through the belt (`tenantPrismaTx` pins the GUC, RLS
    // enforces); the platform chain (`orgId IS NULL`) is owner-only — RLS hides
    // NULL-org rows from ANY GUC'd role, so only a worker/cron on the owner
    // connection can verify it. The request path (`POST /audit/events/verify`)
    // always passes a concrete actor orgId; see docs/runbooks/rls-cutover.md §4b.
    const rows = args.orgId
      ? await tenantPrismaTx(args.orgId).auditEvent.findMany({ where, orderBy: { id: 'asc' } })
      : await prisma().auditEvent.findMany({ where, orderBy: { id: 'asc' } });

    // SEC-002 fix: thread `expectedPrev` forward from the actual previous
    // row's `rowHash` rather than trusting each row's own self-declared
    // `prevHash`. Without this, a tamperer who rewrites both `action` AND
    // `prevHash` to a consistent recomputation would slip past the check.
    //
    // For an unbounded range the anchor is genesis. When `fromUlid` skips
    // ahead in the chain we must fetch the row immediately preceding the
    // first selected row so the walk has a real anchor.
    let expectedPrev: string = GENESIS_PREV_HASH;
    if (args.fromUlid && rows.length > 0) {
      const anchorWhere: Prisma.AuditEventWhereInput = { ...where, ulid: { lt: rows[0]!.ulid } };
      const anchor = args.orgId
        ? await tenantPrismaTx(args.orgId).auditEvent.findFirst({
            where: anchorWhere,
            orderBy: { id: 'desc' },
            select: { rowHash: true },
          })
        : await prisma().auditEvent.findFirst({
            where: anchorWhere,
            orderBy: { id: 'desc' },
            select: { rowHash: true },
          });
      if (anchor) expectedPrev = anchor.rowHash;
    }

    const secret = env().AUDIT_CHAIN_SECRET;
    let count = 0;
    for (const row of rows) {
      count++;
      const forHash: AuditEventForHash = {
        id: row.ulid,
        orgId: row.orgId,
        regionCode: row.regionCode,
        actorUserId: row.actorUserId,
        action: row.action,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        beforeJson: row.beforeJson ?? null,
        afterJson: row.afterJson ?? null,
        // The writer canonicalizes metadata as `{}` when absent — keep
        // the same shape here so the hash matches.
        metadata: row.metadata ?? {},
        occurredAt: row.occurredAt.toISOString(),
      };
      // Two-level integrity check:
      //   1. The stored `prevHash` must equal the threaded `expectedPrev`
      //      (catches tampering of `prevHash` alongside other fields).
      //   2. The recomputed `rowHash` (using the threaded value, not the
      //      stored one) must equal the stored `rowHash`.
      const expected = computeRowHash(expectedPrev, forHash, secret);
      if (row.prevHash !== expectedPrev || expected !== row.rowHash) {
        return {
          ok: false,
          brokenAt: row.ulid,
          count,
          expected,
          actual: row.rowHash,
        };
      }
      expectedPrev = row.rowHash;
    }
    return { ok: true, count };
  },

  /**
   * Cursor-paginated listing of audit rows for an org. Filters narrow by
   * actor, resource, action, and time window.
   */
  async listEvents(args: {
    orgId: string;
    regionCode: RegionCode;
    actorUserId?: string;
    resourceType?: string;
    resourceId?: string;
    action?: string;
    from?: Date;
    to?: Date;
    cursor?: string;
    limit: number;
  }): Promise<{ data: AuditEventPublic[]; nextCursor: string | null }> {
    // orgId is injected by tenantPrismaTx (suspenders) and enforced by RLS
    // (belt); see docs/runbooks/rls-cutover.md §4b. regionCode stays an explicit
    // filter (an org is region-pinned, so it's a no-op narrowing, kept for parity).
    const where: Prisma.AuditEventWhereInput = {
      regionCode: args.regionCode,
    };
    if (args.actorUserId) where.actorUserId = args.actorUserId;
    if (args.resourceType) where.resourceType = args.resourceType;
    if (args.resourceId) where.resourceId = args.resourceId;
    if (args.action) where.action = args.action;
    if (args.from || args.to) {
      const range: Prisma.DateTimeFilter = {};
      if (args.from) range.gte = args.from;
      if (args.to) range.lte = args.to;
      where.occurredAt = range;
    }

    const rows = await tenantPrismaTx(args.orgId).auditEvent.findMany({
      where,
      take: args.limit + 1,
      ...(args.cursor && { cursor: { ulid: args.cursor }, skip: 1 }),
      orderBy: { id: 'asc' },
    });
    const hasMore = rows.length > args.limit;
    const slice = hasMore ? rows.slice(0, args.limit) : rows;
    const nextCursor = hasMore ? (slice[slice.length - 1]?.ulid ?? null) : null;
    return { data: slice.map(toPublic), nextCursor };
  },
};

// ───────────────────────────────────────────────────────────────────────────
// Mapper
// ───────────────────────────────────────────────────────────────────────────

function toPublic(r: {
  id: bigint;
  ulid: string;
  orgId: string | null;
  regionCode: RegionCode;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  beforeJson: Prisma.JsonValue;
  afterJson: Prisma.JsonValue;
  metadata: Prisma.JsonValue;
  prevHash: string;
  rowHash: string;
  occurredAt: Date;
}): AuditEventPublic {
  return {
    // Surface the bigint primary key as a string for JSON safety,
    // but the ulid is the preferred external identifier.
    id: r.id.toString(),
    ulid: r.ulid,
    orgId: r.orgId,
    regionCode: r.regionCode,
    actorUserId: r.actorUserId,
    action: r.action,
    resourceType: r.resourceType,
    resourceId: r.resourceId,
    beforeJson: r.beforeJson ?? null,
    afterJson: r.afterJson ?? null,
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
    prevHash: r.prevHash,
    rowHash: r.rowHash,
    occurredAt: r.occurredAt.toISOString(),
  };
}
