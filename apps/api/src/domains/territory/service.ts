/**
 * Territory service — create / list / read / patch / assign / heatmap.
 *
 * PostGIS is not yet on the dev DB. Polygons travel + persist as WKT text;
 * centroid is computed by averaging the ring vertices (Phase 1.1 placeholder).
 * `s2CellIds` is filled by a stub derived from the centroid — full S2
 * covering lands in Phase 1.2 once `@radarlabs/s2` is wired up.
 *
 * Every mutation writes an AuditEvent in the same TX, scoped to the actor's
 * org. Org-scoped reads run through `tenantPrismaTx(actor.orgId)` — the §4b
 * RLS-belt read path: each op executes in its own GUC-pinned transaction so
 * Postgres RLS enforces tenant isolation under the non-owner `d2d_app` role,
 * and the app-layer `$extends` injector AND-injects `where: { orgId }` as the
 * suspenders. Cross-tenant single-resource reads therefore return null →
 * 404 (existence withheld), NOT 403 — see getTerritory. Reads of models
 * without an `orgId` column (TerritoryAssignment) ride their parent's
 * visibility and stay on the plain `prisma()` connection.
 */
import type { RegionCode, Prisma, Vertical } from '@prisma/client';
import { newId, Problems, ProblemError } from '@d2d/shared-utils';
import { prisma, tenantTx, tenantPrismaTx } from '../../config/db';
import { writeAudit } from '../../shared/audit/write';
import type {
  CreateTerritoryRequest,
  UpdateTerritoryRequest,
  ListTerritoriesQuery,
  CreateAssignmentRequest,
  HeatmapQuery,
} from './schemas';

interface ActorContext {
  userId: string;
  orgId: string;
  regionCode: RegionCode;
}

export interface TerritoryPublic {
  id: string;
  orgId: string;
  regionCode: RegionCode;
  brandCode: string;
  name: string;
  vertical: Vertical;
  polygonWkt: string | null;
  centroid: { lng: number; lat: number } | null;
  s2CellIds: string[];
  campaignId: string | null;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AssignmentPublic {
  id: string;
  territoryId: string;
  userId: string;
  assignedAt: string;
  expiresAt: string | null;
}

export interface TerritoryWithAssignments extends TerritoryPublic {
  assignments: AssignmentPublic[];
}

// ───────────────────────────────────────────────────────────────────────────
// WKT helpers (no PostGIS — keep math in app code)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Parse a 2D WKT POLYGON into `[lng, lat][]` for the outer ring.
 * Strict-ish: rejects non-numeric vertices, fewer-than-4 vertices, and
 * rings whose first vertex doesn't equal the last (= closed).
 */
export function parseWktPolygon(wkt: string): Array<[number, number]> {
  const m = /^POLYGON\s*\(\((.+)\)\)\s*$/i.exec(wkt.trim());
  if (!m) {
    throw new ProblemError(Problems.validation('Polygon must be a single-ring WKT POLYGON'));
  }
  const vertices = m[1]!
    .split(',')
    .map((s) => s.trim())
    .map((pair) => {
      const parts = pair.split(/\s+/);
      if (parts.length !== 2) {
        throw new ProblemError(Problems.validation('Polygon vertex must be "lng lat"'));
      }
      const lng = Number(parts[0]);
      const lat = Number(parts[1]);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        throw new ProblemError(Problems.validation('Polygon vertex must be finite numbers'));
      }
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        throw new ProblemError(Problems.validation('Polygon vertex out of WGS84 range'));
      }
      return [lng, lat] as [number, number];
    });
  if (vertices.length < 4) {
    throw new ProblemError(Problems.validation('Polygon ring needs ≥4 vertices (closed)'));
  }
  const first = vertices[0]!;
  const last = vertices[vertices.length - 1]!;
  if (first[0] !== last[0] || first[1] !== last[1]) {
    throw new ProblemError(Problems.validation('Polygon ring must close (first == last vertex)'));
  }
  return vertices;
}

