/**
 * /api/shifts/bulk — bulk-create knocker shifts in a single transaction.
 *
 * POST  Body { weekStart: YYYY-MM-DD; shifts: Array<single-create-payload-without-weekStart> }
 *       Creates every row atomically (db.$transaction) each with a fresh ksft_ id.
 *       Returns { shifts: createdRows }.
 *
 * Powers the roster page's copy-last-week, apply-template, and bulk-assign flows
 * so they fan out as one network round-trip instead of N sequential POSTs.
 *
 * All writes are tenant-scoped to session.orgId. Cross-tenant operators
 * (super_admin) may pass an explicit ?orgId= to target a sub-account.
 */
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@d2d/database';
import {
  canWriteRoster,
  forbidden,
  internal,
  isCrossTenantOperator,
  ok,
  requireSession,
  validation,
} from '@/lib/api-helpers';
import { newShiftId } from '@/lib/db-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_BULK_SHIFTS = 200;

const shiftStatusEnum = z.enum(['scheduled', 'active', 'lunch', 'missed', 'completed']);

// A single shift in the bulk payload — same shape as createShiftSchema but
// without weekStart (the batch shares one weekStart at the top level).
const bulkShiftSchema = z.object({
  repInitials: z.string().min(1).max(8),
  repName: z.string().min(1).max(100),
  account: z.string().min(1).max(100),
  day: z.number().int().min(0).max(6),
  start: z.string().regex(/^\d{2}:\d{2}$/, 'start must be HH:MM'),
  end: z.string().regex(/^\d{2}:\d{2}$/, 'end must be HH:MM'),
  territory: z.string().min(1).max(100),
  lunch: z.string().nullable().optional(),
  status: shiftStatusEnum.default('scheduled'),
});

const bulkCreateSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'weekStart must be YYYY-MM-DD'),
  shifts: z.array(bulkShiftSchema).min(1).max(MAX_BULK_SHIFTS),
});

export async function POST(req: NextRequest): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  // Roster creation requires at least org_admin or manager role.
  if (!canWriteRoster(session)) {
    return forbidden('Insufficient role to create roster shifts');
  }

  const targetOrgId = isCrossTenantOperator(session)
    ? (req.nextUrl.searchParams.get('orgId') ?? session.orgId)
    : session.orgId;

  if (!targetOrgId) {
    return forbidden('No org context — cannot create shifts');
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return validation('Request body must be JSON');
  }

  const parsed = bulkCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return validation('Invalid bulk shift payload', parsed.error.flatten());
  }
  const { weekStart, shifts } = parsed.data;

  try {
    const created = await db.$transaction(
      shifts.map((s) =>
        db.knockerShift.create({
          data: {
            id: newShiftId(),
            orgId: targetOrgId,
            weekStart,
            repInitials: s.repInitials,
            repName: s.repName,
            account: s.account,
            day: s.day,
            start: s.start,
            end: s.end,
            territory: s.territory,
            lunch: s.lunch ?? null,
            status: s.status,
          },
        }),
      ),
    );
    return ok({ shifts: created }, { status: 201 });
  } catch (err) {
    console.error('[api/shifts/bulk POST] failed:', err);
    return internal('Failed to bulk-create shifts');
  }
}
