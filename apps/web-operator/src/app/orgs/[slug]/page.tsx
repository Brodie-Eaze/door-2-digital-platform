/**
 * /orgs/[slug] — deep profile for any org, addressed by slug. Replaces the
 * old hardcoded /orgs/pilot-charlie page. Live Prisma only: org row +
 * per-org counts + billing summary. No fixture fallback.
 *
 * Authorization: super_admin can open any org; everyone else only their own
 * (`session.orgId`). An org that doesn't exist, or one the caller isn't
 * authorized for, 404s — default-deny, and 404 (rather than 403) avoids
 * confirming a slug exists to a caller who isn't allowed to see it.
 *
 * Note: paid-solicitor state clearance for this org lives on /compliance —
 * not duplicated here, to keep this page to what the route actually owns
 * (identity, usage, billing).
 */
import { notFound, redirect } from 'next/navigation';
import { Building2, Calendar, CreditCard, Globe, ShieldCheck } from 'lucide-react';
import { KpiCard, Money, RegionBadge, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { getSession } from '@/lib/session';
import { isCrossTenantOperator } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface OrgProfile {
  id: string;
  legalName: string;
  tradingName: string;
  slug: string;
  vertical: string;
  regionCode: 'US' | 'AU' | 'SG';
  type: string;
  status: string;
  createdAt: Date;
  ssoProvider: string | null;
  dedicatedDb: boolean;
  brandKit: { customDomain: string | null; appBundleId: string | null } | null;
  billing: {
    platformFeeMonthlyCents: bigint;
    doorRakePercent: number;
    insideSalesRakePercent: number;
    retargetingRakePercent: number;
    billingDay: number;
    currency: string;
  } | null;
  users: number;
  knockers: number;
  insideSalesReps: number;
  leads: number;
  conversionsMTD: number;
  revenueCentsMTD: bigint;
}

async function loadOrg(slug: string): Promise<OrgProfile | null> {
  const { db } = await import('@d2d/database');

  const org = await db.org.findFirst({
    where: { slug },
    select: {
      id: true,
      legalName: true,
      tradingName: true,
      slug: true,
      vertical: true,
      regionCode: true,
      type: true,
      status: true,
      createdAt: true,
      ssoProvider: true,
      dedicatedDb: true,
      brandKit: { select: { customDomain: true, appBundleId: true } },
      billing: {
        select: {
          platformFeeMonthlyCents: true,
          doorRakePercent: true,
          insideSalesRakePercent: true,
          retargetingRakePercent: true,
          billingDay: true,
          currency: true,
        },
      },
    },
  });
  if (!org || !org.slug) return null;

  const mtdStart = new Date();
  mtdStart.setUTCDate(1);
  mtdStart.setUTCHours(0, 0, 0, 0);

  const [users, knockers, insideSalesReps, leads, convAgg] = await Promise.all([
    db.user.count({ where: { orgId: org.id, status: { not: 'archived' } } }),
    db.user.count({ where: { orgId: org.id, role: 'knocker', status: { not: 'archived' } } }),
    db.user.count({
      where: { orgId: org.id, role: 'inside_sales', status: { not: 'archived' } },
    }),
    db.lead.count({ where: { orgId: org.id } }),
    db.conversion.aggregate({
      _count: { _all: true },
      _sum: { amountCents: true },
      where: { orgId: org.id, signedAt: { gte: mtdStart } },
    }),
  ]);

  return {
    id: org.id,
    legalName: org.legalName,
    tradingName: org.tradingName,
    slug: org.slug,
    vertical: org.vertical,
    regionCode: org.regionCode,
    type: org.type,
    status: org.status,
    createdAt: org.createdAt,
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
          currency: org.billing.currency,
        }
      : null,
    users,
    knockers,
    insideSalesReps,
    leads,
    conversionsMTD: convAgg._count._all,
    revenueCentsMTD: convAgg._sum.amountCents ?? 0n,
  };
}

