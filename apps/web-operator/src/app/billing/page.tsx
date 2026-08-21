'use client';

import { Download, ExternalLink } from 'lucide-react';
import { Button, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { toast } from '@/components/Toaster';

const INVOICES = [
  {
    id: 'inv_2026_05',
    org: 'Hope Forward International',
    period: 'May 2026',
    platformFeeCents: 250000n,
    doorRakeCents: 1_207_500_00n,
    insideSalesRakeCents: 218_400_00n,
    retargetingRakeCents: 36_200_00n,
    totalCents: 1_605_240_00n + 250000n,
    status: 'open',
    issuedAt: '2026-06-01',
  },
  {
    id: 'inv_2026_05_pestmax',
    org: 'PestMax Services',
    period: 'May 2026',
    platformFeeCents: 99_900n,
    doorRakeCents: 124_800_00n,
    insideSalesRakeCents: 0n,
    retargetingRakeCents: 0n,
    totalCents: 124_800_00n + 99_900n,
    status: 'paid',
    issuedAt: '2026-06-01',
  },
  {
    id: 'inv_2026_04',
    org: 'Hope Forward International',
    period: 'Apr 2026',
    platformFeeCents: 250000n,
    doorRakeCents: 982_400_00n,
    insideSalesRakeCents: 165_900_00n,
    retargetingRakeCents: 22_100_00n,
    totalCents: 1_170_400_00n + 250000n,
    status: 'paid',
    issuedAt: '2026-05-01',
  },
];

const RESIDUALS = [
  {
    period: 'May 2026',
    volumeCents: 12_485_000_00n,
    residualCents: 18_240_50n,
    status: 'pending_payout',
  },
  { period: 'Apr 2026', volumeCents: 9_820_000_00n, residualCents: 14_180_25n, status: 'paid' },
  { period: 'Mar 2026', volumeCents: 5_240_000_00n, residualCents: 7_614_80n, status: 'paid' },
];

export default function BillingPage(): JSX.Element {
  return (
    <PlatformShell pageTitle="Billing & invoices">
      <div className="space-y-6 max-w-[1280px]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="MTD billed"
            value={<Money cents={1_730_440_00n + 350_000n} region="US" />}
            delta="+22.4%"
            deltaTone="positive"
          />
          <KpiCard
            label="Open invoices"
            value="1"
            hint={<Money cents={1_607_740_00n} region="US" />}
          />
          <KpiCard
            label="MiCamp residuals MTD"
            value={<Money cents={18_240_50n} region="US" />}
            delta="+28.6%"
            deltaTone="positive"
            hint="ISO agreement"
          />
          <KpiCard
            label="Avg rake / conv."
            value={<Money cents={32_810n} region="US" />}
            hint="blended across buckets"
          />
        </div>

        <Section
          title="Recent invoices"
          subtitle="Platform fee + per-attribution rake (door 15% · inside-sales 10% · retargeting 5%)"
          paddedBody={false}
          action={
            <div className="flex items-center gap-2">
              <DataSourceBadge source="fixture" />
              <Button
                leftIcon={<Download size={14} />}
                variant="ghost"
                size="sm"
                onClick={() => toast.info('Export CSV — wiring lands in Phase 1.2')}
              >
                Export CSV
              </Button>
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
              {INVOICES.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <span className="mono text-[10px] !w-auto !px-2">{inv.id}</span>
                  </td>
                  <td className="text-[13px] text-ink truncate max-w-[180px]">{inv.org}</td>
                  <td className="text-[12px] text-muted">{inv.period}</td>
                  <td>
                    <Money cents={inv.platformFeeCents} region="US" />
                  </td>
                  <td>
                    <Money cents={inv.doorRakeCents} region="US" />
                  </td>
                  <td>
                    <Money cents={inv.insideSalesRakeCents} region="US" emptyAsDash />
                  </td>
                  <td>
                    <Money cents={inv.retargetingRakeCents} region="US" emptyAsDash />
                  </td>
                  <td className="font-medium">
                    <Money cents={inv.totalCents} region="US" />
                  </td>
                  <td>
                    <StatusPill tone={inv.status === 'paid' ? 'success' : 'info'}>
                      {inv.status === 'paid' ? 'Paid' : 'Open'}
                    </StatusPill>
                  </td>
                  <td>
                    <button
                      className="text-soft hover:text-ink"
                      onClick={() =>
                        toast.info(`Open invoice ${inv.id} — wiring lands in Phase 1.2`)
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

        <Section
          title="MiCamp ISO residuals"
          subtitle="Processor markup share — separate from D2D platform revenue. Per ADR-0028."
          paddedBody={false}
          action={<DataSourceBadge source="fixture" />}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Period</th>
                <th>Processed volume</th>
                <th>Residual rate</th>
                <th>Residual earned</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {RESIDUALS.map((r) => (
                <tr key={r.period}>
                  <td className="text-[13px] text-ink">{r.period}</td>
                  <td>
                    <Money cents={r.volumeCents} region="US" />
                  </td>
                  <td className="numeric text-[13px] text-muted">0.146%</td>
                  <td className="font-medium">
                    <Money cents={r.residualCents} region="US" />
                  </td>
                  <td>
                    <StatusPill tone={r.status === 'paid' ? 'success' : 'warn'}>
                      {r.status === 'paid' ? 'Paid' : 'Pending payout'}
                    </StatusPill>
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
