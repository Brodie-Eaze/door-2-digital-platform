/**
 * POST /api/orgs/[slug]/territories/[id]/assignments — assign a knocker to a
 * territory so it shows on their iOS map.
 *
 * Web BFF twin of the Fastify `POST /v1/territories/:id/assignments`
 * (apps/api domains/territory/service.addAssignment): both the territory and
 * the user must resolve inside the org, then a TerritoryAssignment row is
 * written with the SAME `territoryAssignment.created` audit event.
 *
 * Tenant scope: resolveAccountOrg pins the org; territory + user are both
 * org-checked before the write, and the assignment write is operator-gated.
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
import { newAssignmentId, writeAudit } from '@/lib/db-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const assignSchema = z
  .object({
    userId: z.string().trim().min(1, 'userId is required'),
    // Optional assignment TTL; null/absent = permanent until revoked.
    expiresAt: z.string().datetime().optional(),
  })
  .strict();

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string; id: string } },
): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  const orgOrErr = await resolveAccountOrg(params.slug, session);
  if (orgOrErr instanceof Response) return orgOrErr;
  const org = orgOrErr;

  // Assigning coverage is an operator action — a viewer/knocker must not.
  if (!canOperate(session)) {
    return forbidden('Your role may not assign territories');
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return validation('Request body must be JSON');
  }

  const parsed = assignSchema.safeParse(raw);
  if (!parsed.success) {
    return validation('Invalid assignment payload', parsed.error.flatten().fieldErrors);
  }
  const input = parsed.data;

  try {
    const territory = await db.territory.findFirst({
      where: { id: params.id, orgId: org.id },
      select: { id: true },
    });
    if (!territory) return notFound('Territory', params.id);

    const user = await db.user.findFirst({
      where: { id: input.userId, orgId: org.id },
      select: { id: true },
    });
    if (!user) return notFound('User', input.userId);

    const id = newAssignmentId();
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;

    const created = await db.$transaction(async (tx) => {
      const row = await tx.territoryAssignment.create({
        data: { id, territoryId: params.id, userId: input.userId, expiresAt },
      });
      await writeAudit(tx, {
        orgId: org.id,
        regionCode: org.regionCode,
        actorUserId: session.userId,
        action: 'territoryAssignment.created',
        resourceType: 'TerritoryAssignment',
        resourceId: id,
        afterJson: {
          territoryId: params.id,
          userId: input.userId,
          expiresAt: expiresAt?.toISOString() ?? null,
        },
        metadata: { via: 'web-operator.account-territories' },
      });
      return row;
    });

    return ok(
      {
        assignment: {
          id: created.id,
          territoryId: created.territoryId,
          userId: created.userId,
          assignedAt: created.assignedAt,
          expiresAt: created.expiresAt,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/orgs/:slug/territories/:id/assignments POST] failed:', err);
    return internal('Failed to assign territory');
  }
}