export default async function OrgProfilePage({
  params: paramsPromise,
}: {
  params: Promise<{ slug: string }>;
}): Promise<JSX.Element> {
  const { slug } = await paramsPromise;
  const session = await getSession();
  if (!session) redirect(`/login?next=/orgs/${slug}`);

  let org: OrgProfile | null;
  try {
    org = await loadOrg(slug);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[orgs/:slug] DB load failed:', err);
    org = null;
  }
  if (!org) notFound();
  if (!isCrossTenantOperator(session) && session.orgId !== org.id) notFound();

  return (
    <PlatformShell pageTitle={org.tradingName}>
      <div className="space-y-6 max-w-[1280px]">
        <div className="card card-pad">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-ink/5 flex items-center justify-center">
                <Building2 size={24} className="text-ink" />
              </div>
              <div>
                <div className="text-base font-semibold text-ink tracking-tight">
                  {org.legalName}
                </div>
                <div className="text-xs text-muted mt-0.5">
                  {org.tradingName} · {org.slug}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <RegionBadge region={org.regionCode} />
                  <span className="pill capitalize">{org.vertical}</span>
                  <StatusPill tone={org.status === 'active' ? 'success' : 'muted'}>
                    {org.status === 'active' ? 'Active' : org.status}
                  </StatusPill>
                </div>
              </div>
            </div>
            <div className="text-right flex flex-col items-end gap-2">
              <DataSourceBadge source="live" />
              <div>
                <div className="text-[11px] text-muted uppercase tracking-wider">Onboarded</div>
                <div className="text-[13px] font-semibold text-ink mt-0.5 numeric">
                  {org.createdAt.toISOString().slice(0, 10)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Users" value={org.users} hint="all roles, active" />
          <KpiCard label="Knockers" value={org.knockers} hint="active field reps" />
          <KpiCard label="Inside sales" value={org.insideSalesReps} hint="call-centre seats" />
          <KpiCard label="Leads (all time)" value={org.leads.toLocaleString()} />
          <KpiCard
            label="MTD conversions"
            value={org.conversionsMTD.toLocaleString()}
            hint="signed this month"
          />
          <KpiCard
            label="MTD revenue"
            value={<Money cents={org.revenueCentsMTD} region={org.regionCode} />}
            hint="fee + rake"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section title="Billing" subtitle="OrgBilling row for this org">
            {org.billing ? (
              <div className="space-y-3 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted flex items-center gap-2">
                    <CreditCard size={14} className="text-soft" />
                    Platform fee
                  </span>
                  <span className="numeric font-medium text-ink">
                    <Money cents={org.billing.platformFeeMonthlyCents} region={org.regionCode} /> /
                    mo
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Door-sale rake</span>
                  <span className="numeric font-medium text-ink">
                    {org.billing.doorRakePercent.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Inside-sales rake</span>
                  <span className="numeric font-medium text-ink">
                    {org.billing.insideSalesRakePercent.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Retargeting rake</span>
                  <span className="numeric font-medium text-ink">
                    {org.billing.retargetingRakePercent.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-line2 pt-3 mt-3">
                  <span className="text-muted flex items-center gap-2">
                    <Calendar size={14} className="text-soft" />
                    Billing day
                  </span>
                  <span className="numeric font-medium text-ink">
                    {org.billing.billingDay === 1
                      ? '1st of month'
                      : `${org.billing.billingDay}th of month`}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-muted">No OrgBilling row configured for this org.</p>
            )}
          </Section>

          <Section title="Integrations" subtitle="Tenant-specific config">
            <div className="space-y-3 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-muted flex items-center gap-2">
                  <ShieldCheck size={14} className="text-soft" />
                  SSO provider
                </span>
                <span className="font-medium text-ink capitalize">
                  {org.ssoProvider ?? <span className="text-soft font-normal">Not configured</span>}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">White-label domain</span>
                <span className="font-medium text-ink truncate">
                  {org.brandKit?.customDomain ?? (
                    <span className="text-soft font-normal">Not set</span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Dedicated DB</span>
                <StatusPill tone={org.dedicatedDb ? 'success' : 'muted'}>
                  {org.dedicatedDb ? 'Provisioned' : 'Shared'}
                </StatusPill>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted flex items-center gap-2">
                  <Globe size={14} className="text-soft" />
                  iOS bundle ID
                </span>
                <span className="font-medium text-ink truncate">
                  {org.brandKit?.appBundleId ?? <span className="text-soft font-normal">—</span>}
                </span>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </PlatformShell>
  );
}
