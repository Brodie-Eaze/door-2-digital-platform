/**
 * GET /api/audit — recent AuditEvent rows for the operator's audit log screen.
 *
 * Returns the latest 50 events ordered by occurredAt desc.
 * Also returns:
 *   - eventsToday: count of rows with occurredAt >= today 00:00 UTC
 *   - totalRows: approximate total (uses COUNT; large tables should
 *     swap to an estimate query once the table grows past ~1M rows)
 *
 * Authorization: super_admin sees all rows; an org-scoped session sees
 * only that org's rows.
 *
 * PII: actorUserId is included (a user ID, not PII on its own). No
 * Lead / Donation PII is present in the audit row itself.
 *
 * Cached 0 s — audit log must be live.
 */
import type { NextRequest } from 'next/server';
import { db } from '@d2d/database';
import { internal, isCrossTenantOperator, ok, requireSession } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PAGE_SIZE = 50;

export async function GET(req: NextRequest): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  const cursor = req.nextUrl.searchParams.get('cursor');

  const orgFilter = isCrossTenantOperator(session) ? {} : { orgId: session.orgId ?? '__none__' };
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  try {
    const [events, eventsToday, totalRows] = await Promise.all([
      db.auditEvent.findMany({
        where: orgFilter,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: PAGE_SIZE + 1,
        ...(cursor ? { cursor: { id: BigInt(cursor) }, skip: 1 } : {}),
        select: {
          id: true,
          ulid: true,
          orgId: true,
          regionCode: true,
          actorUserId: true,
          action: true,
          resourceType: true,
          resourceId: true,
          rowHash: true,
          prevHash: true,
          occurredAt: true,
        },
      }),

      db.auditEvent.count({
        where: { ...orgFilter, occurredAt: { gte: todayStart } },
      }),

      db.auditEvent.count({ where: orgFilter }),
    ]);

    const hasMore = events.length > PAGE_SIZE;
    const items = hasMore ? events.slice(0, PAGE_SIZE) : events;

    return ok({
      events: items.map((e) => ({
        // id is BigInt — serialise as string so the wire is JSON-safe
        id: e.id.toString(),
        ulid: e.ulid,
        orgId: e.orgId ?? null,
        regionCode: e.regionCode,
        actorUserId: e.actorUserId ?? null,
        action: e.action,
        resourceType: e.resourceType,
        resourceId: e.resourceId,
        // Only expose the tail 8 hex chars in the UI — enough for visual
        // verification without leaking the full HMAC to a screenshot.
        rowHashTail: e.rowHash.slice(-8),
        prevHashTail: e.prevHash.slice(-8),
        occurredAt: e.occurredAt,
      })),
      eventsToday,
      totalRows,
      nextCursor: hasMore ? (items[items.length - 1]?.id.toString() ?? null) : null,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/audit GET] failed:', err);
    return internal('Failed to load audit events');
  }
}
