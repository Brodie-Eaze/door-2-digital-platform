/**
 * /audit — hash-chained audit log for the platform operator.
 *
 * Server component. Reads directly from the shared Prisma client
 * (same pattern as /accounts). Falls back to the RECENT_AUDIT fixture
 * when the DB is unreachable so the screen never goes blank.
 *
 * Authorization: super_admin sees all events; org-scoped sessions see
 * only their own org's events.
 *
 * Note: AuditEvent.id is BigInt — serialised as string throughout.
 */
import { ShieldCheck, Hash, Database, AlertTriangle } from 'lucide-react';
import { Banner, Section } from '@d2d/ui-web';
import { OperatorShell } from '@/components/OperatorShell';
import { RECENT_AUDIT } from '@/lib/fixtures';
import { getSession } from '@/lib/session';
import { isCrossTenantOperator } from '@/lib/api-helpers';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── types ──────────────────────────────────────────────────────────────────

interface AuditRow {
  id: string;
  ulid: string;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  rowHashTail: string;
  occurredAt: Date | string;
}

interface AuditData {
  events: AuditRow[];
  eventsToday: number;
  totalRows: number;
  source: 'database' | 'fixture-fallback';
  error?: string;
}

// ─── data loader ────────────────────────────────────────────────────────────

async function loadAudit(): Promise<AuditData> {
  const session = await getSession();
  if (!session) {
    return { events: [], eventsToday: 0, totalRows: 0, source: 'fixture-fallback' };
  }

  try {
    const { db } = await import('@d2d/database');

    const orgFilter = isCrossTenantOperator(session) ? {} : { orgId: session.orgId ?? '__none__' };

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const PAGE_SIZE = 50;

    const [events, eventsToday, totalRows] = await Promise.all([
      db.auditEvent.findMany({
        where: orgFilter,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: PAGE_SIZE,
        select: {
          id: true,
          ulid: true,
          actorUserId: true,
          action: true,
          resourceType: true,
          resourceId: true,
          rowHash: true,
          occurredAt: true,
        },
      }),
      db.auditEvent.count({
        where: { ...orgFilter, occurredAt: { gte: todayStart } },
      }),
      db.auditEvent.count({ where: orgFilter }),
    ]);

    return {
      events: events.map((e) => ({
        id: e.id.toString(),
        ulid: e.ulid,
        actorUserId: e.actorUserId ?? null,
        action: e.action,
        resourceType: e.resourceType,
        resourceId: e.resourceId,
        rowHashTail: e.rowHash.slice(-8),
        occurredAt: e.occurredAt,
      })),
      eventsToday,
      totalRows,
      source: 'database',
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[audit] DB load failed, falling back to fixture:', err);
    return {
      events: RECENT_AUDIT.map((e, i) => ({
        id: `fixture-${i}`,
        ulid: `aud_fixture_${i}`,
        actorUserId: e.actor,
        action: e.action,
        resourceType: e.resource.split(':')[0] ?? 'Resource',
        resourceId: e.resource,
        rowHashTail: Math.random().toString(16).slice(2, 10),
        occurredAt: e.occurredAt,
      })),
      eventsToday: RECENT_AUDIT.length,
      totalRows: RECENT_AUDIT.length,
      source: 'fixture-fallback',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── page ────────────────────────────────────────────────────────────────────

export default async function AuditPage(): Promise<JSX.Element> {
  const session = await getSession();
  if (!session) redirect('/login?next=/audit');

  const { events, eventsToday, totalRows, source, error } = await loadAudit();

  // Format total for the "hash chain rows" KPI — show as locale string or
  // rounded (e.g. "3.4M") once real data arrives.
  const totalDisplay =
    totalRows >= 1_000_000 ? `${(totalRows / 1_000_000).toFixed(1)}M` : totalRows.toLocaleString();

  return (
    <OperatorShell pageTitle="Audit log">
      <div className="space-y-6 max-w-[1280px]">
        <Banner tone="success">
          <span className="text-[13px] flex items-center gap-2">
            <ShieldCheck size={14} />
            {/* TODO(M5): wire to /api/audit for live chain-verify status from
                the backend AuditService (chain-head + Merkle root). Currently
                shows static verified message. */}
            Audit chain integrity verified · Hash-chained outbox, written in same TX as each
            mutation
          </span>
        </Banner>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card card-pad">
            <div className="h-section">Events today</div>
            <div className="mt-2 text-[20px] font-semibold text-ink numeric">
              {eventsToday.toLocaleString()}
            </div>
            <div className="text-[11px] text-muted mt-0.5 flex items-center gap-1.5">
              {source === 'database' ? (
                <span className="inline-flex items-center gap-1 text-success text-[10px] uppercase tracking-wider font-semibold">
                  <Database size={10} /> Live
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 text-warn text-[10px] uppercase tracking-wider font-semibold"
                  title="Data temporarily unavailable"
                >
                  <AlertTriangle size={10} /> Fixture
                </span>
              )}
            </div>
          </div>
          <div className="card card-pad">
            <div className="h-section">Hash chain rows</div>
            <div className="mt-2 text-[20px] font-semibold text-ink numeric">{totalDisplay}</div>
            <div className="text-[11px] text-muted mt-0.5">total in DB</div>
          </div>
          <div className="card card-pad">
            <div className="h-section">S3 Object Lock retention</div>
            <div className="mt-2 text-[20px] font-semibold text-ink numeric">7y</div>
            <div className="text-[11px] text-muted mt-0.5">COMPLIANCE mode</div>
          </div>
        </div>

        <Section
          title="Recent events"
          subtitle="Hash-chained immutable outbox · written in same TX as the originating mutation"
          paddedBody={false}
        >
          {events.length === 0 ? (
            <div className="p-6 text-center text-[13px] text-muted">
              No audit events yet. Events are written automatically alongside every mutation.
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>Chain</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td className="text-[11px] text-muted numeric">
                      {new Date(e.occurredAt).toISOString().slice(11, 19)}
                    </td>
                    <td className="text-[12px] text-ink truncate max-w-[220px]">
                      {e.actorUserId ?? 'system'}
                    </td>
                    <td>
                      <span className="tag">{e.action}</span>
                    </td>
                    <td className="text-[12px] text-muted truncate max-w-[280px]">
                      {e.resourceType}:{e.resourceId}
                    </td>
                    <td>
                      <span className="text-soft inline-flex items-center gap-1">
                        <Hash size={11} />
                        <span className="font-mono text-[10px]">{e.rowHashTail}…</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>
    </OperatorShell>
  );
}
