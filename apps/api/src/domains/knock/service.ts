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
import type { RegionCode, Prisma, KnockDisposition } from '@prisma/client';
import { newId, Problems, ProblemError, addressHash } from '@d2d/shared-utils';
import { prisma } from '../../config/db';
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
  // Territory must belong to actor's org.
  const ter = await prisma().territory.findUnique({
    where: { id: input.territoryId },
    select: { orgId: true, status: true },
  });
  if (!ter) throw new ProblemError(Problems.notFound('Territory', input.territoryId));
  if (ter.orgId !== actor.orgId) {
    throw new ProblemError(Problems.tenantMismatch(ter.orgId));
  }
  if (ter.status !== 'active') {
    throw new ProblemError(Problems.conflict('Territory is not active'));
  }

  const id = newId('sess');
  const created = await prisma().knockSession.create({
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
  });
  return toSessionPublic(created);
}

export async function endSession(sessionId: string, actor: ActorContext): Promise<SessionPublic> {
  const existing = await prisma().knockSession.findUnique({ where: { id: sessionId } });
  if (!existing) throw new ProblemError(Problems.notFound('KnockSession', sessionId));
  if (existing.orgId !== actor.orgId) {
    throw new ProblemError(Problems.tenantMismatch(existing.orgId));
  }
  if (existing.endedAt) {
    return toSessionPublic(existing); // idempotent
  }
  const updated = await prisma().knockSession.update({
    where: { id: sessionId },
    data: { endedAt: new Date() },
  });
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
  // Dedupe by idempotencyKey (unique column).
  const dup = await prisma().knock.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (dup) {
    if (dup.orgId !== actor.orgId) {
      throw new ProblemError(Problems.idempotencyKeyReused());
    }
    return { knock: toKnockPublic(dup), deduped: true };
  }

  // Session must exist + belong to actor's org.
  const sess = await prisma().knockSession.findUnique({
    where: { id: input.sessionId },
    select: { orgId: true, userId: true, territoryId: true, regionCode: true },
  });
  if (!sess) throw new ProblemError(Problems.notFound('KnockSession', input.sessionId));
  if (sess.orgId !== actor.orgId) {
    throw new ProblemError(Problems.tenantMismatch(sess.orgId));
  }

  const territoryId = input.territoryId ?? sess.territoryId;
  if (input.territoryId && input.territoryId !== sess.territoryId) {
    // Verify the override still belongs to this org.
    const ter = await prisma().territory.findUnique({
      where: { id: input.territoryId },
      select: { orgId: true },
    });
    if (!ter || ter.orgId !== actor.orgId) {
      throw new ProblemError(Problems.notFound('Territory', input.territoryId));
    }
  }

  const capturedAt = new Date(input.capturedAt);
  const serverNow = new Date();
  const clientOffsetMs = serverNow.getTime() - capturedAt.getTime();
  const id = newId('knk');

  const result = await prisma().$transaction(async (tx) => {
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
  });

  return { knock: toKnockPublic(result), deduped: false };
}

// ───────────────────────────────────────────────────────────────────────────
// Batch
// ───────────────────────────────────────────────────────────────────────────

export async function createKnockBatch(
  knocks: CreateKnockRequest[],
  actor: ActorContext,
): Promise<BatchResult> {
  // In-batch duplicate detection by idempotencyKey.
  const seen = new Set<string>();
  const errors: BatchResult['errors'] = [];
  const dedupedInBatch = new Set<number>();
  for (let i = 0; i < knocks.length; i++) {
    const k = knocks[i]!;
    if (seen.has(k.idempotencyKey)) {
      dedupedInBatch.add(i);
    } else {
      seen.add(k.idempotencyKey);
    }
  }

  // Pre-fetch existing rows for the batch's keys so we can short-circuit.
  const existingRows = await prisma().knock.findMany({
    where: { idempotencyKey: { in: Array.from(seen) } },
    select: { id: true, idempotencyKey: true, orgId: true },
  });
  const existingByKey = new Map<string, { id: string; orgId: string }>();
  for (const r of existingRows) {
    existingByKey.set(r.idempotencyKey, { id: r.id, orgId: r.orgId });
  }

  const out: KnockPublic[] = [];
  let inserted = 0;
  let deduped = 0;

  for (let i = 0; i < knocks.length; i++) {
    const k = knocks[i]!;
    if (dedupedInBatch.has(i)) {
      deduped += 1;
      continue;
    }
    const hit = existingByKey.get(k.idempotencyKey);
    if (hit) {
      if (hit.orgId !== actor.orgId) {
        errors.push({
          index: i,
          idempotencyKey: k.idempotencyKey,
          message: 'idempotency key reused by another org',
        });
      } else {
        deduped += 1;
      }
      continue;
    }
    try {
      const r = await createKnock(k, actor);
      if (r.deduped) {
        deduped += 1;
      } else {
        inserted += 1;
        out.push(r.knock);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      errors.push({ index: i, idempotencyKey: k.idempotencyKey, message: msg });
    }
  }
  return { inserted, deduped, errors, knocks: out };
}

// ───────────────────────────────────────────────────────────────────────────
// Read
// ───────────────────────────────────────────────────────────────────────────

export async function listKnocks(
  query: ListKnocksQuery,
  actor: ActorContext,
): Promise<{ data: KnockPublic[]; nextCursor: string | null }> {
  const where: Prisma.KnockWhereInput = { orgId: actor.orgId };
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

  const rows = await prisma().knock.findMany({
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
  const row = await prisma().knock.findUnique({ where: { id } });
  if (!row) throw new ProblemError(Problems.notFound('Knock', id));
  if (row.orgId !== actor.orgId) {
    throw new ProblemError(Problems.tenantMismatch(row.orgId));
  }
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
