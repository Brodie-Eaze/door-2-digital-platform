/**
 * /api/activity — recent knock activity for the HQ live feed.
 *
 * GET  Returns the last 50 Knock rows (across all org sessions) mapped to
 *      ActivityEvent objects that the LiveActivityFeed component consumes.
 *
 * KnockDisposition → ActivityEventType mapping:
 *   converted_donation | converted_sale  → "conversion"
 *   appointment                          → "callback_scheduled"
 *   callback                             → "callback_scheduled"
 *   no_answer                            → "knock_not_home"
 *   not_interested | hostile             → "knock_not_home"
 *   do_not_knock | invalid_address       → "knock_not_home"
 *   (fallback)                           → "knock_lead"
 *
 * Polling cadence: the command-centre page polls every 15 seconds.
 */
import type { NextRequest } from 'next/server';
import { db } from '@d2d/database';
import { forbidden, internal, isCrossTenantOperator, ok, requireSession } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ActivityEventType =
  | 'conversion'
  | 'knock_lead'
  | 'knock_sale'
  | 'knock_not_home'
  | 'callback_scheduled'
  | 'shift_start'
  | 'shift_break_return'
  | 'shift_break_start';

type KnockDisp =
  | 'no_answer'
  | 'not_interested'
  | 'callback'
  | 'do_not_knock'
  | 'appointment'
  | 'converted_donation'
  | 'converted_sale'
  | 'hostile'
  | 'invalid_address';

function dispositionToEventType(d: KnockDisp): ActivityEventType {
  switch (d) {
    case 'converted_donation':
    case 'converted_sale':
      return 'conversion';
    case 'appointment':
    case 'callback':
      return 'callback_scheduled';
    case 'no_answer':
    case 'not_interested':
    case 'hostile':
    case 'do_not_knock':
    case 'invalid_address':
      return 'knock_not_home';
    default:
      return 'knock_lead';
  }
}

function dispositionLabel(d: KnockDisp): string {
  switch (d) {
    case 'converted_donation':
      return 'Conversion · Donation';
    case 'converted_sale':
      return 'Conversion · Sale';
    case 'appointment':
      return 'Appointment set';
    case 'callback':
      return 'Callback scheduled';
    case 'no_answer':
      return 'No answer';
    case 'not_interested':
      return 'Not interested';
    case 'hostile':
      return 'Hostile';
    case 'do_not_knock':
      return 'Do Not Knock';
    case 'invalid_address':
      return 'Invalid address';
    default:
      return 'Knock recorded';
  }
}

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Placeholder initials from userId until PII vault is wired. */
function userIdToInitials(userId: string): string {
  const suffix = userId.replace(/^[a-z]+_/, '');
  const alphas = suffix.replace(/[^A-Za-z]/g, '');
  return (alphas.slice(-2) || suffix.slice(-2) || '??').toUpperCase();
}

export async function GET(req: NextRequest): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  const orgFilter = isCrossTenantOperator(session)
    ? req.nextUrl.searchParams.get('orgId')
      ? { orgId: req.nextUrl.searchParams.get('orgId')! }
      : {}
    : session.orgId
      ? { orgId: session.orgId }
      : null;

  if (orgFilter === null) {
    return forbidden('No org context');
  }

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10) || 50, 100);

  try {
    const knocks = await db.knock.findMany({
      where: orgFilter,
      orderBy: { capturedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        userId: true,
        orgId: true,
        disposition: true,
        capturedAt: true,
        // PII: a household's street address is location PII — never emitted in
        // this org-wide polling feed, especially paired with a disposition like
        // "Hostile"/"Do Not Knock" (it would link a residence to a resident's
        // reaction). Only the coarse locality (suburb/city) is surfaced. Precise
        // address resolution must go through the JIT PII-unmask + audit path.
        address: {
          select: { locality: true },
        },
      },
    });

    const events = knocks.map((k) => {
      const disp = k.disposition as KnockDisp;
      const type = dispositionToEventType(disp);
      const primary = dispositionLabel(disp);
      const locality = k.address?.locality ?? 'Unknown area';

      return {
        id: k.id,
        at: formatTime(k.capturedAt),
        actorInitials: userIdToInitials(k.userId),
        type,
        primary,
        secondary: locality,
      };
    });

    return ok({ events, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[api/activity GET] failed:', err);
    return internal('Failed to load activity');
  }
}
