'use client';

import {
  ShieldCheck,
  AlertTriangle,
  Mail,
  Clock,
  FileSignature,
  ScrollText,
  CheckCircle2,
  Database,
  Lock,
  EyeOff,
  Globe2,
} from 'lucide-react';

import { Banner, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { toast } from '@/components/Toaster';

/**
 * SG compliance deep-dive.
 *
 * PDPA's 11 main obligations, Charity Council Code of Governance Tier 3,
 * Commercial Fundraiser appointment letter status, PLRD H2H Collection
 * permit details, and the CPFTA 5-business-day cooling-off tracker.
 *
 * This is the operational source of truth for SG sends: every campaign
 * delivered to a Singapore postal sector passes through these gates.
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

interface CpftaWindow {
  donor: string;
  area: string;
  conversionDate: string;
  daysRemaining: number;
  account: string;
}

const CPFTA_OPEN: CpftaWindow[] = [
  {
    donor: 'L. T**',
    area: 'Tampines',
    conversionDate: '2026-05-23',
    daysRemaining: 4,
    account: 'Tampines FSC pilot',
  },
  {
    donor: 'W. L**',
    area: 'Bedok',
    conversionDate: '2026-05-23',
    daysRemaining: 4,
    account: 'SCS pilot',
  },
  {
    donor: 'Y. C***',
    area: 'Jurong East',
    conversionDate: '2026-05-22',
    daysRemaining: 3,
    account: 'SCS pilot',
  },
  {
    donor: 'M. R**',
    area: 'Toa Payoh',
    conversionDate: '2026-05-22',
    daysRemaining: 3,
    account: 'SCS pilot',
  },
  {
    donor: 'S. K**',
    area: 'Tampines',
    conversionDate: '2026-05-21',
    daysRemaining: 2,
    account: 'Tampines FSC pilot',
  },
  {
    donor: 'P. L***',
    area: 'Ang Mo Kio',
    conversionDate: '2026-05-21',
    daysRemaining: 2,
    account: 'SCS pilot',
  },
  {
    donor: 'N. F***',
    area: 'Bedok',
    conversionDate: '2026-05-20',
    daysRemaining: 1,
    account: 'SCS pilot',
  },
  {
    donor: 'H. Z****',
    area: 'Woodlands',
    conversionDate: '2026-05-20',
    daysRemaining: 1,
    account: 'SCS pilot',
  },
  {
    donor: 'A. M**',
    area: 'Punggol',
    conversionDate: '2026-05-19',
    daysRemaining: 1,
    account: 'Tampines FSC pilot',
  },
  {
    donor: 'J. S***',
    area: 'Jurong East',
    conversionDate: '2026-05-19',
    daysRemaining: 1,
    account: 'SCS pilot',
  },
];

const PERMITS = [
  {
    name: 'PLRD H2H Collection (Tampines + Bedok)',
    permitNo: 'PLRD/H2H/2026/0188',
    bondSgd: 50_000,
    period: '2026-03-01 → 2026-08-31',
    status: 'active' as const,
  },
  {
    name: 'PLRD H2H Collection (Jurong East + Toa Payoh)',
    permitNo: 'PLRD/H2H/2026/0214',
    bondSgd: 35_000,
    period: '2026-04-15 → 2026-09-15',
    status: 'active' as const,
  },
  {
    name: 'PLRD Street/Tin Collection (CBD)',
    permitNo: 'PLRD/SCC/2026/0091',
    bondSgd: 20_000,
    period: 'Pending',
    status: 'pending' as const,
  },
  {
    name: 'PLRD H2H Collection (Sengkang)',
    permitNo: 'PLRD/H2H/2026/PEND',
    bondSgd: 30_000,
    period: 'Pending',
    status: 'pending' as const,
  },
];

export default function SgComplianceDeepDivePage(): JSX.Element {
  const implemented = PDPA_OBLIGATIONS.filter((o) => o.impl === 'implemented').length;
  const planned = PDPA_OBLIGATIONS.filter((o) => o.impl === 'planned').length;
  const activePermits = PERMITS.filter((p) => p.status === 'active').length;

  return (
    <PlatformShell pageTitle="SG compliance · deep dive">
      <div className="space-y-5 max-w-[1500px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <ShieldCheck size={14} className="text-accent" />
            <span>
              This page is the <span className="font-semibold">operational source of truth</span>{' '}
              for SG compliance. All campaigns delivered to Singapore addresses pass through these
              gates: PDPA, Charity Council Code, PLRD H2H + Tin permits, CPFTA cooling-off,
              Commercial Fundraiser appointment.
            </span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="PDPA coverage"
            value={`${implemented} / 11`}
            hint={`${planned} planned`}
            deltaTone="positive"
          />
          <KpiCard
            label="PLRD permits active"
            value={`${activePermits} / ${PERMITS.length}`}
            hint="2 pending review"
          />
          <KpiCard
            label="PDPC DNC conformance"
            value="100%"
            hint="last 30d sends"
            deltaTone="positive"
          />
          <KpiCard label="CPFTA windows open" value={CPFTA_OPEN.length} hint="awaiting release" />
        </div>

        <Section
          title="PDPA · 11 main obligations"
          subtitle="Personal Data Protection Act 2012 · mapped to D2D implementation"
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
          title="Spam Control Act · consent + identifier + unsubscribe"
          subtitle="Three statutory rules · enforced server-side on every electronic message"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <SpamCard
              icon={<FileSignature size={14} className="text-accent" />}
              title="Consent capture"
              detail="Express or deemed consent recorded with timestamp + IP + signature method."
              tickStat="100%"
              tickHint="of last 30d sends had a consent record"
            />
            <SpamCard
              icon={<Mail size={14} className="text-accent" />}
              title="UEN + sender ID"
              detail="Sender name + UEN + valid SG return-path auto-injected per send."
              tickStat="Auto-injected"
              tickHint="header template v3.2 · counsel-approved"
            />
            <SpamCard
              icon={<Clock size={14} className="text-accent" />}
              title="Unsubscribe link"
              detail={'Functional "<UNSUBSCRIBE>" / "STOP" handling per Spam Control Act.'}
              tickStat="< 1 day"
              tickHint="median actioning time"
            />
          </div>
        </Section>

        <Section
          title="CPFTA cooling-off · 5 business days"
          subtitle="Consumer Protection (Fair Trading) Act · all door + phone conversions subject"
          paddedBody={false}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Donor (masked)</th>
                <th>Planning area</th>
                <th>Account</th>
                <th>Conversion date</th>
                <th>Days remaining</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {CPFTA_OPEN.map((w, i) => {
                const tone: 'warn' | 'info' = w.daysRemaining <= 2 ? 'warn' : 'info';
                return (
                  <tr key={i}>
                    <td className="text-[13px] text-ink mono">{w.donor}</td>
                    <td className="text-[12px] text-ink">{w.area}</td>
                    <td className="text-[12px] text-ink">{w.account}</td>
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
          title="PLRD permits · per-area"
          subtitle="House-to-House + Tin Collection permits · bonds + renewal cadence"
          paddedBody={false}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Permit</th>
                <th>Permit no.</th>
                <th>Bond (SGD)</th>
                <th>Period</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {PERMITS.map((p) => (
                <tr key={p.permitNo}>
                  <td className="text-[12.5px] text-ink font-medium">{p.name}</td>
                  <td>
                    <span className="mono text-[10px] !w-auto !px-2">{p.permitNo}</span>
                  </td>
                  <td className="text-[12px] text-ink numeric">
                    {p.bondSgd === 0 ? '—' : `S$${p.bondSgd.toLocaleString()}`}
                  </td>
                  <td className="text-[12px] text-muted numeric">{p.period}</td>
                  <td>
                    <StatusPill tone={p.status === 'active' ? 'success' : 'warn'}>
                      {p.status === 'active' ? 'Active' : 'Pending'}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Section
            title="Commercial Fundraiser appointment"
            subtitle="Charities Act (Cap. 37) · CF appointment letter on file"
          >
            <div className="space-y-2.5 text-[13px]">
              <Row label="CF entity" value="Door 2 Digital Pte Ltd (acting as CF)" />
              <Row label="UEN" value={<span className="mono !w-auto !px-2">202610421R</span>} />
              <Row label="Appointment letter" value="On file · counter-signed 2026-03-12" />
              <Row label="Engaging charity" value="Tampines FSC pilot · SCS pilot" />
              <Row label="Fundraising appeal" value="House-to-house · pre-authorised script" />
              <Row label="Disclosure of fees" value="≤ 30% of net proceeds · published" />
              <Row label="Auditor" value="KPMG Singapore" />
              <Row
                label="Annual return filed"
                value={<StatusPill tone="success">Filed 2026-02-28</StatusPill>}
              />
            </div>
          </Section>

          <Section
            title="Charity Council Code of Governance"
            subtitle="Tier 3 (large charity) · enhanced disclosure regime"
          >
            <div className="space-y-3">
              <CodeRow
                title="Board composition"
                detail="Min 3 directors · max 4yr term per director · ≥ 1 independent"
                status="met"
              />
              <CodeRow
                title="Conflict of interest register"
                detail="Annual declaration + per-decision recusal logged in audit trail"
                status="met"
              />
              <CodeRow
                title="Fundraising governance"
                detail="Board-approved policy · disclosure of ratio of admin to direct"
                status="met"
              />
              <CodeRow
                title="Whistleblowing policy"
                detail="Independent channel · DPO routing · NDPA-conformant"
                status="met"
              />
              <CodeRow
                title="Programme effectiveness review"
                detail="Annual outcomes review · published in AR"
                status="met"
              />
              <CodeRow
                title="Reserves policy"
                detail="Free reserves between 6–24 months operating cost"
                status="partial"
              />
            </div>
          </Section>
        </div>

        <Section title="Active SG notifications" subtitle="DPO + compliance team alerts">
          <div className="space-y-3">
            {[
              {
                icon: AlertTriangle,
                tone: 'text-warn',
                msg: 'PLRD/SCC/2026/0091 (Tin Collection CBD) under PLRD review · ETA week 2.',
              },
              {
                icon: AlertTriangle,
                tone: 'text-warn',
                msg: 'Sengkang H2H permit lodged 2026-04-29 · awaiting Town Council letter.',
              },
              {
                icon: ShieldCheck,
                tone: 'text-success',
                msg: 'PDPC DNC scrub completed 2026-05-24 02:00 SGT · 1,284 contacts scrubbed.',
              },
              {
                icon: ShieldCheck,
                tone: 'text-success',
                msg: 'PDPC notifiable breach drill completed 2026-05-12 · 0 findings.',
              },
              {
                icon: ScrollText,
                tone: 'text-soft',
                msg: `CPFTA cooling-off engine: ${CPFTA_OPEN.length} windows currently open · 0 breaches MTD.`,
              },
              {
                icon: CheckCircle2,
                tone: 'text-success',
                msg: 'COC AR filed 2026-02-28 · next due 2027-01-31.',
              },
              {
                icon: Lock,
                tone: 'text-success',
                msg: 'AWS ap-southeast-1 residency check passed · no cross-region replication detected.',
              },
              {
                icon: EyeOff,
                tone: 'text-soft',
                msg: 'NRIC masking enforced on all customer-facing logs · last audit 2026-05-08.',
              },
              {
                icon: Globe2,
                tone: 'text-accent',
                msg: 'MAS Outsourcing notice updated for Stripe SG (acct_1NRSxxxSGsxxx).',
              },
            ].map((n, i) => (
              <div key={i} className="flex items-start gap-2 text-[13px]">
                <n.icon size={14} className={`${n.tone} mt-0.5 shrink-0`} />
                <span className="text-ink">{n.msg}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="PDPA data residency · ap-southeast-1"
          subtitle="Singapore data stays in Singapore · no replication outside region"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card card-pad">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted font-medium">
                <Database size={12} className="text-accent" />
                Primary RDS
              </div>
              <div className="mt-1.5 text-[16px] font-semibold text-ink numeric">
                ap-southeast-1a
              </div>
              <div className="text-[11px] text-muted mt-0.5">aurora-postgres v15.4</div>
            </div>
            <div className="card card-pad">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted font-medium">
                <Database size={12} className="text-accent" />
                Standby RDS
              </div>
              <div className="mt-1.5 text-[16px] font-semibold text-ink numeric">
                ap-southeast-1c
              </div>
              <div className="text-[11px] text-muted mt-0.5">multi-AZ replica · &lt;5s lag</div>
            </div>
            <div className="card card-pad">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted font-medium">
                <Lock size={12} className="text-accent" />
                S3 bucket
              </div>
              <div className="mt-1.5 text-[16px] font-semibold text-ink numeric">d2d-sg-prod</div>
              <div className="text-[11px] text-muted mt-0.5">KMS · object-lock 7yr</div>
            </div>
            <div className="card card-pad">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted font-medium">
                <ShieldCheck size={12} className="text-success" />
                Cross-region copy
              </div>
              <div className="mt-1.5 text-[16px] font-semibold text-ink numeric">Disabled</div>
              <div className="text-[11px] text-muted mt-0.5">no offshore replication</div>
            </div>
          </div>
        </Section>
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

function CodeRow({
  title,
  detail,
  status,
}: {
  title: string;
  detail: string;
  status: 'met' | 'partial' | 'gap';
}): JSX.Element {
  const tone: 'success' | 'warn' | 'danger' =
    status === 'met' ? 'success' : status === 'partial' ? 'warn' : 'danger';
  const label = status === 'met' ? 'Met' : status === 'partial' ? 'Partial' : 'Gap';
  return (
    <div className="border-b border-line2 last:border-b-0 pb-2.5 last:pb-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-ink">{title}</div>
          <div className="text-[11px] text-muted mt-0.5">{detail}</div>
        </div>
        <StatusPill tone={tone}>{label}</StatusPill>
      </div>
    </div>
  );
}
