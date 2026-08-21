/**
 * /api/orgs/[slug]/territories — list a sub-account's territories with their
 * LIVE knocker assignments + their CANVASS AREA, and create new ones.
 *
 * GET  Returns every Territory for the org plus its currently-active
 *      assignments (expiresAt null or in the future), each with the assigned
 *      knocker's masked display name, AND the canvass-area fields
 *      (areaType/radiusMeters/polygon/centroid) so the operator map can draw
 *      what reps will receive. This is the read half of the assign-to-knocker
 *      flow + the source for the area editor; the assignment write half lives
 *      at ./[id]/assignments (POST) and ./[id]/assignments/[aid] (DELETE).
 *
 * POST Create a new Territory with a canvass AREA (radius circle or drawn
 *      polygon). Operator-gated; mirrors the Fastify `POST /v1/territories`
 *      create + `territory.created` audit. The saved area is what the tenant's
 *      reps pull via GET /v1/territories/assigned on Knocker iOS.
 *
 * Tenant scope: resolveAccountOrg pins every read + write to the slug's Org.
 */
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma, db } from '@d2d/database';
import {
  canOperate,
  forbidden,
  internal,
  ok,
  requireSession,
  resolveAccountOrg,
  validation,
} from '@/lib/api-helpers';
import { newTerritoryId, writeAudit } from '@/lib/db-helpers';
import { validatePolygonWkt, validateRadius } from '@/lib/territory-geo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  _req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const params = await paramsPromise;
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  const orgOrErr = await resolveAccountOrg(params.slug, session);
  if (orgOrErr instanceof Response) return orgOrErr;
  const org = orgOrErr;

  try {
    const now = new Date();
    const territories = await db.territory.findMany({
      where: { orgId: org.id },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        vertical: true,
        status: true,
        areaType: true,
        radiusMeters: true,
        polygon: true,
        centroid: true,
        assignments: {
          // Only LIVE assignments — a revoke sets expiresAt=now, so the strict
          // gt-now comparison drops just-revoked rows.
          where: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          orderBy: { assignedAt: 'desc' },
          select: {
            id: true,
            userId: true,
            assignedAt: true,
            expiresAt: true,
            user: { select: { givenName: true, familyName: true } },
          },
        },
      },
    });

    return ok({
      orgId: org.id,
      territories: territories.map((t) => ({
        id: t.id,
        name: t.name,
        vertical: t.vertical,
        status: t.status,
        // Canvass area — what this territory's reps see on Knocker iOS.
        areaType: t.areaType,
        radiusMeters: t.radiusMeters,
        polygon: t.polygon,
        centroid: t.centroid,
        assignments: t.assignments.map((a) => ({
          id: a.id,
          userId: a.userId,
          // PII-first: given name + family initial only (mirrors staff dir).
          repName: a.user
            ? a.user.familyName
              ? `${a.user.givenName} ${a.user.familyName.charAt(0)}.`
              : a.user.givenName
            : a.userId,
          initials: a.user
            ? `${a.user.givenName.charAt(0)}${a.user.familyName?.charAt(0) ?? ''}`.toUpperCase()
            : '??',
          assignedAt: a.assignedAt,
          expiresAt: a.expiresAt,
        })),
      })),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/orgs/:slug/territories GET] failed:', err);
    return internal('Failed to load territories');
  }
}

// ───────────────────────────────────────────────────────────────────────────
// POST — create a Territory with a canvass area (radius circle or polygon).
// ───────────────────────────────────────────────────────────────────────────

const radiusBody = z
  .object({
    name: z.string().trim().min(1, 'name is required').max(120),
    vertical: z.enum(['charity', 'commercial']),
    areaType: z.literal('radius'),
    centerLng: z.number().finite(),
    centerLat: z.number().finite(),
    radiusMeters: z.number().finite(),
  })
  .strict();

const polygonBody = z
  .object({
    name: z.string().trim().min(1, 'name is required').max(120),
    vertical: z.enum(['charity', 'commercial']),
    areaType: z.literal('polygon'),
    polygonWkt: z.string().trim().min(1, 'polygonWkt is required'),
  })
  .strict();

const createBody = z.discriminatedUnion('areaType', [radiusBody, polygonBody]);

export async function POST(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const params = await paramsPromise;
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  const orgOrErr = await resolveAccountOrg(params.slug, session);
  if (orgOrErr instanceof Response) return orgOrErr;
  const org = orgOrErr;

  // Defining a canvass area pushes coverage to reps — an operator action.
  if (!canOperate(session)) {
    return forbidden('Your role may not create canvass areas');
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return validation('Request body must be JSON');
  }
  const parsed = createBody.safeParse(raw);
  if (!parsed.success) {
    return validation('Invalid canvass-area payload', parsed.error.flatten().fieldErrors);
  }
  const input = parsed.data;

  // Resolve the area to the stored TEXT shape (same as the Fastify service).
  let polygon: string | null = null;
  let centroid: string;
  let radiusMeters: number | null = null;
  let s2CellIds: string[];

  if (input.areaType === 'radius') {
    const r = validateRadius(input.centerLng, input.centerLat, input.radiusMeters);
    if (!r.ok) return validation(r.message);
    centroid = r.centroid;
    radiusMeters = r.radiusMeters;
    s2CellIds = r.s2CellIds;
  } else {
    const p = validatePolygonWkt(input.polygonWkt);
    if (!p.ok) return validation(p.message);
    polygon = p.wkt;
    centroid = p.centroid;
    s2CellIds = p.s2CellIds;
  }

  try {
    const id = newTerritoryId();
    const created = await db.$transaction(async (tx) => {
      const row = await tx.territory.create({
        data: {
          id,
          orgId: org.id,
          regionCode: org.regionCode,
          name: input.name,
          vertical: input.vertical,
          areaType: input.areaType,
          radiusMeters,
          polygon,
          centroid,
          s2CellIds,
          status: 'active',
          metadata: {} as Prisma.InputJsonValue,
        },
      });
      await writeAudit(tx, {
        orgId: org.id,
        regionCode: org.regionCode,
        actorUserId: session.userId,
        action: 'territory.created',
        resourceType: 'Territory',
        resourceId: id,
        afterJson: {
          name: row.name,
          vertical: row.vertical,
          areaType: row.areaType,
          radiusMeters: row.radiusMeters,
          centroid: row.centroid,
          polygon: row.polygon,
          s2CellIds,
        },
        metadata: { via: 'web-operator.account-territories' },
      });
      return row;
    });

    return ok(
      {
        territory: {
          id: created.id,
          name: created.name,
          vertical: created.vertical,
          status: created.status,
          areaType: created.areaType,
          radiusMeters: created.radiusMeters,
          polygon: created.polygon,
          centroid: created.centroid,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/orgs/:slug/territories POST] failed:', err);
    return internal('Failed to create canvass area');
  }
}
