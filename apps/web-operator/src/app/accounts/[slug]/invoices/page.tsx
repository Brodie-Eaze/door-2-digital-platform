import {
  CreditCard,
  Download,
  ExternalLink,
  Send,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Banner, Button, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { getAccount, type Account } from '@/lib/accounts';

interface Invoice {
  id: string;
  period: string;
  issuedAt: string;
  dueAt: string;
  status: 'paid' | 'pending' | 'overdue' | 'open';
  amountCents: bigint;
  daysOverdue?: number;
}

const PLATFORM_FEE_CENTS = 250000n; // $2,500
const DOOR_RAKE_PCT = 15;
const INSIDE_RAKE_PCT = 10;
const RETARG_RAKE_PCT = 5;

function bn(n: number): bigint {
  return BigInt(Math.round(n));
}

function pct(amount: bigint, p: number): bigint {
  return (amount * BigInt(Math.round(p * 100))) / 10000n;
}

function buildInvoiceHistory(account: Account): Invoice[] {
  // Build 7 historical invoices for established accounts, fewer for trial
  const months = [
    { period: 'Apr 2026', issued: '2026-05-01', due: '2026-05-15' },
    { period: 'Mar 2026', issued: '2026-04-01', due: '2026-04-15' },
    { period: 'Feb 2026', issued: '2026-03-01', due: '2026-03-15' },
    { period: 'Jan 2026', issued: '2026-02-01', due: '2026-02-15' },
    { period: 'Dec 2025', issued: '2026-01-01', due: '2026-01-15' },
    { period: 'Nov 2025', issued: '2025-12-01', due: '2025-12-15' },
    { period: 'Oct 2025', issued: '2025-11-01', due: '2025-11-15' },
  ];

  const monthCount = account.plan === 'Trial' ? 0 : account.plan === 'Growth' ? 4 : 7;
  const base = account.revenueCentsMTD;
  return months.slice(0, monthCount).map((m, i) => {
    // Vary revenue by month (older = a bit smaller)
    const factor = 1 - i * 0.04 - (i % 2) * 0.02;
    const amt = (base * bn(factor * 100)) / 100n + PLATFORM_FEE_CENTS;
    // Mostly paid; one overdue for attention accounts
    const status: Invoice['status'] =
      i === 0 && account.health === 'attention'
        ? 'overdue'
        : i === 1 && account.health === 'attention'
          ? 'pending'
          : 'paid';
    return {
      id: `inv_${m.period.toLowerCase().replace(' ', '_')}_${account.slug.slice(0, 4)}`,
      period: m.period,
      issuedAt: m.issued,
      dueAt: m.due,
      status,
      amountCents: amt,
      daysOverdue: status === 'overdue' ? 12 : undefined,
    };
  });
}

export default function AccountInvoicesPage({ params }: { params: { slug: string } }): JSX.Element {
  const account = getAccount(params.slug);
  if (!account) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Invoices">
        <Banner tone="danger">Account not found.</Banner>
      </AccountShell>
    );
  }

  // Current month (in-progress) breakdown — derived from revenueCentsMTD
  // Assume 70% door, 22% inside-sales, 8% retargeting of MTD revenue
  const doorConvCents = (account.revenueCentsMTD * 70n) / 100n;
  const insideConvCents = (account.revenueCentsMTD * 22n) / 100n;
  const retargConvCents = (account.revenueCentsMTD * 8n) / 100n;

  const doorRake = pct(doorConvCents, DOOR_RAKE_PCT);
  const insideRake = pct(insideConvCents, INSIDE_RAKE_PCT);
  const retargRake = pct(retargConvCents, RETARG_RAKE_PCT);
  const currentTotal = PLATFORM_FEE_CENTS + doorRake + insideRake + retargRake;

  const invoices = buildInvoiceHistory(account);
  const outstanding = invoices
    .filter((i) => i.status === 'overdue' || i.status === 'pending')
    .reduce((s, i) => s + i.amountCents, 0n);
  const paidYTD = invoices
    .filter((i) => i.status === 'paid')
    .reduce((s, i) => s + i.amountCents, 0n);
  const avgInvoice = invoices.length > 0 ? paidYTD / BigInt(invoices.length) : 0n;
  const daysOverdue = invoices.find((i) => i.status === 'overdue')?.daysOverdue ?? 0;

  const region = account.region === 'AU' ? 'AU' : 'US';
  const processor =
    account.region === 'AU'
      ? 'Stripe AU + GoCardless'
      : account.region === 'US'
        ? 'MiCamp'
        : 'Stripe';

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Invoices">
      <div className="space-y-5 max-w-[1400px]">
        <Banner tone={account.health === 'attention' ? 'warn' : 'info'}>
          <span className="text-[13px] flex items-center gap-2">
            <CreditCard size={13} />
            <span>
              Billing for <span className="font-semibold">{account.shortName}</span> · platform fee
              + per-attribution rake (door {DOOR_RAKE_PCT}% · inside-sales {INSIDE_RAKE_PCT}% ·
              retargeting {RETARG_RAKE_PCT}%) · cycles through {processor}.
            </span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Outstanding"
            value={<Money cents={outstanding} region={region} />}
            hint={outstanding > 0n ? 'awaiting payment' : 'all current'}
            deltaTone={outstanding > 0n ? 'negative' : 'positive'}
          />
          <KpiCard
            label="Paid YTD"
            value={<Money cents={paidYTD} region={region} />}
            delta="+18.4%"
            deltaTone="positive"
          />
          <KpiCard
            label="Avg invoice"
            value={<Money cents={avgInvoice} region={region} />}
            hint={`${invoices.length} prior invoices`}
          />
          <KpiCard
            label="Days overdue"
            value={daysOverdue || '—'}
            hint={daysOverdue > 0 ? 'NET-15 terms' : 'on time'}
            deltaTone={daysOverdue > 0 ? 'negative' : 'positive'}
          />
        </div>

        <Section
          title="Current invoice (in-progress) · May 2026"
          subtitle={`Auto-generated nightly · finalised on day ${account.contractedAt.slice(8, 10)} of the month`}
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-3">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Line item</th>
                    <th>Volume</th>
                    <th>Rate</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <div className="text-[13px] font-medium text-ink">Platform fee</div>
                      <div className="text-[10px] text-muted">Fixed monthly · {account.plan}</div>
                    </td>
                    <td className="text-[12px] text-muted">1 × month</td>
                    <td className="text-[12px] text-muted">—</td>
                    <td>
                      <Money cents={PLATFORM_FEE_CENTS} region={region} />
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div className="text-[13px] font-medium text-ink">Door conversions</div>
                      <div className="text-[10px] text-muted">In-person knock → conversion</div>
                    </td>
                    <td className="text-[12px] text-ink numeric">
                      <Money cents={doorConvCents} region={region} />
                    </td>
                    <td className="text-[12px] text-muted numeric">{DOOR_RAKE_PCT}%</td>
                    <td>
                      <Money cents={doorRake} region={region} />
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div className="text-[13px] font-medium text-ink">
                        Inside-sales conversions
                      </div>
                      <div className="text-[10px] text-muted">Phone callback → conversion</div>
                    </td>
                    <td className="text-[12px] text-ink numeric">
                      <Money cents={insideConvCents} region={region} />
                    </td>
                    <td className="text-[12px] text-muted numeric">{INSIDE_RAKE_PCT}%</td>
                    <td>
                      <Money cents={insideRake} region={region} />
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div className="text-[13px] font-medium text-ink">
                        Retargeting conversions
                      </div>
                      <div className="text-[10px] text-muted">Drip/web/email → conversion</div>
                    </td>
                    <td className="text-[12px] text-ink numeric">
                      <Money cents={retargConvCents} region={region} />
                    </td>
                    <td className="text-[12px] text-muted numeric">{RETARG_RAKE_PCT}%</td>
                    <td>
                      <Money cents={retargRake} region={region} />
                    </td>
                  </tr>
                  <tr className="font-semibold bg-paper/60">
                    <td
                      colSpan={3}
                      className="text-right text-[12px] uppercase tracking-wider text-muted"
                    >
                      Running total
                    </td>
                    <td>
                      <Money
                        cents={currentTotal}
                        region={region}
                        className="!text-[15px] !font-bold !text-ink"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="space-y-3">
              <div className="card card-pad">
                <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-3">
                  Conversion mix
                </div>
                <div className="space-y-2">
                  <MixBar label="Door" pct={70} tone="success" />
                  <MixBar label="Inside-sales" pct={22} tone="info" />
                  <MixBar label="Retargeting" pct={8} tone="warn" />
                </div>
              </div>
              <div className="card card-pad">
                <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-3">
                  Next steps
                </div>
                <div className="space-y-2 text-[11px]">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 size={12} className="text-success mt-0.5 shrink-0" />
                    <span className="text-ink">Auto-finalises on May 31, 23:59 UTC</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 size={12} className="text-success mt-0.5 shrink-0" />
                    <span className="text-ink">Charged via {processor} on June 1</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 size={12} className="text-success mt-0.5 shrink-0" />
                    <span className="text-ink">PDF emailed to billing contact</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section
          title="Invoice history"
          subtitle={`${invoices.length} prior invoices · NET-15 terms`}
          paddedBody={false}
          action={
            <Button variant="ghost" size="sm" leftIcon={<Download size={13} />}>
              Export CSV
            </Button>
          }
        >
          {invoices.length === 0 ? (
            <div className="p-5">
              <div className="text-[12px] text-soft">
                No prior invoices — {account.shortName} is on a 14-day trial. First invoice will be
                generated when the trial converts.
              </div>
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Period</th>
                  <th>Issued</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const tone: 'success' | 'warn' | 'danger' | 'info' =
                    inv.status === 'paid'
                      ? 'success'
                      : inv.status === 'overdue'
                        ? 'danger'
                        : inv.status === 'pending'
                          ? 'warn'
                          : 'info';
                  return (
                    <tr key={inv.id}>
                      <td>
                        <span className="mono text-[10px] !w-auto !px-2">{inv.id}</span>
                      </td>
                      <td className="text-[13px] text-ink">{inv.period}</td>
                      <td className="text-[12px] text-muted numeric">{inv.issuedAt}</td>
                      <td className="text-[12px] text-muted numeric">{inv.dueAt}</td>
                      <td>
                        <StatusPill tone={tone}>
                          {inv.status === 'overdue'
                            ? `Overdue · ${inv.daysOverdue}d`
                            : inv.status === 'pending'
                              ? 'Pending'
                              : inv.status === 'paid'
                                ? 'Paid'
                                : 'Open'}
                        </StatusPill>
                      </td>
                      <td>
                        <Money cents={inv.amountCents} region={region} />
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            className="text-soft hover:text-ink p-1 rounded hover:bg-paper"
                            title="View PDF"
                          >
                            <ExternalLink size={13} />
                          </button>
                          <button
                            className="text-soft hover:text-ink p-1 rounded hover:bg-paper"
                            title="Resend"
                          >
                            <Send size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Section>

        <Section
          title="Payment method"
          subtitle={`On file with ${processor} for ${account.shortName}`}
        >
          {account.region === 'AU' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card card-pad">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted font-medium">
                      Primary · Stripe AU
                    </div>
                    <div className="text-[14px] font-semibold text-ink mt-1">
                      Visa · Corporate (AUD)
                    </div>
                  </div>
                  <span className="tag !text-[9px]">Stripe AU</span>
                </div>
                <div className="space-y-2 text-[12px]">
                  <Row label="Card ending" value={<span className="numeric">••••4421</span>} />
                  <Row label="Expires" value={<span className="numeric">11/27</span>} />
                  <Row
                    label="Billing postcode"
                    value={<span className="numeric">2000 (NSW)</span>}
                  />
                  <Row
                    label="Account ref"
                    value={
                      <span className="mono text-[10px] !w-auto !px-2">acct_1NQFxxxAUauxx</span>
                    }
                  />
                  <Row
                    label="Status"
                    value={<StatusPill tone="success">Verified · auto-charge</StatusPill>}
                  />
                </div>
              </div>
              <div className="card card-pad">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted font-medium">
                      Backup · GoCardless (BPAY / PayTo)
                    </div>
                    <div className="text-[14px] font-semibold text-ink mt-1">
                      CommBank Direct Debit · NPP
                    </div>
                  </div>
                  {account.health === 'attention' && (
                    <span className="text-warn">
                      <AlertTriangle size={14} />
                    </span>
                  )}
                </div>
                <div className="space-y-2 text-[12px]">
                  <Row label="BSB" value={<span className="numeric">062-001</span>} />
                  <Row label="Account ending" value={<span className="numeric">••••8821</span>} />
                  <Row
                    label="PayTo agreement"
                    value={<span className="mono text-[10px] !w-auto !px-2">PA-2026-04-0421</span>}
                  />
                  <Row
                    label="ABN"
                    value={<span className="mono text-[10px] !w-auto !px-2">53 004 085 616</span>}
                  />
                  <Row
                    label="Status"
                    value={<StatusPill tone="success">Active · NPP-cleared</StatusPill>}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card card-pad">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted font-medium">
                      Primary
                    </div>
                    <div className="text-[14px] font-semibold text-ink mt-1">
                      ACH · Bank of America
                    </div>
                  </div>
                  <span className="tag !text-[9px]">{processor}</span>
                </div>
                <div className="space-y-2 text-[12px]">
                  <Row label="Account ending" value={<span className="numeric">••••3412</span>} />
                  <Row label="Routing" value={<span className="numeric">••••0091</span>} />
                  <Row
                    label="Added"
                    value={<span className="numeric">{account.contractedAt}</span>}
                  />
                  <Row
                    label="Status"
                    value={<StatusPill tone="success">Verified · auto-debit</StatusPill>}
                  />
                </div>
              </div>
              <div className="card card-pad">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted font-medium">
                      Backup card
                    </div>
                    <div className="text-[14px] font-semibold text-ink mt-1">Visa · Corporate</div>
                  </div>
                  {account.health === 'attention' && (
                    <span className="text-warn">
                      <AlertTriangle size={14} />
                    </span>
                  )}
                </div>
                <div className="space-y-2 text-[12px]">
                  <Row label="Card ending" value={<span className="numeric">••••8821</span>} />
                  <Row label="Expires" value={<span className="numeric">09/27</span>} />
                  <Row label="Billing zip" value={<span className="numeric">78704</span>} />
                  <Row
                    label="Status"
                    value={
                      account.health === 'attention' ? (
                        <StatusPill tone="warn">Expires in 18mo</StatusPill>
                      ) : (
                        <StatusPill tone="muted">Backup only</StatusPill>
                      )
                    }
                  />
                </div>
              </div>
            </div>
          )}
        </Section>
      </div>
    </AccountShell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }): JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

function MixBar({
  label,
  pct,
  tone,
}: {
  label: string;
  pct: number;
  tone: 'success' | 'info' | 'warn';
}): JSX.Element {
  const bg = tone === 'success' ? 'bg-success' : tone === 'info' ? 'bg-accent' : 'bg-warn';
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-muted">{label}</span>
        <span className="text-ink font-semibold numeric">{pct}%</span>
      </div>
      <div className="h-1.5 bg-line2 rounded-full overflow-hidden">
        <div className={`h-full ${bg}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
