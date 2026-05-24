import {
  ShieldCheck,
  AlertTriangle,
  Mail,
  Clock,
  FileSignature,
  ScrollText,
  CheckCircle2,
} from 'lucide-react';
import { Banner, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';

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

interface OpenWindow {
  donor: string;
  conversionDate: string;
  account: string;
  daysRemaining: number;
  state: 'NSW' | 'VIC' | 'QLD' | 'SA' | 'WA' | 'TAS' | 'ACT';
}

const OPEN_WINDOWS: OpenWindow[] = [
  {
    donor: 'A. M****l',
    conversionDate: '2026-05-22',
    account: 'World Vision',
    daysRemaining: 8,
    state: 'NSW',
  },
  {
    donor: 'S. C***r',
    conversionDate: '2026-05-21',
    account: 'World Vision',
    daysRemaining: 7,
    state: 'VIC',
  },
  {
    donor: 'M. R***d',
    conversionDate: '2026-05-21',
    account: 'Gold Coast Hospital',
    daysRemaining: 7,
    state: 'QLD',
  },
  {
    donor: 'P. K**g',
    conversionDate: '2026-05-20',
    account: 'World Vision',
    daysRemaining: 6,
    state: 'NSW',
  },
  {
    donor: 'L. N****a',
    conversionDate: '2026-05-20',
    account: 'World Vision',
    daysRemaining: 6,
    state: 'WA',
  },
  {
    donor: 'J. H****s',
    conversionDate: '2026-05-19',
    account: 'Gold Coast Hospital',
    daysRemaining: 5,
    state: 'QLD',
  },
  {
    donor: 'C. M****r',
    conversionDate: '2026-05-19',
    account: 'World Vision',
    daysRemaining: 5,
    state: 'VIC',
  },
  {
    donor: 'R. P***l',
    conversionDate: '2026-05-18',
    account: 'World Vision',
    daysRemaining: 4,
    state: 'NSW',
  },
  {
    donor: 'T. W****e',
    conversionDate: '2026-05-17',
    account: 'World Vision',
    daysRemaining: 3,
    state: 'SA',
  },
  {
    donor: 'D. F****r',
    conversionDate: '2026-05-16',
    account: 'World Vision',
    daysRemaining: 2,
    state: 'VIC',
  },
  {
    donor: 'O. A***i',
    conversionDate: '2026-05-15',
    account: 'Gold Coast Hospital',
    daysRemaining: 1,
    state: 'QLD',
  },
  {
    donor: 'N. B****t',
    conversionDate: '2026-05-14',
    account: 'World Vision',
    daysRemaining: 1,
    state: 'NSW',
  },
];

const LICENSING = [
  {
    state: 'NSW',
    licence: 'Charitable Fundraising Authority CFA 16412',
    bondAud: 25_000,
    lastRenewed: '2026-04-15',
    expires: '2027-04-30',
  },
  {
    state: 'VIC',
    licence: 'Fundraiser Registration F-19023',
    bondAud: 20_000,
    lastRenewed: '2026-03-12',
    expires: '2027-03-31',
  },
  {
    state: 'QLD',
    licence: 'Charity Collections Act CCA 8845',
    bondAud: 15_000,
    lastRenewed: '2026-06-21',
    expires: '2027-06-30',
  },
  {
    state: 'SA',
    licence: 'Charitable & Community Fundraising 4129',
    bondAud: 10_000,
    lastRenewed: '2026-02-10',
    expires: '2027-02-28',
  },
  {
    state: 'WA',
    licence: 'Pending · application lodged',
    bondAud: 18_000,
    lastRenewed: '—',
    expires: '—',
  },
  {
    state: 'TAS',
    licence: 'TAS Consumer Affairs TAS-CF-1188',
    bondAud: 5_000,
    lastRenewed: '2026-01-08',
    expires: '2027-01-31',
  },
  {
    state: 'ACT',
    licence: 'Access Canberra ACT-CC-220',
    bondAud: 5_000,
    lastRenewed: '2026-05-19',
    expires: '2027-05-31',
  },
];

export default function AuComplianceDeepDivePage(): JSX.Element {
  const implemented = APP_PRINCIPLES.filter((p) => p.impl === 'implemented').length;
  const planned = APP_PRINCIPLES.filter((p) => p.impl === 'planned').length;
  const registered = LICENSING.filter((l) => !l.licence.startsWith('Pending')).length;

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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="APP coverage"
            value={`${implemented} / 13`}
            hint={`${planned} planned`}
            deltaTone="positive"
          />
          <KpiCard
            label="States registered"
            value={`${registered} / 7`}
            hint="WA pending"
            deltaTone="positive"
          />
          <KpiCard
            label="Spam Act conformance"
            value="100%"
            hint="last 30d sends"
            deltaTone="positive"
          />
          <KpiCard
            label="Cooling-off windows open"
            value={OPEN_WINDOWS.length}
            hint="awaiting release"
          />
        </div>

        <Section
          title="Australian Privacy Principles (APP 1–13)"
          subtitle="OAIC · all 13 principles mapped to D2D implementation"
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
          title="Spam Act 2003 · consent, identify, unsubscribe"
          subtitle="Three statutory rules · enforced server-side on every electronic message"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <SpamCard
              icon={<FileSignature size={14} className="text-accent" />}
              title="Consent capture"
              detail="Express or inferred consent recorded with timestamp + IP + signature method."
              tickStat="100%"
              tickHint="of last 30d sends had a consent record"
            />
            <SpamCard
              icon={<Mail size={14} className="text-accent" />}
              title="Identify clause"
              detail="Sender name + ABN + AU mailing address auto-injected per send."
              tickStat="Auto-injected"
              tickHint="header template v3.2 · counsel-approved"
            />
            <SpamCard
              icon={<Clock size={14} className="text-accent" />}
              title="Unsubscribe link"
              detail="Functional one-click unsubscribe respected within 5 business days."
              tickStat="< 1 day"
              tickHint="median actioning time"
            />
          </div>
        </Section>

        <Section
          title="ACL cooling-off · 10 business days"
          subtitle="Australian Consumer Law · all door + phone conversions are subject"
          paddedBody={false}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Donor (masked)</th>
                <th>State</th>
                <th>Account</th>
                <th>Conversion date</th>
                <th>Days remaining</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {OPEN_WINDOWS.map((w, i) => {
                const tone = w.daysRemaining <= 2 ? 'warn' : 'info';
                return (
                  <tr key={i}>
                    <td className="text-[13px] text-ink mono">{w.donor}</td>
                    <td>
                      <span className="mono !w-9 !text-[10px]">{w.state}</span>
                    </td>
                    <td className="text-[12px] text-ink">{w.account}</td>
                    <td className="text-[12px] text-muted numeric">{w.conversionDate}</td>
                    <td>
                      <StatusPill tone={tone}>{w.daysRemaining}d left</StatusPill>
                    </td>
                    <td>
                      <button
                        className="text-[11px] font-semibold text-accent hover:underline"
                        type="button"
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
          title="Solicitor licensing · state-by-state"
          subtitle="Charitable fundraiser registrations · bonds + renewal cadence"
          paddedBody={false}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>State</th>
                <th>Licence</th>
                <th>Bond (AUD)</th>
                <th>Last renewed</th>
                <th>Expires</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {LICENSING.map((l) => {
                const isPending = l.licence.startsWith('Pending');
                return (
                  <tr key={l.state}>
                    <td>
                      <span className="mono !w-9 !text-[10px]">{l.state}</span>
                    </td>
                    <td className="text-[12.5px] text-ink">{l.licence}</td>
                    <td className="text-[12px] text-ink numeric">
                      {l.bondAud === 0 ? '—' : `A$${l.bondAud.toLocaleString()}`}
                    </td>
                    <td className="text-[12px] text-muted numeric">{l.lastRenewed}</td>
                    <td className="text-[12px] text-muted numeric">{l.expires}</td>
                    <td>
                      <StatusPill tone={isPending ? 'warn' : 'success'}>
                        {isPending ? 'Pending' : 'Registered'}
                      </StatusPill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Section
            title="ACNC · receipt compliance"
            subtitle="Charity registration + DGR templating"
          >
            <div className="space-y-2.5 text-[13px]">
              <Row
                label="ACNC charity number"
                value={<span className="mono !w-auto !px-2">CN 12345</span>}
              />
              <Row label="ACNC subtype" value="PBI · Public Benevolent Institution" />
              <Row label="DGR status" value={<StatusPill tone="success">Item 1</StatusPill>} />
              <Row label="DGR endorsement effective" value="2018-07-01" />
              <Row label="Receipt template version" value="v3.4 · counsel-approved" />
              <Row label="Last counsel review" value="2026-03-12 · Norton Rose Fulbright" />
              <Row label="Receipts emitted (May)" value="3,120 receipts" />
              <Row label="Receipts disputed" value="2 (0.06%)" />
              <Row
                label="Annual Information Statement (AIS)"
                value={<StatusPill tone="success">Filed 2026-02-28</StatusPill>}
              />
            </div>
          </Section>

          <Section title="Active AU notifications" subtitle="Counsel + compliance team alerts">
            <div className="space-y-3">
              {[
                {
                  icon: AlertTriangle,
                  tone: 'text-warn',
                  msg: 'WA paid-solicitor application lodged 2026-04-21 · ETA week 4.',
                },
                {
                  icon: AlertTriangle,
                  tone: 'text-warn',
                  msg: 'Spam Act audit: 1 stale consent record flagged for World Vision (auto-revoked).',
                },
                {
                  icon: ShieldCheck,
                  tone: 'text-success',
                  msg: 'DNCR scrub passed 2026-05-24 02:00 AEST · 8,402 contacts scrubbed.',
                },
                {
                  icon: ShieldCheck,
                  tone: 'text-success',
                  msg: 'OAIC notifiable data breach drill completed 2026-05-15 · 0 findings.',
                },
                {
                  icon: ScrollText,
                  tone: 'text-soft',
                  msg: 'ACL cooling-off engine: 142 windows currently open · 0 breaches MTD.',
                },
                {
                  icon: CheckCircle2,
                  tone: 'text-success',
                  msg: 'ACNC AIS filed 2026-02-28 · next due 2027-01-31.',
                },
              ].map((n, i) => (
                <div key={i} className="flex items-start gap-2 text-[13px]">
                  <n.icon size={14} className={`${n.tone} mt-0.5 shrink-0`} />
                  <span className="text-ink">{n.msg}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </PlatformShell>
  );
}

function SpamCard({
  icon,
  title,
  detail,
  tickStat,
  tickHint,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  tickStat: string;
  tickHint: string;
}): JSX.Element {
  return (
    <div className="card card-pad">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <div className="text-[13px] font-semibold text-ink">{title}</div>
      </div>
      <div className="text-[11.5px] text-muted leading-snug mb-3">{detail}</div>
      <div className="border-t border-line2 pt-3">
        <div className="text-[16px] font-semibold text-ink tracking-tight numeric">{tickStat}</div>
        <div className="text-[10.5px] text-muted mt-0.5">{tickHint}</div>
      </div>
    </div>
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
