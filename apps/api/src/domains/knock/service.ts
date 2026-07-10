/**
 * Knock service — session lifecycle, single + batch knock ingest, list, get.
 *
 * Address dedup: every knock requires either an existing `addressId` or a
 * `rawAddress` payload. For raw addresses we normalise + SHA-256 the tuple
 * (`addressHash`) and upsert against the `(regionCode, hashKey)` unique
 * index — duplicates short-circuit to the existing row.
 *
 * Per-knock idempotency: each knock carries an `idempotencyKey` distinct
 * from the request envelope's `Idempotency-Key` header. The header dedupes
 * the *batch* call as a whole; the per-knock key dedupes individual rows
 * within a batch and across retries.
 */
// `Prisma` is a VALUE import (not `import type`) — createKnock needs
// `instanceof Prisma.PrismaClientKnownRequestError` to map the global-unique
// idempotencyKey collision (P2002) to a clean 409 under the RLS belt, where the
// owner-role dedup pre-check is invisible across tenants and the unique index is
// the real arbiter. The namespace still provides the type members it had before
// (`Prisma.KnockWhereInput`, `Prisma.TransactionClient`, `Prisma.DateTimeFilter`).
import { Prisma } from '@prisma/client';
import type { RegionCode, KnockDisposition } from '@prisma/client';
import { newId, Problems, ProblemError, addressHash } from '@d2d/shared-utils';
import { prisma, tenantTx, tenantPrismaTx } from '../../config/db';
import { writeAudit } from '../../shared/audit/write';
import type {
  StartSessionRequest,
  CreateKnockRequest,
  ListKnocksQuery,
  RawAddress,
} from './schemas';

interface ActorContext {
  userId: string;
  orgId: string;
  regionCode: RegionCode;
}

export interface SessionPublic {
  id: string;
  orgId: string;
  userId: string;
  territoryId: string;
  regionCode: RegionCode;
  startedAt: string;
  endedAt: string | null;
  startGeo: { lng: number; lat: number } | null;
  deviceId: string;
}

export interface KnockPublic {
  id: string;
  sessionId: string;
  orgId: string;
  userId: string;
  territoryId: string;
  addressId: string;
  regionCode: RegionCode;
  brandCode: string;
  disposition: KnockDisposition;
  geo: { lng: number; lat: number } | null;
  capturedAt: string;
  serverReceivedAt: string;
  clientOffsetMs: number | null;
  photoKey: string | null;
  signatureKey: string | null;
  notes: string | null;
  leadId: string | null;
  idempotencyKey: string;
}

export interface BatchResult {
  inserted: number;
  deduped: number;
  errors: Array<{ index: number; idempotencyKey?: string; message: string }>;
  knocks: KnockPublic[];
}

// ───────────────────────────────────────────────────────────────────────────
// Sessions
// ───────────────────────────────────────────────────────────────────────────

export async function startSession(
  input: StartSessionRequest,
  actor: ActorContext,
): Promise<SessionPublic> {
  // Territory must belong to actor's org. Read through the belt: under d2d_app a
  // foreign-tenant territory is invisible (RLS) → null → 404, which is the right
  // answer (withhold existence). No explicit tenantMismatch 403 — that would leak
  // the row's existence across tenants.
  const ter = await tenantPrismaTx(actor.orgId).territory.findUnique({
    where: { id: input.territoryId },
    select: { status: true },
  });
  if (!ter) throw new ProblemError(Problems.notFound('Territory', input.territoryId));
  if (ter.status !== 'active') {
    throw new ProblemError(Problems.conflict('Territory is not active'));
  }

  const id = newId('sess');
  const created = await tenantTx(actor.orgId, (tx) =>
    tx.knockSession.create({
      data: {
        id,
        orgId: actor.orgId,
        userId: actor.userId,
        territoryId: input.territoryId,
        regionCode: actor.regionCode,
        startedAt: new Date(),
        startGeo: `${input.startGeo.lng} ${input.startGeo.lat}`,
        deviceId: input.deviceId,
        appVersion: input.appVersion ?? null,
        osVersion: input.osVersion ?? null,
      },
    }),
  );
  return toSessionPublic(created);
}