/** Arithmetic mean of the unique ring vertices (skip duplicate close). */
export function centroidOf(ring: Array<[number, number]>): { lng: number; lat: number } {
  const unique = ring.slice(0, ring.length - 1); // skip the close-vertex repeat
  let sumLng = 0;
  let sumLat = 0;
  for (const [lng, lat] of unique) {
    sumLng += lng;
    sumLat += lat;
  }
  return { lng: sumLng / unique.length, lat: sumLat / unique.length };
}

/**
 * Stub S2 covering — Phase 1.2 will swap to `@radarlabs/s2`'s level-13
 * `RegionCoverer`. For now we derive a single deterministic cell ID from
 * the centroid's bucketed lng/lat so the field is non-empty and
 * downstream callers (`packages/services/mapping`) can treat the column
 * as authoritative.
 */
export function stubS2Covering(centroid: { lng: number; lat: number }): string[] {
  const bucket = (n: number): number => Math.round(n * 1e4) / 1e4;
  const tag = `S2L13_${bucket(centroid.lng)}_${bucket(centroid.lat)}`;
  return [tag];
}

function toCentroid(s: string | null): { lng: number; lat: number } | null {
  if (!s) return null;
  // Stored as "lng lat" — same convention as WKT POINT body, but plain.
  const parts = s.split(/\s+/);
  if (parts.length !== 2) return null;
  const lng = Number(parts[0]);
  const lat = Number(parts[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return { lng, lat };
}

// ───────────────────────────────────────────────────────────────────────────
// CRUD
// ───────────────────────────────────────────────────────────────────────────

export async function createTerritory(
  input: CreateTerritoryRequest,
  actor: ActorContext,
): Promise<TerritoryPublic> {
  // Validate polygon up-front so we 400 before opening a TX.
  const ring = parseWktPolygon(input.polygonWkt);
  const centroid = centroidOf(ring);
  const s2 = stubS2Covering(centroid);

  if (input.campaignId) {
    // Belt: a cross-tenant campaignId is invisible under the GUC-pinned read,
    // so it collapses to null → 404, same as a genuinely missing campaign.
    const c = await tenantPrismaTx(actor.orgId).campaign.findUnique({
      where: { id: input.campaignId },
      select: { id: true },
    });
    if (!c) throw new ProblemError(Problems.notFound('Campaign', input.campaignId));
  }

  const id = newId('ter');
  const metadata = (input.metadata ?? {}) as Record<string, unknown>;

  const created = await tenantTx(actor.orgId, async (tx) => {
    const row = await tx.territory.create({
      data: {
        id,
        orgId: actor.orgId,
        regionCode: actor.regionCode,
        name: input.name,
        vertical: input.vertical,
        polygon: input.polygonWkt,
        centroid: `${centroid.lng} ${centroid.lat}`,
        s2CellIds: s2,
        campaignId: input.campaignId ?? null,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
    await writeAudit(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'territory.created',
      resourceType: 'Territory',
      resourceId: id,
      afterJson: {
        name: row.name,
        vertical: row.vertical,
        centroid: `${centroid.lng} ${centroid.lat}`,
        s2CellIds: s2,
        campaignId: row.campaignId,
      },
    });
    return row;
  });

  return toPublic(created);
}

export async function listTerritories(
  query: ListTerritoriesQuery,
  actor: ActorContext,
): Promise<{ data: TerritoryPublic[]; nextCursor: string | null }> {
  // orgId is supplied by the GUC + suspenders injector — filter on the rest.
  const where: Prisma.TerritoryWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.vertical) where.vertical = query.vertical;
  if (query.campaignId) where.campaignId = query.campaignId;

  const rows = await tenantPrismaTx(actor.orgId).territory.findMany({
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

export async function getTerritory(
  id: string,
  actor: ActorContext,
): Promise<TerritoryWithAssignments> {
  // A territory owned by another org is invisible under the GUC-pinned read,
  // so it resolves to null → 404. We deliberately do NOT 403 on a tenant
  // mismatch: withholding existence is the point of the RLS belt. The nested
  // assignments ride the parent territory's visibility (TerritoryAssignment
  // has no orgId of its own).
  const row = await tenantPrismaTx(actor.orgId).territory.findUnique({
    where: { id },
    include: { assignments: true },
  });
  if (!row) throw new ProblemError(Problems.notFound('Territory', id));
  return {
    ...toPublic(row),
    assignments: row.assignments.map(toAssignmentPublic),
  };
}

export async function updateTerritory(
  id: string,
  input: UpdateTerritoryRequest,
  actor: ActorContext,
): Promise<TerritoryPublic> {
  // Cross-tenant id → invisible under the belt → null → 404 (not 403).
  const existing = await tenantPrismaTx(actor.orgId).territory.findUnique({ where: { id } });
  if (!existing) throw new ProblemError(Problems.notFound('Territory', id));

  // The schema declares polygonWkt/centroid/s2CellIds as `never`, but
  // belt-and-suspenders: reject if the caller still slipped them in via
  // a non-strict client.
  if ((input as Record<string, unknown>).polygonWkt !== undefined) {
    throw new ProblemError({
      type: 'https://docs.d2d.io/problems/polygon-immutable',
      title: 'Polygon immutable',
      status: 400,
      detail: 'Polygon is locked at territory creation; re-create the territory to redraw',
    });
  }

  const updated = await tenantTx(actor.orgId, async (tx) => {
    const next = await tx.territory.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.metadata !== undefined && {
          metadata: input.metadata as Prisma.InputJsonValue,
        }),
      },
    });
    await writeAudit(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'territory.updated',
      resourceType: 'Territory',
      resourceId: id,
      beforeJson: subset(existing, Object.keys(input)),
      afterJson: subset(next, Object.keys(input)),
    });
    return next;
  });

  return toPublic(updated);
}

// ───────────────────────────────────────────────────────────────────────────
// Assignments
// ───────────────────────────────────────────────────────────────────────────

export async function addAssignment(
  territoryId: string,
  input: CreateAssignmentRequest,
  actor: ActorContext,
): Promise<AssignmentPublic> {
  const db = tenantPrismaTx(actor.orgId);
  // Cross-tenant territory → invisible → null → 404.
  const ter = await db.territory.findUnique({ where: { id: territoryId } });
  if (!ter) throw new ProblemError(Problems.notFound('Territory', territoryId));
  // A user from another org is invisible under the belt, so the lookup nulls
  // out — collapse "missing" and "cross-tenant" into one 400 validation
  // (body-reference, not a resource GET): you can't assign someone who isn't
  // in your org, and we don't disclose whether the id exists elsewhere.
  const u = await db.user.findUnique({
    where: { id: input.userId },
    select: { id: true },
  });
  if (!u) {
    throw new ProblemError(Problems.validation('User is not in this org'));
  }

  const id = newId('tas');
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;

  const created = await tenantTx(actor.orgId, async (tx) => {
    const row = await tx.territoryAssignment.create({
      data: {
        id,
        territoryId,
        userId: input.userId,
        expiresAt,
      },
    });
    await writeAudit(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'territoryAssignment.created',
      resourceType: 'TerritoryAssignment',
      resourceId: id,
      afterJson: { territoryId, userId: input.userId, expiresAt: expiresAt?.toISOString() ?? null },
    });
    return row;
  });
  return toAssignmentPublic(created);
}

