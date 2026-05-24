import Link from 'next/link';
import {
  ShieldCheck,
  Lock,
  FileText,
  KeyRound,
  Globe2,
  Bug,
  ScrollText,
  ArrowRight,
  CheckCircle2,
  Mail,
} from 'lucide-react';
import { PublicShell } from '@/components/PublicShell';

export const metadata = {
  title: 'Security & Compliance — Door 2 Digital',
  description:
    'SOC 2 Type II in flight, KMS envelope encryption, hash-chained audit log, multi-region residency, quarterly pen-tests, bug bounty.',
};

interface PostureCard {
  icon: typeof ShieldCheck;
  title: string;
  status: string;
  statusTone: 'in-flight' | 'active' | 'planned';
  body: string;
  bullets: string[];
}

const POSTURE: PostureCard[] = [
  {
    icon: ShieldCheck,
    title: 'SOC 2 Type II',
    status: 'Observation window active',
    statusTone: 'in-flight',
    body: 'SOC 2 Type II is in active observation. Target completion: Q3 2026. Type I report available under NDA today.',
    bullets: [
      'Independent auditor: Big-4 firm (under engagement)',
      'Control framework: SOC 2 Common Criteria + Availability + Confidentiality',
      'Continuous monitoring via Vanta',
      'Annual recertification cadence',
    ],
  },
  {
    icon: Lock,
    title: 'Encryption',
    status: 'Live',
    statusTone: 'active',
    body: 'Defence in depth. Every byte at rest is encrypted; every connection in transit is TLS 1.3. PII is searchable without being exposed.',
    bullets: [
      'KMS envelope encryption — per-tenant data keys, AWS KMS master key',
      'Deterministic-SIV (AES-SIV) for searchable PII fields',
      'TLS 1.3 enforced everywhere; HSTS preloaded',
      'Secrets in AWS Secrets Manager with auto-rotation',
    ],
  },
  {
    icon: ScrollText,
    title: 'Audit chain',
    status: 'Live',
    statusTone: 'active',
    body: 'Every state-changing event lands in a hash-chained audit log. Tamper-evident at the row level, replicated to S3 Object Lock for 7-year compliance retention.',
    bullets: [
      'Hash-chained rows (SHA-256 prev_hash → row_hash)',
      'S3 Object Lock — Compliance mode, 7-year retention',
      'Per-actor / per-tenant / per-action queryable',
      'Exportable as signed JSON packet for regulators',
    ],
  },
  {
    icon: KeyRound,
    title: 'Identity & access',
    status: 'Live',
    statusTone: 'active',
    body: 'Strong identity for humans and services. WebAuthn for admin, SAML/OIDC SSO for enterprise, RBAC across five roles.',
    bullets: [
      'WebAuthn / passkeys required for super_admin actions',
      'SAML 2.0 + OIDC SSO (Okta, Azure AD, Google, Auth0)',
      'RBAC: super_admin / admin / accountant / broker / read-only',
      'Service accounts use short-lived JWTs + IP allowlists',
    ],
  },
  {
    icon: Globe2,
    title: 'Multi-region residency',
    status: 'Live',
    statusTone: 'active',
    body: 'Door-to-door is a regulated, local sport. US data stays in US, AU data stays in AU, SG data stays in SG. Period.',
    bullets: [
      'US: us-east-1 (Virginia) + us-west-2 (Oregon) replica',
      'AU: ap-southeast-2 (Sydney)',
      'SG: ap-southeast-1 (Singapore)',
      'No cross-region replication of customer data without explicit DPA',
    ],
  },
  {
    icon: Bug,
    title: 'Pen tests & bug bounty',
    status: 'Quarterly + invite-only',
    statusTone: 'active',
    body: 'External penetration testing every quarter, plus an invite-only bug bounty program. Public bounty launches with Phase 4.',
    bullets: [
      'Q-cadence pen test by CREST-certified firm',
      'Invite-only bug bounty (Phase 3, transitioning to public)',
      'Reward tiers: P1 $5K · P2 $2K · P3 $500 · P4 $100',
      'Hall of fame on /public/bug-bounty',
    ],
  },
];

const COMPLIANCE_LIST = [
  'SOC 2 Type II (in flight, Q3 2026 target)',
  'GDPR (Article 28 processor)',
  'CCPA / CPRA',
  'Australian Privacy Act 1988 (APP)',
  'Singapore PDPA',
  'HIPAA-aligned controls (healthcare verticals)',
  'PCI DSS SAQ-A (no card data stored)',
  'TCPA-aware SMS pipeline (US)',
];

function ToneBadge({
  tone,
  status,
}: {
  tone: PostureCard['statusTone'];
  status: string;
}): JSX.Element {
  const cls =
    tone === 'active'
      ? 'pill pill-info'
      : tone === 'in-flight'
        ? 'pill pill-warn'
        : 'pill pill-muted';
  return <span className={cls}>{status}</span>;
}

