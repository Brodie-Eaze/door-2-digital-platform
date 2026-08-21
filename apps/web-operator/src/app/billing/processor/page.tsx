/**
 * /billing/processor — MiCamp ISO residual detail. Server component, live
 * `Conversion` reads (paymentProvider = 'micamp'). No fixture fallback.
 *
 * The old fixture invented a "gross residual vs MiCamp split" distinction
 * and a per-org "settled / in transit" status — neither concept has a
 * backing model (`Conversion.processorResidualCents` is a single computed
 * figure, and there's no settlement-status field for ISO residuals). Both
 * are dropped rather than fabricated; this page shows only what the schema
 * actually carries.
 */
import Link from 'next/link';
import { ArrowLeft, Download, ExternalLink } from 'lucide-react';
import { Banner, KpiCard, Money, Section } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { ToastButton } from '@/components/ToastButton';
import { ProcessorVolumeEmpty } from '@/components/PlatformEmptyStates';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface OrgVolume {
  orgId: string;
  orgName: string;
  regionCode: 'US' | 'AU' | 'SG';
  volumeCents: bigint;
  txns: number;
  avgTicketCents: bigint;
}

interface MonthBucket {
  period: string; // 'YYYY-MM'
  volumeCents: bigint;
  txns: number;
  residualCents: bigint;
}

interface ProcessorData {
  volumeMtdCents: bigint;
  residualMtdCents: bigint;
  txnsMtd: number;
  byOrg: OrgVolume[];
  byMonth: MonthBucket[];
  error?: string;
}