export async function removeAssignment(
  territoryId: string,
  assignmentId: string,
  actor: ActorContext,
): Promise<AssignmentPublic> {
  // Belt-guard the parent territory first: a cross-tenant territoryId is
  // invisible → null → 404. The assignment row itself has no orgId, so it
  // rides the parent's visibility — once we've proven the territory is ours,
  // the plain-connection read below is safe (and we re-check territoryId).
  const ter = await tenantPrismaTx(actor.orgId).territory.findUnique({
    where: { id: territoryId },
  });
  if (!ter) throw new ProblemError(Problems.notFound('Territory', territoryId));
  const existing = await prisma().territoryAssignment.findUnique({ where: { id: assignmentId } });
  if (!existing || existing.territoryId !== territoryId) {
    throw new ProblemError(Problems.notFound('TerritoryAssignment', assignmentId));
  }

  const updated = await tenantTx(actor.orgId, async (tx) => {
    const row = await tx.territoryAssignment.update({
      where: { id: assignmentId },
      data: { expiresAt: new Date() },
    });
    await writeAudit(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'territoryAssignment.revoked',
      resourceType: 'TerritoryAssignment',
      resourceId: assignmentId,
      beforeJson: { expiresAt: existing.expiresAt?.toISOString() ?? null },
      afterJson: { expiresAt: row.expiresAt?.toISOString() ?? null },
    });
    return row;
  });
  return toAssignmentPublic(updated);
}

