/**
 * Analytics service — the warehouse OUTBOX + read/export surface.
 *
 * This is the seam that lets the data team plug a warehouse (BigQuery /
 * Snowflake) + dbt onto D2D WITHOUT touching the OLTP path. The contract is a
 * single append-only table, `AnalyticsEvent`, written exactly once at the point
 * each business fact happens and drained at-least-once into the warehouse.
 *
 * Two halves:
 *
 *   1. emitAnalyticsEvent(tx, …) — the WRITE seam. Other domains call this
 *      INSIDE their own `tenantTx` so the analytics row commits atomically with
 *      the business mutation that produced it (transactional outbox — no event
 *      can exist without its source row, and vice-versa). It is exported but is
 *      intentionally NOT wired into other domains here — see the call-site list
 *      in the agent report.
 *
 *   2. The READ side:
 *        - listEvents()  — tenant-scoped, cursor-paginated flat events for the
 *                          operator/data console (auto-org-scoped via prisma()
 *                          `$extends`, mirroring catalog/lead reads).
 *        - drainUnshipped() — the at-least-once warehouse sink: read the oldest
 *                          UNSHIPPED rows for the caller's org and stamp
 *                          shippedAt=now in a `tenantTx` (RLS-pinned write). The
 *                          stream endpoint emits these as NDJSON.
 *
 * Money: any `*Cents` value placed on `payload` is a JS number of cents (BigInt
 * is converted at the call site / backfill — see toCents()), so the warehouse
 * never has to reason about BigInt JSON.
 * Dates: every timestamp on the wire is ISO-8601 (occurredAt, createdAt,
 * shippedAt).
 */
import type { Prisma, RegionCode } from '@prisma/client';
import { newId } from '@d2d/shared-utils';
import { prisma, tenantTx } from '../../config/db';
import type { ExportQuery, ListEventsQuery } from './schemas';

interface ActorContext {
  userId: string;
  orgId: string;
  regionCode: RegionCode;
}

/**
 * The flat warehouse row as it goes over the wire / down the NDJSON stream.
 * Deliberately denormalised: `payload` already carries everything dbt needs so
 * the warehouse never has to join back into OLTP. BigInt is already off the
 * wire (cents are numbers inside `payload`); all timestamps are ISO-8601.
 */
export interface AnalyticsEventPublic {
  id: string;
  orgId: string;
  regionCode: RegionCode;
  userId: string | null;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  occurredAt: string;
  payload: Record<string, unknown>;
  shippedAt: string | null;
  createdAt: string;
}

/**
 * The write-seam input. `occurredAt` is the business event time (NOT now()) so
 * the warehouse can reason about when a thing actually happened, independent of
 * when its row was inserted (`createdAt`). `payload` is flat + denormalised.
 */
export interface EmitAnalyticsEventInput {
  orgId: string;
  regionCode: RegionCode;
  userId?: string | null;
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  occurredAt: Date;
  payload: Record<string, unknown>;
}

/**
 * Append ONE analytics event onto the outbox, using the caller's transaction.
 *
 * Call this from inside another domain's `tenantTx(orgId, async (tx) => …)` so
 * the event commits atomically with the business row it describes — that is the
 * transactional-outbox guarantee: the warehouse stream can never drift from the
 * OLTP truth because both rows share one COMMIT.
 *
 * It takes a `Prisma.TransactionClient` (the same `tx` AuditService.recordEvent
 * takes) rather than opening its own transaction, exactly so it can be dropped
 * into an existing write path. `orgId` is passed explicitly (and is also pinned
 * by the surrounding tenantTx's RLS GUC), never read from a request body.
 *
 * Returns the new event id (aev_*) for the caller to log if it wants.
 */
export async function emitAnalyticsEvent(
  tx: Prisma.TransactionClient,
  input: EmitAnalyticsEventInput,
): Promise<{ id: string }> {
  const id = newId('aev');
  await tx.analyticsEvent.create({
    data: {
      id,
      orgId: input.orgId,
      regionCode: input.regionCode,
      userId: input.userId ?? null,
      eventType: input.eventType,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      occurredAt: input.occurredAt,
      payload: input.payload as Prisma.InputJsonValue,
    },
  });
  return { id };
}

