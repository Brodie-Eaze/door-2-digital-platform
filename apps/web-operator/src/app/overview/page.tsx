/**
 * /overview — cross-tenant mission control for the platform operator.
 *
 * Server component. Reads directly from the shared Prisma client (same
 * pattern as /accounts) so the first paint has live data. If the DB is
 * unreachable it shows an honest "Live data unavailable" state — figures
 * are hidden, never faked (no fixture fallback).
 *
 * Authorization: super_admin sees all orgs; org-scoped sessions see their
 * own org only (isCrossTenantOperator mirrors the BFF helper).
 */
import { AnomalyCard, KpiCard, Money, RegionBadge, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { getSession } from '@/lib/session';
import { isCrossTenantOperator } from '@/lib/api-helpers';
import { redirect } from 'next/navigation';
import { AlertTriangle, Database } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── types ──────────────────────────────────────────────────────────────────

interface OverviewKpis {
  activeOrgs: number;
  activeKnockers: number;
  conversionsMTD: number;
  revenueCentsMTD: bigint;
}

interface AnomalyItem {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  timestamp: string;
}

interface OverviewData {
  // null when the platform DB is unreachable — we hide figures rather than
  // fabricate them (true-source rule: no number ships unless it's real).
  kpis: OverviewKpis | null;
  anomalies: AnomalyItem[];
  source: 'database' | 'unavailable';
  error?: string;
}

// ─── data loader ────────────────────────────────────────────────────────────

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function loadOverview(): Promise<OverviewData> {
  const session = await getSession();
  if (!session) {
    return { kpis: null, anomalies: [], source: 'unavailable', error: 'no session' };
  }

  try {
    const { db } = await import('@d2d/database');

    const orgWhere = isCrossTenantOperator(session)
      ? { status: { not: 'archived' as const }, slug: { not: null } }
      : session.orgId
        ? { id: session.orgId, status: { not: 'archived' as const } }
        : { id: '__no_org__' };

    const convWhere = isCrossTenantOperator(session)
      ? { signedAt: { gte: startOfMonth() } }
      : { orgId: session.orgId ?? '__none__', signedAt: { gte: startOfMonth() } };

    const knockerWhere = isCrossTenantOperator(session)
      ? { role: 'knocker' as const, status: 'active' }
      : { orgId: session.orgId ?? '__none__', role: 'knocker' as const, status: 'active' };

    const [orgs, activeKnockers, conversionsMTD, revenueAgg, pendingRegs] = await Promise.all([
      db.org.findMany({ where: orgWhere, select: { id: true } }),
      db.user.count({ where: knockerWhere }),
      db.conversion.count({ where: convWhere }),
      db.conversion.aggregate({
        _sum: { d2dRakeCents: true, processorResidualCents: true },
        where: convWhere,
      }),
      // Surface pending registrations as anomalies (super_admin only).
      isCrossTenantOperator(session)
        ? db.paidSolicitorRegistration.findMany({
            where: { status: { not: 'approved' } },
            orderBy: { createdAt: 'asc' },
            take: 10,
            select: { id: true, state: true, status: true, filedAt: true, notes: true },
          })
        : Promise.resolve(
            [] as {
              id: string;
              state: string;
              status: string;
              filedAt: Date | null;
              notes: string | null;
            }[],
          ),
    ]);

    const revenueCentsMTD =
      (revenueAgg._sum.d2dRakeCents ?? 0n) + (revenueAgg._sum.processorResidualCents ?? 0n);

    const anomalies: AnomalyItem[] = pendingRegs.map((r) => ({
      id: r.id,
      title: `Paid-solicitor registration ${r.state} — ${r.status}`,
      description:
        r.notes ??
        (r.filedAt
          ? `Filed ${r.filedAt.toISOString().slice(0, 10)}. Awaiting approval.`
          : 'Not yet filed.'),
      severity:
        r.status === 'rejected'
          ? ('critical' as const)
          : r.status === 'pending'
            ? ('warning' as const)
            : ('info' as const),
      timestamp: r.filedAt ? `Filed ${r.filedAt.toISOString().slice(0, 10)}` : 'Not filed',
    }));

    return {
      kpis: { activeOrgs: orgs.length, activeKnockers, conversionsMTD, revenueCentsMTD },
      anomalies,
      source: 'database',
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[overview] DB load failed — hiding figures (no fixture fallback):', err);
    // Do NOT fabricate KPIs. An operator must never see invented numbers dressed
    // as live platform metrics; show an honest "unavailable" state instead.
    return {
      kpis: null,
      anomalies: [],
      source: 'unavailable',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── page ────────────────────────────────────────────────────────────────────

export default async function OverviewPage(): Promise<JSX.Element> {
  const session = await getSession();
  if (!session) redirect('/login?next=/overview');

  const { kpis, anomalies, source, error } = await loadOverview();

  return (
    <PlatformShell pageTitle="Cross-org overview">
      <div className="space-y-6 max-w-[1280px]">
        <div className="flex items-center gap-2">
          {source === 'database' ? (
            <span
              className="inline-flex items-center gap-1 text-success text-[10px] uppercase tracking-wider font-semibold"
              title="Loaded from Postgres"
            >
              <Database size={10} /> Live data
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 text-warn text-[10px] uppercase tracking-wider font-semibold"
              title={error ? `DB error: ${error}` : 'Platform database unreachable'}
            >
              <AlertTriangle size={10} /> Live data unavailable
            </span>
          )}
        </div>

        {source !== 'database' && (
          <div className="card card-pad border border-warn/40 bg-warn/5 text-[13px] text-ink">
            The platform database is unreachable, so live figures are hidden rather than estimated.
            Retry shortly. (No cached or sample numbers are shown.)
          </div>
        )}

        {/* KPI rail — real values, or an honest dash when the DB is unavailable. */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Active client orgs"
            value={kpis ? kpis.activeOrgs : '—'}
            hint="non-archived"
          />
          <KpiCard
            label="Active knockers"
            value={kpis ? kpis.activeKnockers : '—'}
            delta="—"
            deltaTone="neutral"
          />
          <KpiCard
            label="MTD conversions"
            value={kpis ? kpis.conversionsMTD.toLocaleString() : '—'}
            delta="—"
            deltaTone="neutral"
            hint="all sources"
          />
          <KpiCard
            label="MTD platform revenue"
            value={kpis ? <Money cents={kpis.revenueCentsMTD} region="US" /> : '—'}
            delta="—"
            deltaTone="neutral"
            hint="rake + residual"
          />
        </div>

        {/* Today: anomalies + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="h-section">Needs attention</h2>
            {anomalies.length === 0 ? (
              <div className="card card-pad text-[13px] text-muted">
                No open compliance items. All paid-solicitor registrations are approved.
              </div>
            ) : (
              anomalies.map((a) => (
                <AnomalyCard
                  key={a.id}
                  severity={a.severity}
                  title={a.title}
                  description={a.description}
                  timestamp={a.timestamp}
                />
              ))
            )}
          </div>

          <div className="space-y-4">
            <Section title="Regions" subtitle="Data residency status">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <RegionBadge region="US" />
                  <StatusPill tone="success">Active</StatusPill>
                </div>
                <div className="flex items-center justify-between">
                  <RegionBadge region="AU" />
                  <StatusPill tone="muted">Phase 2</StatusPill>
                </div>
                <div className="flex items-center justify-between">
                  <RegionBadge region="SG" />
                  <StatusPill tone="muted">Phase 3</StatusPill>
                </div>
              </div>
            </Section>

            <Section title="Build status" subtitle="Phase 0 / 16">
              <div className="space-y-2.5 text-[13px]">
                <div className="flex items-center justify-between">
                  <span>Scaffold</span>
                  <StatusPill tone="success">Complete</StatusPill>
                </div>
                <div className="flex items-center justify-between">
                  <span>Design system</span>
                  <StatusPill tone="success">Complete</StatusPill>
                </div>
                <div className="flex items-center justify-between">
                  <span>Auth + Org (1.1)</span>
                  <StatusPill tone="warn">In progress</StatusPill>
                </div>
                <div className="flex items-center justify-between">
                  <span>Field + Compliance (1.2)</span>
                  <StatusPill tone="muted">Queued</StatusPill>
                </div>
                <div className="flex items-center justify-between">
                  <span>Payment + Billing (1.3)</span>
                  <StatusPill tone="muted">Queued</StatusPill>
                </div>
                <div className="flex items-center justify-between">
                  <span>Hardening + go-live (1.4)</span>
                  <StatusPill tone="muted">Queued</StatusPill>
                </div>
              </div>
            </Section>
          </div>
        </div>
      </div>
    </PlatformShell>
  );
}
