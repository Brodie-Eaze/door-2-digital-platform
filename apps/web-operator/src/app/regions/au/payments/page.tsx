import {
  CreditCard,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  Repeat,
  RefreshCw,
} from 'lucide-react';
import { Banner, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { DataSourceBadge } from '@/components/DataSourceBadge';

interface StripeEvent {
  id: string;
  type:
    | 'payment_intent.succeeded'
    | 'payment_intent.payment_failed'
    | 'charge.refunded'
    | 'invoice.paid'
    | 'subscription.created'
    | 'mandate.updated';
  account: string;
  amountCents: bigint;
  ts: string;
  status: 'ok' | 'failed' | 'pending';
}

const STRIPE_EVENTS: StripeEvent[] = [
  {
    id: 'evt_3PA9xQK1u',
    type: 'payment_intent.succeeded',
    account: 'World Vision',
    amountCents: 12_000n,
    ts: '2026-05-24 09:42:18',
    status: 'ok',
  },
  {
    id: 'evt_3PA9wHX2v',
    type: 'payment_intent.succeeded',
    account: 'World Vision',
    amountCents: 25_000n,
    ts: '2026-05-24 09:41:02',
    status: 'ok',
  },
  {
    id: 'evt_3PA9vBN3w',
    type: 'invoice.paid',
    account: 'World Vision',
    amountCents: 60_000n,
    ts: '2026-05-24 09:38:55',
    status: 'ok',
  },
  {
    id: 'evt_3PA9uTL4x',
    type: 'subscription.created',
    account: 'Gold Coast Hospital',
    amountCents: 5_000n,
    ts: '2026-05-24 09:35:21',
    status: 'ok',
  },
  {
    id: 'evt_3PA9tQR5y',
    type: 'payment_intent.payment_failed',
    account: 'World Vision',
    amountCents: 25_000n,
    ts: '2026-05-24 09:30:09',
    status: 'failed',
  },
  {
    id: 'evt_3PA9sFG6z',
    type: 'payment_intent.succeeded',
    account: 'World Vision',
    amountCents: 10_000n,
    ts: '2026-05-24 09:28:44',
    status: 'ok',
  },
  {
    id: 'evt_3PA9rZX7a',
    type: 'charge.refunded',
    account: 'Gold Coast Hospital',
    amountCents: 7_500n,
    ts: '2026-05-24 09:22:11',
    status: 'ok',
  },
  {
    id: 'evt_3PA9qPM8b',
    type: 'payment_intent.succeeded',
    account: 'World Vision',
    amountCents: 30_000n,
    ts: '2026-05-24 09:18:55',
    status: 'ok',
  },
  {
    id: 'evt_3PA9pWE9c',
    type: 'mandate.updated',
    account: 'World Vision',
    amountCents: 0n,
    ts: '2026-05-24 09:14:32',
    status: 'ok',
  },
  {
    id: 'evt_3PA9oUC0d',
    type: 'payment_intent.succeeded',
    account: 'Gold Coast Hospital',
    amountCents: 5_000n,
    ts: '2026-05-24 09:09:13',
    status: 'ok',
  },
  {
    id: 'evt_3PA9nXJ1e',
    type: 'payment_intent.succeeded',
    account: 'World Vision',
    amountCents: 12_000n,
    ts: '2026-05-24 09:02:08',
    status: 'ok',
  },
  {
    id: 'evt_3PA9mZO2f',
    type: 'invoice.paid',
    account: 'World Vision',
    amountCents: 80_000n,
    ts: '2026-05-24 08:58:41',
    status: 'ok',
  },
  {
    id: 'evt_3PA9lDV3g',
    type: 'payment_intent.payment_failed',
    account: 'World Vision',
    amountCents: 12_000n,
    ts: '2026-05-24 08:54:18',
    status: 'failed',
  },
  {
    id: 'evt_3PA9kPM4h',
    type: 'subscription.created',
    account: 'World Vision',
    amountCents: 10_000n,
    ts: '2026-05-24 08:48:33',
    status: 'ok',
  },
  {
    id: 'evt_3PA9jLA5i',
    type: 'payment_intent.succeeded',
    account: 'Gold Coast Hospital',
    amountCents: 25_000n,
    ts: '2026-05-24 08:42:09',
    status: 'ok',
  },
  {
    id: 'evt_3PA9iBE6j',
    type: 'payment_intent.succeeded',
    account: 'World Vision',
    amountCents: 50_000n,
    ts: '2026-05-24 08:34:22',
    status: 'ok',
  },
  {
    id: 'evt_3PA9hSU7k',
    type: 'mandate.updated',
    account: 'Gold Coast Hospital',
    amountCents: 0n,
    ts: '2026-05-24 08:28:11',
    status: 'ok',
  },
  {
    id: 'evt_3PA9gMI8l',
    type: 'payment_intent.succeeded',
    account: 'World Vision',
    amountCents: 12_000n,
    ts: '2026-05-24 08:19:55',
    status: 'ok',
  },
];

interface Mandate {
  customerRef: string;
  donor: string;
  type: 'BPAY' | 'PayTo';
  status: 'active' | 'pending_customer_approval' | 'expired' | 'cancelled';
  nextCollection: string;
  amountCents: bigint;
  account: string;
}

const MANDATES: Mandate[] = [
  {
    customerRef: 'CUS-AU-44211',
    donor: 'A. Mitchell (NSW)',
    type: 'PayTo',
    status: 'active',
    nextCollection: '2026-05-31',
    amountCents: 12_500n,
    account: 'World Vision',
  },
  {
    customerRef: 'CUS-AU-44210',
    donor: 'S. Carter (VIC)',
    type: 'BPAY',
    status: 'active',
    nextCollection: '2026-06-01',
    amountCents: 25_000n,
    account: 'World Vision',
  },
  {
    customerRef: 'CUS-AU-44209',
    donor: 'M. Reed (QLD)',
    type: 'PayTo',
    status: 'active',
    nextCollection: '2026-05-30',
    amountCents: 10_000n,
    account: 'Gold Coast Hospital',
  },
  {
    customerRef: 'CUS-AU-44208',
    donor: 'P. King (NSW)',
    type: 'BPAY',
    status: 'active',
    nextCollection: '2026-06-15',
    amountCents: 50_000n,
    account: 'World Vision',
  },
  {
    customerRef: 'CUS-AU-44207',
    donor: 'L. Nguyen (WA)',
    type: 'PayTo',
    status: 'pending_customer_approval',
    nextCollection: '—',
    amountCents: 7_500n,
    account: 'World Vision',
  },
  {
    customerRef: 'CUS-AU-44206',
    donor: 'J. Harris (QLD)',
    type: 'PayTo',
    status: 'active',
    nextCollection: '2026-05-28',
    amountCents: 5_000n,
    account: 'Gold Coast Hospital',
  },
  {
    customerRef: 'CUS-AU-44205',
    donor: 'C. Miller (VIC)',
    type: 'BPAY',
    status: 'active',
    nextCollection: '2026-06-01',
    amountCents: 12_500n,
    account: 'World Vision',
  },
  {
    customerRef: 'CUS-AU-44204',
    donor: 'R. Patel (NSW)',
    type: 'PayTo',
    status: 'active',
    nextCollection: '2026-05-31',
    amountCents: 10_000n,
    account: 'World Vision',
  },
  {
    customerRef: 'CUS-AU-44203',
    donor: 'T. Whyte (SA)',
    type: 'BPAY',
    status: 'active',
    nextCollection: '2026-06-10',
    amountCents: 30_000n,
    account: 'World Vision',
  },
  {
    customerRef: 'CUS-AU-44202',
    donor: 'D. Fischer (VIC)',
    type: 'PayTo',
    status: 'expired',
    nextCollection: '—',
    amountCents: 5_000n,
    account: 'World Vision',
  },
  {
    customerRef: 'CUS-AU-44201',
    donor: 'O. Adesina (QLD)',
    type: 'PayTo',
    status: 'active',
    nextCollection: '2026-05-29',
    amountCents: 12_500n,
    account: 'Gold Coast Hospital',
  },
  {
    customerRef: 'CUS-AU-44200',
    donor: 'N. Brackett (NSW)',
    type: 'BPAY',
    status: 'active',
    nextCollection: '2026-06-01',
    amountCents: 25_000n,
    account: 'World Vision',
  },
  {
    customerRef: 'CUS-AU-44199',
    donor: 'V. Sokolov (NSW)',
    type: 'PayTo',
    status: 'active',
    nextCollection: '2026-05-30',
    amountCents: 7_500n,
    account: 'World Vision',
  },
  {
    customerRef: 'CUS-AU-44198',
    donor: 'F. Tanaka (VIC)',
    type: 'BPAY',
    status: 'cancelled',
    nextCollection: '—',
    amountCents: 0n,
    account: 'World Vision',
  },
  {
    customerRef: 'CUS-AU-44197',
    donor: 'E. Bianchi (SA)',
    type: 'PayTo',
    status: 'active',
    nextCollection: '2026-06-04',
    amountCents: 10_000n,
    account: 'World Vision',
  },
];

interface Cohort {
  cohort: string;
  donors: number;
  mrrCents: bigint;
  churned: number;
  netRetentionPct: number;
}

const COHORTS: Cohort[] = [
  { cohort: 'May 2025', donors: 312, mrrCents: 11_244_000n, churned: 78, netRetentionPct: 78.4 },
  { cohort: 'Jun 2025', donors: 408, mrrCents: 14_280_000n, churned: 91, netRetentionPct: 81.2 },
  { cohort: 'Jul 2025', donors: 482, mrrCents: 16_385_000n, churned: 102, netRetentionPct: 82.0 },
  { cohort: 'Aug 2025', donors: 521, mrrCents: 17_972_500n, churned: 104, netRetentionPct: 83.5 },
  { cohort: 'Sep 2025', donors: 614, mrrCents: 21_490_000n, churned: 119, netRetentionPct: 84.1 },
  { cohort: 'Oct 2025', donors: 702, mrrCents: 25_272_000n, churned: 128, netRetentionPct: 85.0 },
  { cohort: 'Nov 2025', donors: 768, mrrCents: 28_416_000n, churned: 132, netRetentionPct: 85.6 },
  { cohort: 'Dec 2025', donors: 812, mrrCents: 30_855_000n, churned: 121, netRetentionPct: 87.2 },
  { cohort: 'Jan 2026', donors: 921, mrrCents: 34_904_000n, churned: 126, netRetentionPct: 88.0 },
  { cohort: 'Feb 2026', donors: 1_044, mrrCents: 40_716_000n, churned: 132, netRetentionPct: 89.1 },
  { cohort: 'Mar 2026', donors: 1_182, mrrCents: 46_990_000n, churned: 138, netRetentionPct: 90.0 },
  { cohort: 'Apr 2026', donors: 1_311, mrrCents: 53_751_000n, churned: 121, netRetentionPct: 91.4 },
];

function eventTone(s: StripeEvent['status']): 'success' | 'danger' | 'warn' {
  return s === 'ok' ? 'success' : s === 'failed' ? 'danger' : 'warn';
}

function mandateTone(s: Mandate['status']): 'success' | 'warn' | 'muted' | 'danger' {
  switch (s) {
    case 'active':
      return 'success';
    case 'pending_customer_approval':
      return 'warn';
    case 'expired':
      return 'muted';
    case 'cancelled':
      return 'danger';
  }
}

function mandateLabel(s: Mandate['status']): string {
  switch (s) {
    case 'active':
      return 'Active';
    case 'pending_customer_approval':
      return 'Pending customer';
    case 'expired':
      return 'Expired';
    case 'cancelled':
      return 'Cancelled';
  }
}

export default function AuPaymentsPage(): JSX.Element {
  const totalMtdCents = 64_240_000n + 29_840_000n; // Stripe + GoCardless monthly volume
  const successful = STRIPE_EVENTS.filter(
    (e) => e.status === 'ok' && e.type !== 'mandate.updated',
  ).length;
  const failed = STRIPE_EVENTS.filter((e) => e.status === 'failed').length;
  const refundCount = STRIPE_EVENTS.filter((e) => e.type === 'charge.refunded').length;
  const recurringActive = MANDATES.filter((m) => m.status === 'active').length;
  const bpayActive = MANDATES.filter((m) => m.type === 'BPAY' && m.status === 'active').length;
  const paytoActive = MANDATES.filter((m) => m.type === 'PayTo' && m.status === 'active').length;
  const refundRate = (refundCount / Math.max(successful, 1)) * 100;

  return (
    <PlatformShell pageTitle="AU payments · Stripe AU + GoCardless">
      <div className="space-y-5 max-w-[1700px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <CreditCard size={14} className="text-accent" />
            <span>
              AU money rails. <span className="font-semibold">Stripe AU</span> for card + Direct
              Debit. <span className="font-semibold">GoCardless</span> for BPAY + PayTo (NPP).
              Settlement currency AUD · entity ABN 53 004 085 616 · AUSTRAC reportable thresholds
              monitored.
            </span>
          </span>
        </Banner>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted">
            AU · Phase 2 demo data — live wiring lands in Phase 2.x
          </span>
          <DataSourceBadge source="fixture" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <KpiCard
            label="Total MTD"
            value={<Money cents={totalMtdCents} region="AU" />}
            delta="+12.1%"
            deltaTone="positive"
          />
          <KpiCard
            label="Successful charges"
            value={successful}
            hint="last 24h"
            deltaTone="positive"
          />
          <KpiCard label="Failed charges" value={failed} hint="last 24h" deltaTone="negative" />
          <KpiCard
            label="Recurring active"
            value={recurringActive}
            hint="across all rails"
            deltaTone="positive"
          />
          <KpiCard label="BPAY mandates" value={bpayActive} hint="active" />
          <KpiCard label="PayTo mandates" value={paytoActive} hint="active" />
          <KpiCard label="Refund rate" value={`${refundRate.toFixed(1)}%`} hint="of successful" />
        </div>

        <Section
          title="Stripe AU · recent events"
          subtitle="Live webhook stream · last 18 events shown"
          paddedBody={false}
          action={
            <span className="text-[11px] text-muted flex items-center gap-1.5">
              <RefreshCw size={11} className="text-soft" />
              Demo stream · fixture
            </span>
          }
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Event ID</th>
                <th>Type</th>
                <th>Account</th>
                <th>Amount (AUD)</th>
                <th>Status</th>
                <th>Timestamp (AEST)</th>
              </tr>
            </thead>
            <tbody>
              {STRIPE_EVENTS.map((e) => {
                const arrow =
                  e.type === 'charge.refunded' ? (
                    <ArrowUpRight size={11} className="text-warn" />
                  ) : (
                    <ArrowDownRight size={11} className="text-success" />
                  );
                return (
                  <tr key={e.id}>
                    <td>
                      <span className="mono text-[10px] !w-auto !px-2">{e.id}</span>
                    </td>
                    <td className="text-[12px] text-ink">
                      <span className="inline-flex items-center gap-1.5">
                        {arrow}
                        {e.type}
                      </span>
                    </td>
                    <td className="text-[12px] text-ink">{e.account}</td>
                    <td className="text-[12px] text-ink">
                      {e.amountCents === 0n ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <Money cents={e.amountCents} region="AU" />
                      )}
                    </td>
                    <td>
                      <StatusPill tone={eventTone(e.status)}>
                        {e.status === 'ok'
                          ? 'Delivered'
                          : e.status === 'failed'
                            ? 'Failed'
                            : 'Pending'}
                      </StatusPill>
                    </td>
                    <td className="text-[12px] text-muted numeric">{e.ts}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>

        <Section
          title="GoCardless · BPAY + PayTo mandates"
          subtitle="Direct Debit & NPP rails · recurring giving spine"
          paddedBody={false}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Customer ref</th>
                <th>Donor (state)</th>
                <th>Type</th>
                <th>Account</th>
                <th>Next collection</th>
                <th>Amount (AUD)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {MANDATES.map((m) => (
                <tr key={m.customerRef}>
                  <td>
                    <span className="mono text-[10px] !w-auto !px-2">{m.customerRef}</span>
                  </td>
                  <td className="text-[12.5px] text-ink">{m.donor}</td>
                  <td>
                    <span className="tag !text-[9px]">{m.type}</span>
                  </td>
                  <td className="text-[12px] text-ink">{m.account}</td>
                  <td className="text-[12px] text-muted numeric">{m.nextCollection}</td>
                  <td className="text-[12px] text-ink">
                    {m.amountCents === 0n ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <Money cents={m.amountCents} region="AU" />
                    )}
                  </td>
                  <td>
                    <StatusPill tone={mandateTone(m.status)}>{mandateLabel(m.status)}</StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section
          title="Recurring giving cohort · net retention"
          subtitle="By sign-up month · 12-month rolling · World Vision + Gold Coast Hospital combined"
          paddedBody={false}
          action={
            <span className="text-[11px] text-muted flex items-center gap-1.5">
              <Repeat size={11} className="text-accent" />
              Avg net retention: 85.4%
            </span>
          }
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Cohort</th>
                <th>Donors signed up</th>
                <th>Initial MRR</th>
                <th>Churned</th>
                <th>Active today</th>
                <th>Net retention</th>
              </tr>
            </thead>
            <tbody>
              {COHORTS.map((c) => {
                const tone =
                  c.netRetentionPct >= 88 ? 'success' : c.netRetentionPct >= 82 ? 'info' : 'warn';
                return (
                  <tr key={c.cohort}>
                    <td className="text-[13px] text-ink font-medium">{c.cohort}</td>
                    <td className="text-[12px] text-ink numeric">{c.donors.toLocaleString()}</td>
                    <td className="text-[12px] text-ink">
                      <Money cents={c.mrrCents} region="AU" />
                    </td>
                    <td className="text-[12px] text-rose-600 numeric">−{c.churned}</td>
                    <td className="text-[12px] text-ink numeric">
                      {(c.donors - c.churned).toLocaleString()}
                    </td>
                    <td>
                      <RetBar pct={c.netRetentionPct} tone={tone} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SignalCard
            icon={<CheckCircle2 size={14} className="text-success" />}
            label="Last successful Stripe webhook"
            value="09:42:18 AEST"
            hint="payment_intent.succeeded · evt_3PA9xQK1u"
          />
          <SignalCard
            icon={<XCircle size={14} className="text-danger" />}
            label="Last failed charge"
            value="09:30:09 AEST"
            hint="Card declined · A$250.00 · auto-retry queued"
          />
          <SignalCard
            icon={<RefreshCw size={14} className="text-accent" />}
            label="Next GoCardless settlement"
            value="2026-05-26"
            hint="Settles to NAB CommBiz · A$48,210 expected"
          />
        </div>
      </div>
    </PlatformShell>
  );
}

function RetBar({ pct, tone }: { pct: number; tone: 'success' | 'info' | 'warn' }): JSX.Element {
  const bg = tone === 'success' ? 'bg-success' : tone === 'info' ? 'bg-accent' : 'bg-warn';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-line2 rounded-full overflow-hidden">
        <div className={`h-full ${bg}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[12px] font-semibold text-ink numeric w-12">{pct.toFixed(1)}%</span>
    </div>
  );
}

function SignalCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}): JSX.Element {
  return (
    <div className="card card-pad">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted font-medium">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-[16px] font-semibold text-ink tracking-tight numeric">
        {value}
      </div>
      <div className="text-[11px] text-muted mt-0.5">{hint}</div>
    </div>
  );
}