// ───────────────────────────────────────────────────────────────────────────
// Heatmap (stub aggregate — real cell-density compute lands in Phase 1.2)
// ───────────────────────────────────────────────────────────────────────────

export async function heatmap(
  query: HeatmapQuery,
  actor: ActorContext,
): Promise<{
  bbox: [number, number, number, number];
  layer: string;
  cells: Array<{ cellId: string; count: number; centroid: { lng: number; lat: number } }>;
  generatedAt: string;
}> {
  const [w, s, e, n] = query.bbox.split(',').map(Number) as [number, number, number, number];

  // TODO(Phase 1.2): replace with real S2 covering + Knock count aggregation.
  // For now return knocks-per-territory-centroid that fall inside the bbox
  // so the response shape is stable for the operator console.
  // orgId is supplied by the GUC + suspenders injector on both reads below;
  // the per-territory count runs as its own GUC-pinned tx (acceptable for the
  // stub aggregate — the Phase 1.2 rewrite collapses this to one query).
  const db = tenantPrismaTx(actor.orgId);
  const territories = await db.territory.findMany({
    where: { status: 'active' },
    select: { id: true, centroid: true, s2CellIds: true },
  });
  const cells: Array<{ cellId: string; count: number; centroid: { lng: number; lat: number } }> =
    [];
  for (const t of territories) {
    const c = toCentroid(t.centroid);
    if (!c) continue;
    if (c.lng < w || c.lng > e || c.lat < s || c.lat > n) continue;
    const count = await db.knock.count({
      where: { territoryId: t.id },
    });
    const cellId = t.s2CellIds[0] ?? `S2L13_${c.lng.toFixed(3)}_${c.lat.toFixed(3)}`;
    cells.push({ cellId, count, centroid: c });
  }

  return {
    bbox: [w, s, e, n],
    layer: 'knock-density',
    cells,
    generatedAt: new Date().toISOString(),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Mappers
// ───────────────────────────────────────────────────────────────────────────

function toPublic(t: {
  id: string;
  orgId: string;
  regionCode: RegionCode;
  brandCode: string;
  name: string;
  vertical: Vertical;
  polygon: string | null;
  centroid: string | null;
  s2CellIds: string[];
  campaignId: string | null;
  status: string;
  metadata: Prisma.JsonValue;
  createdAt: Date;
}): TerritoryPublic {
  return {
    id: t.id,
    orgId: t.orgId,
    regionCode: t.regionCode,
    brandCode: t.brandCode,
    name: t.name,
    vertical: t.vertical,
    polygonWkt: t.polygon,
    centroid: toCentroid(t.centroid),
    s2CellIds: t.s2CellIds,
    campaignId: t.campaignId,
    status: t.status,
    metadata: (t.metadata ?? {}) as Record<string, unknown>,
    createdAt: t.createdAt.toISOString(),
  };
}

function toAssignmentPublic(a: {
  id: string;
  territoryId: string;
  userId: string;
  assignedAt: Date;
  expiresAt: Date | null;
}): AssignmentPublic {
  return {
    id: a.id,
    territoryId: a.territoryId,
    userId: a.userId,
    assignedAt: a.assignedAt.toISOString(),
    expiresAt: a.expiresAt ? a.expiresAt.toISOString() : null,
  };
}

function subset<T extends Record<string, unknown>>(
  obj: T,
  keys: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (k in obj) {
      const v = obj[k];
      out[k] = typeof v === 'bigint' ? v.toString() : v;
    }
  }
  return out;
}
