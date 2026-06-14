/**
 * /api/orgs/[slug]/territories — list a sub-account's territories with their
 * LIVE knocker assignments, for the per-account Territories "assign to knocker"
 * control.
 *
 * GET  Returns every Territory for the org plus its currently-active
 *      assignments (expiresAt null or in the future), each with the assigned
 *      knocker's masked display name. This is the read half of the
 *      assign-to-knocker flow; the write half lives at
 *      ./[id]/assignments (POST) and ./[id]/assignments/[aid] (DELETE),
 *      mirroring the Fastify `POST/DELETE /v1/territories/:id/assignments`.
 *
 * Tenant scope: resolveAccountOrg pins every read to the slug's Org.
 */
import type { NextRequest } from 'next/server';
import { db } from '@d2d/database';
import { internal, ok, requireSession, resolveAccountOrg } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } },
): Promise<Response> {
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
