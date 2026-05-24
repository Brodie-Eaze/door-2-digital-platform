import {
  Globe2,
  ShieldCheck,
  CreditCard,
  Database,
  PhoneOff,
  Clock,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { Banner, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { ACCOUNTS } from '@/lib/accounts';

const AU_ACCOUNTS = ACCOUNTS.filter((a) => a.region === 'AU');

const AU_KNOCKERS = AU_ACCOUNTS.reduce((s, a) => s + a.knockers, 0);
const AU_REVENUE_CENTS = AU_ACCOUNTS.reduce((s, a) => s + a.revenueCentsMTD, 0n);
const AU_CONVERSIONS = AU_ACCOUNTS.reduce((s, a) => s + a.conversionsMTD, 0);
const AU_LEADS_TODAY = AU_ACCOUNTS.reduce((s, a) => s + a.leadsInboxToday, 0);
const AU_CONVERSION_RATE = AU_LEADS_TODAY > 0 ? (AU_CONVERSIONS / 30 / AU_LEADS_TODAY) * 100 : 0;

interface StateClearance {
  state: 'NSW' | 'VIC' | 'QLD' | 'SA' | 'WA' | 'TAS' | 'ACT' | 'NT';
  regulator: string;
  status: 'registered' | 'pending' | 'NA';
  bondAud: number;
  expires: string;
  licence: string;
}

const STATE_TABLE: StateClearance[] = [
  {
    state: 'NSW',
    regulator: 'NSW Dept Fair Trading',
    status: 'registered',
    bondAud: 25_000,
    expires: '2027-04-30',
    licence: 'CFN 16412',
  },
  {
    state: 'VIC',
    regulator: 'Consumer Affairs Victoria',
    status: 'registered',
    bondAud: 20_000,
    expires: '2027-03-31',
    licence: 'F-19023',
  },
  {
    state: 'QLD',
    regulator: 'QLD Office of Fair Trading',
    status: 'registered',
    bondAud: 15_000,
    expires: '2027-06-30',
    licence: 'CCA 8845',
  },
  {
    state: 'SA',
    regulator: 'SA Consumer & Business Services',
    status: 'registered',
    bondAud: 10_000,
    expires: '2027-02-28',
    licence: 'CHFS 4129',
  },
  {
    state: 'WA',
    regulator: 'WA Dept Mines, Industry, Regulation & Safety',
    status: 'pending',
    bondAud: 18_000,
    expires: '—',
    licence: 'WAC-PEND-0421',
  },
  {
    state: 'TAS',
    regulator: 'TAS Consumer Affairs & Fair Trading',
    status: 'registered',
    bondAud: 5_000,
    expires: '2027-01-31',
    licence: 'TAS-CF-1188',
  },
  {
    state: 'ACT',
    regulator: 'Access Canberra',
    status: 'registered',
    bondAud: 5_000,
    expires: '2027-05-31',
    licence: 'ACT-CC-220',
  },
  {
    state: 'NT',
    regulator: 'NT Consumer Affairs',
    status: 'NA',
    bondAud: 0,
    expires: '—',
    licence: '— (charity exempt)',
  },
];

const ABS_FEEDS = [
  {
    name: 'ABS SEIFA 2021',
    detail: 'Socio-economic decile per SA1 statistical area',
    lastRefresh: '2026-05-23 03:14 AEST',
    rowCount: '57,523',
    next: 'Quarterly · 2026-08-15',
  },
  {
    name: 'ABS Mesh Block boundaries',
    detail: 'GeoJSON polygons for ~358k mesh blocks',
    lastRefresh: '2026-05-01 02:01 AEST',
    rowCount: '358,122',
    next: 'Annual · 2027-05-01',
  },
  {
    name: 'Australia Post PAF',
    detail: 'Postal Address File · 13.8M deliverable addresses',
    lastRefresh: '2026-05-24 01:00 AEST',
    rowCount: '13,824,907',
    next: 'Daily · 2026-05-25',
  },
  {
    name: 'ABS Census 2021 cross-tabs',
    detail: 'Income · age · household type per SA2',
    lastRefresh: '2026-05-01 02:34 AEST',
    rowCount: '2,310',
    next: 'Annual · 2027-08-15',
  },
];

const COOLING_OFF = {
  windowDays: 10,
  open: 142,
  releasedToday: 23,
  breaches: 0,
};

export default function AuRegionPage(): JSX.Element {
  return (
    <PlatformShell pageTitle="AU region — operations">
      <div className="space-y-5 max-w-[1700px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Globe2 size={14} className="text-accent" />
            <span>
              Operational view for the <span className="font-semibold">Australia region</span>.
              Compliance (ACNC + 7 state regulators), payments (Stripe AU + GoCardless), ABS data
              feeds, CHOICE DNK / DNCR scrubbing, and ACL 10-business-day cooling-off all live here.
              Campaigns into AU addresses pass through these gates.
            </span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard
            label="Active AU accounts"
            value={AU_ACCOUNTS.length}
            hint={`of ${ACCOUNTS.length} portfolio`}
          />
          <KpiCard
            label="AU Knockers deployed"
            value={AU_KNOCKERS.toLocaleString()}
            hint="field reps"
          />
          <KpiCard
            label="MTD revenue AUD"
            value={<Money cents={AU_REVENUE_CENTS} region="AU" />}
            delta="+9.4%"
            deltaTone="positive"
          />
          <KpiCard
            label="Conversion rate"
            value={`${AU_CONVERSION_RATE.toFixed(1)}%`}
            hint="rolling 30d"
          />
          <KpiCard
            label="Cooling-off open"
            value={COOLING_OFF.open}
            hint={`${COOLING_OFF.windowDays}-bus-day windows`}
          />
        </div>

        <Section
          title="Compliance status · ACNC + state regulators"
          subtitle="One row per AU regulator · paid-solicitor + charity-collector registrations"
          paddedBody={false}
          action={
            <span className="text-[11px] text-muted flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-success" />
              ACNC registration: <span className="mono">CN 12345</span> · DGR status: Item 1
            </span>
          }
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>State</th>
                <th>Regulator</th>
                <th>Licence ref</th>
                <th>Bond (AUD)</th>
                <th>Expires</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {STATE_TABLE.map((row) => {
                const tone: 'success' | 'warn' | 'muted' =
                  row.status === 'registered'
                    ? 'success'
                    : row.status === 'pending'
                      ? 'warn'
                      : 'muted';
                const label =
                  row.status === 'registered'
                    ? 'Registered'
                    : row.status === 'pending'
                      ? 'Pending'
                      : 'N/A';
                return (
                  <tr key={row.state}>
                    <td>
                      <span className="mono !w-9 !text-[10px]">{row.state}</span>
                    </td>
                    <td className="text-[13px] text-ink">{row.regulator}</td>
                    <td>
                      <span className="mono text-[10px] !w-auto !px-2">{row.licence}</span>
                    </td>
                    <td className="text-[12px] text-ink numeric">
                      {row.bondAud === 0 ? '—' : `A$${row.bondAud.toLocaleString()}`}
                    </td>
                    <td className="text-[12px] text-muted numeric">{row.expires}</td>
                    <td>
                      <StatusPill tone={tone}>{label}</StatusPill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>

        <Section
          title="Payment providers · AU"
          subtitle="Stripe AU for card + Direct Debit · GoCardless for BPAY / PayTo"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ProviderCard
              name="Stripe AU"
              subtitle="acct_1NQFxxxAUauxx · en-AU · AUD"
              status="live"
              lastWebhook="2026-05-24 09:42:18 AEST · payment_intent.succeeded"
              monthlyVolumeAud={642_400_00n}
              kbn="acct_live_stripeau"
              docsUrl="https://dashboard.stripe.com/au"
            />
            <ProviderCard
              name="GoCardless · BPAY + PayTo"
              subtitle="OR-AU-9921 · ABN 53 004 085 616 · AUD"
              status="live"
              lastWebhook="2026-05-24 09:38:02 AEST · mandates.active"
              monthlyVolumeAud={298_400_00n}
              kbn="OR-AU-9921"
              docsUrl="https://manage.gocardless.com/au"
            />
          </div>
        </Section>

        <Section
          title="ABS data feeds"
          subtitle="Nightly ingest · attribution preserved per APP 1"
          paddedBody={false}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Feed</th>
                <th>Last refresh (AEST)</th>
                <th>Row count</th>
                <th>Next refresh</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {ABS_FEEDS.map((f) => (
                <tr key={f.name}>
                  <td>
                    <div className="flex items-start gap-2">
                      <Database size={12} className="text-soft mt-1 shrink-0" />
                      <div>
                        <div className="text-[13px] font-medium text-ink">{f.name}</div>
                        <div className="text-[10.5px] text-muted">{f.detail}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-[12px] text-muted numeric">{f.lastRefresh}</td>
                  <td className="text-[12px] text-ink numeric">{f.rowCount}</td>
                  <td className="text-[12px] text-muted">{f.next}</td>
                  <td>
                    <StatusPill tone="success">Healthy</StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Section title="DNK · DNC scrubbing" subtitle="CHOICE DNK + ACMA Do Not Call Register">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <PhoneOff size={14} className="text-soft mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-ink">
                    CHOICE DNK sticker registry
                  </div>
                  <div className="text-[11px] text-muted">
                    Address-level opt-outs honoured pre-knock
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[16px] font-semibold text-ink numeric">142,318</div>
                  <div className="text-[10px] text-muted uppercase tracking-wider">opt-outs</div>
                </div>
              </div>
              <div className="border-t border-line2 pt-3 flex items-start gap-3">
                <PhoneOff size={14} className="text-soft mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-ink">DNCR API (ACMA)</div>
                  <div className="text-[11px] text-muted">
                    Telephone Do Not Call Register · live wash
                  </div>
                </div>
                <StatusPill tone="success">Connected</StatusPill>
              </div>
              <div className="border-t border-line2 pt-3 flex items-start gap-3">
                <RefreshCw size={14} className="text-soft mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-ink">Last scrub run</div>
                  <div className="text-[11px] text-muted">2026-05-24 02:00 AEST</div>
                </div>
                <div className="text-right">
                  <div className="text-[16px] font-semibold text-ink numeric">8,402</div>
                  <div className="text-[10px] text-muted uppercase tracking-wider">
                    scrubbed 24h
                  </div>
                </div>
              </div>
            </div>
          </Section>

          <Section
            title="ACL cooling-off engine"
            subtitle="Australian Consumer Law · 10 business days post-conversion"
          >
            <div className="grid grid-cols-2 gap-3">
              <CoolingTile
                icon={<Clock size={13} className="text-accent" />}
                label="Open windows"
                value={COOLING_OFF.open}
                hint="In cooling-off"
              />
              <CoolingTile
                icon={<CheckCircle2 size={13} className="text-success" />}
                label="Released today"
                value={COOLING_OFF.releasedToday}
                hint="Locked to billing"
              />
              <CoolingTile
                icon={<Clock size={13} className="text-muted" />}
                label="Window length"
                value={`${COOLING_OFF.windowDays} bus.days`}
                hint="Per ACL"
              />
              <CoolingTile
                icon={<ShieldCheck size={13} className="text-success" />}
                label="Breaches"
                value={COOLING_OFF.breaches}
                hint="Last 30d"
              />
            </div>
            <div className="mt-3 text-[11px] text-muted">
              Cooling-off timers start at conversion timestamp + first AEST business-day boundary
              and exclude weekends + AU public holidays.
            </div>
          </Section>
        </div>

        <Section
          title="AU accounts on platform"
          subtitle="Sub-accounts whose conversions touch this region's compliance gates"
          paddedBody={false}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Account</th>
                <th>Vertical</th>
                <th>Plan</th>
                <th>Knockers</th>
                <th>MTD revenue</th>
                <th>Conversions MTD</th>
                <th>Health</th>
              </tr>
            </thead>
            <tbody>
              {AU_ACCOUNTS.map((a) => (
                <tr key={a.slug}>
                  <td>
                    <a
                      href={`/accounts/${a.slug}`}
                      className="text-[13px] font-medium text-ink hover:text-accent flex items-center gap-1.5"
                    >
                      {a.name}
                      <ExternalLink size={11} className="text-soft" />
                    </a>
                  </td>
                  <td className="text-[12px] text-muted capitalize">{a.vertical}</td>
                  <td className="text-[12px] text-ink">{a.plan}</td>
                  <td className="text-[12px] text-ink numeric">{a.knockers}</td>
                  <td className="text-[12px] text-ink">
                    <Money cents={a.revenueCentsMTD} region="AU" />
                  </td>
                  <td className="text-[12px] text-ink numeric">
                    {a.conversionsMTD.toLocaleString()}
                  </td>
                  <td>
                    <StatusPill
                      tone={
                        a.health === 'healthy'
                          ? 'success'
                          : a.health === 'attention'
                            ? 'warn'
                            : 'danger'
                      }
                    >
                      {a.health}
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

function ProviderCard({
  name,
  subtitle,
  status,
  lastWebhook,
  monthlyVolumeAud,
  kbn,
  docsUrl,
}: {
  name: string;
  subtitle: string;
  status: 'live' | 'sandbox' | 'down';
  lastWebhook: string;
  monthlyVolumeAud: bigint;
  kbn: string;
  docsUrl: string;
}): JSX.Element {
  const tone = status === 'live' ? 'success' : status === 'sandbox' ? 'warn' : 'danger';
  const label = status === 'live' ? 'Live' : status === 'sandbox' ? 'Sandbox' : 'Down';
  return (
    <div className="card card-pad">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <CreditCard size={13} className="text-accent" />
            <div className="text-[14px] font-semibold text-ink">{name}</div>
          </div>
          <div className="text-[10.5px] text-muted mt-0.5">{subtitle}</div>
        </div>
        <StatusPill tone={tone}>{label}</StatusPill>
      </div>
      <div className="space-y-1.5 text-[12px]">
        <div className="flex items-center justify-between">
          <span className="text-muted">Last webhook</span>
          <span className="text-ink mono text-[10px]">{lastWebhook}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted">Monthly volume</span>
          <Money cents={monthlyVolumeAud} region="AU" className="!text-[13px] !font-semibold" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted">Account ref</span>
          <span className="mono text-[10px] !w-auto !px-2">{kbn}</span>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-line2">
        <a
          href={docsUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] font-semibold text-accent hover:underline flex items-center gap-1"
        >
          Open dashboard <ExternalLink size={11} />
        </a>
      </div>
    </div>
  );
}

function CoolingTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint: string;
}): JSX.Element {
  return (
    <div className="card card-pad">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted font-medium">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-[18px] font-semibold text-ink tracking-tight numeric">
        {value}
      </div>
      <div className="text-[11px] text-muted mt-0.5">{hint}</div>
    </div>
  );
}
