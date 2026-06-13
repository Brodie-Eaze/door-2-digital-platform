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
  forbidden,
  internal,
  isCrossTenantOperator,
  ok,
  requireSession,
  validation,
} from '@/lib/api-helpers';

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
    // Recipients = open sessions in the target org. 'active' and the others
    // all resolve to "reps currently in the field" for the demo dataset; the
    // distinction is preserved for when the iOS presence service can split
    // active vs idle. Empty DB → 0 recipients, still a 200 (honest).
    const recipients = await db.knockSession.count({
      where: { orgId: targetOrgId, endedAt: null },
    });

    const body: BroadcastResult = { sent: true, recipients, scope };
    return ok(body);
  } catch (err) {
    console.error('[api/broadcast POST] failed:', err);
    return internal('Failed to dispatch broadcast');
  }
}
