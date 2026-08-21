'use client';

import { useEffect, useState } from 'react';
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
import { DataSourceBadge, useDataFreshness } from '@/components/DataSourceBadge';
import { RegistrationsEmpty, CoolingOffEmpty } from '@/components/RegionEmptyStates';
import { useAccountList, useAccountStats } from '@/lib/use-account-meta';

interface RegionOverview {
  activeOrgs: number;
  activeKnockers: number;
  conversionsMTD: number;
  revenueCentsMTD: string; // BigInt over the wire → string
  conversionRatePct: number;
}

interface RegistrationRow {
  id: string;
  state: string;
  status: 'pending' | 'submitted' | 'approved' | 'expired' | 'rejected';
  expiresAt: string | null;
  bondAmountCents: string;
  registrationNumber: string | null;
}

interface CoolingOffWindow {
  id: string;
  donor: string;
  area: string;
  account: string;
  conversionDate: string;
  daysRemaining: number;
}

interface ComplianceResponse {
  windowDays: number;
  releasedToday: number;
  dnkCount: number;
  dncCount: number;
  dnkLastLoadedAt: string | null;
  registrations: RegistrationRow[];
  openCoolingOff: CoolingOffWindow[];
}

interface BillingResponse {
  mtd: { volumeCents: string; conversionCount: number };
  byProvider: { provider: string; volumeCents: string; count: number }[];
}

/** Static reference — which external datasets feed the AU propensity model.
 *  No live status/refresh claim: there is no feed-sync table backing this. */
const ABS_REFERENCE_SOURCES = [
  { name: 'ABS SEIFA 2021', detail: 'Socio-economic decile per SA1 statistical area' },
  { name: 'ABS Mesh Block boundaries', detail: 'GeoJSON polygons for ~358k mesh blocks' },
  { name: 'Australia Post PAF', detail: 'Postal Address File · deliverable addresses' },
  { name: 'ABS Census 2021 cross-tabs', detail: 'Income · age · household type per SA2' },
];

