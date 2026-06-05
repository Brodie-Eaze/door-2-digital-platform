/**
 * Territory service — create / list / read / patch / assign / heatmap.
 *
 * PostGIS is not yet on the dev DB. Polygons travel + persist as WKT text;
 * centroid is computed by averaging the ring vertices (Phase 1.1 placeholder).
 * `s2CellIds` is filled by a stub derived from the centroid — full S2
 * covering lands in Phase 1.2 once `@radarlabs/s2` is wired up.
 *
 * Every mutation writes an AuditEvent in the same TX, scoped to the actor's
 * org. Reads are tenant-guarded — Phase 1.2's Prisma `$extends` injector
 * will replace the explicit `where: { orgId }` filters, but for now we set
 * them by hand.
 */
import type { RegionCode, Prisma, Vertical } from '@prisma/client';
import { newId, Problems, ProblemError } from '@d2d/shared-utils';
import { prisma } from '../../config/db';
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
    const c = await prisma().campaign.findUnique({
      where: { id: input.campaignId },
      select: { orgId: true },
    });
    if (!c) throw new ProblemError(Problems.notFound('Campaign', input.campaignId));
    if (c.orgId !== actor.orgId) {
      throw new ProblemError(Problems.tenantMismatch(c.orgId));
    }
  }

  const id = newId('ter');
  const metadata = (input.metadata ?? {}) as Record<string, unknown>;

  const created = await prisma().$transaction(async (tx) => {
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
  const where: Prisma.TerritoryWhereInput = { orgId: actor.orgId };
  if (query.status) where.status = query.status;
  if (query.vertical) where.vertical = query.vertical;
  if (query.campaignId) where.campaignId = query.campaignId;

  const rows = await prisma().territory.findMany({
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
  const row = await prisma().territory.findUnique({
    where: { id },
    include: { assignments: true },
  });
  if (!row) throw new ProblemError(Problems.notFound('Territory', id));
  if (row.orgId !== actor.orgId) {
    throw new ProblemError(Problems.tenantMismatch(row.orgId));
  }
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
  const existing = await prisma().territory.findUnique({ where: { id } });
  if (!existing) throw new ProblemError(Problems.notFound('Territory', id));
  if (existing.orgId !== actor.orgId) {
    throw new ProblemError(Problems.tenantMismatch(existing.orgId));
  }

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

  const updated = await prisma().$transaction(async (tx) => {
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
  const ter = await prisma().territory.findUnique({ where: { id: territoryId } });
  if (!ter) throw new ProblemError(Problems.notFound('Territory', territoryId));
  if (ter.orgId !== actor.orgId) {
    throw new ProblemError(Problems.tenantMismatch(ter.orgId));
  }
  const u = await prisma().user.findUnique({
    where: { id: input.userId },
    select: { orgId: true, status: true },
  });
  if (!u) throw new ProblemError(Problems.notFound('User', input.userId));
  if (u.orgId !== actor.orgId) {
    throw new ProblemError(Problems.validation('User is not in this org'));
  }

  const id = newId('tas');
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;

  const created = await prisma().$transaction(async (tx) => {
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
  const ter = await prisma().territory.findUnique({ where: { id: territoryId } });
  if (!ter) throw new ProblemError(Problems.notFound('Territory', territoryId));
  if (ter.orgId !== actor.orgId) {
    throw new ProblemError(Problems.tenantMismatch(ter.orgId));
  }
  const existing = await prisma().territoryAssignment.findUnique({ where: { id: assignmentId } });
  if (!existing || existing.territoryId !== territoryId) {
    throw new ProblemError(Problems.notFound('TerritoryAssignment', assignmentId));
  }

  const updated = await prisma().$transaction(async (tx) => {
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
  const territories = await prisma().territory.findMany({
    where: { orgId: actor.orgId, status: 'active' },
    select: { id: true, centroid: true, s2CellIds: true },
  });

  // PERF-INDEXES / HEATMAP-N+1: one groupBy instead of per-territory count.
  // Territories with zero knocks are not present in the groupBy result; they
  // are merged below with a default of 0 so the return shape is unchanged.
  const knockGroups = await prisma().knock.groupBy({
    by: ['territoryId'],
    where: { orgId: actor.orgId },
    _count: { _all: true },
  });
  const knockCountByTerritory = new Map<string, number>(
    knockGroups.map((g) => [g.territoryId, g._count._all]),
  );

  const cells: Array<{ cellId: string; count: number; centroid: { lng: number; lat: number } }> =
    [];
  for (const t of territories) {
    const c = toCentroid(t.centroid);
    if (!c) continue;
    if (c.lng < w || c.lng > e || c.lat < s || c.lat > n) continue;
    const count = knockCountByTerritory.get(t.id) ?? 0;
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
