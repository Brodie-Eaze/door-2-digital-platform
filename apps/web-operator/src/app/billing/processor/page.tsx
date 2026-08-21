'use client';

import { ArrowLeft, Download, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Banner, Button, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import type { Tone } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { toast } from '@/components/Toaster';

// MiCamp ISO residuals — processor markup share, separate from D2D platform
// revenue (per ADR-0028). Residual rate ≈ 0.146% of processed card volume.
interface ResidualRow {
  period: string;
  volumeCents: bigint;
  txns: number;
  grossResidualCents: bigint;
  isoSplitCents: bigint;
  status: 'paid' | 'pending_payout' | 'reconciling';
  settledAt: string | null;
}

const RESIDUALS: ResidualRow[] = [
  {
    period: 'May 2026',
    volumeCents: 12_485_000_00n,
    txns: 38_142,
    grossResidualCents: 24_320_67n,
    isoSplitCents: 18_240_50n,
    status: 'pending_payout',
    settledAt: null,
  },
  {
    period: 'Apr 2026',
    volumeCents: 9_820_000_00n,
    txns: 29_904,
    grossResidualCents: 18_907_00n,
    isoSplitCents: 14_180_25n,
    status: 'paid',
    settledAt: '2026-05-12',
  },
  {
    period: 'Mar 2026',
    volumeCents: 5_240_000_00n,
    txns: 16_188,
    grossResidualCents: 10_153_07n,
    isoSplitCents: 7_614_80n,
    status: 'paid',
    settledAt: '2026-04-11',
  },
  {
    period: 'Feb 2026',
    volumeCents: 3_110_000_00n,
    txns: 9_640,
    grossResidualCents: 6_026_40n,
    isoSplitCents: 4_519_80n,
    status: 'paid',
    settledAt: '2026-03-12',
  },
];

interface VolumeTile {
  org: string;
  region: string;
  volumeCents: bigint;
  txns: number;
  avgTicketCents: bigint;
  settlement: 'settled' | 'in_transit';
}

const PROCESSOR_VOLUME: VolumeTile[] = [
  {
    org: 'Hope Forward International',
    region: 'US',
    volumeCents: 10_842_000_00n,
    txns: 33_180,
    avgTicketCents: 32_680n,
    settlement: 'in_transit',
  },
  {
    org: 'PestMax Services',
    region: 'US',
    volumeCents: 1_643_000_00n,
    txns: 4_962,
    avgTicketCents: 33_110n,
    settlement: 'settled',
  },
];

function statusTone(s: ResidualRow['status']): Tone {
  if (s === 'paid') return 'success';
  if (s === 'reconciling') return 'info';
  return 'warn';
}

function statusLabel(s: ResidualRow['status']): string {
  if (s === 'paid') return 'Paid';
  if (s === 'reconciling') return 'Reconciling';
  return 'Pending payout';
}

export default function ProcessorPage(): JSX.Element {
  const mtd = RESIDUALS[0]!;
  const totalVolume = PROCESSOR_VOLUME.reduce((a, t) => a + t.volumeCents, 0n);
  const totalTxns = PROCESSOR_VOLUME.reduce((a, t) => a + t.txns, 0);

  return (
    <PlatformShell pageTitle="Billing · MiCamp processor">
      <div className="space-y-6 max-w-[1280px]">
        <Link
          href="/billing"
          className="inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-ink"
        >
          <ArrowLeft size={13} /> Back to billing
        </Link>

        <Banner tone="info">
          <span className="text-[13px]">
            MiCamp ISO residuals — D2D&apos;s share of processor markup, separate from platform
            revenue (per ADR-0028). Residual ≈ 0.146% of processed card volume.{' '}
            <span className="text-muted">Demo data — live MiCamp feed lands in Phase 1.2.</span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Processed volume MTD"
            value={<Money cents={mtd.volumeCents} region="US" />}
            delta="+27.1%"
            deltaTone="positive"
          />
          <KpiCard
            label="ISO residual MTD"
            value={<Money cents={mtd.isoSplitCents} region="US" />}
            delta="+28.6%"
            deltaTone="positive"
            hint="net of MiCamp split"
          />
          <KpiCard
            label="Transactions MTD"
            value={mtd.txns.toLocaleString()}
            hint="settled + in-transit"
          />
          <KpiCard label="Residual rate" value="0.146%" hint="of processed volume" />
        </div>

        <Section
          title="Processor volume by org"
          subtitle="MiCamp-processed card volume contributing to the residual pool"
          action={<DataSourceBadge source="fixture" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PROCESSOR_VOLUME.map((t) => (
              <div key={t.org} className="rounded-lg border border-line2 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-ink">{t.org}</span>
                  <StatusPill tone={t.settlement === 'settled' ? 'success' : 'info'}>
                    {t.settlement === 'settled' ? 'Settled' : 'In transit'}
                  </StatusPill>
                </div>
                <div className="mt-3 text-[22px] font-semibold text-ink">
                  <Money cents={t.volumeCents} region="US" />
                </div>
                <div className="mt-2 flex items-center gap-4 text-[12px] text-muted">
                  <span>{t.txns.toLocaleString()} txns</span>
                  <span>
                    avg ticket <Money cents={t.avgTicketCents} region="US" />
                  </span>
                </div>
              </div>
            ))}
            <div className="rounded-lg border border-line2 p-4 bg-paper">
              <span className="text-[12px] text-muted uppercase tracking-wide">Total</span>
              <div className="mt-3 text-[22px] font-semibold text-ink">
                <Money cents={totalVolume} region="US" />
              </div>
              <div className="mt-2 text-[12px] text-muted">{totalTxns.toLocaleString()} txns</div>
            </div>
          </div>
        </Section>

        <Section
          title="Residual by month"
          subtitle="Gross residual, MiCamp split and D2D net per settlement period"
          paddedBody={false}
          action={
            <div className="flex items-center gap-2">
              <DataSourceBadge source="fixture" />
              <Button
                leftIcon={<Download size={14} />}
                variant="ghost"
                size="sm"
                onClick={() =>
                  toast.info('Export residuals CSV — MiCamp feed export lands in Phase 1.2.')
                }
              >
                Export
              </Button>
            </div>
          }
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Period</th>
                <th>Processed volume</th>
                <th>Txns</th>
                <th>Gross residual</th>
                <th>MiCamp split</th>
                <th>D2D net</th>
                <th>Settlement</th>
                <th>Settled</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {RESIDUALS.map((r) => (
                <tr key={r.period}>
                  <td className="text-[13px] text-ink">{r.period}</td>
                  <td>
                    <Money cents={r.volumeCents} region="US" />
                  </td>
                  <td className="numeric text-[12px] text-muted">{r.txns.toLocaleString()}</td>
                  <td>
                    <Money cents={r.grossResidualCents} region="US" />
                  </td>
                  <td className="text-muted">
                    <Money cents={r.grossResidualCents - r.isoSplitCents} region="US" />
                  </td>
                  <td className="font-medium">
                    <Money cents={r.isoSplitCents} region="US" />
                  </td>
                  <td>
                    <StatusPill tone={statusTone(r.status)}>{statusLabel(r.status)}</StatusPill>
                  </td>
                  <td className="text-[12px] text-muted">
                    {r.settledAt ?? <span className="text-soft">—</span>}
                  </td>
                  <td>
                    <button
                      className="text-soft hover:text-ink"
                      onClick={() =>
                        toast.info(
                          `Open ${r.period} settlement statement — MiCamp document link lands in Phase 1.2.`,
                        )
                      }
                    >
                      <ExternalLink size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
    </PlatformShell>
  );
}