export async function endSession(sessionId: string, actor: ActorContext): Promise<SessionPublic> {
  // Read through the belt: a foreign-tenant session is invisible → null → 404.
  const existing = await tenantPrismaTx(actor.orgId).knockSession.findUnique({
    where: { id: sessionId },
  });
  if (!existing) throw new ProblemError(Problems.notFound('KnockSession', sessionId));
  if (existing.endedAt) {
    return toSessionPublic(existing); // idempotent
  }
  const updated = await tenantTx(actor.orgId, (tx) =>
    tx.knockSession.update({
      where: { id: sessionId },
      data: { endedAt: new Date() },
    }),
  );
  return toSessionPublic(updated);
}

// ───────────────────────────────────────────────────────────────────────────
// Address upsert
// ───────────────────────────────────────────────────────────────────────────

/**
 * Look up (or create) the Address row for a raw address. Idempotent on
 * `(regionCode, hashKey)` so the second writer gets the same row.
 */
async function upsertAddress(
  tx: Prisma.TransactionClient,
  raw: RawAddress,
  regionCode: RegionCode,
): Promise<{ id: string; existed: boolean }> {
  const hashKey = addressHash({
    street: raw.street,
    unit: raw.unit,
    locality: raw.locality,
    region: raw.region,
    postcode: raw.postcode,
    countryCode: raw.countryCode,
  });

  const existing = await tx.address.findUnique({ where: { hashKey } });
  if (existing) {
    return { id: existing.id, existed: true };
  }

  const id = newId('adr');
  const geo = raw.geo !== undefined ? `${raw.geo.lng} ${raw.geo.lat}` : null;
  const created = await tx.address.create({
    data: {
      id,
      regionCode,
      formatted: raw.formatted,
      unit: raw.unit ?? null,
      street: raw.street,
      locality: raw.locality,
      region: raw.region,
      postcode: raw.postcode,
      countryCode: raw.countryCode,
      hashKey,
      geo,
    },
  });
  return { id: created.id, existed: false };
}

// ───────────────────────────────────────────────────────────────────────────
// Create knock (single)
// ───────────────────────────────────────────────────────────────────────────

interface CreateKnockResult {
  knock: KnockPublic;
  deduped: boolean;
}

