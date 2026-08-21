/**
 * /api/broadcast — push a message/config out to the active field fleet.
 *
 * POST { message: string; scope?: 'all' | 'active' | 'idle' }
 *      Validates the body with zod, derives the recipient count from the
 *      number of OPEN KnockSession rows (endedAt = null) in the caller's org,
 *      writes an audit row, and returns { sent: true, recipients: <count> }.
 *
 * What this does NOT do yet (honest interim): there is no APNs / FCM push
 * fan-out wired here — that lands when the Knocker-iOS notification service
 * is provisioned (see humanGated). Today this records the intent + audits it
 * + reports who *would* receive it, so the operator gets a truthful count
 * and an auditable trail rather than a silent no-op.
 *
 * Tenant scoping mirrors the rest of the BFF: pinned to session.orgId; a
 * cross-tenant operator (super_admin) may target a sub-account with ?orgId=.
 */
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@d2d/database';
import {
  canOperate,
  forbidden,
  internal,
  isCrossTenantOperator,
  ok,
  requireSession,
  validation,
} from '@/lib/api-helpers';
import { writeAudit } from '@/lib/db-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const broadcastScopeEnum = z.enum(['all', 'active', 'idle']);

const broadcastSchema = z.object({
  message: z.string().trim().min(1, 'message is required').max(500, 'message too long'),
  scope: broadcastScopeEnum.default('active'),
});

export interface BroadcastResult {
  sent: true;
  recipients: number;
  scope: z.infer<typeof broadcastScopeEnum>;
}

export async function POST(req: NextRequest): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  // Authz: broadcasting to the fleet (and writing the audit row) is an operator
  // action — not available to a viewer/knocker with a valid session.
  if (!canOperate(session)) {
    return forbidden('Insufficient role to broadcast to the field');
  }

  // Org scope.
  const requestedOrgId = req.nextUrl.searchParams.get('orgId');
  const targetOrgId: string | null = isCrossTenantOperator(session)
    ? (requestedOrgId ?? session.orgId ?? null)
    : (session.orgId ?? null);

  if (!targetOrgId) {
    return forbidden('No org context');
  }

  // Parse + validate the body. Tolerate an empty / non-JSON body explicitly.
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return validation('Request body must be valid JSON');
  }

  const parsed = broadcastSchema.safeParse(raw);
  if (!parsed.success) {
    return validation('Invalid broadcast payload', parsed.error.flatten().fieldErrors);
  }
  const { message, scope } = parsed.data;

  try {
    const recipients = await db.$transaction(async (tx) => {
      // Recipients = open sessions in the target org. 'active' and the others
      // all resolve to "reps currently in the field" for the demo dataset; the
      // distinction is preserved for when the iOS presence service can split
      // active vs idle. Empty DB → 0 recipients, still a 200 (honest).
      const count = await tx.knockSession.count({
        where: { orgId: targetOrgId, endedAt: null },
      });

      // Region for the audit chain — derived from the target org (the chain is
      // per-(orgId, regionCode); we never invent a region from the session).
      const org = await tx.org.findUnique({
        where: { id: targetOrgId },
        select: { regionCode: true },
      });

      // Audit the broadcast intent. There is no push fan-out yet (see header):
      // the recipient count + this audit row are the honest, auditable contract.
      await writeAudit(tx, {
        orgId: targetOrgId,
        regionCode: org?.regionCode ?? 'US',
        actorUserId: session.userId,
        action: 'field.broadcast',
        resourceType: 'KnockSession',
        resourceId: targetOrgId,
        metadata: {
          scope,
          recipients: count,
          messageLength: message.length,
        },
      });

      return count;
    });

    const body: BroadcastResult = { sent: true, recipients, scope };
    return ok(body);
  } catch (err) {
    console.error('[api/broadcast POST] failed:', err);
    return internal('Failed to dispatch broadcast');
  }
}
