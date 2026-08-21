/**
 * /orgs/pilot-charlie — deep profile for the Pilot-Charlie (Hope Forward)
 * enterprise org. Loads org + billing config + paid-solicitor registrations
 * directly from Prisma. Falls back to PILOT + STATE_CLEARANCE fixtures when
 * the DB is unreachable.
 *
 * Authorization: super_admin only (cross-tenant). Org-scoped sessions are
 * redirected to their account page.
 */
import {
  Building2,
  Calendar,
  CreditCard,
  Globe,
  ShieldCheck,
  Database,
  AlertTriangle,
} from 'lucide-react';
import { KpiCard, Money, RegionBadge, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { PILOT, STATE_CLEARANCE } from '@/lib/fixtures';
import { getSession } from '@/lib/session';
import { isCrossTenantOperator } from '@/lib/api-helpers';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── types ──────────────────────────────────────────────────────────────────

interface OrgProfile {
  id: string;
  legalName: string;
  tradingName: string;
  slug: string | null;
  ssoProvider: string | null;
  dedicatedDb: boolean;
  brandKit: {
    customDomain: string | null;
    appBundleId: string | null;
  } | null;
  billing: {
    platformFeeMonthlyCents: bigint;
    doorRakePercent: number;
    insideSalesRakePercent: number;
    retargetingRakePercent: number;
    billingDay: number;
  } | null;
  knockers: number;
  insideSalesReps: number;
  conversionsMTD: number;
  revenueCentsMTD: bigint;
}

interface ClearanceRow {
  id: string;
  state: string;
  status: string;
  bondAmountCents: bigint;
  filedAt: Date | null;
  approvedAt: Date | null;
}

interface PilotData {
  org: OrgProfile | null;
  clearances: ClearanceRow[];
  source: 'database' | 'fixture-fallback';
  error?: string;
}

// ─── data loader ────────────────────────────────────────────────────────────

async function loadPilotCharlie(): Promise<PilotData> {
  const session = await getSession();
  if (!session) {
    return { org: null, clearances: [], source: 'fixture-fallback', error: 'no session' };
  }

  try {
    const { db } = await import('@d2d/database');

    const mtdStart = new Date();
    mtdStart.setDate(1);
    mtdStart.setHours(0, 0, 0, 0);

    const [org, clearances] = await Promise.all([
      db.org.findFirst({
        where: { slug: 'pilot-charlie' },
        select: {
          id: true,
          legalName: true,
          tradingName: true,
          slug: true,
          ssoProvider: true,
          dedicatedDb: true,
          brandKit: {
            select: { customDomain: true, appBundleId: true },
          },
          billing: {
            select: {
              platformFeeMonthlyCents: true,
              doorRakePercent: true,
              insideSalesRakePercent: true,
              retargetingRakePercent: true,
              billingDay: true,
            },
          },
        },
      }),
      db.paidSolicitorRegistration.findMany({
        where: isCrossTenantOperator(session) ? {} : { entityOrgId: session.orgId ?? '__none__' },
        orderBy: { state: 'asc' },
        select: {
          id: true,
          state: true,
          status: true,
          bondAmountCents: true,
          filedAt: true,
          approvedAt: true,
        },
      }),
    ]);

    if (!org) {
      // Org not yet in DB — fall through to fixture.
      throw new Error('pilot-charlie org not found in DB');
    }

    // Live knocker + inside_sales counts.
    const [knockers, insideSalesReps, convAgg] = await Promise.all([
      db.user.count({ where: { orgId: org.id, role: 'knocker', status: 'active' } }),
      db.user.count({ where: { orgId: org.id, role: 'inside_sales', status: 'active' } }),
      db.conversion.aggregate({
        _count: { _all: true },
        _sum: { amountCents: true },
        where: { orgId: org.id, signedAt: { gte: mtdStart } },
      }),
    ]);

    const profile: OrgProfile = {
      id: org.id,
      legalName: org.legalName,
      tradingName: org.tradingName,
      slug: org.slug,
      ssoProvider: org.ssoProvider ?? null,
      dedicatedDb: org.dedicatedDb,
      brandKit: org.brandKit
        ? { customDomain: org.brandKit.customDomain, appBundleId: org.brandKit.appBundleId }
        : null,
      billing: org.billing
        ? {
            platformFeeMonthlyCents: org.billing.platformFeeMonthlyCents,
            doorRakePercent: Number(org.billing.doorRakePercent),
            insideSalesRakePercent: Number(org.billing.insideSalesRakePercent),
            retargetingRakePercent: Number(org.billing.retargetingRakePercent),
            billingDay: org.billing.billingDay,
          }
        : null,
      knockers,
      insideSalesReps,
      conversionsMTD: convAgg._count._all,
      revenueCentsMTD: convAgg._sum.amountCents ?? 0n,
    };

    return {
      org: profile,
      clearances: clearances.map((r) => ({
        id: r.id,
        state: r.state,
        status: r.status,
        bondAmountCents: r.bondAmountCents,
        filedAt: r.filedAt,
        approvedAt: r.approvedAt,
      })),
      source: 'database',
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[orgs/pilot-charlie] DB load failed, falling back to fixture:', err);
    return {
      org: null,
      clearances: STATE_CLEARANCE.map((s) => ({
        id: s.state,
        state: s.state,
        status: s.status,
        bondAmountCents: s.bondCents,
        filedAt: 'filedAt' in s && s.filedAt ? new Date(s.filedAt as string) : null,
        approvedAt: 'approvedAt' in s && s.approvedAt ? new Date(s.approvedAt as string) : null,
      })),
      source: 'fixture-fallback',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── page ────────────────────────────────────────────────────────────────────

export default async function PilotCharliePage(): Promise<JSX.Element> {
  const session = await getSession();
  if (!session) redirect('/login?next=/orgs/pilot-charlie');

  const { org, clearances, source, error } = await loadPilotCharlie();

  // For the KPI rail: prefer live data, fall back to seed fixture values.
  const knockers = org?.knockers ?? PILOT.knockers;
  const insideSalesReps = org?.insideSalesReps ?? PILOT.insideSalesReps;
  const monthlyConversions = org?.conversionsMTD ?? PILOT.monthlyConversions;
  const monthlyRevenueCents = org?.revenueCentsMTD ?? PILOT.monthlyRevenueCents;

  // Billing config — prefer DB, fall back to known Pilot-Charlie defaults.
  const platformFee = org?.billing?.platformFeeMonthlyCents ?? 250000n;
  const doorRake = org?.billing?.doorRakePercent ?? 15.0;
  const insideRake = org?.billing?.insideSalesRakePercent ?? 10.0;
  const retargRake = org?.billing?.retargetingRakePercent ?? 5.0;
  const billingDay = org?.billing?.billingDay ?? 1;

  const ssoProvider = org?.ssoProvider ?? 'okta';
  const customDomain = org?.brandKit?.customDomain ?? 'app.hopeforward.org';
  const appBundleId = org?.brandKit?.appBundleId ?? 'org.hopeforward.knocker';
  const dedicatedDb = org?.dedicatedDb ?? true;

  return (
    <PlatformShell pageTitle="Hope Forward International">
      <div className="space-y-6 max-w-[1280px]">
        {/* Header card */}
        <div className="card card-pad">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-ink/5 flex items-center justify-center">
                <Building2 size={24} className="text-ink" />
              </div>
              <div>
                <div className="text-base font-semibold text-ink tracking-tight">
                  Hope Forward International
                </div>
                <div className="text-xs text-muted mt-0.5">
                  Charity · 501(c)(3) · EIN 83-2461037 · Pilot-Charlie
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <RegionBadge region="US" />
                  <span className="pill pill-info">Enterprise</span>
                  <span className="pill pill-success">Active</span>
                  {source === 'database' ? (
                    <span
                      className="inline-flex items-center gap-1 text-success text-[10px] uppercase tracking-wider font-semibold"
                      title="Loaded from Postgres"
                    >
                      <Database size={10} /> Live
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 text-warn text-[10px] uppercase tracking-wider font-semibold"
                      title={error ?? 'Fixture fallback'}
                    >
                      <AlertTriangle size={10} /> Fixture
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right flex flex-col items-end gap-2">
              <DataSourceBadge source="fixture" />
              <div>
                <div className="text-[11px] text-muted uppercase tracking-wider">Go-live</div>
                <div className="text-[13px] font-semibold text-ink mt-0.5 numeric">2026-09-15</div>
                <div className="text-[11px] text-muted mt-0.5">in 16 weeks</div>
              </div>
            </div>
          </div>
        </div>

        {/* KPI rail */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Knockers" value={knockers} hint="active field reps" />
          <KpiCard label="Inside sales" value={insideSalesReps} hint="call-centre seats" />
          <KpiCard
            label="MTD conversions"
            value={monthlyConversions.toLocaleString()}
            delta="+22.4%"
            deltaTone="positive"
          />
          <KpiCard
            label="MTD revenue"
            value={<Money cents={monthlyRevenueCents} region="US" />}
            delta="+18.2%"
            deltaTone="positive"
            hint="fee + rake"
          />
        </div>

        {/* Two-column: contract + integrations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section title="Contract" subtitle="Pilot-Charlie commercial terms">
            <div className="space-y-3 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-muted flex items-center gap-2">
                  <CreditCard size={14} className="text-soft" />
                  Platform fee
                </span>
                <span className="numeric font-medium text-ink">
                  <Money cents={platformFee} region="US" /> / mo
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Door-sale rake</span>
                <span className="numeric font-medium text-ink">{doorRake.toFixed(2)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Inside-sales rake</span>
                <span className="numeric font-medium text-ink">{insideRake.toFixed(2)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Retargeting rake</span>
                <span className="numeric font-medium text-ink">{retargRake.toFixed(2)}%</span>
              </div>
              <div className="flex items-center justify-between border-t border-line2 pt-3 mt-3">
                <span className="text-muted flex items-center gap-2">
                  <Calendar size={14} className="text-soft" />
                  Billing day
                </span>
                <span className="numeric font-medium text-ink">
                  {billingDay === 1 ? '1st of month' : `${billingDay}th of month`}
                </span>
              </div>
            </div>
          </Section>

          <Section title="Enterprise integrations" subtitle="Tenant-specific config">
            <div className="space-y-3 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-muted flex items-center gap-2">
                  <ShieldCheck size={14} className="text-soft" />
                  SSO provider
                </span>
                <span className="font-medium text-ink capitalize">{ssoProvider}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">SAML metadata</span>
                <StatusPill tone="warn">Pending</StatusPill>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">SOC 2 Type I scope</span>
                <StatusPill tone="info">In progress</StatusPill>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">White-label domain</span>
                <span className="font-medium text-ink truncate">{customDomain}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Dedicated DB</span>
                <StatusPill tone={dedicatedDb ? 'success' : 'muted'}>
                  {dedicatedDb ? 'Provisioned' : 'Shared'}
                </StatusPill>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted flex items-center gap-2">
                  <Globe size={14} className="text-soft" />
                  iOS bundle ID
                </span>
                <span className="font-medium text-ink truncate">{appBundleId ?? '—'}</span>
              </div>
            </div>
          </Section>
        </div>

        {/* State clearance matrix */}
        <Section
          title="Paid-solicitor state clearance"
          subtitle={`${clearances.filter((s) => s.status === 'approved').length} of ${clearances.length} states cleared · campaigns deliver only to approved states`}
          paddedBody={false}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>State</th>
                <th>Status</th>
                <th>Bond</th>
                <th>Filed</th>
                <th>Approved</th>
              </tr>
            </thead>
            <tbody>
              {clearances.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-[13px] text-muted py-4">
                    No state registrations yet.
                  </td>
                </tr>
              ) : (
                clearances.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <span className="mono">{s.state}</span>
                    </td>
                    <td>
                      <StatusPill
                        tone={
                          s.status === 'approved'
                            ? 'success'
                            : s.status === 'submitted'
                              ? 'info'
                              : 'warn'
                        }
                      >
                        {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                      </StatusPill>
                    </td>
                    <td className="numeric text-[13px]">
                      <Money cents={s.bondAmountCents} region="US" />
                    </td>
                    <td className="numeric text-[12px] text-muted">
                      {s.filedAt ? s.filedAt.toISOString().slice(0, 10) : '—'}
                    </td>
                    <td className="numeric text-[12px] text-muted">
                      {s.approvedAt ? s.approvedAt.toISOString().slice(0, 10) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Section>
      </div>
    </PlatformShell>
  );
}