async function loadProcessor(): Promise<ProcessorData> {
  const empty: ProcessorData = {
    volumeMtdCents: 0n,
    residualMtdCents: 0n,
    txnsMtd: 0,
    byOrg: [],
    byMonth: [],
  };

  try {
    const { db } = await import('@d2d/database');

    const mtdStart = new Date();
    mtdStart.setUTCDate(1);
    mtdStart.setUTCHours(0, 0, 0, 0);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setUTCMonth(sixMonthsAgo.getUTCMonth() - 5);
    sixMonthsAgo.setUTCDate(1);
    sixMonthsAgo.setUTCHours(0, 0, 0, 0);

    const [mtdAgg, byOrgGroup, monthRows] = await Promise.all([
      db.conversion.aggregate({
        _sum: { amountCents: true, processorResidualCents: true },
        _count: { _all: true },
        where: { paymentProvider: 'micamp', signedAt: { gte: mtdStart } },
      }),
      db.conversion.groupBy({
        by: ['orgId'],
        where: { paymentProvider: 'micamp', signedAt: { gte: mtdStart } },
        _sum: { amountCents: true },
        _count: { _all: true },
      }),
      // Monthly buckets computed IN THE DB (date_trunc), not by loading every
      // conversion row into the server. At scale this table holds millions of
      // rows over six months — the old findMany streamed them all into memory
      // just to group by month in JS (an OOM waiting to happen). This returns
      // ~6 rows. BigInt sums come back as text and are parsed below.
      db.$queryRaw<Array<{ period: string; volume: string; txns: number; residual: string }>>`
        SELECT to_char(date_trunc('month', "signedAt"), 'YYYY-MM') AS period,
               SUM("amountCents")::text AS volume,
               COUNT(*)::int AS txns,
               SUM("processorResidualCents")::text AS residual
        FROM "Conversion"
        WHERE "paymentProvider"::text = 'micamp' AND "signedAt" >= ${sixMonthsAgo}
        GROUP BY 1
        ORDER BY 1 DESC
      `,
    ]);

    const orgIds = byOrgGroup.map((g) => g.orgId);
    const orgs = orgIds.length
      ? await db.org.findMany({
          where: { id: { in: orgIds } },
          select: { id: true, tradingName: true, regionCode: true },
        })
      : [];
    const orgById = new Map(orgs.map((o) => [o.id, o]));

    const byOrg: OrgVolume[] = byOrgGroup.map((g) => {
      const org = orgById.get(g.orgId);
      const volumeCents = g._sum.amountCents ?? 0n;
      const txns = g._count._all;
      return {
        orgId: g.orgId,
        orgName: org?.tradingName ?? g.orgId,
        regionCode: org?.regionCode ?? 'US',
        volumeCents,
        txns,
        avgTicketCents: txns > 0 ? volumeCents / BigInt(txns) : 0n,
      };
    });

    const byMonth: MonthBucket[] = monthRows.map((r) => ({
      period: r.period,
      volumeCents: BigInt(r.volume ?? '0'),
      txns: Number(r.txns),
      residualCents: BigInt(r.residual ?? '0'),
    }));

    return {
      volumeMtdCents: mtdAgg._sum.amountCents ?? 0n,
      residualMtdCents: mtdAgg._sum.processorResidualCents ?? 0n,
      txnsMtd: mtdAgg._count._all,
      byOrg,
      byMonth,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[billing/processor] DB load failed:', err);
    return { ...empty, error: err instanceof Error ? err.message : String(err) };
  }
}

export default async function ProcessorPage(): Promise<JSX.Element> {
  const { volumeMtdCents, residualMtdCents, txnsMtd, byOrg, byMonth, error } =
    await loadProcessor();
  const residualRate =
    volumeMtdCents > 0n ? (Number(residualMtdCents) / Number(volumeMtdCents)) * 100 : 0;
  const totalVolume = byOrg.reduce((a, t) => a + t.volumeCents, 0n);
  const totalTxns = byOrg.reduce((a, t) => a + t.txns, 0);

  return (
    <PlatformShell pageTitle="Billing · MiCamp processor">
      <div className="space-y-6 max-w-[1280px]">
        <Link
          href="/billing"
          className="inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-ink"
        >
          <ArrowLeft size={13} /> Back to billing
        </Link>

        {error && (
          <Banner tone="warn">
            <span className="text-[13px]">
              Could not load processor data: {error}. Refresh to retry.
            </span>
          </Banner>
        )}

        <Banner tone="info">
          <span className="text-[13px]">
            MiCamp ISO residuals — D2D&apos;s share of processor markup, separate from platform
            revenue (per ADR-0028). Computed per conversion as{' '}
            <code className="kbd">Conversion.processorResidualCents</code>.
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Processed volume MTD"
            value={<Money cents={volumeMtdCents} region="US" />}
          />
          <KpiCard
            label="ISO residual MTD"
            value={<Money cents={residualMtdCents} region="US" />}
            hint="net to D2D"
          />
          <KpiCard label="Transactions MTD" value={txnsMtd.toLocaleString()} />
          <KpiCard
            label="Residual rate"
            value={`${residualRate.toFixed(3)}%`}
            hint="of processed volume, MTD"
          />
        </div>

        {byOrg.length === 0 ? (
          <ProcessorVolumeEmpty />
        ) : (
          <>
            <Section
              title="Processor volume by org"
              subtitle="MiCamp-processed card volume this month, by org"
              action={<DataSourceBadge source="live" />}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {byOrg.map((t) => (
                  <div key={t.orgId} className="rounded-lg border border-line2 p-4">
                    <div className="text-[13px] font-medium text-ink">{t.orgName}</div>
                    <div className="mt-3 text-[22px] font-semibold text-ink">
                      <Money cents={t.volumeCents} region={t.regionCode} />
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-[12px] text-muted">
                      <span>{t.txns.toLocaleString()} txns</span>
                      <span>
                        avg ticket <Money cents={t.avgTicketCents} region={t.regionCode} />
                      </span>
                    </div>
                  </div>
                ))}
                <div className="rounded-lg border border-line2 p-4 bg-paper">
                  <span className="text-[12px] text-muted uppercase tracking-wide">Total</span>
                  <div className="mt-3 text-[22px] font-semibold text-ink">
                    <Money cents={totalVolume} region="US" />
                  </div>
                  <div className="mt-2 text-[12px] text-muted">
                    {totalTxns.toLocaleString()} txns
                  </div>
                </div>
              </div>
            </Section>

            <Section
              title="Residual by month"
              subtitle="Processed volume, transactions, and ISO residual per calendar month"
              paddedBody={false}
              action={
                <div className="flex items-center gap-2">
                  <DataSourceBadge source="live" />
                  <ToastButton
                    leftIcon={<Download size={14} />}
                    variant="ghost"
                    size="sm"
                    message="Export residuals CSV — MiCamp feed export lands in Phase 1.2."
                  >
                    Export
                  </ToastButton>
                </div>
              }
            >
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Processed volume</th>
                    <th>Txns</th>
                    <th>ISO residual</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {byMonth.map((r) => (
                    <tr key={r.period}>
                      <td className="text-[13px] text-ink">{r.period}</td>
                      <td>
                        <Money cents={r.volumeCents} region="US" />
                      </td>
                      <td className="numeric text-[12px] text-muted">{r.txns.toLocaleString()}</td>
                      <td className="font-medium">
                        <Money cents={r.residualCents} region="US" />
                      </td>
                      <td>
                        <ToastButton
                          variant="ghost"
                          size="sm"
                          message={`Open ${r.period} settlement statement — MiCamp document link lands in Phase 1.2.`}
                        >
                          <ExternalLink size={14} />
                        </ToastButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          </>
        )}
      </div>
    </PlatformShell>
  );
}
