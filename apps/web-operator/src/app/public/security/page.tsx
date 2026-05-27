import Link from 'next/link';
import {
  ShieldCheck,
  Lock,
  Link2,
  Globe2,
  Bug,
  ScrollText,
  ArrowRight,
  CheckCircle2,
  Mail,
  FileText,
  ListChecks,
} from 'lucide-react';
import { PublicShell } from '@/components/PublicShell';

export const metadata = {
  title: 'Security — Door 2 Digital',
  description:
    'Built secure by default. Hash-chained audit log · envelope-encrypted PII vault · multi-tenant isolation · region-pinned residency · SOC 2 scoping · public pen-test checklist.',
};

interface Foundation {
  icon: typeof ShieldCheck;
  title: string;
  body: string;
  link: { href: string; label: string };
}

/**
 * The 6 foundations grid. Each one MUST link to an artifact that
 * actually exists in this repo (docs/, ADR, or live page). Honesty rule:
 * if a link goes nowhere yet, mark it Phase 1.x target — don't fake it.
 *
 * Sprint D dropped the emoji glyph next to each Lucide icon — the icon
 * already carries the visual, the emoji was redundant + violated the
 * no-emoji voice rule.
 */
const FOUNDATIONS: Foundation[] = [
  {
    icon: Link2,
    title: 'Hash-chained audit log',
    body: 'Every regulated mutation written to an append-only, hash-chained audit trail. Replay-verifiable end-to-end — operators can prove no row was tampered with after the fact.',
    link: { href: '/public/security/review#audit', label: 'See architecture' },
  },
  {
    icon: Lock,
    title: 'PII Vault (envelope encryption)',
    body: 'AES-256-GCM with AAD binding to row identity. Two-person JIT unmask grants expire in 30 minutes and land in the audit chain. No long-lived plaintext PII anywhere.',
    link: { href: '/public/security/review', label: 'Read the review' },
  },
  {
    icon: ShieldCheck,
    title: 'Multi-tenant isolation',
    body: 'Tenant guard middleware + region pinning + per-org scoped queries. Cross-tenant reads return 403 + audit row, not silent data. No way to forget a tenant filter.',
    link: { href: '/public/security/review', label: 'See guarantees' },
  },
  {
    icon: ListChecks,
    title: 'SOC 2 Type I (scoping)',
    body: 'Phase 1.4 target. CC1–CC9 control matrix in flight. Type I scoping doc + control evidence collection underway with continuous monitoring via Vanta.',
    link: { href: '/public/security/review', label: 'Current controls' },
  },
  {
    icon: Bug,
    title: 'Pen-test readiness checklist',
    body: '20-item public checklist tracked across releases — auth, session, CSRF, IDOR, secrets, headers, dependencies, observability. Updated each Phase.',
    link: { href: '/public/security/pen-test-readiness', label: 'View checklist' },
  },
  {
    icon: Globe2,
    title: 'Region-pinned residency',
    body: 'AU data stays in AU. SG data stays in SG. US data stays in US. Org region is immutable at the DB level — enforced by trigger + RegionGuard middleware.',
    link: { href: '/public/security/region-pinning', label: 'Read ADR-0016' },
  },
];

interface ComplianceBadge {
  label: string;
  status: string;
  tone: 'in-progress' | 'active' | 'planned';
}

const COMPLIANCE: ComplianceBadge[] = [
  { label: 'SOC 2 Type I', status: 'In progress · Phase 1.4', tone: 'in-progress' },
  { label: 'PCI DSS', status: 'SAQ-A · tokenized (no PAN stored)', tone: 'active' },
  { label: 'GDPR + APP', status: 'Aware · DPA template ready', tone: 'active' },
  { label: 'CCPA + state-privacy', status: 'Ready · subject-rights endpoints', tone: 'active' },
];

interface Subprocessor {
  name: string;
  purpose: string;
  /** Their actual published compliance posture. */
  compliance: string[];
  /** Our DPA with them — currently in flight for Phase 1.4. */
  dpaStatus: 'in-flight' | 'on-file' | 'na';
}

