import {
  CreditCard,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  Repeat,
  RefreshCw,
  QrCode,
} from 'lucide-react';
import { Banner, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { DataSourceBadge } from '@/components/DataSourceBadge';

/**
 * SG payments dashboard.
 *
 * Two rails: Stripe SG for card + recurring, PayNow Corporate (via
 * Stripe SG endpoint) for QR push-pay against the D2D UEN. Cohort
 * retention reuses the AU pattern but on SG sign-ups only.
 */

interface StripeSgEvent {
  id: string;
  type:
    | 'payment_intent.succeeded'
    | 'payment_intent.payment_failed'
    | 'charge.refunded'
    | 'invoice.paid'
    | 'subscription.created'
    | 'paynow.confirmed';
  account: string;
  amountCents: bigint;
  ts: string;
  status: 'ok' | 'failed' | 'pending';
}

const STRIPE_SG_EVENTS: StripeSgEvent[] = [
  {
    id: 'evt_3QSG7xK1u',
    type: 'paynow.confirmed',
    account: 'Tampines FSC pilot',
    amountCents: 5_000n,
    ts: '2026-05-24 09:42:18',
    status: 'ok',
  },
  {
    id: 'evt_3QSG7wHX2',
    type: 'payment_intent.succeeded',
    account: 'SCS pilot',
    amountCents: 30_000n,
    ts: '2026-05-24 09:39:02',
    status: 'ok',
  },
  {
    id: 'evt_3QSG7vBN3',
    type: 'invoice.paid',
    account: 'SCS pilot',
    amountCents: 100_000n,
    ts: '2026-05-24 09:35:55',
    status: 'ok',
  },
  {
    id: 'evt_3QSG7uTL4',
    type: 'subscription.created',
    account: 'Tampines FSC pilot',
    amountCents: 2_500n,
    ts: '2026-05-24 09:32:21',
    status: 'ok',
  },
  {
    id: 'evt_3QSG7tQR5',
    type: 'paynow.confirmed',
    account: 'Tampines FSC pilot',
    amountCents: 10_000n,
    ts: '2026-05-24 09:28:09',
    status: 'ok',
  },
  {
    id: 'evt_3QSG7sFG6',
    type: 'payment_intent.succeeded',
    account: 'SCS pilot',
    amountCents: 15_000n,
    ts: '2026-05-24 09:24:44',
    status: 'ok',
  },
  {
    id: 'evt_3QSG7rZX7',
    type: 'payment_intent.payment_failed',
    account: 'SCS pilot',
    amountCents: 20_000n,
    ts: '2026-05-24 09:20:11',
    status: 'failed',
  },
  {
    id: 'evt_3QSG7qPM8',
    type: 'paynow.confirmed',
    account: 'SCS pilot',
    amountCents: 5_000n,
    ts: '2026-05-24 09:16:55',
    status: 'ok',
  },
  {
    id: 'evt_3QSG7pWE9',
    type: 'invoice.paid',
    account: 'Tampines FSC pilot',
    amountCents: 7_500n,
    ts: '2026-05-24 09:12:32',
    status: 'ok',
  },
  {
    id: 'evt_3QSG7oUC0',
    type: 'payment_intent.succeeded',
    account: 'SCS pilot',
    amountCents: 30_000n,
    ts: '2026-05-24 09:08:13',
    status: 'ok',
  },
  {
    id: 'evt_3QSG7nXJ1',
    type: 'paynow.confirmed',
    account: 'SCS pilot',
    amountCents: 2_500n,
    ts: '2026-05-24 09:02:08',
    status: 'ok',
  },
  {
    id: 'evt_3QSG7mZO2',
    type: 'charge.refunded',
    account: 'SCS pilot',
    amountCents: 5_000n,
    ts: '2026-05-24 08:58:41',
    status: 'ok',
  },
  {
    id: 'evt_3QSG7lDV3',
    type: 'payment_intent.payment_failed',
    account: 'Tampines FSC pilot',
    amountCents: 2_500n,
    ts: '2026-05-24 08:54:18',
    status: 'failed',
  },
  {
    id: 'evt_3QSG7kPM4',
    type: 'subscription.created',
    account: 'SCS pilot',
    amountCents: 10_000n,
    ts: '2026-05-24 08:48:33',
    status: 'ok',
  },
  {
    id: 'evt_3QSG7jLA5',
    type: 'payment_intent.succeeded',
    account: 'Tampines FSC pilot',
    amountCents: 25_000n,
    ts: '2026-05-24 08:42:09',
    status: 'ok',
  },
];

interface PayNowMandate {
  customerRef: string;
  donor: string;
  uen: string;
  status: 'active' | 'pending_qr_scan' | 'expired' | 'cancelled';
  nextCollection: string;
  amountCents: bigint;
  account: string;
}

const PAYNOW_MANDATES: PayNowMandate[] = [
  {
    customerRef: 'CUS-SG-12211',
    donor: 'L. Tan (Tampines)',
    uen: 'T26CC0021K',
    status: 'active',
    nextCollection: '2026-05-31',
    amountCents: 5_000n,
    account: 'Tampines FSC pilot',
  },
  {
    customerRef: 'CUS-SG-12210',
    donor: 'W. Lim (Bedok)',
    uen: 'T26CC0021K',
    status: 'active',
    nextCollection: '2026-06-01',
    amountCents: 10_000n,
    account: 'SCS pilot',
  },
  {
    customerRef: 'CUS-SG-12209',
    donor: 'Y. Chen (Jurong East)',
    uen: 'T26CC0021K',
    status: 'active',
    nextCollection: '2026-05-30',
    amountCents: 15_000n,
    account: 'SCS pilot',
  },
  {
    customerRef: 'CUS-SG-12208',
    donor: 'M. Rahman (Toa Payoh)',
    uen: 'T26CC0021K',
    status: 'pending_qr_scan',
    nextCollection: '—',
    amountCents: 2_500n,
    account: 'SCS pilot',
  },
  {
    customerRef: 'CUS-SG-12207',
    donor: 'S. Kumar (Tampines)',
    uen: 'T26CC0021K',
    status: 'active',
    nextCollection: '2026-05-31',
    amountCents: 7_500n,
    account: 'Tampines FSC pilot',
  },
  {
    customerRef: 'CUS-SG-12206',
    donor: 'P. Lim (Ang Mo Kio)',
    uen: 'T26CC0021K',
    status: 'active',
    nextCollection: '2026-05-29',
    amountCents: 5_000n,
    account: 'SCS pilot',
  },
  {
    customerRef: 'CUS-SG-12205',
    donor: 'N. Fadhil (Bedok)',
    uen: 'T26CC0021K',
    status: 'active',
    nextCollection: '2026-06-04',
    amountCents: 30_000n,
    account: 'SCS pilot',
  },
  {
    customerRef: 'CUS-SG-12204',
    donor: 'H. Zhang (Woodlands)',
    uen: 'T26CC0021K',
    status: 'expired',
    nextCollection: '—',
    amountCents: 5_000n,
    account: 'SCS pilot',
  },
  {
    customerRef: 'CUS-SG-12203',
    donor: 'A. Maniam (Punggol)',
    uen: 'T26CC0021K',
    status: 'active',
    nextCollection: '2026-05-30',
    amountCents: 10_000n,
    account: 'Tampines FSC pilot',
  },
  {
    customerRef: 'CUS-SG-12202',
    donor: 'J. Sim (Jurong East)',
    uen: 'T26CC0021K',
    status: 'cancelled',
    nextCollection: '—',
    amountCents: 0n,
    account: 'SCS pilot',
  },
  {
    customerRef: 'CUS-SG-12201',
    donor: 'V. Krishnan (Ang Mo Kio)',
    uen: 'T26CC0021K',
    status: 'active',
    nextCollection: '2026-06-01',
    amountCents: 12_500n,
    account: 'SCS pilot',
  },
  {
    customerRef: 'CUS-SG-12200',
    donor: 'B. Goh (Tampines)',
    uen: 'T26CC0021K',
    status: 'active',
    nextCollection: '2026-05-31',
    amountCents: 5_000n,
    account: 'Tampines FSC pilot',
  },
];

interface Cohort {
  cohort: string;
  donors: number;
  mrrCents: bigint;
  churned: number;
  netRetentionPct: number;
}

const SG_COHORTS: Cohort[] = [
  { cohort: 'May 2025', donors: 24, mrrCents: 240_00n, churned: 8, netRetentionPct: 71.2 },
  { cohort: 'Jun 2025', donors: 38, mrrCents: 380_00n, churned: 11, netRetentionPct: 74.5 },
  { cohort: 'Jul 2025', donors: 51, mrrCents: 510_00n, churned: 13, netRetentionPct: 76.8 },
  { cohort: 'Aug 2025', donors: 62, mrrCents: 620_00n, churned: 14, netRetentionPct: 78.1 },
  { cohort: 'Sep 2025', donors: 81, mrrCents: 810_00n, churned: 17, netRetentionPct: 80.0 },
  { cohort: 'Oct 2025', donors: 102, mrrCents: 1_020_00n, churned: 19, netRetentionPct: 82.4 },
  { cohort: 'Nov 2025', donors: 118, mrrCents: 1_180_00n, churned: 21, netRetentionPct: 83.1 },
  { cohort: 'Dec 2025', donors: 142, mrrCents: 1_420_00n, churned: 21, netRetentionPct: 85.2 },
  { cohort: 'Jan 2026', donors: 168, mrrCents: 1_680_00n, churned: 24, netRetentionPct: 85.8 },
  { cohort: 'Feb 2026', donors: 198, mrrCents: 2_178_00n, churned: 26, netRetentionPct: 87.1 },
  { cohort: 'Mar 2026', donors: 229, mrrCents: 2_519_00n, churned: 24, netRetentionPct: 89.0 },
  { cohort: 'Apr 2026', donors: 261, mrrCents: 2_871_00n, churned: 21, netRetentionPct: 91.2 },
];

function eventTone(s: StripeSgEvent['status']): 'success' | 'danger' | 'warn' {
  return s === 'ok' ? 'success' : s === 'failed' ? 'danger' : 'warn';
}

function paynowTone(s: PayNowMandate['status']): 'success' | 'warn' | 'muted' | 'danger' {
  switch (s) {
    case 'active':
      return 'success';
    case 'pending_qr_scan':
      return 'warn';
    case 'expired':
      return 'muted';
    case 'cancelled':
      return 'danger';
  }
}

function paynowLabel(s: PayNowMandate['status']): string {
  switch (s) {
    case 'active':
      return 'Active';
    case 'pending_qr_scan':
      return 'Awaiting QR scan';
    case 'expired':
      return 'Expired';
    case 'cancelled':
      return 'Cancelled';
  }
}

export default function SgPaymentsPage(): JSX.Element {
  const totalMtdCents = 142_400_00n + 41_840_00n; // Stripe SG + PayNow monthly
  const successful = STRIPE_SG_EVENTS.filter(
    (e) => e.status === 'ok' && e.type !== 'paynow.confirmed',
  ).length;
  const failed = STRIPE_SG_EVENTS.filter((e) => e.status === 'failed').length;
  const paynowScans = STRIPE_SG_EVENTS.filter((e) => e.type === 'paynow.confirmed').length;
  const recurringActive = PAYNOW_MANDATES.filter((m) => m.status === 'active').length;

  return (
    <PlatformShell pageTitle="SG payments · Stripe SG + PayNow">
      <div className="space-y-5 max-w-[1700px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <CreditCard size={14} className="text-accent" />
            <span>
              SG money rails. <span className="font-semibold">Stripe SG</span> for card + recurring
              (SGD settled to DBS). <span className="font-semibold">PayNow Corporate</span> for QR
              push-pay against UEN <span className="mono">T26CC0021K</span>. MAS Outsourcing notice
              on file · AWS ap-southeast-1 residency.
            </span>
          </span>
        </Banner>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted">
            SG · Phase 3 demo data — live wiring lands in Phase 3.x
          </span>
          <DataSourceBadge source="fixture" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <KpiCard
            label="Total MTD"
            value={<Money cents={totalMtdCents} region="SG" />}
            delta="+18.3%"
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
            label="PayNow QR scans"
            value={paynowScans}
            hint="last 24h"
            deltaTone="positive"
          />
          <KpiCard label="Recurring active" value={recurringActive} hint="across all rails" />
          <KpiCard
            label="Avg PayNow gift"
            value={<Money cents={5_625n} region="SG" />}
            hint="last 24h"
          />
          <KpiCard label="Stripe SG fees MTD" value={<Money cents={4_272_00n} region="SG" />} />
        </div>

        <Section
          title="Stripe SG · recent events"
          subtitle="Live webhook stream · last 15 events shown"
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
                <th>Amount (SGD)</th>
                <th>Status</th>
                <th>Timestamp (SGT)</th>
              </tr>
            </thead>
            <tbody>
              {STRIPE_SG_EVENTS.map((e) => {
                const arrow =
                  e.type === 'charge.refunded' ? (
                    <ArrowUpRight size={11} className="text-warn" />
                  ) : e.type === 'paynow.confirmed' ? (
                    <QrCode size={11} className="text-accent" />
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
                        <Money cents={e.amountCents} region="SG" />
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
          title="PayNow Corporate · QR-code mandates"
          subtitle={`UEN T26CC0021K · ${PAYNOW_MANDATES.length} mandates against entity`}
          paddedBody={false}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Customer ref</th>
                <th>Donor (area)</th>
                <th>UEN</th>
                <th>Account</th>
                <th>Next collection</th>
                <th>Amount (SGD)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {PAYNOW_MANDATES.map((m) => (
                <tr key={m.customerRef}>
                  <td>
                    <span className="mono text-[10px] !w-auto !px-2">{m.customerRef}</span>
                  </td>
                  <td className="text-[12.5px] text-ink">{m.donor}</td>
                  <td>
                    <span className="mono text-[10px] !w-auto !px-2">{m.uen}</span>
                  </td>
                  <td className="text-[12px] text-ink">{m.account}</td>
                  <td className="text-[12px] text-muted numeric">{m.nextCollection}</td>
                  <td className="text-[12px] text-ink">
                    {m.amountCents === 0n ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <Money cents={m.amountCents} region="SG" />
                    )}
                  </td>
                  <td>
                    <StatusPill tone={paynowTone(m.status)}>{paynowLabel(m.status)}</StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section
          title="Recurring giving cohort · net retention (SG)"
          subtitle="By sign-up month · 12-month rolling · Tampines FSC + SCS pilots combined"
          paddedBody={false}
          action={
            <span className="text-[11px] text-muted flex items-center gap-1.5">
              <Repeat size={11} className="text-accent" />
              Avg net retention: 82.0%
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
              {SG_COHORTS.map((c) => {
                const tone: 'success' | 'info' | 'warn' =
                  c.netRetentionPct >= 88 ? 'success' : c.netRetentionPct >= 80 ? 'info' : 'warn';
                return (
                  <tr key={c.cohort}>
                    <td className="text-[13px] text-ink font-medium">{c.cohort}</td>
                    <td className="text-[12px] text-ink numeric">{c.donors.toLocaleString()}</td>
                    <td className="text-[12px] text-ink">
                      <Money cents={c.mrrCents} region="SG" />
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
            label="Last successful Stripe SG webhook"
            value="09:42:18 SGT"
            hint="paynow.confirmed · evt_3QSG7xK1u"
          />
          <SignalCard
            icon={<XCircle size={14} className="text-danger" />}
            label="Last failed charge"
            value="09:20:11 SGT"
            hint="Card declined · S$200.00 · auto-retry queued"
          />
          <SignalCard
            icon={<RefreshCw size={14} className="text-accent" />}
            label="Next Stripe SG payout"
            value="2026-05-26"
            hint="Settles to DBS · S$28,420 expected"
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
