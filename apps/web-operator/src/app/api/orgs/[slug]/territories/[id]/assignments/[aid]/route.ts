/**
 * DELETE /api/orgs/[slug]/territories/[id]/assignments/[aid] — revoke a
 * knocker's territory assignment (soft: expiresAt=now), removing it from their
 * iOS map on the next read.
 *
 * Web BFF twin of the Fastify `DELETE /v1/territories/:id/assignments/:aid`
 * (apps/api domains/territory/service.removeAssignment): same soft-revoke +
 * `territoryAssignment.revoked` audit event.
 */
import type { NextRequest } from 'next/server';
import { db } from '@d2d/database';
import {
  canOperate,
  forbidden,
  internal,
  notFound,
  ok,
  requireSession,
  resolveAccountOrg,
} from '@/lib/api-helpers';
import { writeAudit } from '@/lib/db-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { slug: string; id: string; aid: string } },
): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  const orgOrErr = await resolveAccountOrg(params.slug, session);
  if (orgOrErr instanceof Response) return orgOrErr;
  const org = orgOrErr;

  if (!canOperate(session)) {
    return forbidden('Your role may not revoke territory assignments');
  }

  try {
    const territory = await db.territory.findFirst({
      where: { id: params.id, orgId: org.id },
      select: { id: true },
    });
    if (!territory) return notFound('Territory', params.id);

    const existing = await db.territoryAssignment.findUnique({
      where: { id: params.aid },
      select: { id: true, territoryId: true, expiresAt: true },
    });
    if (!existing || existing.territoryId !== params.id) {
      return notFound('TerritoryAssignment', params.aid);
    }

    const now = new Date();
    await db.$transaction(async (tx) => {
      await tx.territoryAssignment.update({
        where: { id: params.aid },
        data: { expiresAt: now },
      });
      await writeAudit(tx, {
        orgId: org.id,
        regionCode: org.regionCode,
        actorUserId: session.userId,
        action: 'territoryAssignment.revoked',
        resourceType: 'TerritoryAssignment',
        resourceId: params.aid,
        beforeJson: { expiresAt: existing.expiresAt?.toISOString() ?? null },
        afterJson: { expiresAt: now.toISOString() },
        metadata: { via: 'web-operator.account-territories' },
      });
    });

    return ok({ id: params.aid, revoked: true, expiresAt: now.toISOString() });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/orgs/:slug/territories/:id/assignments/:aid DELETE] failed:', err);
    return internal('Failed to revoke assignment');
  }
}