export default function PublicSecurityPage(): JSX.Element {
  return (
    <PublicShell activeNav="security">
      {/* HERO */}
      <section className="border-b border-line2 bg-gradient-to-b from-surface to-paper">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accentSoft text-accent text-[11px] uppercase tracking-[0.12em] font-medium mb-6">
              Security & Compliance
            </div>
            <h1 className="text-4xl sm:text-5xl font-semibold text-ink tracking-tight leading-[1.05]">
              Built for the next subpoena before it lands.
            </h1>
            <p className="mt-5 text-lg text-muted max-w-2xl leading-relaxed">
              Door-to-door touches PII at the literal door. We treat security and compliance as
              product surface, not paperwork — instrumented, auditable, and demonstrable on demand.
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
                href="mailto:security@door2digital.io"
                className="inline-flex items-center gap-2 text-[13px] font-medium text-surface px-4 py-2 rounded-md bg-ink hover:bg-ink2 transition"
              >
                <Mail className="h-3.5 w-3.5" />
                security@door2digital.io
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* POSTURE GRID */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-16 lg:py-20">
        <div className="max-w-2xl mb-12">
          <h2 className="text-[11px] uppercase tracking-[0.12em] text-muted font-medium mb-3">
            Security posture
          </h2>
          <h3 className="text-3xl font-semibold text-ink tracking-tight">
            Six controls. Six demonstrable defaults.
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {POSTURE.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="card card-pad p-7 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center justify-center h-10 w-10 rounded-md bg-accentSoft text-accent">
                    <Icon className="h-5 w-5" />
                  </div>
                  <ToneBadge tone={p.statusTone} status={p.status} />
                </div>
                <h4 className="text-[17px] font-semibold text-ink tracking-tight">{p.title}</h4>
                <p className="text-[13.5px] text-muted leading-relaxed">{p.body}</p>
                <ul className="mt-2 space-y-2">
                  {p.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-[13px] text-ink">
                      <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* COMPLIANCE FRAMEWORKS */}
      <section className="border-y border-line2 bg-surface">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
          <div className="max-w-2xl mb-10">
            <h2 className="text-[11px] uppercase tracking-[0.12em] text-muted font-medium mb-3">
              Frameworks & regulations
            </h2>
            <h3 className="text-3xl font-semibold text-ink tracking-tight">Compliance coverage.</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {COMPLIANCE_LIST.map((c) => (
              <div
                key={c}
                className="flex items-start gap-2.5 px-4 py-3 rounded-md border border-line2 bg-paper text-[13px] text-ink"
              >
                <ShieldCheck className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                <span>{c}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* REPORT REQUEST */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-16 lg:py-20">
        <div className="card card-pad p-10 lg:p-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2">
              <h2 className="text-[11px] uppercase tracking-[0.12em] text-muted font-medium mb-3">
                Reports & artifacts
              </h2>
              <h3 className="text-2xl font-semibold text-ink tracking-tight">
                Need our SOC 2, pen test, or DPA?
              </h3>
              <p className="mt-4 text-[14px] text-muted leading-relaxed max-w-2xl">
                Enterprise customers and active prospects under NDA can request our SOC 2 Type I
                report (Type II in flight), our most recent pen-test executive summary, and our
                standard DPA + sub-processor list. Email security@door2digital.io with the request
                and we&apos;ll route via secure share within 1 business day.
              </p>
              <ul className="mt-6 space-y-2.5 text-[13.5px] text-ink">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  SOC 2 Type I report (PDF, under NDA)
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  Pen test executive summary (most recent quarter)
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  Standard Data Processing Addendum + sub-processor list
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  Vendor security questionnaire (SIG Lite responses)
                </li>
              </ul>
            </div>
            <div>
              <a
                href="mailto:security@door2digital.io?subject=Security%20report%20request"
                className="inline-flex w-full items-center justify-center gap-2 bg-ink text-surface text-[14px] font-semibold px-5 py-3.5 rounded-md hover:bg-ink2 transition"
              >
                Request artifacts <ArrowRight className="h-4 w-4" />
              </a>
              <Link
                href="/public/status"
                className="mt-3 inline-flex w-full items-center justify-center gap-2 bg-surface text-ink text-[14px] font-medium px-5 py-3.5 rounded-md border border-line hover:bg-paper transition"
              >
                Live status page
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* DISCLOSURE */}
      <section className="border-t border-line2 bg-paper">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
          <div className="card card-pad p-10 lg:p-12 max-w-4xl mx-auto">
            <h3 className="text-2xl font-semibold text-ink tracking-tight">
              Found a vulnerability?
            </h3>
            <p className="mt-3 text-[14px] text-muted leading-relaxed">
              Report it responsibly. We aim to acknowledge within 24 hours and remediate per
              severity (Critical 24h · High 72h · Medium 7d · Low 30d). Public bug bounty launches
              with Phase 4 — see the program scope and reward tiers.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link
                href="/public/bug-bounty"
                className="inline-flex items-center justify-center gap-2 bg-ink text-surface text-[14px] font-semibold px-5 py-3 rounded-md hover:bg-ink2 transition"
              >
                Bug bounty program
              </Link>
              <a
                href="/.well-known/security.txt"
                className="inline-flex items-center justify-center gap-2 bg-surface text-ink text-[14px] font-medium px-5 py-3 rounded-md border border-line hover:bg-paper transition"
              >
                security.txt
              </a>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
