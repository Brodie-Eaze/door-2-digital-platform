/**
 * /billing — invoices + per-org billing configuration. Server component,
 * live Prisma reads. No fixture fallback.
 *
 * MiCamp ISO residual detail (grouped monthly, by-org volume) lives on
 * /billing/processor — this page shows only the current-month residual KPI
 * plus a link, so the two surfaces don't compute overlapping monthly
 * breakdowns from two different code paths.
 */
import Link from 'next/link';
import { ArrowRight, Download, ExternalLink } from 'lucide-react';
import { Banner, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import type { Tone } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { ToastButton } from '@/components/ToastButton';
import { InvoicesEmpty } from '@/components/PlatformEmptyStates';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface InvoiceRow {
  id: string;
  orgName: string;
  regionCode: 'US' | 'AU' | 'SG';
  periodStart: Date;
  platformFeeCents: bigint;
  doorRakeCents: bigint;
  insideSalesRakeCents: bigint;
  retargetingRakeCents: bigint;
  totalCents: bigint;
  status: string;
}

interface OrgBillingRow {
  orgName: string;
  regionCode: 'US' | 'AU' | 'SG';
  platformFeeMonthlyCents: bigint;
  doorRakePercent: number;
  insideSalesRakePercent: number;
  retargetingRakePercent: number;
  billingDay: number;
  currency: string;
}

interface BillingData {
  invoices: InvoiceRow[];
  orgBilling: OrgBillingRow[];
  mtdBilledCents: bigint;
  openCount: number;
  openCents: bigint;
  micampResidualMtdCents: bigint;
  avgRakePerConvCents: bigint;
  error?: string;
}

function statusTone(status: string): Tone {
  if (status === 'paid') return 'success';
  if (status === 'sent') return 'info';
  if (status === 'void') return 'danger';
  return 'muted';
}

async function loadBilling(): Promise<BillingData> {
  const empty: BillingData = {
    invoices: [],
    orgBilling: [],
    mtdBilledCents: 0n,
    openCount: 0,
    openCents: 0n,
    micampResidualMtdCents: 0n,
    avgRakePerConvCents: 0n,
  };

  try {
    const { db } = await import('@d2d/database');

    const mtdStart = new Date();
    mtdStart.setUTCDate(1);
    mtdStart.setUTCHours(0, 0, 0, 0);

    const [invoices, orgBillingRows, mtdInvoiceAgg, openAgg, micampAgg, rakeAgg] =
      await Promise.all([
        db.invoice.findMany({
          orderBy: { createdAt: 'desc' },
          take: 25,
          include: { org: { select: { tradingName: true, regionCode: true } } },
        }),
        db.orgBilling.findMany({
          include: { org: { select: { tradingName: true, regionCode: true } } },
          orderBy: { updatedAt: 'desc' },
        }),
        db.invoice.aggregate({
          _sum: { totalCents: true },
          where: { createdAt: { gte: mtdStart } },
        }),
        db.invoice.aggregate({
          _count: { _all: true },
          _sum: { totalCents: true },
          where: { status: 'sent' },
        }),
        db.conversion.aggregate({
          _sum: { processorResidualCents: true },
          where: { paymentProvider: 'micamp', signedAt: { gte: mtdStart } },
        }),
        db.conversion.aggregate({
          _avg: { d2dRakeCents: true },
          where: { signedAt: { gte: mtdStart } },
        }),
      ]);

    return {
      invoices: invoices.map((inv) => ({
        id: inv.id,
        orgName: inv.org.tradingName,
        regionCode: inv.org.regionCode,
        periodStart: inv.periodStart,
        platformFeeCents: inv.platformFeeCents,
        doorRakeCents: inv.doorRakeCents,
        insideSalesRakeCents: inv.insideSalesRakeCents,
        retargetingRakeCents: inv.retargetingRakeCents,
        totalCents: inv.totalCents,
        status: inv.status,
      })),
      orgBilling: orgBillingRows.map((b) => ({
        orgName: b.org.tradingName,
        regionCode: b.org.regionCode,
        platformFeeMonthlyCents: b.platformFeeMonthlyCents,
        doorRakePercent: Number(b.doorRakePercent),
        insideSalesRakePercent: Number(b.insideSalesRakePercent),
        retargetingRakePercent: Number(b.retargetingRakePercent),
        billingDay: b.billingDay,
        currency: b.currency,
      })),
      mtdBilledCents: mtdInvoiceAgg._sum.totalCents ?? 0n,
      openCount: openAgg._count._all,
      openCents: openAgg._sum.totalCents ?? 0n,
      micampResidualMtdCents: micampAgg._sum.processorResidualCents ?? 0n,
      avgRakePerConvCents: BigInt(Math.round(rakeAgg._avg.d2dRakeCents ?? 0)),
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[billing] DB load failed:', err);
    return { ...empty, error: err instanceof Error ? err.message : String(err) };
  }
}

export default async function BillingPage(): Promise<JSX.Element> {
  const {
    invoices,
    orgBilling,
    mtdBilledCents,
    openCount,
    openCents,
    micampResidualMtdCents,
    avgRakePerConvCents,
    error,
  } = await loadBilling();

  return (
    <PlatformShell pageTitle="Billing & invoices">
      <div className="space-y-6 max-w-[1280px]">
        {error && (
          <Banner tone="warn">
            <span className="text-[13px]">
              Could not load billing data: {error}. Refresh to retry.
            </span>
          </Banner>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="MTD billed" value={<Money cents={mtdBilledCents} region="US" />} />
          <KpiCard
            label="Open invoices"
            value={openCount.toString()}
            hint={<Money cents={openCents} region="US" />}
          />
          <KpiCard
            label="MiCamp residuals MTD"
            value={<Money cents={micampResidualMtdCents} region="US" />}
            hint="ISO agreement"
          />
          <KpiCard
            label="Avg rake / conv."
            value={<Money cents={avgRakePerConvCents} region="US" />}
            hint="blended across buckets, MTD"
          />
        </div>

        {invoices.length === 0 ? (
          <InvoicesEmpty />
        ) : (
          <Section
            title="Recent invoices"
            subtitle="Platform fee + per-attribution rake, from Invoice rows"
            paddedBody={false}
            action={
              <div className="flex items-center gap-2">
                <DataSourceBadge source="live" />
                <ToastButton
                  leftIcon={<Download size={14} />}
                  variant="ghost"
                  size="sm"
                  message="Export CSV — wiring lands in Phase 1.2"
                >
                  Export CSV
                </ToastButton>
              </div>
            }
          >
            <table className="tbl">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Org</th>
                  <th>Period</th>
                  <th>Platform</th>
                  <th>Door</th>
                  <th>Inside</th>
                  <th>Retarget</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <span className="mono text-[10px] !w-auto !px-2">{inv.id}</span>
                    </td>
                    <td className="text-[13px] text-ink truncate max-w-[180px]">{inv.orgName}</td>
                    <td className="text-[12px] text-muted">
                      {inv.periodStart.toISOString().slice(0, 7)}
                    </td>
                    <td>
                      <Money cents={inv.platformFeeCents} region={inv.regionCode} />
                    </td>
                    <td>
                      <Money cents={inv.doorRakeCents} region={inv.regionCode} emptyAsDash />
                    </td>
                    <td>
                      <Money cents={inv.insideSalesRakeCents} region={inv.regionCode} emptyAsDash />
                    </td>
                    <td>
                      <Money cents={inv.retargetingRakeCents} region={inv.regionCode} emptyAsDash />
                    </td>
                    <td className="font-medium">
                      <Money cents={inv.totalCents} region={inv.regionCode} />
                    </td>
                    <td>
                      <StatusPill tone={statusTone(inv.status)}>
                        {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                      </StatusPill>
                    </td>
                    <td>
                      <ToastButton
                        variant="ghost"
                        size="sm"
                        message={`Open invoice ${inv.id} — document viewer wiring lands in Phase 1.2`}
                      >
                        <ExternalLink size={14} />
                      </ToastButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        <Section
          title="Org billing configuration"
          subtitle="Live OrgBilling rows — rake %, platform fee, billing day per org"
          paddedBody={false}
          action={
            <Link
              href="/billing/processor"
              className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline"
            >
              MiCamp processor detail <ArrowRight size={12} />
            </Link>
          }
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Org</th>
                <th>Platform fee</th>
                <th>Door rake</th>
                <th>Inside rake</th>
                <th>Retarget rake</th>
                <th>Billing day</th>
                <th>Currency</th>
              </tr>
            </thead>
            <tbody>
              {orgBilling.map((b, i) => (
                <tr key={`${b.orgName}-${i}`}>
                  <td className="text-[13px] text-ink">{b.orgName}</td>
                  <td>
                    <Money cents={b.platformFeeMonthlyCents} region={b.regionCode} /> / mo
                  </td>
                  <td className="numeric text-[13px]">{b.doorRakePercent.toFixed(2)}%</td>
                  <td className="numeric text-[13px]">{b.insideSalesRakePercent.toFixed(2)}%</td>
                  <td className="numeric text-[13px]">{b.retargetingRakePercent.toFixed(2)}%</td>
                  <td className="numeric text-[12px] text-muted">
                    {b.billingDay === 1 ? '1st' : `${b.billingDay}th`}
                  </td>
                  <td className="text-[12px] text-muted">{b.currency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
    </PlatformShell>
  );
}
