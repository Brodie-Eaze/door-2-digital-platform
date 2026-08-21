/**
 * /audit — the platform hash-chain audit log.
 *
 * Server component. Reads live `AuditEvent` rows directly from Prisma —
 * newest first, capped at 100. super_admin sees platform-wide events;
 * everyone else is scoped to their own orgId (default-deny for an
 * unknown/no-org session). No fixture fallback: a DB error renders an
 * honest error banner, zero rows render an honest EmptyState.
 *
 * PII: beforeJson/afterJson may carry raw field diffs (some pre-redacted
 * with '[REDACTED]' markers by the writer, some not) — this surface never
 * renders those blobs. Only structured, non-PII columns are shown: ulid,
 * actorUserId (an opaque ID, not contact info), action, resourceType/Id,
 * orgId, occurredAt, and the chain-integrity hash pair truncated to 8 hex
 * chars each.
 */
import { ShieldCheck, Hash } from 'lucide-react';
import { Banner, Section } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { AuditEmpty } from '@/components/PlatformEmptyStates';
import { getSession } from '@/lib/session';
import { isCrossTenantOperator } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface AuditRow {
  ulid: string;
  orgId: string | null;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  occurredAt: Date;
  prevHash: string;
  rowHash: string;
}

interface AuditData {
  rows: AuditRow[];
  eventsToday: number;
  totalRows: number;
  error?: string;
}

async function loadAudit(): Promise<AuditData> {
  const session = await getSession();
  if (!session) return { rows: [], eventsToday: 0, totalRows: 0, error: 'no session' };

  try {
    const { db } = await import('@d2d/database');

    const scope = isCrossTenantOperator(session) ? {} : { orgId: session.orgId ?? '__no_org__' };

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const [rows, eventsToday, totalRows] = await Promise.all([
      db.auditEvent.findMany({
        where: scope,
        orderBy: { id: 'desc' },
        take: 100,
        select: {
          ulid: true,
          orgId: true,
          actorUserId: true,
          action: true,
          resourceType: true,
          resourceId: true,
          occurredAt: true,
          prevHash: true,
          rowHash: true,
        },
      }),
      db.auditEvent.count({ where: { ...scope, occurredAt: { gte: todayStart } } }),
      db.auditEvent.count({ where: scope }),
    ]);

    return { rows, eventsToday, totalRows };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[audit] DB load failed:', err);
    return {
      rows: [],
      eventsToday: 0,
      totalRows: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export default async function AuditPage(): Promise<JSX.Element> {
  const { rows, eventsToday, totalRows, error } = await loadAudit();

  if (error) {
    return (
      <PlatformShell pageTitle="Audit log">
        <div className="space-y-5 max-w-[1280px]">
          <Banner tone="warn">
            <span className="text-[13px]">
              Could not load the audit log: {error}. Refresh to retry.
            </span>
          </Banner>
        </div>
      </PlatformShell>
    );
  }

  return (
    <PlatformShell pageTitle="Audit log">
      <div className="space-y-6 max-w-[1280px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <ShieldCheck size={14} />
            Every mutation writes a hash-chained <code className="kbd">AuditEvent</code> row (
            <code className="kbd">prevHash</code> / <code className="kbd">rowHash</code>) in the
            same transaction as the change it records.
          </span>
        </Banner>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card card-pad">
            <div className="h-section">Events today</div>
            <div className="mt-2 text-[20px] font-semibold text-ink numeric">
              {eventsToday.toLocaleString()}
            </div>
            <div className="text-[11px] text-muted mt-0.5">in scope for this session</div>
          </div>
          <div className="card card-pad">
            <div className="h-section">Hash chain rows</div>
            <div className="mt-2 text-[20px] font-semibold text-ink numeric">
              {totalRows.toLocaleString()}
            </div>
            <div className="text-[11px] text-muted mt-0.5">in scope for this session</div>
          </div>
          <div className="card card-pad">
            <div className="h-section">Off-site retention</div>
            <div className="mt-2 text-[20px] font-semibold text-ink numeric">7y</div>
            <div className="text-[11px] text-muted mt-0.5">
              designed policy — S3 Object Lock activates with the AWS deploy
            </div>
          </div>
        </div>

        {rows.length === 0 ? (
          <AuditEmpty />
        ) : (
          <Section
            title="Recent events"
            subtitle="Newest first · capped at 100 rows"
            paddedBody={false}
            action={<DataSourceBadge source="live" />}
          >
            <table className="tbl">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>Org</th>
                  <th>Chain</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.ulid}>
                    <td className="text-[11px] text-muted numeric">
                      {e.occurredAt.toISOString().slice(0, 19).replace('T', ' ')}
                    </td>
                    <td className="text-[12px] text-ink truncate max-w-[180px]">
                      {e.actorUserId ?? <span className="text-soft">system</span>}
                    </td>
                    <td>
                      <span className="tag">{e.action}</span>
                    </td>
                    <td className="text-[12px] text-muted truncate max-w-[240px]">
                      {e.resourceType}:{e.resourceId}
                    </td>
                    <td className="text-[11px] text-muted truncate max-w-[140px]">
                      {e.orgId ?? <span className="text-soft">platform</span>}
                    </td>
                    <td>
                      <span className="text-soft inline-flex items-center gap-1">
                        <Hash size={11} />
                        <span className="font-mono text-[10px]">
                          {e.prevHash.slice(0, 8)}→{e.rowHash.slice(0, 8)}
                        </span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}
      </div>
    </PlatformShell>
  );
}