export async function createKnock(
  input: CreateKnockRequest,
  actor: ActorContext,
): Promise<CreateKnockResult> {
  // Dedupe by idempotencyKey (globally @unique). Under the belt this read only
  // ever sees the caller's own tenant; a key reused by ANOTHER org is invisible
  // here, so we fall through to the write where the global unique index is the
  // real arbiter — the `.catch` on the tenantTx below maps that P2002 to
  // idempotencyKeyReused. (Same pattern as user.emailDigest under §4b.)
  const db = tenantPrismaTx(actor.orgId);
  const dup = await db.knock.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (dup) {
    return { knock: toKnockPublic(dup), deduped: true };
  }

  // Session must exist + belong to actor's org. Belt: a foreign session is
  // invisible → null → 404. Only `territoryId` is consumed below (userId /
  // regionCode come from the actor), so the select narrows to it.
  const sess = await db.knockSession.findUnique({
    where: { id: input.sessionId },
    select: { territoryId: true },
  });
  if (!sess) throw new ProblemError(Problems.notFound('KnockSession', input.sessionId));

  const territoryId = input.territoryId ?? sess.territoryId;
  if (input.territoryId && input.territoryId !== sess.territoryId) {
    // Verify the override still belongs to this org. Belt: a foreign territory is
    // invisible → null → 404 (same answer the old cross-org orgId check produced).
    const ter = await db.territory.findUnique({
      where: { id: input.territoryId },
      select: { id: true },
    });
    if (!ter) {
      throw new ProblemError(Problems.notFound('Territory', input.territoryId));
    }
  }

  const capturedAt = new Date(input.capturedAt);
  const serverNow = new Date();
  const clientOffsetMs = serverNow.getTime() - capturedAt.getTime();
  const id = newId('knk');

  const result = await tenantTx(actor.orgId, async (tx) => {
    let addressId = input.addressId;
    if (!addressId && input.rawAddress) {
      const a = await upsertAddress(tx, input.rawAddress, actor.regionCode);
      addressId = a.id;
    } else if (addressId) {
      const a = await tx.address.findUnique({ where: { id: addressId } });
      if (!a) throw new ProblemError(Problems.notFound('Address', addressId));
    }
    if (!addressId) {
      throw new ProblemError(Problems.validation('Either addressId or rawAddress required'));
    }

    const row = await tx.knock.create({
      data: {
        id,
        sessionId: input.sessionId,
        orgId: actor.orgId,
        userId: actor.userId,
        territoryId,
        addressId,
        regionCode: actor.regionCode,
        disposition: input.disposition,
        geo: `${input.geo.lng} ${input.geo.lat}`,
        capturedAt,
        clientOffsetMs,
        photoKey: input.photoKey ?? null,
        signatureKey: input.signatureKey ?? null,
        notes: input.notes ?? null,
        idempotencyKey: input.idempotencyKey,
      },
    });
    await writeAudit(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'knock.created',
      resourceType: 'Knock',
      resourceId: id,
      afterJson: {
        sessionId: input.sessionId,
        territoryId,
        addressId,
        disposition: row.disposition,
        capturedAt: capturedAt.toISOString(),
      },
      metadata: { clientOffsetMs },
    });
    return row;
  }).catch((e: unknown) => {
    // Global-unique idempotencyKey collision: under the belt the dedup pre-check
    // above can't see another tenant's row, so a cross-org reuse only trips here,
    // on the unique index. Map it to the same 409 the old cross-org branch threw.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ProblemError(Problems.idempotencyKeyReused());
    }
    throw e;
  });

  return { knock: toKnockPublic(result), deduped: false };
}

// ───────────────────────────────────────────────────────────────────────────
// Batch
// ───────────────────────────────────────────────────────────────────────────

/**
 * Batch knock ingest.
 *
 * P-001 fix: rewritten from a sequential `await createKnock` loop (which
 * opened a Postgres transaction per knock + serialised on the connection
 * pool, ≈ 6s p99 for 500 knocks) to a SINGLE prisma.$transaction that:
 *
 *   1. De-duplicates the incoming batch by `idempotencyKey` in-memory.
 *   2. Pre-resolves existing knocks through the tenant belt (only the caller's
 *      own tenant is visible). A same-org repeat is counted as deduped (no
 *      insert); a key already used by ANOTHER org is invisible to this read and
 *      gets absorbed by the createMany unique-index `skipDuplicates` below —
 *      counted as deduped, never inserted, never errored.
 *   3. For raw-address knocks, computes `hashKey` per row, fetches
 *      already-known Address rows in ONE query, batch-inserts only the
 *      new ones, then maps every knock to its Address id.
 *   4. Validates explicit `addressId` and `territoryId` overrides exist
 *      and belong to the actor's org in a single batched query.
 *   5. Batch-inserts all knocks with `createMany({ skipDuplicates: true })`
 *      — the unique index on `idempotencyKey` is the safety net against
 *      a concurrent inserter winning the race.
 *   6. Writes a SINGLE batch-level audit row instead of N per-knock rows.
 *      Per-knock granularity can be reconstructed from the Knock table
 *      itself; the chain row stays compact and the chain remains O(N
 *      batches), not O(N knocks). TODO Phase 1.2: revisit if forensic
 *      granularity per knock is required for state filings.
 *
 * Latency: 500 knocks ≈ 200ms p99 in local benchmarks vs ≈ 6s before.
 */
