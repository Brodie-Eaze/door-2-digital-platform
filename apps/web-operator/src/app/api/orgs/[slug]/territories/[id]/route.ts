/**
 * PATCH /api/orgs/[slug]/territories/[id] — update an existing territory's
 * CANVASS AREA (switch/redefine a radius circle or a drawn polygon).
 *
 * Web BFF twin of the Fastify territory update: operator-gated, tenant-scoped
 * (the territory must already resolve inside the org), and audited with the
 * before/after area so the hash chain records exactly what reps' coverage
 * changed to. The saved area is what the tenant's reps pull via
 * GET /v1/territories/assigned on Knocker iOS.
 *
 * Writing an area never targets individual houses — it stores either a
 * center+radius circle or a single-ring polygon, mirroring the create path.
 */
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@d2d/database';
import {
  canOperate,
  forbidden,
  internal,
  notFound,
  ok,
  requireSession,
  resolveAccountOrg,
  validation,
} from '@/lib/api-helpers';
import { writeAudit } from '@/lib/db-helpers';
import { validatePolygonWkt, validateRadius } from '@/lib/territory-geo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const radiusBody = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    areaType: z.literal('radius'),
    centerLng: z.number().finite(),
    centerLat: z.number().finite(),
    radiusMeters: z.number().finite(),
  })
  .strict();

const polygonBody = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    areaType: z.literal('polygon'),
    polygonWkt: z.string().trim().min(1, 'polygonWkt is required'),
  })
  .strict();

const patchBody = z.discriminatedUnion('areaType', [radiusBody, polygonBody]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string; id: string } },
): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  const orgOrErr = await resolveAccountOrg(params.slug, session);
  if (orgOrErr instanceof Response) return orgOrErr;
  const org = orgOrErr;

  if (!canOperate(session)) {
    return forbidden('Your role may not edit canvass areas');
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return validation('Request body must be JSON');
  }
  const parsed = patchBody.safeParse(raw);
  if (!parsed.success) {
    return validation('Invalid canvass-area payload', parsed.error.flatten().fieldErrors);
  }
  const input = parsed.data;

  // Resolve the new area to the stored TEXT shape.
  const update: {
    areaType: 'polygon' | 'radius';
    polygon: string | null;
    centroid: string;
    radiusMeters: number | null;
    s2CellIds: string[];
    name?: string;
  } = {
    areaType: input.areaType,
    polygon: null,
    centroid: '',
    radiusMeters: null,
    s2CellIds: [],
    ...(input.name ? { name: input.name } : {}),
  };

  if (input.areaType === 'radius') {
    const r = validateRadius(input.centerLng, input.centerLat, input.radiusMeters);
    if (!r.ok) return validation(r.message);
    update.centroid = r.centroid;
    update.radiusMeters = r.radiusMeters;
    update.s2CellIds = r.s2CellIds;
  } else {
    const p = validatePolygonWkt(input.polygonWkt);
    if (!p.ok) return validation(p.message);
    update.polygon = p.wkt;
    update.centroid = p.centroid;
    update.s2CellIds = p.s2CellIds;
  }

  try {
    const existing = await db.territory.findFirst({
      where: { id: params.id, orgId: org.id },
      select: {
        id: true,
        name: true,
        areaType: true,
        radiusMeters: true,
        polygon: true,
        centroid: true,
      },
    });
    if (!existing) return notFound('Territory', params.id);

    const updated = await db.$transaction(async (tx) => {
      const row = await tx.territory.update({
        where: { id: params.id },
        data: {
          areaType: update.areaType,
          polygon: update.polygon,
          centroid: update.centroid,
          radiusMeters: update.radiusMeters,
          s2CellIds: update.s2CellIds,
          ...(update.name ? { name: update.name } : {}),
        },
      });
      await writeAudit(tx, {
        orgId: org.id,
        regionCode: org.regionCode,
        actorUserId: session.userId,
        action: 'territory.areaUpdated',
        resourceType: 'Territory',
        resourceId: params.id,
        beforeJson: {
          areaType: existing.areaType,
          radiusMeters: existing.radiusMeters,
          centroid: existing.centroid,
          polygon: existing.polygon,
        },
        afterJson: {
          areaType: row.areaType,
          radiusMeters: row.radiusMeters,
          centroid: row.centroid,
          polygon: row.polygon,
          s2CellIds: update.s2CellIds,
        },
        metadata: { via: 'web-operator.account-territories' },
      });
      return row;
    });

    return ok({
      territory: {
        id: updated.id,
        name: updated.name,
        status: updated.status,
        areaType: updated.areaType,
        radiusMeters: updated.radiusMeters,
        polygon: updated.polygon,
        centroid: updated.centroid,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/orgs/:slug/territories/:id PATCH] failed:', err);
    return internal('Failed to update canvass area');
  }
}
