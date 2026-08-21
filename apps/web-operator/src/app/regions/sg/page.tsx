'use client';

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
  FileText,
  Wallet,
} from 'lucide-react';
import { Banner, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { toast } from '@/components/Toaster';

/**
 * SG region — operations control panel.
 *
 * Mirrors the AU/US pattern but with Singapore-specific regulators
 * (Commissioner of Charities, PLRD), payment rails (Stripe SG + PayNow
 * corporate via UEN), data feeds (SingStat, URA, LTA), and the CPFTA
 * 5-business-day cooling-off engine.
 *
 * No SG accounts contracted yet — KPIs reflect the SG pilot pipeline
 * (Tampines Family Service Centres + Singapore Cancer Society) staged
 * for go-live with Phase 3.
 */

interface SgPlanningArea {
  area: string;
  region: 'East' | 'West' | 'North' | 'South' | 'Central' | 'North-East';
  status: 'Active' | 'Pilot' | 'Permitted' | 'Pending PLRD';
}

const SG_PLANNING_AREAS: SgPlanningArea[] = [
  { area: 'Tampines', region: 'East', status: 'Active' },
  { area: 'Bedok', region: 'East', status: 'Active' },
  { area: 'Jurong East', region: 'West', status: 'Active' },
  { area: 'Toa Payoh', region: 'Central', status: 'Pilot' },
  { area: 'Ang Mo Kio', region: 'North-East', status: 'Permitted' },
  { area: 'Woodlands', region: 'North', status: 'Permitted' },
  { area: 'Punggol', region: 'North-East', status: 'Pilot' },
  { area: 'Sengkang', region: 'North-East', status: 'Pending PLRD' },
];

interface RegulatorRow {
  body: string;
  scope: string;
  ref: string;
  status: 'active' | 'pending' | 'NA';
  expires: string;
  bondSgd: number;
}

const REGULATORS: RegulatorRow[] = [
  {
    body: 'Commissioner of Charities (COC)',
    scope: 'Charity registration · IPC tax-deduction status',
    ref: 'UEN T26CC0021K',
    status: 'active',
    expires: 'Perpetual',
    bondSgd: 0,
  },
  {
    body: 'PLRD · House-to-House Collection',
    scope: 'Police Licensing & Regulatory Dept · per-permit basis',
    ref: 'PLRD/H2H/2026/0188',
    status: 'active',
    expires: '2026-08-31',
    bondSgd: 50_000,
  },
  {
    body: 'PLRD · Street/Tin Collection',
    scope: 'Public-place fundraising (extension)',
    ref: 'PLRD/SCC/2026/0091',
    status: 'pending',
    expires: '—',
    bondSgd: 20_000,
  },
  {
    body: 'IRAS — IPC status',
    scope: 'Institution of a Public Character · 250% deduction',
    ref: 'IPC 000211',
    status: 'active',
    expires: '2027-03-31',
    bondSgd: 0,
  },
  {
    body: 'Charity Council Code of Governance',
    scope: 'Tier 3 (large) compliance · enhanced disclosures',
    ref: 'CCG-T3-2026',
    status: 'active',
    expires: '2027-01-31',
    bondSgd: 0,
  },
  {
    body: 'MAS Outsourcing Guidelines',
    scope: 'Payment processor outsourcing notification',
    ref: 'MAS-OSG-2026-014',
    status: 'active',
    expires: 'Continuous',
    bondSgd: 0,
  },
];

const SINGSTAT_FEEDS = [
  {
    name: 'SingStat Planning Area Census 2020',
    detail: 'Resident profile · age · dwelling type · household income',
    lastRefresh: '2026-05-23 02:18 SGT',
    rowCount: '55 areas',
    next: 'Annual · 2026-12-15',
  },
  {
    name: 'URA Master Plan 2024',
    detail: 'Land-use zoning · building heights · plot ratio',
    lastRefresh: '2026-05-01 02:01 SGT',
    rowCount: '21,840 lots',
    next: 'Quarterly · 2026-08-01',
  },
  {
    name: 'HDB Resale Index',
    detail: 'Per-town resale flat pricing trend',
    lastRefresh: '2026-05-24 01:00 SGT',
    rowCount: '26 towns',
    next: 'Monthly · 2026-06-01',
  },
  {
    name: 'LTA OneMap geometries',
    detail: 'Postal-code centroids · street boundaries · MRT exits',
    lastRefresh: '2026-05-23 03:30 SGT',
    rowCount: '147,902 codes',
    next: 'Weekly · 2026-05-30',
  },
];

interface CoolingOffWindow {
  donor: string;
  area: string;
  conversionDate: string;
  daysRemaining: number; // CPFTA = 5 business days
}

const COOLING_OFF_OPEN: CoolingOffWindow[] = [
  { donor: 'L. T**', area: 'Tampines', conversionDate: '2026-05-23', daysRemaining: 4 },
  { donor: 'W. L**', area: 'Bedok', conversionDate: '2026-05-23', daysRemaining: 4 },
  { donor: 'Y. C***', area: 'Jurong East', conversionDate: '2026-05-22', daysRemaining: 3 },
  { donor: 'M. R**', area: 'Toa Payoh', conversionDate: '2026-05-22', daysRemaining: 3 },
  { donor: 'S. K**', area: 'Tampines', conversionDate: '2026-05-21', daysRemaining: 2 },
  { donor: 'P. L***', area: 'Ang Mo Kio', conversionDate: '2026-05-21', daysRemaining: 2 },
  { donor: 'N. F***', area: 'Bedok', conversionDate: '2026-05-20', daysRemaining: 1 },
  { donor: 'H. Z****', area: 'Woodlands', conversionDate: '2026-05-20', daysRemaining: 1 },
  { donor: 'A. M**', area: 'Punggol', conversionDate: '2026-05-19', daysRemaining: 1 },
  { donor: 'J. S***', area: 'Jurong East', conversionDate: '2026-05-19', daysRemaining: 1 },
];

const SG_REVENUE_MTD_CENTS = 184_240_00n; // SGD 184k pilot
const SG_KNOCKERS = 28;
const SG_ACCOUNTS_ACTIVE = 2; // Tampines FSC pilot + SCS pilot
const SG_CONVERSIONS_MTD = 412;
const SG_LEADS_TODAY = 36;
const SG_CONVERSION_RATE = (SG_CONVERSIONS_MTD / 30 / SG_LEADS_TODAY) * 100;

export default function SgRegionPage(): JSX.Element {
  const activeAreas = SG_PLANNING_AREAS.filter((a) => a.status === 'Active').length;
  const permittedAreas = SG_PLANNING_AREAS.filter(
    (a) => a.status === 'Active' || a.status === 'Permitted' || a.status === 'Pilot',
  ).length;

  return (
    <PlatformShell pageTitle="SG region — operations">
      <div className="space-y-5 max-w-[1700px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Globe2 size={14} className="text-accent" />
            <span>
              Operational view for the <span className="font-semibold">Singapore region</span>. COC
              + PLRD permits, PDPA compliance, Stripe SG + PayNow corporate rails, SingStat / URA /
              LTA data feeds, DNC Registry (PDPC), and CPFTA 5-business-day cooling-off all live
              here. SG accounts go through these gates before any door is knocked.
            </span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard
            label="Active SG accounts"
            value={SG_ACCOUNTS_ACTIVE}
            hint="Tampines FSC + SCS pilots"
          />
          <KpiCard label="SG knockers deployed" value={SG_KNOCKERS} hint="across permitted areas" />
          <KpiCard
            label="MTD revenue SGD"
            value={<Money cents={SG_REVENUE_MTD_CENTS} region="SG" />}
            delta="+18.3%"
            deltaTone="positive"
          />
          <KpiCard
            label="Conversion rate"
            value={`${SG_CONVERSION_RATE.toFixed(1)}%`}
            hint="rolling 30d · pilot"
          />
          <KpiCard
            label="Cooling-off open"
            value={COOLING_OFF_OPEN.length}
            hint="5 bus-day CPFTA windows"
          />
        </div>

        <Section
          title="Singapore regulator status"
          subtitle="COC + PLRD + IRAS · charity-fundraising perimeter"
          paddedBody={false}
          action={
            <span className="text-[11px] text-muted flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-success" />
              UEN <span className="mono">T26CC0021K</span> · IPC{' '}
              <span className="mono">000211</span>
            </span>
          }
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Body</th>
                <th>Scope</th>
                <th>Reference</th>
                <th>Bond (SGD)</th>
                <th>Expires</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {REGULATORS.map((row) => {
                const tone: 'success' | 'warn' | 'muted' =
                  row.status === 'active' ? 'success' : row.status === 'pending' ? 'warn' : 'muted';
                const label =
                  row.status === 'active' ? 'Active' : row.status === 'pending' ? 'Pending' : 'N/A';
                return (
                  <tr key={row.ref}>
                    <td className="text-[13px] text-ink font-medium">{row.body}</td>
                    <td className="text-[12px] text-muted">{row.scope}</td>
                    <td>
                      <span className="mono text-[10px] !w-auto !px-2">{row.ref}</span>
                    </td>
                    <td className="text-[12px] text-ink numeric">
                      {row.bondSgd === 0 ? '—' : `S$${row.bondSgd.toLocaleString()}`}
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
          title="Payment providers · SG"
          subtitle="Stripe SG for card + recurring · PayNow Corporate via UEN for QR push-pay"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ProviderCard
              name="Stripe SG"
              subtitle="acct_1NRSxxxSGsxxx · en-SG · SGD"
              status="live"
              lastWebhook="2026-05-24 09:42:18 SGT · payment_intent.succeeded"
              monthlyVolumeSgd={142_400_00n}
              kbn="acct_live_stripesg"
              docsUrl="https://dashboard.stripe.com/sg"
            />
            <ProviderCard
              name="PayNow Corporate (via Stripe SG)"
              subtitle="UEN T26CC0021K · SGD · DBS clearing"
              status="live"
              lastWebhook="2026-05-24 09:39:11 SGT · paynow.confirmed"
              monthlyVolumeSgd={41_840_00n}
              kbn="PNW-T26CC0021K"
              docsUrl="https://www.abs.org.sg/consumer-banking/pay-now"
            />
          </div>
        </Section>

        <Section
          title="SingStat / URA / LTA data feeds"
          subtitle="Nightly ingest · attribution preserved per PDPA Openness obligation"
          paddedBody={false}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Feed</th>
                <th>Last refresh (SGT)</th>
                <th>Row count</th>
                <th>Next refresh</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {SINGSTAT_FEEDS.map((f) => (
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
          <Section
            title="DNC Registry · PDPC"
            subtitle="Singapore Do Not Call Registry · live wash"
          >
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <PhoneOff size={14} className="text-soft mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-ink">DNC Voice Register</div>
                  <div className="text-[11px] text-muted">
                    No telemarketing calls to listed numbers without consent
                  </div>
                </div>
                <StatusPill tone="success">Connected</StatusPill>
              </div>
              <div className="border-t border-line2 pt-3 flex items-start gap-3">
                <PhoneOff size={14} className="text-soft mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-ink">DNC SMS Register</div>
                  <div className="text-[11px] text-muted">
                    SMS marketing washed via PDPC daily feed
                  </div>
                </div>
                <StatusPill tone="success">Connected</StatusPill>
              </div>
              <div className="border-t border-line2 pt-3 flex items-start gap-3">
                <RefreshCw size={14} className="text-soft mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-ink">Last scrub run</div>
                  <div className="text-[11px] text-muted">2026-05-24 02:00 SGT</div>
                </div>
                <div className="text-right">
                  <div className="text-[16px] font-semibold text-ink numeric">1,284</div>
                  <div className="text-[10px] text-muted uppercase tracking-wider">
                    scrubbed 24h
                  </div>
                </div>
              </div>
              <div className="border-t border-line2 pt-3 flex items-start gap-3">
                <Wallet size={14} className="text-accent mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-ink">
                    CDC Voucher integration (CDC2026)
                  </div>
                  <div className="text-[11px] text-muted">
                    CDC vouchers redeemable as one-off donation only
                  </div>
                </div>
                <StatusPill tone="warn">Decorative</StatusPill>
              </div>
            </div>
          </Section>

          <Section
            title="CPFTA cooling-off engine"
            subtitle="Consumer Protection (Fair Trading) Act · 5 business days post-conversion"
          >
            <div className="grid grid-cols-2 gap-3">
              <CoolingTile
                icon={<Clock size={13} className="text-accent" />}
                label="Open windows"
                value={COOLING_OFF_OPEN.length}
                hint="In cooling-off"
              />
              <CoolingTile
                icon={<CheckCircle2 size={13} className="text-success" />}
                label="Released today"
                value={6}
                hint="Locked to billing"
              />
              <CoolingTile
                icon={<Clock size={13} className="text-muted" />}
                label="Window length"
                value="5 bus.days"
                hint="Per CPFTA"
              />
              <CoolingTile
                icon={<ShieldCheck size={13} className="text-success" />}
                label="Breaches"
                value={0}
                hint="Last 30d"
              />
            </div>
            <div className="mt-3 text-[11px] text-muted">
              Cooling-off timers start at conversion timestamp + first SGT business-day boundary and
              exclude Saturdays, Sundays, and Singapore public holidays.
            </div>
          </Section>
        </div>

        <Section
          title="Open CPFTA cooling-off windows"
          subtitle="Recent SG conversions awaiting 5-business-day release"
          paddedBody={false}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Donor (masked)</th>
                <th>Planning area</th>
                <th>Conversion date</th>
                <th>Days remaining</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {COOLING_OFF_OPEN.map((w, i) => {
                const tone: 'warn' | 'info' = w.daysRemaining <= 2 ? 'warn' : 'info';
                return (
                  <tr key={i}>
                    <td className="text-[13px] text-ink mono">{w.donor}</td>
                    <td className="text-[12px] text-ink">{w.area}</td>
                    <td className="text-[12px] text-muted numeric">{w.conversionDate}</td>
                    <td>
                      <StatusPill tone={tone}>{w.daysRemaining}d left</StatusPill>
                    </td>
                    <td>
                      <button
                        className="text-[11px] font-semibold text-accent hover:underline"
                        type="button"
                        onClick={() =>
                          toast.info(`Cancel & refund ${w.donor} — wiring lands in Phase 1.2`)
                        }
                      >
                        Cancel & refund
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>

        <Section
          title="Singapore planning areas covered"
          subtitle="Per-area PLRD permitting status · territories visible to SG knockers"
          paddedBody={false}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Planning area</th>
                <th>Region</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {SG_PLANNING_AREAS.map((a) => {
                const tone: 'success' | 'info' | 'warn' =
                  a.status === 'Active'
                    ? 'success'
                    : a.status === 'Pilot' || a.status === 'Permitted'
                      ? 'info'
                      : 'warn';
                return (
                  <tr key={a.area}>
                    <td className="text-[13px] text-ink font-medium">{a.area}</td>
                    <td className="text-[12px] text-muted">{a.region}</td>
                    <td>
                      <StatusPill tone={tone}>{a.status}</StatusPill>
                    </td>
                    <td>
                      <a
                        href="/regions/sg/territory-intel"
                        className="text-[11px] font-semibold text-accent hover:underline inline-flex items-center gap-1"
                      >
                        View intel <ExternalLink size={10} />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SignalTile
            icon={<FileText size={13} className="text-accent" />}
            label="Active planning areas"
            value={`${activeAreas}/${SG_PLANNING_AREAS.length}`}
            hint={`${permittedAreas} permitted or active`}
          />
          <SignalTile
            icon={<ShieldCheck size={13} className="text-success" />}
            label="PDPA breach drills"
            value="3 in Q2"
            hint="0 findings · last 2026-05-12"
          />
          <SignalTile
            icon={<CreditCard size={13} className="text-accent" />}
            label="PayNow QR scans 24h"
            value="184"
            hint="98% successful confirm"
          />
          <SignalTile
            icon={<Database size={13} className="text-soft" />}
            label="SingStat feeds healthy"
            value={`${SINGSTAT_FEEDS.length}/${SINGSTAT_FEEDS.length}`}
            hint="all on cadence"
          />
        </div>
      </div>
    </PlatformShell>
  );
}

function ProviderCard({
  name,
  subtitle,
  status,
  lastWebhook,
  monthlyVolumeSgd,
  kbn,
  docsUrl,
}: {
  name: string;
  subtitle: string;
  status: 'live' | 'sandbox' | 'down';
  lastWebhook: string;
  monthlyVolumeSgd: bigint;
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
          <Money cents={monthlyVolumeSgd} region="SG" className="!text-[13px] !font-semibold" />
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

function SignalTile({
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
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted font-medium">
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