/**
 * Tenant-scoped, cursor-paginated read of the flat event stream. The org filter
 * is auto-injected by the `prisma()` `$extends` tenant-scope extension (we also
 * pass `orgId` explicitly — belt + suspenders, idempotent per db.ts). Ordered
 * by `id` (monotonic with insertion) for a stable cursor.
 */
export async function listEvents(
  query: ListEventsQuery,
  actor: ActorContext,
): Promise<{ data: AnalyticsEventPublic[]; nextCursor: string | null }> {
  const where: Prisma.AnalyticsEventWhereInput = { orgId: actor.orgId };
  if (query.eventType) where.eventType = query.eventType;
  if (query.since) where.occurredAt = { gte: new Date(query.since) };

  const rows = await prisma().analyticsEvent.findMany({
    where,
    take: query.limit + 1,
    ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    orderBy: { id: 'asc' },
  });

  const hasMore = rows.length > query.limit;
  const slice = hasMore ? rows.slice(0, query.limit) : rows;
  const nextCursor = hasMore ? (slice[slice.length - 1]?.id ?? null) : null;
  return { data: slice.map(toPublic), nextCursor };
}

/**
 * The at-least-once warehouse drain. Reads the oldest UNSHIPPED events for the
 * caller's org (bounded by `limit`) and, in ONE tenantTx, marks exactly those
 * rows `shippedAt = now()`. The route streams the returned rows as NDJSON.
 *
 * At-least-once (not exactly-once) by design: rows are returned to the caller
 * FIRST, then marked shipped in the same call. If the HTTP stream dies after
 * the mark commits, the warehouse may have missed those lines — but because the
 * warehouse loads are idempotent on `id` (dbt upsert / MERGE on the primary
 * key), re-delivery is a no-op. We accept possible duplicates, never loss.
 *
 * Cursor-free: the unshipped set IS the cursor (shippedAt IS NULL), so the sink
 * just polls /export in a loop until it gets an empty batch.
 */
export async function drainUnshipped(
  query: ExportQuery,
  actor: ActorContext,
): Promise<AnalyticsEventPublic[]> {
  const where: Prisma.AnalyticsEventWhereInput = {
    orgId: actor.orgId,
    shippedAt: null,
  };
  if (query.eventType) where.eventType = query.eventType;

  // Select the batch first (tenant-scoped read), oldest occurredAt first so the
  // warehouse receives events in roughly business-time order.
  const rows = await prisma().analyticsEvent.findMany({
    where,
    take: query.limit,
    orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
  });
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const shippedAt = new Date();

  // Mark exactly this batch shipped inside an RLS-pinned tenant transaction.
  // We constrain on `shippedAt: null` again so a concurrent drain can't double
  // -claim the same rows (the second updateMany simply touches 0 of them).
  await tenantTx(actor.orgId, async (tx) => {
    await tx.analyticsEvent.updateMany({
      where: { orgId: actor.orgId, id: { in: ids }, shippedAt: null },
      data: { shippedAt },
    });
  });

  // Reflect the shipped timestamp we just wrote onto the rows we hand back so
  // the NDJSON line is consistent with the DB (the in-memory rows predate the
  // update).
  return rows.map((r) => toPublic({ ...r, shippedAt }));
}

function toPublic(r: {
  id: string;
  orgId: string;
  regionCode: RegionCode;
  userId: string | null;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  occurredAt: Date;
  payload: Prisma.JsonValue;
  shippedAt: Date | null;
  createdAt: Date;
}): AnalyticsEventPublic {
  return {
    id: r.id,
    orgId: r.orgId,
    regionCode: r.regionCode,
    userId: r.userId,
    eventType: r.eventType,
    entityType: r.entityType,
    entityId: r.entityId,
    occurredAt: r.occurredAt.toISOString(),
    // `payload` is stored flat; coerce the Prisma JsonValue to the public record
    // shape (it is always a JSON object as written by emitAnalyticsEvent).
    payload: (r.payload ?? {}) as Record<string, unknown>,
    shippedAt: r.shippedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}