const SUBPROCESSORS: Subprocessor[] = [
  {
    name: 'Twilio',
    purpose: 'SMS',
    compliance: ['SOC 2 Type II', 'ISO 27001', 'HIPAA'],
    dpaStatus: 'in-flight',
  },
  {
    name: 'Resend',
    purpose: 'Transactional email',
    compliance: ['SOC 2 Type II'],
    dpaStatus: 'in-flight',
  },
  {
    name: 'MiCamp',
    purpose: 'US card processor',
    compliance: ['PCI DSS Level 1'],
    dpaStatus: 'in-flight',
  },
  {
    name: 'Stripe AU',
    purpose: 'AU payments',
    compliance: ['PCI DSS Level 1', 'SOC 1 + 2 Type II'],
    dpaStatus: 'in-flight',
  },
  {
    name: 'Stripe SG',
    purpose: 'SG payments',
    compliance: ['PCI DSS Level 1', 'SOC 1 + 2 Type II'],
    dpaStatus: 'in-flight',
  },
  { name: 'Mapbox', purpose: 'Map tiles', compliance: ['SOC 2 Type II'], dpaStatus: 'in-flight' },
  {
    name: 'Esri',
    purpose: 'Satellite imagery',
    compliance: ['SOC 2 Type II', 'FedRAMP Moderate'],
    dpaStatus: 'in-flight',
  },
  {
    name: 'Anthropic',
    purpose: 'AI Marketing Studio',
    compliance: ['SOC 2 Type II', 'Zero data retention available'],
    dpaStatus: 'in-flight',
  },
  {
    name: 'OpenAI',
    purpose: 'AI Marketing Studio (fallback)',
    compliance: ['SOC 2 Type II', 'Zero data retention for API'],
    dpaStatus: 'in-flight',
  },
  {
    name: 'Replicate',
    purpose: 'Image generation',
    compliance: ['SOC 2 Type II'],
    dpaStatus: 'in-flight',
  },
  {
    name: 'AWS',
    purpose: 'Compute · DB · storage · KMS',
    compliance: ['SOC 1 + 2 + 3', 'ISO 27001', 'PCI DSS Level 1', 'FedRAMP'],
    dpaStatus: 'on-file',
  },
];

function ComplianceChip({ badge }: { badge: ComplianceBadge }): JSX.Element {
  const cls =
    badge.tone === 'active'
      ? 'border-success/30 bg-successSoft text-success'
      : badge.tone === 'in-progress'
        ? 'border-warn/30 bg-warnSoft text-warn'
        : 'border-line2 bg-paper text-muted';
  return (
    <div className={`flex flex-col gap-1 px-4 py-3 rounded-lg border ${cls}`}>
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-3.5 w-3.5" />
        <span className="text-[13px] font-semibold text-ink tracking-tight">{badge.label}</span>
      </div>
      <span className="text-[11.5px] text-muted">{badge.status}</span>
    </div>
  );
}

function DpaPill({ status }: { status: Subprocessor['dpaStatus'] }): JSX.Element {
  if (status === 'on-file')
    return <span className="pill pill-success text-[10px]">DPA on file</span>;
  if (status === 'in-flight')
    return <span className="pill pill-warn text-[10px]">DPA in flight · Phase 1.4</span>;
  return <span className="pill pill-muted text-[10px]">N/A</span>;
}

