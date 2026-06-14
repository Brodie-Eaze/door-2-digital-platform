'use client';

import { useMemo, useState } from 'react';
import { DollarSign, Download, FileText, ListChecks, Layers } from 'lucide-react';
import { Banner, Button, EmptyState, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { FirstRunBanner } from '@/components/AccountEmptyStates';
import { firstRunSnapshot } from '@/lib/first-run';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { toast } from '@/components/Toaster';

interface AccrualRow {
  knocker: string;
  initials: string;
  baseCents: bigint;
  conversionsCents: bigint;
  totalCents: bigint;
  payoutBatch: string;
}

interface LedgerRow {
  ts: string;
  knocker: string;
  type: 'base' | 'conversion' | 'lead-bonus' | 'override' | 'clawback';
  amountCents: bigint;
  ref: string;
}

interface PayoutRow {
  batch: string;
  period: string;
  knockers: number;
  amountCents: bigint;
  status: 'queued' | 'instruction-ready' | 'paid';
}

const ACCRUALS: AccrualRow[] = [
  {
    knocker: 'Jada Brooks',
    initials: 'JB',
    baseCents: 4200n,
    conversionsCents: 12000n,
    totalCents: 16200n,
    payoutBatch: 'PAY-2026-05A',
  },
  {
    knocker: 'Marcus Reed',
    initials: 'MR',
    baseCents: 3800n,
    conversionsCents: 9000n,
    totalCents: 12800n,
    payoutBatch: 'PAY-2026-05A',
  },
  {
    knocker: 'Elena Vargas',
    initials: 'EV',
    baseCents: 5100n,
    conversionsCents: 18000n,
    totalCents: 23100n,
    payoutBatch: 'PAY-2026-05A',
  },
  {
    knocker: 'Tyrone Hill',
    initials: 'TH',
    baseCents: 2900n,
    conversionsCents: 6000n,
    totalCents: 8900n,
    payoutBatch: 'PAY-2026-05A',
  },
  {
    knocker: 'Priya Nair',
    initials: 'PN',
    baseCents: 4600n,
    conversionsCents: 15000n,
    totalCents: 19600n,
    payoutBatch: 'PAY-2026-05A',
  },
];

const LEDGER: LedgerRow[] = [
  { ts: '16:48', knocker: 'Elena Vargas', type: 'conversion', amountCents: 1000n, ref: 'CNV-90412' },
  { ts: '16:41', knocker: 'Jada Brooks', type: 'lead-bonus', amountCents: 3000n, ref: 'LEAD-5521' },
  { ts: '16:22', knocker: 'Priya Nair', type: 'conversion', amountCents: 1000n, ref: 'CNV-90408' },
  { ts: '15:57', knocker: 'Marcus Reed', type: 'base', amountCents: 100n, ref: 'KNK-33180' },
  { ts: '15:40', knocker: 'Team lead · D. Ortiz', type: 'override', amountCents: 500n, ref: 'OVR-0042' },
  { ts: '14:18', knocker: 'Tyrone Hill', type: 'clawback', amountCents: -1000n, ref: 'CHB-2210' },
];

const PAYOUTS: PayoutRow[] = [
  { batch: 'PAY-2026-04B', period: '16–30 Apr', knockers: 14, amountCents: 612400n, status: 'paid' },
  {
    batch: 'PAY-2026-05A',
    period: '01–15 May',
    knockers: 16,
    amountCents: 80600n,
    status: 'instruction-ready',
  },
  { batch: 'PAY-2026-05B', period: '16–31 May', knockers: 16, amountCents: 41200n, status: 'queued' },
];

const LADDER = [
  { tier: 'Standard', conversions: '0–9 / wk', rate: '$10 / conversion', active: false },
  { tier: 'Silver', conversions: '10–19 / wk', rate: '$12 / conversion', active: true },
  { tier: 'Gold', conversions: '20–34 / wk', rate: '$15 / conversion', active: false },
  { tier: 'Elite', conversions: '35+ / wk', rate: '$18 / conversion + override', active: false },
];

const LEDGER_TONE: Record<LedgerRow['type'], 'info' | 'success' | 'warn' | 'danger' | 'muted'> = {
  base: 'muted',
  conversion: 'success',
  'lead-bonus': 'info',
  override: 'info',
  clawback: 'danger',
};

const PAYOUT_TONE: Record<PayoutRow['status'], 'info' | 'success' | 'warn'> = {
  queued: 'info',
  'instruction-ready': 'warn',
  paid: 'success',
};

export default function Page({ params }: { params: { slug: string } }): JSX.Element {
  const firstRun = firstRunSnapshot(params.slug);
  const [tab, setTab] = useState<'accruals' | 'ledger' | 'payouts'>('accruals');

  const totalCommissions = useMemo(() => ACCRUALS.reduce((sum, c) => sum + c.totalCents, 0n), []);

  if (firstRun.isFirstRun) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Commissions">
        <div className="space-y-5 max-w-[1400px]">
          <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          <EmptyState
            icon={DollarSign}
            title="No commission ledger yet."
            description="Commission lines accrue as conversions land — door 15% / inside 10% / retargeting 5% by default, configurable per knocker or campaign."
            primaryAction={{ label: 'Onboard knockers', href: `/accounts/${params.slug}/knockers` }}
            variant="first-run"
          />
        </div>
      </AccountShell>
    );
  }

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Commissions">
      <div className="space-y-6 max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px]">
            D2D never auto-debits per <code className="kbd">ADR-0019</code>. Payout batches generate
            a NACHA/CSV instruction file → ops downloads and executes manually in the banking app.
            Demo data — live wiring lands in Phase 1.x.
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Accrued today"
            value={<Money cents={totalCommissions} region="US" />}
            delta="+22.4%"
            deltaTone="positive"
          />
          <KpiCard label="Active plans" value="3" hint="Charity-Standard, Lead, Override" />
          <KpiCard label="Next payout" value="PAY-2026-05A" hint="2026-06-01" />
          <KpiCard label="Disputes open" value="0" />
        </div>

        <div className="card !p-0">
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-line2 flex-wrap">
            <div className="flex items-center gap-1.5">
              {(
                [
                  ['accruals', 'Today’s accruals', ListChecks],
                  ['ledger', 'Ledger', Layers],
                  ['payouts', 'Payout queue', FileText],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition ${
                    tab === key
                      ? 'bg-ink text-surface'
                      : 'bg-paper text-muted hover:bg-line2 hover:text-ink'
                  }`}
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <DataSourceBadge source="fixture" />
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Download size={12} />}
              onClick={() =>
                toast.info('Export commission statement — CSV export wiring lands in Phase 1.x')
              }
            >
              Export statement
            </Button>
          </div>

          {tab === 'accruals' && (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Knocker</th>
                  <th>Base (knocks)</th>
                  <th>Conversions</th>
                  <th>Total accrued</th>
                  <th>Payout batch</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {ACCRUALS.map((c) => (
                  <tr key={c.knocker}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="mono">{c.initials}</span>
                        <span className="text-[13px] text-ink">{c.knocker}</span>
                      </div>
                    </td>
                    <td>
                      <Money cents={c.baseCents} region="US" />
                    </td>
                    <td>
                      <Money cents={c.conversionsCents} region="US" />
                    </td>
                    <td className="font-semibold">
                      <Money cents={c.totalCents} region="US" />
                    </td>
                    <td>
                      <span className="tag">{c.payoutBatch}</span>
                    </td>
                    <td>
                      <StatusPill tone="info">Accrued</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'ledger' && (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Earner</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {LEDGER.map((l) => (
                  <tr key={l.ref}>
                    <td className="numeric text-soft">{l.ts}</td>
                    <td className="text-[13px] text-ink">{l.knocker}</td>
                    <td>
                      <StatusPill tone={LEDGER_TONE[l.type]}>{l.type}</StatusPill>
                    </td>
                    <td
                      className={l.amountCents < 0n ? 'text-rose-600 font-semibold' : 'font-semibold'}
                    >
                      <Money cents={l.amountCents} region="US" />
                    </td>
                    <td className="numeric text-[12px] text-muted">{l.ref}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'payouts' && (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Period</th>
                  <th>Earners</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {PAYOUTS.map((p) => (
                  <tr key={p.batch}>
                    <td className="numeric text-[13px] text-ink">{p.batch}</td>
                    <td className="text-[13px] text-muted">{p.period}</td>
                    <td className="numeric">{p.knockers}</td>
                    <td className="font-semibold">
                      <Money cents={p.amountCents} region="US" />
                    </td>
                    <td>
                      <StatusPill tone={PAYOUT_TONE[p.status]}>{p.status}</StatusPill>
                    </td>
                    <td className="text-right">
                      {p.status === 'paid' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            toast.info(`View remittance ${p.batch} — wiring lands in Phase 1.x`)
                          }
                        >
                          Remittance
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Download size={12} />}
                          onClick={() =>
                            toast.info(
                              `Generate NACHA/CSV for ${p.batch} — requires dual-control + real banking credentials; never auto-executed`,
                            )
                          }
                        >
                          Build instruction file
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <Section
          title="Commission ladder"
          subtitle="Per-conversion rate scales with weekly velocity · tiers reset Monday 00:00 local"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {LADDER.map((t) => (
              <div
                key={t.tier}
                className={`card card-pad border ${
                  t.active ? 'border-accent ring-1 ring-accent/20' : 'border-line2'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-ink">{t.tier}</span>
                  {t.active && <StatusPill tone="success">Current</StatusPill>}
                </div>
                <div className="text-[11px] text-muted mt-1">{t.conversions}</div>
                <div className="text-[13px] text-ink mt-2 font-medium">{t.rate}</div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </AccountShell>
  );
}
