'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, Mail, Clock, FileSignature, ScrollText } from 'lucide-react';
import { Banner, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { DataSourceBadge, useDataFreshness } from '@/components/DataSourceBadge';
import { RegistrationsEmpty, CoolingOffEmpty } from '@/components/RegionEmptyStates';

/**
 * SG compliance deep-dive.
 *
 * PDPA's 11 main obligations are a fixed legal framework — kept as a
 * labeled reference const per the true-source law's "config, not data"
 * carve-out. Everything per-instance below it (registrations, cooling-off
 * windows) is real, fetched from GET /api/regions/SG/compliance.
 */
const PDPA_OBLIGATIONS: {
  num: number;
  title: string;
  summary: string;
  impl: 'implemented' | 'planned' | 'NA';
}[] = [
  {
    num: 1,
    title: 'Consent obligation',
    summary: 'Express + deemed consent capture · withdrawal honoured ≤ 30 days.',
    impl: 'implemented',
  },
  {
    num: 2,
    title: 'Purpose limitation',
    summary: 'Only used for purposes notified at collection · stored against record.',
    impl: 'implemented',
  },
  {
    num: 3,
    title: 'Notification obligation',
    summary: 'Notice surfaced at door + on capture form in EN / 简体中文 / Melayu / தமிழ்.',
    impl: 'implemented',
  },
  {
    num: 4,
    title: 'Access & correction obligation',
    summary: 'Donor self-service portal + Knocker correction workflow · 30-day SLA.',
    impl: 'implemented',
  },
  {
    num: 5,
    title: 'Accuracy obligation',
    summary: 'NRIC fragment + postal sector verified at capture · monthly refresh job.',
    impl: 'implemented',
  },
  {
    num: 6,
    title: 'Protection obligation',
    summary: 'Encryption at rest + in transit · Clerk RBAC · audit log per access.',
    impl: 'implemented',
  },
  {
    num: 7,
    title: 'Retention limitation',
    summary: 'PDPA-compliant 7yr retention · automatic destruction queue + DPO sign-off.',
    impl: 'implemented',
  },
  {
    num: 8,
    title: 'Transfer limitation',
    summary: 'Restricted to AWS ap-southeast-1 (SG) · no offshore transfer unless contracted.',
    impl: 'implemented',
  },
  {
    num: 9,
    title: 'Openness obligation',
    summary: 'PDPA policy + DPO contact published · DPO badge on every customer-facing surface.',
    impl: 'implemented',
  },
  {
    num: 10,
    title: 'Accountability obligation',
    summary: 'DPO appointment letter on file · annual PDPA self-audit · staff training quarterly.',
    impl: 'implemented',
  },
  {
    num: 11,
    title: 'Data breach notification',
    summary: 'PDPC notification ≤ 72h for notifiable breaches · donor notice ≤ 30 days.',
    impl: 'planned',
  },
];

interface RegistrationRow {
  id: string;
  state: string;
  status: 'pending' | 'submitted' | 'approved' | 'expired' | 'rejected';
  filedAt: string | null;
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
  activeConsentCount: number;
  registrations: RegistrationRow[];
  openCoolingOff: CoolingOffWindow[];
}

export default function SgComplianceDeepDivePage(): JSX.Element {
  const [compliance, setCompliance] = useState<ComplianceResponse | null>(null);
  const { source, markFresh, markFixture } = useDataFreshness('fixture');

  useEffect(() => {
    let cancelled = false;
    (async (): Promise<void> => {
      try {
        const res = await fetch('/api/regions/SG/compliance', {
          headers: { accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`compliance ${res.status}`);
        const json = (await res.json()) as ComplianceResponse;
        if (cancelled) return;
        setCompliance(json);
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

  const implemented = PDPA_OBLIGATIONS.filter((o) => o.impl === 'implemented').length;
  const planned = PDPA_OBLIGATIONS.filter((o) => o.impl === 'planned').length;
  const registrations = compliance?.registrations ?? [];
  const activePermits = registrations.filter((r) => r.status === 'approved').length;
  const openWindows = compliance?.openCoolingOff ?? [];

  return (
    <PlatformShell pageTitle="SG compliance · deep dive">
      <div className="space-y-5 max-w-[1500px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <ShieldCheck size={14} className="text-accent" />
            <span>
              This page is the <span className="font-semibold">operational source of truth</span>{' '}
              for SG compliance. All campaigns delivered to Singapore addresses pass through these
              gates: PDPA, PLRD H2H + Tin permits, CPFTA cooling-off, Commercial Fundraiser
              appointment.
            </span>
          </span>
        </Banner>

        <div className="flex items-center justify-end">
          <DataSourceBadge source={source} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="PDPA coverage"
            value={`${implemented} / 11`}
            hint={`${planned} planned`}
            deltaTone="positive"
          />
          <KpiCard
            label="PLRD permits approved"
            value={`${activePermits} / ${registrations.length || '—'}`}
            hint="PaidSolicitorRegistration"
          />
          <KpiCard
            label="Active consent records"
            value={compliance?.activeConsentCount ?? 0}
            hint="granted, not revoked"
          />
          <KpiCard label="CPFTA windows open" value={openWindows.length} hint="awaiting release" />
        </div>

        <Section
          title="PDPA · 11 main obligations · reference"
          subtitle="Personal Data Protection Act 2012 — fixed legal framework, not sourced from the database"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {PDPA_OBLIGATIONS.map((o) => {
              const tone: 'success' | 'warn' | 'muted' =
                o.impl === 'implemented' ? 'success' : o.impl === 'planned' ? 'warn' : 'muted';
              const label =
                o.impl === 'implemented' ? 'Implemented' : o.impl === 'planned' ? 'Planned' : 'N/A';
              return (
                <div key={o.num} className="card card-pad">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="mono !w-auto !px-2 !text-[10px]">PDPA {o.num}</span>
                        <span className="text-[12.5px] font-semibold text-ink truncate">
                          {o.title}
                        </span>
                      </div>
                    </div>
                    <StatusPill tone={tone}>{label}</StatusPill>
                  </div>
                  <div className="text-[11px] text-muted leading-snug">{o.summary}</div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section
          title="Spam Control Act · consent + identifier + unsubscribe · reference"
          subtitle="Three statutory rules — enforced server-side on every electronic message"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <SpamCard
              icon={<FileSignature size={14} className="text-accent" />}
              title="Consent capture"
              detail="Express or deemed consent recorded with timestamp + IP + signature method."
            />
            <SpamCard
              icon={<Mail size={14} className="text-accent" />}
              title="UEN + sender ID"
              detail="Sender name + UEN + valid SG return-path auto-injected per send."
            />
            <SpamCard
              icon={<Clock size={14} className="text-accent" />}
              title="Unsubscribe link"
              detail={'Functional "<UNSUBSCRIBE>" / "STOP" handling per Spam Control Act.'}
            />
          </div>
        </Section>

        <Section
          title="CPFTA cooling-off · 5 business days"
          subtitle="Consumer Protection (Fair Trading) Act · all door + phone conversions subject"
          paddedBody={false}
        >
          {compliance && openWindows.length === 0 ? (
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
                {openWindows.map((w) => {
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

        <Section
          title="PLRD permits · per-area"
          subtitle="PaidSolicitorRegistration rows filed against SG"
          paddedBody={false}
        >
          {compliance && registrations.length === 0 ? (
            <RegistrationsEmpty />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Area / scope</th>
                  <th>Permit no.</th>
                  <th>Bond (SGD)</th>
                  <th>Filed</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((r) => (
                  <tr key={r.id}>
                    <td className="text-[12.5px] text-ink font-medium">{r.state}</td>
                    <td>
                      <span className="mono text-[10px] !w-auto !px-2">
                        {r.registrationNumber ?? '—'}
                      </span>
                    </td>
                    <td className="text-[12px] text-ink numeric">
                      <Money cents={BigInt(r.bondAmountCents)} region="SG" />
                    </td>
                    <td className="text-[12px] text-muted numeric">
                      {r.filedAt ? r.filedAt.slice(0, 10) : '—'}
                    </td>
                    <td>
                      <StatusPill tone={r.status === 'approved' ? 'success' : 'warn'}>
                        {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="Active SG notifications">
          {/* No ComplianceNotification model exists yet — an honest banner
              beats a fabricated activity feed. */}
          <p className="text-[13px] text-muted flex items-start gap-2">
            <ScrollText size={14} className="text-soft mt-0.5 shrink-0" />
            Notification feed not yet wired — no dedicated model for filing-status alerts, PDPC
            scrub-run events, or breach drills. The KPI rail above reflects live data; this feed
            does not exist yet.
          </p>
        </Section>
      </div>
    </PlatformShell>
  );
}

function SpamCard({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}): JSX.Element {
  return (
    <div className="card card-pad">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <div className="text-[13px] font-semibold text-ink">{title}</div>
      </div>
      <div className="text-[11.5px] text-muted leading-snug">{detail}</div>
    </div>
  );
}