export default function PublicSecurityPage(): JSX.Element {
  return (
    <PublicShell activeNav="security">
      {/* HERO */}
      <section className="border-b border-line2 bg-gradient-to-b from-surface to-paper">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accentSoft text-accent text-[11px] uppercase tracking-[0.12em] font-medium mb-6">
              <ShieldCheck className="h-3 w-3" />
              Security
            </div>
            <h1 className="text-4xl sm:text-5xl font-semibold text-ink tracking-tight leading-[1.05]">
              Built secure by default.
            </h1>
            <p className="mt-5 text-lg text-muted max-w-2xl leading-relaxed">
              Door-to-door touches PII at the literal door. We treat security as product surface,
              not paperwork — every regulated mutation lands in an append-only audit chain, every
              PII field is envelope-encrypted, every tenant is region-pinned at the database level.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="/.well-known/security.txt"
                className="inline-flex items-center gap-2 text-[13px] font-medium text-ink px-4 py-2 rounded-md border border-line bg-surface hover:bg-paper transition"
              >
                <FileText className="h-3.5 w-3.5" />
                security.txt
              </a>
              <Link
                href="/public/bug-bounty"
                className="inline-flex items-center gap-2 text-[13px] font-medium text-ink px-4 py-2 rounded-md border border-line bg-surface hover:bg-paper transition"
              >
                <Bug className="h-3.5 w-3.5" />
                Bug bounty
              </Link>
              <a
                href="mailto:security@door2digital.com"
                className="inline-flex items-center gap-2 text-[13px] font-medium text-surface px-4 py-2 rounded-md bg-ink hover:bg-ink2 transition"
              >
                <Mail className="h-3.5 w-3.5" />
                security@door2digital.com
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FOUNDATIONS GRID (3×2) */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-16 lg:py-20">
        <div className="max-w-2xl mb-12">
          <h2 className="text-[11px] uppercase tracking-[0.12em] text-muted font-medium mb-3">
            Six foundations
          </h2>
          <h3 className="text-3xl font-semibold text-ink tracking-tight">
            What we build security into.
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FOUNDATIONS.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="card card-pad p-6 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center justify-center h-10 w-10 rounded-md bg-accentSoft text-accent">
                    <Icon aria-hidden className="h-5 w-5" />
                  </div>
                  <h4 className="text-[16px] font-semibold text-ink tracking-tight">{f.title}</h4>
                </div>
                <p className="text-[13px] text-muted leading-relaxed">{f.body}</p>
                <Link
                  href={f.link.href}
                  className="text-[12.5px] font-medium text-accent hover:underline inline-flex items-center gap-1 mt-auto"
                >
                  {f.link.label} <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* COMPLIANCE BADGES */}
      <section className="border-y border-line2 bg-surface">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14">
          <div className="max-w-2xl mb-8">
            <h2 className="text-[11px] uppercase tracking-[0.12em] text-muted font-medium mb-3">
              Compliance signals
            </h2>
            <h3 className="text-2xl font-semibold text-ink tracking-tight">
              Where we sit on the regulatory map.
            </h3>
            <p className="text-[13px] text-muted mt-2 max-w-xl leading-relaxed">
              Honest posture — we mark what&apos;s in flight as in flight. SOC 2 Type I is the Phase
              1.4 target. Don&apos;t trust any vendor who claims certifications they haven&apos;t
              earned.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {COMPLIANCE.map((c) => (
              <ComplianceChip key={c.label} badge={c} />
            ))}
          </div>
        </div>
      </section>

      {/* DISCLOSURE POLICY */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
        <div className="card card-pad p-10 lg:p-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2">
              <h2 className="text-[11px] uppercase tracking-[0.12em] text-muted font-medium mb-3">
                Responsible disclosure
              </h2>
              <h3 className="text-2xl font-semibold text-ink tracking-tight">
                Reporting policy + SLAs.
              </h3>
              <p className="mt-4 text-[14px] text-muted leading-relaxed max-w-2xl">
                Public disclosure policy lives at{' '}
                <a
                  href="/.well-known/security.txt"
                  className="text-accent hover:underline font-medium"
                >
                  /.well-known/security.txt
                </a>
                . PGP key on file. We acknowledge within 24 hours and remediate per severity. Bug
                bounty program — invite-only today, public with Phase 4.
              </p>
              <ul className="mt-6 space-y-2.5 text-[13.5px] text-ink">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  Critical (P1): acknowledged 24h · remediated 24h
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  High (P2): acknowledged 24h · remediated 72h
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  Medium (P3): acknowledged 72h · remediated 7d
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  Low (P4): acknowledged 72h · remediated 30d
                </li>
              </ul>
            </div>
            <div className="flex flex-col gap-3">
              <a
                href="/.well-known/security.txt"
                className="inline-flex w-full items-center justify-center gap-2 bg-ink text-surface text-[14px] font-semibold px-5 py-3.5 rounded-md hover:bg-ink2 transition"
              >
                <FileText className="h-4 w-4" /> security.txt
              </a>
              <Link
                href="/public/bug-bounty"
                className="inline-flex w-full items-center justify-center gap-2 bg-surface text-ink text-[14px] font-medium px-5 py-3.5 rounded-md border border-line hover:bg-paper transition"
              >
                <Bug className="h-4 w-4" /> Bug bounty program
              </Link>
              <a
                href="mailto:security@door2digital.com"
                className="inline-flex w-full items-center justify-center gap-2 bg-surface text-ink text-[14px] font-medium px-5 py-3.5 rounded-md border border-line hover:bg-paper transition"
              >
                <Mail className="h-4 w-4" /> Email security team
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* PEN-TEST REPORT */}
      <section className="border-y border-line2 bg-paper">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
          <div className="card card-pad p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="inline-flex items-center justify-center h-10 w-10 rounded-md bg-accentSoft text-accent shrink-0">
                <ScrollText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-[17px] font-semibold text-ink tracking-tight">
                  Latest pen-test report
                </h3>
                <p className="text-[13px] text-muted mt-1 max-w-xl leading-relaxed">
                  Q3 2026 by Bastion Security — executive summary available on request under NDA.
                  Quarterly cadence by a CREST-certified firm; remediation evidence tracked in the
                  public pen-test readiness checklist.
                </p>
              </div>
            </div>
            <a
              href="mailto:security@door2digital.com?subject=Pen-test%20report%20request"
              className="inline-flex items-center justify-center gap-2 bg-ink text-surface text-[13.5px] font-semibold px-5 py-2.5 rounded-md hover:bg-ink2 transition whitespace-nowrap"
            >
              Request report <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* SUBPROCESSORS */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
        <div className="max-w-2xl mb-8">
          <h2 className="text-[11px] uppercase tracking-[0.12em] text-muted font-medium mb-3">
            Powered by these subprocessors
          </h2>
          <h3 className="text-2xl font-semibold text-ink tracking-tight">
            Subprocessor list + their posture.
          </h3>
          <p className="text-[13px] text-muted mt-2 max-w-xl leading-relaxed">
            Every vendor that touches customer data, what they touch, and their published compliance
            posture. Our DPAs with each are being countersigned in the Phase 1.4 window.
          </p>
        </div>
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-paper border-b border-line2">
                <th className="text-left px-5 py-3 text-[10.5px] uppercase tracking-[0.08em] text-muted font-medium">
                  Subprocessor
                </th>
                <th className="text-left px-5 py-3 text-[10.5px] uppercase tracking-[0.08em] text-muted font-medium">
                  Purpose
                </th>
                <th className="text-left px-5 py-3 text-[10.5px] uppercase tracking-[0.08em] text-muted font-medium">
                  Their compliance
                </th>
                <th className="text-left px-5 py-3 text-[10.5px] uppercase tracking-[0.08em] text-muted font-medium">
                  Our DPA
                </th>
              </tr>
            </thead>
            <tbody>
              {SUBPROCESSORS.map((sp) => (
                <tr key={sp.name} className="border-b border-line2 last:border-b-0">
                  <td className="px-5 py-3.5 text-[13.5px] text-ink font-medium">{sp.name}</td>
                  <td className="px-5 py-3.5 text-[13px] text-muted">{sp.purpose}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1.5">
                      {sp.compliance.map((c) => (
                        <span
                          key={c}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-medium bg-line2/70 text-muted border border-line2"
                        >
                          <CheckCircle2 className="h-2.5 w-2.5 text-success" />
                          {c}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <DpaPill status={sp.dpaStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* DEEP LINKS */}
      <section className="border-t border-line2 bg-paper">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              href="/public/security/review"
              className="card card-pad p-5 hover:border-accent/40 transition flex items-start gap-3"
            >
              <FileText className="h-5 w-5 text-accent shrink-0 mt-0.5" />
              <div>
                <div className="text-[14px] font-semibold text-ink tracking-tight">
                  Security review
                </div>
                <div className="text-[12px] text-muted mt-0.5">
                  Honest pen-test-readiness audit · the full doc.
                </div>
              </div>
            </Link>
            <Link
              href="/public/security/pen-test-readiness"
              className="card card-pad p-5 hover:border-accent/40 transition flex items-start gap-3"
            >
              <ListChecks className="h-5 w-5 text-accent shrink-0 mt-0.5" />
              <div>
                <div className="text-[14px] font-semibold text-ink tracking-tight">
                  Pen-test readiness
                </div>
                <div className="text-[12px] text-muted mt-0.5">
                  20-item checklist tracked across releases.
                </div>
              </div>
            </Link>
            <Link
              href="/public/security/code-audit"
              className="card card-pad p-5 hover:border-accent/40 transition flex items-start gap-3"
            >
              <ScrollText className="h-5 w-5 text-accent shrink-0 mt-0.5" />
              <div>
                <div className="text-[14px] font-semibold text-ink tracking-tight">Code audit</div>
                <div className="text-[12px] text-muted mt-0.5">
                  Static review of the operator surface.
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