export default function AuRegionPage(): JSX.Element {
  // Live account list + per-account stats (replaces the AU slice of the fixture
  // fleet). auAccounts is the AU-region subset; stats is a slug→numbers map.
  const accounts = useAccountList();
  const accountStats = useAccountStats();
  const auAccounts = accounts.filter((a) => a.region === 'AU');
  const [overview, setOverview] = useState<RegionOverview | null>(null);
  const [compliance, setCompliance] = useState<ComplianceResponse | null>(null);
  const [billing, setBilling] = useState<BillingResponse | null>(null);
  const { source, markFresh, markFixture } = useDataFreshness('fixture');

  useEffect(() => {
    let cancelled = false;
    (async (): Promise<void> => {
      try {
        const [ovRes, compRes, billRes] = await Promise.all([
          fetch('/api/regions/AU/overview', { headers: { accept: 'application/json' } }),
          fetch('/api/regions/AU/compliance', { headers: { accept: 'application/json' } }),
          fetch('/api/regions/AU/billing', { headers: { accept: 'application/json' } }),
        ]);
        if (!ovRes.ok || !compRes.ok || !billRes.ok) throw new Error('region fetch failed');
        const ov = (await ovRes.json()) as RegionOverview;
        const comp = (await compRes.json()) as ComplianceResponse;
        const bill = (await billRes.json()) as BillingResponse;
        if (cancelled) return;
        setOverview(ov);
        setCompliance(comp);
        setBilling(bill);
        markFresh();
      } catch {
        if (cancelled) return;
        markFixture();
      }
    })();
    return (): void => {
      cancelled = true;
    };
  }, [markFresh, markFixture]);

  const stripeAuVolumeCents = BigInt(
    billing?.byProvider.find((p) => p.provider === 'stripe_au')?.volumeCents ?? '0',
  );

  const registered = compliance?.registrations.filter((r) => r.status === 'approved').length ?? 0;
  const totalFiled = compliance?.registrations.length ?? 0;

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

        <div className="flex items-center justify-end">
          <DataSourceBadge source={source} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard
            label="Active AU accounts"
            value={overview?.activeOrgs ?? auAccounts.length}
            hint={`of ${accounts.length} portfolio`}
          />
          <KpiCard
            label="AU Knockers deployed"
            value={(overview?.activeKnockers ?? 0).toLocaleString()}
            hint="field reps"
          />
          <KpiCard
            label="MTD revenue AUD"
            value={<Money cents={BigInt(overview?.revenueCentsMTD ?? '0')} region="AU" />}
          />
          <KpiCard
            label="Conversion rate"
            value={`${(overview?.conversionRatePct ?? 0).toFixed(1)}%`}
            hint="rolling 30d"
          />
          <KpiCard
            label="Cooling-off open"
            value={compliance?.openCoolingOff.length ?? 0}
            hint={`${compliance?.windowDays ?? 10}-bus-day windows`}
          />
        </div>

        <Section
          title="Compliance status · state regulators"
          subtitle="One row per PaidSolicitorRegistration filed against AU"
          paddedBody={false}
          action={
            <span className="text-[11px] text-muted flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-success" />
              {registered} / {totalFiled} states registered
            </span>
          }
        >
          {compliance && compliance.registrations.length === 0 ? (
            <RegistrationsEmpty />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>State</th>
                  <th>Registration #</th>
                  <th>Bond (AUD)</th>
                  <th>Expires</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(compliance?.registrations ?? []).map((row) => {
                  const tone: 'success' | 'warn' | 'muted' | 'danger' =
                    row.status === 'approved'
                      ? 'success'
                      : row.status === 'pending' || row.status === 'submitted'
                        ? 'warn'
                        : row.status === 'rejected'
                          ? 'danger'
                          : 'muted';
                  const label = row.status.charAt(0).toUpperCase() + row.status.slice(1);
                  return (
                    <tr key={row.id}>
                      <td>
                        <span className="mono !w-9 !text-[10px]">{row.state}</span>
                      </td>
                      <td>
                        <span className="mono text-[10px] !w-auto !px-2">
                          {row.registrationNumber ?? '—'}
                        </span>
                      </td>
                      <td className="text-[12px] text-ink numeric">
                        <Money cents={BigInt(row.bondAmountCents)} region="AU" />
                      </td>
                      <td className="text-[12px] text-muted numeric">
                        {row.expiresAt ? row.expiresAt.slice(0, 10) : '—'}
                      </td>
                      <td>
                        <StatusPill tone={tone}>{label}</StatusPill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Section>

        <Section
          title="Payment providers · AU"
          subtitle="Stripe AU for card + Direct Debit · GoCardless for BPAY / PayTo"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ProviderCard
              name="Stripe AU"
              subtitle="Card + Direct Debit · AUD"
              monthlyVolumeAud={stripeAuVolumeCents}
              docsUrl="https://dashboard.stripe.com/au"
            />
            <ProviderCard
              name="GoCardless · BPAY + PayTo"
              subtitle="Not broken out separately — the schema tracks payment volume by paymentProvider (stripe_au), not by sub-rail."
              monthlyVolumeAud={null}
              docsUrl="https://manage.gocardless.com/au"
            />
          </div>
        </Section>

        <Section
          title="External data sources · reference"
          subtitle="Datasets feeding the AU propensity model — see AU territory intelligence for live scoring"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ABS_REFERENCE_SOURCES.map((f) => (
              <div key={f.name} className="flex items-start gap-2">
                <Database size={12} className="text-soft mt-1 shrink-0" />
                <div>
                  <div className="text-[13px] font-medium text-ink">{f.name}</div>
                  <div className="text-[10.5px] text-muted">{f.detail}</div>
                </div>
              </div>
            ))}
          </div>
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
                    Address-level opt-outs on file (DoNotKnock rows)
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[16px] font-semibold text-ink numeric">
                    {(compliance?.dnkCount ?? 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-muted uppercase tracking-wider">opt-outs</div>
                </div>
              </div>
              <div className="border-t border-line2 pt-3 flex items-start gap-3">
                <PhoneOff size={14} className="text-soft mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-ink">DNCR (ACMA)</div>
                  <div className="text-[11px] text-muted">
                    Telephone Do Not Call Register entries on file
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[16px] font-semibold text-ink numeric">
                    {(compliance?.dncCount ?? 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-muted uppercase tracking-wider">numbers</div>
                </div>
              </div>
              <div className="border-t border-line2 pt-3 flex items-start gap-3">
                <RefreshCw size={14} className="text-soft mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-ink">Last DNK list load</div>
                  <div className="text-[11px] text-muted">
                    {compliance?.dnkLastLoadedAt
                      ? new Date(compliance.dnkLastLoadedAt).toLocaleString('en-AU')
                      : 'No DoNotKnock rows loaded yet'}
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
                value={compliance?.openCoolingOff.length ?? 0}
                hint="In cooling-off"
              />
              <CoolingTile
                icon={<CheckCircle2 size={13} className="text-success" />}
                label="Released today"
                value={compliance?.releasedToday ?? 0}
                hint="Window closed today"
              />
              <CoolingTile
                icon={<Clock size={13} className="text-muted" />}
                label="Window length"
                value={`${compliance?.windowDays ?? 10} bus.days`}
                hint="Per ACL"
              />
              <CoolingTile
                icon={<ShieldCheck size={13} className="text-muted" />}
                label="Breach detection"
                value="Not wired"
                hint="No billing-timing audit yet"
              />
            </div>
            <div className="mt-3 text-[11px] text-muted">
              Cooling-off timers are computed live from each conversion&apos;s signed date + 10
              business days, excluding weekends. No AU public-holiday calendar applied yet.
            </div>
          </Section>
        </div>

        <Section
          title="Open ACL cooling-off windows"
          subtitle="Recent AU conversions awaiting 10-business-day release"
          paddedBody={false}
        >
          {compliance && compliance.openCoolingOff.length === 0 ? (
            <CoolingOffEmpty />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Donor (masked)</th>
                  <th>State</th>
                  <th>Account</th>
                  <th>Conversion date</th>
                  <th>Days remaining</th>
                </tr>
              </thead>
              <tbody>
                {(compliance?.openCoolingOff ?? []).map((w) => {
                  const tone: 'warn' | 'info' = w.daysRemaining <= 2 ? 'warn' : 'info';
                  return (
                    <tr key={w.id}>
                      <td className="text-[13px] text-ink mono">{w.donor}</td>
                      <td>
                        <span className="mono !w-9 !text-[10px]">{w.area}</span>
                      </td>
                      <td className="text-[12px] text-ink">{w.account}</td>
                      <td className="text-[12px] text-muted numeric">{w.conversionDate}</td>
                      <td>
                        <StatusPill tone={tone}>{w.daysRemaining}d left</StatusPill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Section>

        <Section
          title="AU accounts on platform"
          subtitle="Sub-accounts whose conversions touch this region's compliance gates"
          paddedBody={false}
        >
          {auAccounts.length === 0 ? (
            <div className="px-4 py-3 text-[12px] text-muted">
              No AU accounts on the platform yet.
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Vertical</th>
                  <th>Knockers</th>
                  <th>MTD revenue</th>
                  <th>Conversions MTD</th>
                  <th>Territories</th>
                </tr>
              </thead>
              <tbody>
                {auAccounts.map((a) => {
                  const s = accountStats?.[a.slug];
                  return (
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
                      <td className="text-[12px] text-ink numeric">{s ? s.knockers : '—'}</td>
                      <td className="text-[12px] text-ink">
                        {s ? <Money cents={s.revenueCentsMTD} region="AU" /> : '—'}
                      </td>
                      <td className="text-[12px] text-ink numeric">
                        {s ? s.conversionsMTD.toLocaleString() : '—'}
                      </td>
                      <td className="text-[12px] text-ink numeric">
                        {s ? s.territoriesActive : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Section>
      </div>
    </PlatformShell>
  );
}

function ProviderCard({
  name,
  subtitle,
  monthlyVolumeAud,
  docsUrl,
}: {
  name: string;
  subtitle: string;
  monthlyVolumeAud: bigint | null;
  docsUrl: string;
}): JSX.Element {
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
        <StatusPill tone="muted">Configured</StatusPill>
      </div>
      <div className="space-y-1.5 text-[12px]">
        <div className="flex items-center justify-between">
          <span className="text-muted">MTD volume</span>
          {monthlyVolumeAud != null ? (
            <Money cents={monthlyVolumeAud} region="AU" className="!text-[13px] !font-semibold" />
          ) : (
            <span className="text-soft">Not tracked separately</span>
          )}
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