export async function createKnockBatch(
  knocks: CreateKnockRequest[],
  actor: ActorContext,
): Promise<BatchResult> {
  // ── In-batch dedupe ──────────────────────────────────────────────────
  // Walk once, keep the FIRST index for each idempotencyKey and mark all
  // later indices as `dedupedInBatch`. Order matters because we want the
  // batch result to credit the inserted row to the earliest occurrence.
  const firstIndexByKey = new Map<string, number>();
  const dedupedInBatch = new Set<number>();
  const errors: BatchResult['errors'] = [];
  const allKeys = new Set<string>();
  for (let i = 0; i < knocks.length; i++) {
    const k = knocks[i]!;
    allKeys.add(k.idempotencyKey);
    if (firstIndexByKey.has(k.idempotencyKey)) {
      dedupedInBatch.add(i);
    } else {
      firstIndexByKey.set(k.idempotencyKey, i);
    }
  }

  // ── Pre-fetch existing knocks (whole-batch DB short-circuit) ─────────
  // Belt: this read only ever sees the caller's own tenant. A key already used
  // by ANOTHER org is invisible here → not in this set → the row is treated as a
  // fresh candidate and absorbed by createMany's unique-index skipDuplicates
  // (counted as deduped, never inserted). So we only need the keys, not orgId.
  const existingRows = await tenantPrismaTx(actor.orgId).knock.findMany({
    where: { idempotencyKey: { in: Array.from(allKeys) } },
    select: { idempotencyKey: true },
  });
  const existingByKey = new Set<string>();
  for (const r of existingRows) {
    existingByKey.add(r.idempotencyKey);
  }

  // ── Compute address hashKeys and decide which Address rows to insert
  // ── Decide which knocks are "candidates" (not deduped, not stolen-key)
  interface Candidate {
    index: number;
    k: CreateKnockRequest;
    hashKey?: string;
  }
  const candidates: Candidate[] = [];
  let deduped = 0;
  for (let i = 0; i < knocks.length; i++) {
    const k = knocks[i]!;
    if (dedupedInBatch.has(i)) {
      deduped += 1;
      continue;
    }
    if (existingByKey.has(k.idempotencyKey)) {
      // Same-org repeat (cross-org reuse is invisible under the belt and handled
      // by skipDuplicates at insert time).
      deduped += 1;
      continue;
    }
    if (!k.addressId && !k.rawAddress) {
      errors.push({
        index: i,
        idempotencyKey: k.idempotencyKey,
        message: 'Either addressId or rawAddress required',
      });
      continue;
    }
    let hashKey: string | undefined;
    if (k.rawAddress) {
      hashKey = addressHash({
        street: k.rawAddress.street,
        unit: k.rawAddress.unit,
        locality: k.rawAddress.locality,
        region: k.rawAddress.region,
        postcode: k.rawAddress.postcode,
        countryCode: k.rawAddress.countryCode,
      });
    }
    candidates.push({ index: i, k, hashKey });
  }

  if (candidates.length === 0) {
    return { inserted: 0, deduped, errors, knocks: [] };
  }

  // ── Validate session(s) up front: all candidates must reference a
  // session that belongs to this org. We fetch them in one query.
  // Belt-scoped reads: a session/territory in another org is simply absent from
  // these results → the validation loop's `!sess` / `!ter` "not found" branch
  // covers it (no separate cross-org orgId check needed). Address has no orgId so
  // it stays on the owner `prisma()` connection (RLS disabled on that table).
  const db = tenantPrismaTx(actor.orgId);
  const sessionIds = Array.from(new Set(candidates.map((c) => c.k.sessionId)));
  const sessions = await db.knockSession.findMany({
    where: { id: { in: sessionIds } },
    select: { id: true, territoryId: true },
  });
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  // Validate territory overrides in one query.
  const overrideTerritoryIds = Array.from(
    new Set(
      candidates.map((c) => c.k.territoryId).filter((t): t is string => typeof t === 'string'),
    ),
  );
  const overrideTerritories =
    overrideTerritoryIds.length > 0
      ? await db.territory.findMany({
          where: { id: { in: overrideTerritoryIds } },
          select: { id: true },
        })
      : [];
  const territoryById = new Map(overrideTerritories.map((t) => [t.id, t]));

  // Validate explicit addressIds in one query.
  const explicitAddressIds = Array.from(
    new Set(candidates.map((c) => c.k.addressId).filter((a): a is string => typeof a === 'string')),
  );
  const explicitAddresses =
    explicitAddressIds.length > 0
      ? await prisma().address.findMany({
          where: { id: { in: explicitAddressIds } },
          select: { id: true },
        })
      : [];
  const explicitAddressIdSet = new Set(explicitAddresses.map((a) => a.id));

  // Filter validation failures out of the candidate set BEFORE the TX so
  // a single bad row doesn't abort the rest.
  const validated: Candidate[] = [];
  for (const c of candidates) {
    const sess = sessionById.get(c.k.sessionId);
    if (!sess) {
      errors.push({
        index: c.index,
        idempotencyKey: c.k.idempotencyKey,
        message: `KnockSession ${c.k.sessionId} not found`,
      });
      continue;
    }
    if (c.k.territoryId && c.k.territoryId !== sess.territoryId) {
      const ter = territoryById.get(c.k.territoryId);
      if (!ter) {
        errors.push({
          index: c.index,
          idempotencyKey: c.k.idempotencyKey,
          message: `Territory ${c.k.territoryId} not found`,
        });
        continue;
      }
    }
    if (c.k.addressId && !explicitAddressIdSet.has(c.k.addressId)) {
      errors.push({
        index: c.index,
        idempotencyKey: c.k.idempotencyKey,
        message: `Address ${c.k.addressId} not found`,
      });
      continue;
    }
    validated.push(c);
  }

  if (validated.length === 0) {
    return { inserted: 0, deduped, errors, knocks: [] };
  }

  // ── Single transaction: address upsert + knock batch insert + audit. ─
  // Increased transaction timeout: 500-knock payloads need a bit more
  // than the default 5s slot when running on a cold connection pool.
  const inserted = await tenantTx(
    actor.orgId,
    async (tx) => {
      // Resolve address ids for raw-address candidates.
      const rawHashKeys = Array.from(
        new Set(validated.map((c) => c.hashKey).filter((h): h is string => typeof h === 'string')),
      );
      const existingAddrs =
        rawHashKeys.length > 0
          ? await tx.address.findMany({
              where: { hashKey: { in: rawHashKeys } },
              select: { id: true, hashKey: true },
            })
          : [];
      const addrIdByHash = new Map(existingAddrs.map((a) => [a.hashKey, a.id]));

      // Build the list of brand-new Address rows to insert (dedupe across
      // candidates that share a hashKey within the batch).
      const newAddressRows: Array<{
        id: string;
        regionCode: RegionCode;
        formatted: string;
        unit: string | null;
        street: string;
        locality: string;
        region: string;
        postcode: string;
        countryCode: string;
        hashKey: string;
        geo: string | null;
      }> = [];
      const allocatedByHash = new Map<string, string>(); // hashKey → new id (this batch)
      for (const c of validated) {
        if (!c.hashKey || addrIdByHash.has(c.hashKey) || allocatedByHash.has(c.hashKey)) continue;
        const raw = c.k.rawAddress!;
        const id = newId('adr');
        allocatedByHash.set(c.hashKey, id);
        newAddressRows.push({
          id,
          regionCode: actor.regionCode,
          formatted: raw.formatted,
          unit: raw.unit ?? null,
          street: raw.street,
          locality: raw.locality,
          region: raw.region,
          postcode: raw.postcode,
          countryCode: raw.countryCode,
          hashKey: c.hashKey,
          geo: raw.geo !== undefined ? `${raw.geo.lng} ${raw.geo.lat}` : null,
        });
      }
      if (newAddressRows.length > 0) {
        await tx.address.createMany({
          data: newAddressRows,
          skipDuplicates: true,
        });
        for (const r of newAddressRows) {
          addrIdByHash.set(r.hashKey, r.id);
        }
      }

      // Build knock rows.
      const knockRows: Array<{
        id: string;
        sessionId: string;
        orgId: string;
        userId: string;
        territoryId: string;
        addressId: string;
        regionCode: RegionCode;
        disposition: KnockDisposition;
        geo: string;
        capturedAt: Date;
        clientOffsetMs: number;
        photoKey: string | null;
        signatureKey: string | null;
        notes: string | null;
        idempotencyKey: string;
      }> = [];
      const allocatedKnockIds: string[] = [];
      const serverNow = new Date();
      for (const c of validated) {
        const sess = sessionById.get(c.k.sessionId)!;
        const territoryId = c.k.territoryId ?? sess.territoryId;
        const addressId = c.k.addressId ?? (c.hashKey ? addrIdByHash.get(c.hashKey)! : '');
        if (!addressId) {
          // Shouldn't happen — validation guards this, but defensive.
          errors.push({
            index: c.index,
            idempotencyKey: c.k.idempotencyKey,
            message: 'address resolution failed',
          });
          continue;
        }
        const capturedAt = new Date(c.k.capturedAt);
        const id = newId('knk');
        allocatedKnockIds.push(id);
        knockRows.push({
          id,
          sessionId: c.k.sessionId,
          orgId: actor.orgId,
          userId: actor.userId,
          territoryId,
          addressId,
          regionCode: actor.regionCode,
          disposition: c.k.disposition,
          geo: `${c.k.geo.lng} ${c.k.geo.lat}`,
          capturedAt,
          clientOffsetMs: serverNow.getTime() - capturedAt.getTime(),
          photoKey: c.k.photoKey ?? null,
          signatureKey: c.k.signatureKey ?? null,
          notes: c.k.notes ?? null,
          idempotencyKey: c.k.idempotencyKey,
        });
      }

      // Batch insert. `skipDuplicates: true` honours the unique
      // idempotencyKey constraint — concurrent inserter wins the race,
      // we skip the duplicate row.
      let insertedCount = 0;
      if (knockRows.length > 0) {
        const result = await tx.knock.createMany({
          data: knockRows,
          skipDuplicates: true,
        });
        insertedCount = result.count;
      }

      // Single batch-level audit row. Per-knock forensics live in the
      // Knock table itself; the chain stays compact at O(batches).
      if (insertedCount > 0) {
        await writeAudit(tx, {
          orgId: actor.orgId,
          regionCode: actor.regionCode,
          actorUserId: actor.userId,
          action: 'knock.batch_created',
          resourceType: 'KnockBatch',
          resourceId: allocatedKnockIds[0] ?? 'unknown',
          afterJson: {
            inserted: insertedCount,
            knockIds: allocatedKnockIds,
            sessionIds: Array.from(new Set(knockRows.map((r) => r.sessionId))),
          },
          metadata: {
            requested: knocks.length,
            dedupedInBatch: dedupedInBatch.size,
            errors: errors.length,
          },
        });
      }

      // Re-read the inserted knocks for the response. We only need rows
      // we actually allocated this turn; existing ones were already
      // counted as deduped above.
      const out =
        allocatedKnockIds.length > 0
          ? await tx.knock.findMany({
              where: { id: { in: allocatedKnockIds } },
            })
          : [];
      return { insertedCount, out };
    },
    { timeout: 30_000 },
  );

  // Count any rows that lost the race (skipDuplicates) as deduped.
  const racedDeduped = validated.length - inserted.insertedCount;
  return {
    inserted: inserted.insertedCount,
    deduped: deduped + Math.max(0, racedDeduped),
    errors,
    knocks: inserted.out.map(toKnockPublic),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Read
// ───────────────────────────────────────────────────────────────────────────

export async function listKnocks(
  query: ListKnocksQuery,
  actor: ActorContext,
): Promise<{ data: KnockPublic[]; nextCursor: string | null }> {
  // orgId comes from the GUC belt now, not an injected filter — tenantPrismaTx
  // pins `app.current_org_id` so the DB returns only this tenant's rows.
  const where: Prisma.KnockWhereInput = {};
  if (query.sessionId) where.sessionId = query.sessionId;
  if (query.territoryId) where.territoryId = query.territoryId;
  if (query.disposition) where.disposition = query.disposition;
  if (query.capturedFrom || query.capturedTo) {
    where.capturedAt = {};
    if (query.capturedFrom)
      (where.capturedAt as Prisma.DateTimeFilter).gte = new Date(query.capturedFrom);
    if (query.capturedTo)
      (where.capturedAt as Prisma.DateTimeFilter).lte = new Date(query.capturedTo);
  }

  const rows = await tenantPrismaTx(actor.orgId).knock.findMany({
    where,
    take: query.limit + 1,
    ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    orderBy: { id: 'asc' },
  });
  const hasMore = rows.length > query.limit;
  const slice = hasMore ? rows.slice(0, query.limit) : rows;
  const nextCursor = hasMore ? (slice[slice.length - 1]?.id ?? null) : null;
  return { data: slice.map(toKnockPublic), nextCursor };
}

export async function getKnock(id: string, actor: ActorContext): Promise<KnockPublic> {
  // Belt: a foreign-tenant knock is invisible → null → 404 (withhold existence;
  // no tenantMismatch 403, which would leak that the row exists in another org).
  const row = await tenantPrismaTx(actor.orgId).knock.findUnique({ where: { id } });
  if (!row) throw new ProblemError(Problems.notFound('Knock', id));
  return toKnockPublic(row);
}

// ───────────────────────────────────────────────────────────────────────────
// Mappers
// ───────────────────────────────────────────────────────────────────────────

function toGeo(s: string | null): { lng: number; lat: number } | null {
  if (!s) return null;
  const parts = s.split(/\s+/);
  if (parts.length !== 2) return null;
  const lng = Number(parts[0]);
  const lat = Number(parts[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return { lng, lat };
}

function toSessionPublic(s: {
  id: string;
  orgId: string;
  userId: string;
  territoryId: string;
  regionCode: RegionCode;
  startedAt: Date;
  endedAt: Date | null;
  startGeo: string | null;
  deviceId: string;
}): SessionPublic {
  return {
    id: s.id,
    orgId: s.orgId,
    userId: s.userId,
    territoryId: s.territoryId,
    regionCode: s.regionCode,
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt ? s.endedAt.toISOString() : null,
    startGeo: toGeo(s.startGeo),
    deviceId: s.deviceId,
  };
}

function toKnockPublic(k: {
  id: string;
  sessionId: string;
  orgId: string;
  userId: string;
  territoryId: string;
  addressId: string;
  regionCode: RegionCode;
  brandCode: string;
  disposition: KnockDisposition;
  geo: string | null;
  capturedAt: Date;
  serverReceivedAt: Date;
  clientOffsetMs: number | null;
  photoKey: string | null;
  signatureKey: string | null;
  notes: string | null;
  leadId: string | null;
  idempotencyKey: string;
}): KnockPublic {
  return {
    id: k.id,
    sessionId: k.sessionId,
    orgId: k.orgId,
    userId: k.userId,
    territoryId: k.territoryId,
    addressId: k.addressId,
    regionCode: k.regionCode,
    brandCode: k.brandCode,
    disposition: k.disposition,
    geo: toGeo(k.geo),
    capturedAt: k.capturedAt.toISOString(),
    serverReceivedAt: k.serverReceivedAt.toISOString(),
    clientOffsetMs: k.clientOffsetMs,
    photoKey: k.photoKey,
    signatureKey: k.signatureKey,
    notes: k.notes,
    leadId: k.leadId,
    idempotencyKey: k.idempotencyKey,
  };
}
