/**
 * /billing — platform billing summary for the operator.
 *
 * Server component. Reads OrgBilling config + MTD conversion aggregates
 * directly from the shared Prisma client (same pattern as /accounts).
 * Falls back to static KPI fixtures when the DB is unreachable.
 *
 * NOTE: There is no BillingInvoice model in the current schema — invoices
 * are computed on-the-fly from OrgBilling + Conversion aggregates.
 * TODO(M5): wire to /api/billing once a BillingInvoice table is added in
 * a schema migration so per-period invoice history can be persisted.
 *
 * The MiCamp residuals section is also computed (not stored) until the
 * processor supplies a residuals feed.
 * TODO(M5): wire to /api/billing/residuals once MiCamp ISO residual
 * feed is integrated (Phase 1.3).
 *
 * Authorization: super_admin sees all orgs; org-scoped sessions see only
 * their own billing row.
 */
import { Download, ExternalLink, Database, AlertTriangle } from 'lucide-react';
import { Button, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { OperatorShell } from '@/components/OperatorShell';
import { KPIS } from '@/lib/fixtures';
import { getSession } from '@/lib/session';
import { isCrossTenantOperator } from '@/lib/api-helpers';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── types ──────────────────────────────────────────────────────────────────

interface OrgBillingRow {
  orgId: string;
  slug: string;
  tradingName: string;
  platformFeeMonthlyCents: bigint;
  doorRakeCents: bigint;
  insideSalesRakeCents: bigint;
  retargetingRakeCents: bigint;
  processorResidualCents: bigint;
  totalBilledCents: bigint;
  conversionCount: number;
  currency: string;
}

interface BillingData {
  orgs: OrgBillingRow[];
  mtdTotalBilledCents: bigint;
  mtdResidualCents: bigint;
  openInvoiceCount: number;
  source: 'database' | 'fixture-fallback';
  error?: string;
}

// ─── data loader ────────────────────────────────────────────────────────────

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function loadBilling(): Promise<BillingData> {
  const session = await getSession();
  if (!session) {
    return {
      orgs: [],
      mtdTotalBilledCents: 0n,
      mtdResidualCents: 0n,
      openInvoiceCount: 0,
      source: 'fixture-fallback',
    };
  }

  try {
    const { db } = await import('@d2d/database');

    const orgWhere = isCrossTenantOperator(session)
      ? { status: { not: 'archived' as const } }
      : { id: session.orgId ?? '__none__', status: { not: 'archived' as const } };

    const orgs = await db.org.findMany({
      where: orgWhere,
      select: {
        id: true,
        slug: true,
        tradingName: true,
        billing: {
          select: {
            platformFeeMonthlyCents: true,
            doorRakePercent: true,
            insideSalesRakePercent: true,
            retargetingRakePercent: true,
            currency: true,
          },
        },
      },
    });

    const orgIds = orgs.map((o) => o.id);
    const mtdStart = startOfMonth();

    const convAgg = await db.conversion.groupBy({
      by: ['orgId', 'attributionSource'],
      where: { orgId: { in: orgIds }, signedAt: { gte: mtdStart } },
      _sum: { d2dRakeCents: true, processorResidualCents: true },
      _count: { _all: true },
    });

    // Accumulate rake per org per attribution bucket.
    type OrgAgg = {
      doorRakeCents: bigint;
      insideSalesRakeCents: bigint;
      retargetingRakeCents: bigint;
      processorResidualCents: bigint;
      count: number;
    };
    const aggByOrg = new Map<string, OrgAgg>();
    for (const row of convAgg) {
      const existing: OrgAgg = aggByOrg.get(row.orgId) ?? {
        doorRakeCents: 0n,
        insideSalesRakeCents: 0n,
        retargetingRakeCents: 0n,
        processorResidualCents: 0n,
        count: 0,
      };
      const rake = row._sum.d2dRakeCents ?? 0n;
      if (row.attributionSource === 'door') {
        existing.doorRakeCents += rake;
      } else if (row.attributionSource === 'inside_sales') {
        existing.insideSalesRakeCents += rake;
      } else if (row.attributionSource === 'retargeting') {
        existing.retargetingRakeCents += rake;
      } else {
        existing.doorRakeCents += rake;
      }
      existing.processorResidualCents += row._sum.processorResidualCents ?? 0n;
      existing.count += row._count._all;
      aggByOrg.set(row.orgId, existing);
    }

    let mtdTotalBilledCents = 0n;
    let mtdResidualCents = 0n;

    const orgRows: OrgBillingRow[] = orgs.map((o) => {
      const agg = aggByOrg.get(o.id) ?? {
        doorRakeCents: 0n,
        insideSalesRakeCents: 0n,
        retargetingRakeCents: 0n,
        processorResidualCents: 0n,
        count: 0,
      };
      const platformFee = o.billing?.platformFeeMonthlyCents ?? 0n;
      const totalBilledCents =
        platformFee + agg.doorRakeCents + agg.insideSalesRakeCents + agg.retargetingRakeCents;

      mtdTotalBilledCents += totalBilledCents;
      mtdResidualCents += agg.processorResidualCents;

      return {
        orgId: o.id,
        slug: o.slug ?? o.id,
        tradingName: o.tradingName,
        platformFeeMonthlyCents: platformFee,
        doorRakeCents: agg.doorRakeCents,
        insideSalesRakeCents: agg.insideSalesRakeCents,
        retargetingRakeCents: agg.retargetingRakeCents,
        processorResidualCents: agg.processorResidualCents,
        totalBilledCents,
        conversionCount: agg.count,
        currency: o.billing?.currency ?? 'USD',
      };
    });

    // Open invoices: orgs with a billing row that haven't been closed this
    // month. Until BillingInvoice is in the schema, we use a heuristic:
    // any org with MTD billing > 0 and a billing config = 1 open invoice.
    // TODO(M5): replace with a real BillingInvoice model query once the
    // schema migration lands.
    const openInvoiceCount = orgRows.filter((r) => r.totalBilledCents > 0n).length;

    return {
      orgs: orgRows,
      mtdTotalBilledCents,
      mtdResidualCents,
      openInvoiceCount,
      source: 'database',
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[billing] DB load failed, falling back to fixture:', err);
    return {
      orgs: [],
      mtdTotalBilledCents: KPIS.revenueCentsMTD,
      mtdResidualCents: KPIS.processorResidualMTD,
      openInvoiceCount: 1,
      source: 'fixture-fallback',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── page ────────────────────────────────────────────────────────────────────

export default async function BillingPage(): Promise<JSX.Element> {
  const session = await getSession();
  if (!session) redirect('/login?next=/billing');

  const { orgs, mtdTotalBilledCents, mtdResidualCents, openInvoiceCount, source, error } =
    await loadBilling();

  // Blended avg rake per conversion across all orgs.
  const totalConversions = orgs.reduce((s, o) => s + o.conversionCount, 0);
  const totalRakeCents = orgs.reduce(
    (s, o) => s + o.doorRakeCents + o.insideSalesRakeCents + o.retargetingRakeCents,
    0n,
  );
  const avgRakePerConv = totalConversions > 0 ? totalRakeCents / BigInt(totalConversions) : 0n;

  return (
    <OperatorShell pageTitle="Billing & invoices">
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
              title={error}
            >
              <AlertTriangle size={10} /> Fixture fallback
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="MTD billed"
            value={<Money cents={mtdTotalBilledCents} region="US" />}
            hint="platform fee + rake"
          />
          <KpiCard
            label="Open invoices"
            value={openInvoiceCount.toString()}
            hint={
              // TODO(M5): show sum of open invoice totals once BillingInvoice
              // model is in the schema.
              'computed'
            }
          />
          <KpiCard
            label="MiCamp residuals MTD"
            value={<Money cents={mtdResidualCents} region="US" />}
            hint="ISO agreement"
          />
          <KpiCard
            label="Avg rake / conv."
            value={<Money cents={avgRakePerConv} region="US" />}
            hint="blended across buckets"
          />
        </div>

        <Section
          title="MTD billing by org"
          subtitle="Platform fee + per-attribution rake (door 15% · inside-sales 10% · retargeting 5%)"
          paddedBody={false}
          action={
            <Button leftIcon={<Download size={14} />} variant="ghost" size="sm">
              Export CSV
            </Button>
          }
        >
          {/* TODO(M5): wire to /api/billing once BillingInvoice model lands;
              currently shows computed MTD figures from OrgBilling + Conversion
              aggregates — no persisted per-period invoice history yet. */}
          {orgs.length === 0 ? (
            <div className="p-6 text-center text-[13px] text-muted">
              {source === 'fixture-fallback'
                ? 'Database unavailable — invoice history requires a live connection.'
                : 'No billing data yet. Invoices are generated once the first conversion is attributed.'}
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Org</th>
                  <th>Platform fee</th>
                  <th>Door rake</th>
                  <th>Inside sales</th>
                  <th>Retargeting</th>
                  <th>Total MTD</th>
                  <th>Conv. MTD</th>
                  <th>Currency</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((o) => (
                  <tr key={o.orgId}>
                    <td className="text-[13px] text-ink truncate max-w-[180px]">{o.tradingName}</td>
                    <td>
                      <Money cents={o.platformFeeMonthlyCents} region="US" />
                    </td>
                    <td>
                      <Money cents={o.doorRakeCents} region="US" />
                    </td>
                    <td>
                      <Money cents={o.insideSalesRakeCents} region="US" emptyAsDash />
                    </td>
                    <td>
                      <Money cents={o.retargetingRakeCents} region="US" emptyAsDash />
                    </td>
                    <td className="font-medium">
                      <Money cents={o.totalBilledCents} region="US" />
                    </td>
                    <td className="numeric text-[13px]">{o.conversionCount.toLocaleString()}</td>
                    <td>
                      <span className="tag">{o.currency}</span>
                    </td>
                    <td>
                      <button
                        className="text-soft hover:text-ink"
                        aria-label={`View ${o.tradingName} billing detail`}
                      >
                        <ExternalLink size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section
          title="MiCamp ISO residuals"
          subtitle="Processor markup share — separate from D2D platform revenue. Per ADR-0028."
          paddedBody={false}
        >
          {/* TODO(M5): wire to /api/billing/residuals once MiCamp ISO residual
              feed integration is complete (Phase 1.3). Currently shows
              aggregate processorResidualCents from Conversion rows. */}
          {orgs.length === 0 ? (
            <div className="p-6 text-center text-[13px] text-muted">
              MiCamp residuals data requires a live database connection.
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Org</th>
                  <th>Residual earned MTD</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orgs
                  .filter((o) => o.processorResidualCents > 0n)
                  .map((o) => (
                    <tr key={o.orgId}>
                      <td className="text-[13px] text-ink">{o.tradingName}</td>
                      <td className="font-medium">
                        <Money cents={o.processorResidualCents} region="US" />
                      </td>
                      <td>
                        <StatusPill tone="warn">Pending payout</StatusPill>
                      </td>
                    </tr>
                  ))}
                {orgs.filter((o) => o.processorResidualCents > 0n).length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center text-[13px] text-muted py-4">
                      No residuals accrued this month yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </Section>
      </div>
    </OperatorShell>
  );
}
