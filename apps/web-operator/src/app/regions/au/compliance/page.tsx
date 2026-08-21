'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, Mail, Clock, FileSignature, ScrollText } from 'lucide-react';
import { Banner, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { DataSourceBadge, useDataFreshness } from '@/components/DataSourceBadge';
import { RegistrationsEmpty, CoolingOffEmpty } from '@/components/RegionEmptyStates';

/**
 * The Australian Privacy Principles are a fixed legal framework (13 items,
 * set by the OAIC) — not a business metric. Kept as a labeled reference
 * const per the true-source law's "config, not data" carve-out. Everything
 * per-instance below it (registrations, cooling-off windows) is real.
 */
const APP_PRINCIPLES: {
  num: number;
  title: string;
  summary: string;
  impl: 'implemented' | 'planned' | 'NA';
}[] = [
  {
    num: 1,
    title: 'Open & transparent management',
    summary: 'Publish APP-1 privacy policy + contact for complaints.',
    impl: 'implemented',
  },
  {
    num: 2,
    title: 'Anonymity & pseudonymity',
    summary: 'Allow donors to give anonymously where lawful.',
    impl: 'implemented',
  },
  {
    num: 3,
    title: 'Collection of solicited info',
    summary: 'Only collect what is reasonably necessary for the function.',
    impl: 'implemented',
  },
  {
    num: 4,
    title: 'Unsolicited personal info',
    summary: 'Destroy or de-identify if collection would have been unlawful.',
    impl: 'implemented',
  },
  {
    num: 5,
    title: 'Notification of collection',
    summary: 'APP 5 collection notice surfaced at door + on capture form.',
    impl: 'implemented',
  },
  {
    num: 6,
    title: 'Use or disclosure',
    summary: 'Limit to the primary purpose unless consent or law applies.',
    impl: 'implemented',
  },
  {
    num: 7,
    title: 'Direct marketing',
    summary: 'Honour opt-out + Spam Act consent stack per channel.',
    impl: 'implemented',
  },
  {
    num: 8,
    title: 'Cross-border disclosure',
    summary: 'Restricted to Sydney AWS ap-southeast-2; no offshore transfers.',
    impl: 'implemented',
  },
  {
    num: 9,
    title: 'Government related identifiers',
    summary: 'No TFN, Medicare, DVA numbers collected.',
    impl: 'implemented',
  },
  {
    num: 10,
    title: 'Quality of personal info',
    summary: 'Donor self-service + Knocker correction workflow.',
    impl: 'implemented',
  },
  {
    num: 11,
    title: 'Security of personal info',
    summary: 'Encryption at rest + in transit · Clerk RBAC · audit log.',
    impl: 'implemented',
  },
  {
    num: 12,
    title: 'Access to personal info',
    summary: 'Subject Access Request workflow · 30-day SLA.',
    impl: 'planned',
  },
  {
    num: 13,
    title: 'Correction of personal info',
    summary: 'Donor edit portal + Knocker iOS field-correction.',
    impl: 'planned',
  },
];

interface RegistrationRow {
  id: string;
  state: string;
  status: 'pending' | 'submitted' | 'approved' | 'expired' | 'rejected';
  expiresAt: string | null;
  filedAt: string | null;
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

export default function AuComplianceDeepDivePage(): JSX.Element {
  const [compliance, setCompliance] = useState<ComplianceResponse | null>(null);
  const { source, markFresh, markFixture } = useDataFreshness('fixture');

  useEffect(() => {
    let cancelled = false;
    (async (): Promise<void> => {
      try {
        const res = await fetch('/api/regions/AU/compliance', {
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

  const implemented = APP_PRINCIPLES.filter((p) => p.impl === 'implemented').length;
  const planned = APP_PRINCIPLES.filter((p) => p.impl === 'planned').length;
  const registrations = compliance?.registrations ?? [];
  const registered = registrations.filter((r) => r.status === 'approved').length;
  const openWindows = compliance?.openCoolingOff ?? [];

  return (
    <PlatformShell pageTitle="AU compliance · deep dive">
      <div className="space-y-5 max-w-[1500px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <ShieldCheck size={14} className="text-accent" />
            <span>
              This page is the <span className="font-semibold">operational source of truth</span>{' '}
              for AU compliance. All campaigns delivered to AU addresses pass through these gates:
              APP, Spam Act, ACL cooling-off, state solicitor licensing, ACNC receipt compliance.
            </span>
          </span>
        </Banner>

        <div className="flex items-center justify-end">
          <DataSourceBadge source={source} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="APP coverage"
            value={`${implemented} / 13`}
            hint={`${planned} planned`}
            deltaTone="positive"
          />
          <KpiCard
            label="States registered"
            value={`${registered} / ${registrations.length || 7}`}
            hint="PaidSolicitorRegistration"
            deltaTone="positive"
          />
          <KpiCard
            label="Active consent records"
            value={compliance?.activeConsentCount ?? 0}
            hint="granted, not revoked"
          />
          <KpiCard
            label="Cooling-off windows open"
            value={openWindows.length}
            hint="awaiting release"
          />
        </div>

        <Section
          title="Australian Privacy Principles (APP 1–13) · reference"
          subtitle="OAIC legal framework — fixed, not sourced from the database"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {APP_PRINCIPLES.map((p) => {
              const tone =
                p.impl === 'implemented' ? 'success' : p.impl === 'planned' ? 'warn' : 'muted';
              const label =
                p.impl === 'implemented' ? 'Implemented' : p.impl === 'planned' ? 'Planned' : 'N/A';
              return (
                <div key={p.num} className="card card-pad">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="mono !w-auto !px-2 !text-[10px]">APP {p.num}</span>
                        <span className="text-[12.5px] font-semibold text-ink truncate">
                          {p.title}
                        </span>
                      </div>
                    </div>
                    <StatusPill tone={tone}>{label}</StatusPill>
                  </div>
                  <div className="text-[11px] text-muted leading-snug">{p.summary}</div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section
          title="Spam Act 2003 · consent, identify, unsubscribe · reference"
          subtitle="Three statutory rules — enforced server-side on every electronic message"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <SpamCard
              icon={<FileSignature size={14} className="text-accent" />}
              title="Consent capture"
              detail="Express or inferred consent recorded with timestamp + IP + signature method."
            />
            <SpamCard
              icon={<Mail size={14} className="text-accent" />}
              title="Identify clause"
              detail="Sender name + ABN + AU mailing address auto-injected per send."
            />
            <SpamCard
              icon={<Clock size={14} className="text-accent" />}
              title="Unsubscribe link"
              detail="Functional one-click unsubscribe respected within 5 business days."
            />
          </div>
        </Section>

        <Section
          title="ACL cooling-off · 10 business days"
          subtitle="Australian Consumer Law · all door + phone conversions are subject"
          paddedBody={false}
        >
          {compliance && openWindows.length === 0 ? (
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
                {openWindows.map((w) => {
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
          title="Solicitor licensing · state-by-state"
          subtitle="PaidSolicitorRegistration rows filed against AU"
          paddedBody={false}
        >
          {compliance && registrations.length === 0 ? (
            <RegistrationsEmpty />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>State</th>
                  <th>Registration #</th>
                  <th>Bond (AUD)</th>
                  <th>Filed</th>
                  <th>Expires</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((r) => {
                  const tone: 'success' | 'warn' | 'muted' | 'danger' =
                    r.status === 'approved'
                      ? 'success'
                      : r.status === 'pending' || r.status === 'submitted'
                        ? 'warn'
                        : r.status === 'rejected'
                          ? 'danger'
                          : 'muted';
                  return (
                    <tr key={r.id}>
                      <td>
                        <span className="mono !w-9 !text-[10px]">{r.state}</span>
                      </td>
                      <td className="text-[12.5px] text-ink">{r.registrationNumber ?? '—'}</td>
                      <td className="text-[12px] text-ink numeric">
                        <Money cents={BigInt(r.bondAmountCents)} region="AU" />
                      </td>
                      <td className="text-[12px] text-muted numeric">
                        {r.filedAt ? r.filedAt.slice(0, 10) : '—'}
                      </td>
                      <td className="text-[12px] text-muted numeric">
                        {r.expiresAt ? r.expiresAt.slice(0, 10) : '—'}
                      </td>
                      <td>
                        <StatusPill tone={tone}>
                          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                        </StatusPill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="Active AU notifications">
          {/* No ComplianceNotification model exists yet — an honest banner
              beats a fabricated activity feed (mirrors /compliance's pattern). */}
          <p className="text-[13px] text-muted flex items-start gap-2">
            <ScrollText size={14} className="text-soft mt-0.5 shrink-0" />
            Notification feed not yet wired — no dedicated model for filing-status alerts, DNCR
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
