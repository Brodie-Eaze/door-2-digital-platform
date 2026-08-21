'use client';

import { useEffect, useState } from 'react';
import { Globe2, Database, PhoneOff, Clock, CheckCircle2 } from 'lucide-react';
import { Banner, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { DataSourceBadge, useDataFreshness } from '@/components/DataSourceBadge';
import { RegistrationsEmpty, CoolingOffEmpty } from '@/components/RegionEmptyStates';

/**
 * SG region — operations control panel.
 *
 * Mirrors the AU pattern: SG-specific regulators (Commissioner of
 * Charities, PLRD), payment rails (Stripe SG + PayNow), data feeds
 * (SingStat, URA, LTA), and the CPFTA 5-business-day cooling-off engine.
 * Every per-instance figure below is fetched from GET /api/regions/SG/*
 * — no SG accounts/permits/donor rows are contracted yet, so most of
 * these render an honest empty state until the first row lands.
 */

interface RegionOverview {
  activeOrgs: number;
  activeKnockers: number;
  conversionsMTD: number;
  revenueCentsMTD: string;
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
  dnkCount: number;
  dncCount: number;
  registrations: RegistrationRow[];
  openCoolingOff: CoolingOffWindow[];
}

/** Static reference — which external datasets feed the SG propensity model.
 *  No live status/refresh claim: there is no feed-sync table backing this. */
const SINGSTAT_REFERENCE_SOURCES = [
  {
    name: 'SingStat Planning Area Census 2020',
    detail: 'Resident profile · age · dwelling · income',
  },
  { name: 'URA Master Plan 2024', detail: 'Land-use zoning · building heights · plot ratio' },
  { name: 'HDB Resale Index', detail: 'Per-town resale flat pricing trend' },
  {
    name: 'LTA OneMap geometries',
    detail: 'Postal-code centroids · street boundaries · MRT exits',
  },
];

export default function SgRegionPage(): JSX.Element {
  const [overview, setOverview] = useState<RegionOverview | null>(null);
  const [compliance, setCompliance] = useState<ComplianceResponse | null>(null);
  const { source, markFresh, markFixture } = useDataFreshness('fixture');

  useEffect(() => {
    let cancelled = false;
    (async (): Promise<void> => {
      try {
        const [ovRes, compRes] = await Promise.all([
          fetch('/api/regions/SG/overview', { headers: { accept: 'application/json' } }),
          fetch('/api/regions/SG/compliance', { headers: { accept: 'application/json' } }),
        ]);
        if (!ovRes.ok || !compRes.ok) throw new Error('region fetch failed');
        const ov = (await ovRes.json()) as RegionOverview;
        const comp = (await compRes.json()) as ComplianceResponse;
        if (cancelled) return;
        setOverview(ov);
        setCompliance(comp);
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

  const registered = compliance?.registrations.filter((r) => r.status === 'approved').length ?? 0;
  const totalFiled = compliance?.registrations.length ?? 0;

  return (
    <PlatformShell pageTitle="SG region — operations">
      <div className="space-y-5 max-w-[1700px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Globe2 size={14} className="text-accent" />
            <span>
              Operational view for the <span className="font-semibold">Singapore region</span>. COC
              + PLRD permits, PDPA compliance, Stripe SG + PayNow corporate rails, SingStat / URA /
              LTA data feeds, and CPFTA 5-business-day cooling-off all live here. SG accounts go
              through these gates before any door is knocked.
            </span>
          </span>
        </Banner>

        <div className="flex items-center justify-end">
          <DataSourceBadge source={source} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard label="Active SG accounts" value={overview?.activeOrgs ?? 0} hint="orgs live" />
          <KpiCard
            label="SG knockers deployed"
            value={(overview?.activeKnockers ?? 0).toLocaleString()}
            hint="across permitted areas"
          />
          <KpiCard
            label="MTD revenue SGD"
            value={<Money cents={BigInt(overview?.revenueCentsMTD ?? '0')} region="SG" />}
          />
          <KpiCard
            label="Conversion rate"
            value={`${(overview?.conversionRatePct ?? 0).toFixed(1)}%`}
            hint="rolling 30d"
          />
          <KpiCard
            label="Cooling-off open"
            value={compliance?.openCoolingOff.length ?? 0}
            hint={`${compliance?.windowDays ?? 5} bus-day CPFTA windows`}
          />
        </div>

        <Section
          title="Singapore regulator status"
          subtitle="PaidSolicitorRegistration rows filed against SG"
          paddedBody={false}
          action={
            <span className="text-[11px] text-muted flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-success" />
              {registered} / {totalFiled} filings approved
            </span>
          }
        >
          {compliance && compliance.registrations.length === 0 ? (
            <RegistrationsEmpty />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Area / scope</th>
                  <th>Registration #</th>
                  <th>Bond (SGD)</th>
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
                  return (
                    <tr key={row.id}>
                      <td className="text-[13px] text-ink font-medium">{row.state}</td>
                      <td>
                        <span className="mono text-[10px] !w-auto !px-2">
                          {row.registrationNumber ?? '—'}
                        </span>
                      </td>
                      <td className="text-[12px] text-ink numeric">
                        <Money cents={BigInt(row.bondAmountCents)} region="SG" />
                      </td>
                      <td className="text-[12px] text-muted numeric">
                        {row.expiresAt ? row.expiresAt.slice(0, 10) : '—'}
                      </td>
                      <td>
                        <StatusPill tone={tone}>
                          {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                        </StatusPill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Section>

        <Section
          title="Payment providers · SG"
          subtitle="Stripe SG for card + recurring · PayNow Corporate via UEN for QR push-pay"
        >
          <div className="text-[12.5px] text-muted">
            See{' '}
            <a href="/regions/sg/payments" className="text-accent hover:underline">
              SG payments
            </a>{' '}
            for real conversion-volume figures by provider.
          </div>
        </Section>

        <Section
          title="SingStat / URA / LTA data sources · reference"
          subtitle="Datasets feeding the SG propensity model — see SG territory intelligence for live scoring"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SINGSTAT_REFERENCE_SOURCES.map((f) => (
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
          <Section
            title="DNC Registry · PDPC"
            subtitle="Singapore Do Not Call Registry entries on file"
          >
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <PhoneOff size={14} className="text-soft mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-ink">DNC Voice + SMS register</div>
                  <div className="text-[11px] text-muted">DoNotCall rows loaded for SG</div>
                </div>
                <div className="text-right">
                  <div className="text-[16px] font-semibold text-ink numeric">
                    {(compliance?.dncCount ?? 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-muted uppercase tracking-wider">numbers</div>
                </div>
              </div>
              <div className="border-t border-line2 pt-3 flex items-start gap-3">
                <PhoneOff size={14} className="text-soft mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-ink">Do Not Knock opt-outs</div>
                  <div className="text-[11px] text-muted">DoNotKnock rows loaded for SG</div>
                </div>
                <div className="text-right">
                  <div className="text-[16px] font-semibold text-ink numeric">
                    {(compliance?.dnkCount ?? 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-muted uppercase tracking-wider">addresses</div>
                </div>
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
                value={compliance?.openCoolingOff.length ?? 0}
                hint="In cooling-off"
              />
              <CoolingTile
                icon={<Clock size={13} className="text-muted" />}
                label="Window length"
                value={`${compliance?.windowDays ?? 5} bus.days`}
                hint="Per CPFTA"
              />
            </div>
            <div className="mt-3 text-[11px] text-muted">
              Cooling-off timers are computed live from each conversion&apos;s signed date + 5
              business days, excluding weekends. No SG public-holiday calendar applied yet.
            </div>
          </Section>
        </div>

        <Section
          title="Open CPFTA cooling-off windows"
          subtitle="Recent SG conversions awaiting 5-business-day release"
          paddedBody={false}
        >
          {compliance && compliance.openCoolingOff.length === 0 ? (
            <CoolingOffEmpty />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Donor (masked)</th>
                  <th>Planning area</th>
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
                      <td className="text-[12px] text-ink">{w.area}</td>
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
      </div>
    </PlatformShell>
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
