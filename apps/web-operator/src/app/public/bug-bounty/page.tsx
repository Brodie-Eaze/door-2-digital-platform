import Link from 'next/link';
import { Bug, Mail, KeyRound, ShieldCheck, CheckCircle2, X, Award, ArrowRight } from 'lucide-react';
import { PublicShell } from '@/components/PublicShell';

export const metadata = {
  title: 'Bug Bounty — Door 2 Digital',
  description:
    'Bug bounty program scope, reward tiers, rules of engagement, and reporting flow. P1 $5K · P2 $2K · P3 $500 · P4 $100.',
};

const IN_SCOPE = [
  'app.door2digital.io',
  'api.door2digital.io',
  'api.us.door2digital.io',
  'api.au.door2digital.io',
  'api.sg.door2digital.io',
  'door2digital.io (marketing)',
  'Knocker iOS app (TestFlight build, on request)',
];

const OUT_OF_SCOPE = [
  'Third-party services (Stripe, Twilio, Resend, AWS, Mapbox)',
  'Sub-processor domains we don’t own',
  'Physical security / social engineering',
  'Denial-of-service (DoS / DDoS / rate-limit exhaustion)',
  'Spam / SEO content reports',
  'Self-XSS or attacks requiring physical device access',
  'Outdated browser / library missing security headers we’ve deliberately omitted',
];

interface Tier {
  level: 'P1' | 'P2' | 'P3' | 'P4';
  label: string;
  reward: string;
  description: string;
  examples: string[];
  tone: 'danger' | 'warn' | 'info' | 'muted';
}

const TIERS: Tier[] = [
  {
    level: 'P1',
    label: 'Critical',
    reward: '$5,000',
    description:
      'Full system compromise. RCE, auth bypass, mass-PII exfil, tenant isolation break with privileged data access.',
    examples: [
      'Remote code execution on production hosts',
      'Authentication bypass across tenants',
      'SQL injection with PII read at scale',
      'Cross-tenant data access via authorisation flaw',
    ],
    tone: 'danger',
  },
  {
    level: 'P2',
    label: 'High',
    reward: '$2,000',
    description:
      'Significant business impact. Privilege escalation within a tenant, sensitive PII leak (limited scope), audit-log tamper.',
    examples: [
      'Privilege escalation (broker → admin) within an account',
      'IDOR exposing 1-100 records of PII',
      'Audit log row tamper without chain-break detection',
      'Webhook signature bypass leading to forged events',
    ],
    tone: 'warn',
  },
  {
    level: 'P3',
    label: 'Medium',
    reward: '$500',
    description:
      'Limited impact, requires user interaction or chained exploitation. Reflected XSS, weak crypto, CSRF on sensitive endpoints.',
    examples: [
      'Reflected XSS requiring victim click',
      'CSRF on a state-changing admin endpoint',
      'Weak crypto primitives in non-PII contexts',
      'Information disclosure of system internals',
    ],
    tone: 'info',
  },
  {
    level: 'P4',
    label: 'Low',
    reward: '$100',
    description:
      'Best-practice deviations, defence-in-depth findings, security headers, configuration issues.',
    examples: [
      'Missing/weak security header on non-sensitive route',
      'TLS configuration warnings (no exploitability)',
      'Verbose error messages',
      'Outdated dependencies without known exploit path',
    ],
    tone: 'muted',
  },
];

const RULES = [
  'Test only against accounts and domains you own or have explicit permission to test.',
  'Do not access, modify, or destroy data belonging to other customers.',
  'Do not exfiltrate more data than minimally required to demonstrate the vulnerability.',
  'Disclose privately — public disclosure requires our written agreement (typically 90 days post-fix).',
  'Make a good-faith effort to avoid privacy violations, service disruption, and data destruction.',
  'Submit one issue per report; chained issues with shared root cause may be merged at our discretion.',
  'No automated scanners that generate excessive traffic. Burst &lt; 60 req/min per IP.',
];

const PGP_BLOCK = `-----BEGIN PGP PUBLIC KEY BLOCK-----
Comment: Door 2 Digital Security
Comment: security@door2digital.io

mDMEZmAbCxYJKwYBBAHaRw8BAQdAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
[ Fingerprint: 7F2C 4A91 8E3B 12D4 5F0A  9C2E 6B1A 8D3F 4E7B 21C5 ]

(Decorative — full key published at:
  https://door2digital.io/.well-known/pgp-key.txt )
-----END PGP PUBLIC KEY BLOCK-----`;

function TierBadge({ tone }: { tone: Tier['tone'] }): JSX.Element {
  const cls =
    tone === 'danger'
      ? 'pill pill-danger'
      : tone === 'warn'
        ? 'pill pill-warn'
        : tone === 'info'
          ? 'pill pill-info'
          : 'pill pill-muted';
  return <span className={cls}>Severity</span>;
}

export default function PublicBugBountyPage(): JSX.Element {
  return (
    <PublicShell activeNav="security">
      {/* HERO */}
      <section className="border-b border-line2 bg-gradient-to-b from-surface to-paper">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accentSoft text-accent text-[11px] uppercase tracking-[0.12em] font-medium mb-6">
              <Bug className="h-3 w-3" />
              Bug Bounty Program
            </div>
            <h1 className="text-4xl sm:text-5xl font-semibold text-ink tracking-tight leading-[1.05]">
              Help us harden the door-to-door operating system.
            </h1>
            <p className="mt-5 text-lg text-muted max-w-2xl leading-relaxed">
              Public program launching Phase 4. Invite-only program ran through Phase 3 with zero
              SEV-1s shipped. Rewards range from $100 (Low) to $5,000 (Critical), paid in USD via
              wire or via a Hall of Fame placement.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="mailto:security@door2digital.io?subject=Bug%20report"
                className="inline-flex items-center gap-2 bg-ink text-surface text-[13px] font-semibold px-4 py-2.5 rounded-md hover:bg-ink2 transition"
              >
                <Mail className="h-3.5 w-3.5" />
                security@door2digital.io
              </a>
              <a
                href="/.well-known/security.txt"
                className="inline-flex items-center gap-2 bg-surface text-ink text-[13px] font-medium px-4 py-2.5 rounded-md border border-line hover:bg-paper transition"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                security.txt
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* SCOPE */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
        <div className="max-w-2xl mb-10">
          <h2 className="text-[11px] uppercase tracking-[0.12em] text-muted font-medium mb-3">
            Scope
          </h2>
          <h3 className="text-3xl font-semibold text-ink tracking-tight">Where to test.</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card card-pad p-8">
            <div className="flex items-center gap-2.5 mb-4">
              <CheckCircle2 className="h-5 w-5 text-accent" />
              <h4 className="text-[15px] font-semibold text-ink tracking-tight">In scope</h4>
            </div>
            <ul className="space-y-2.5">
              {IN_SCOPE.map((s) => (
                <li key={s} className="flex items-start gap-2.5 text-[13.5px] text-ink">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0 mt-2"></span>
                  <code className="font-mono text-[12.5px]">{s}</code>
                </li>
              ))}
            </ul>
          </div>
          <div className="card card-pad p-8">
            <div className="flex items-center gap-2.5 mb-4">
              <X className="h-5 w-5 text-muted" />
              <h4 className="text-[15px] font-semibold text-ink tracking-tight">Out of scope</h4>
            </div>
            <ul className="space-y-2.5">
              {OUT_OF_SCOPE.map((s) => (
                <li key={s} className="flex items-start gap-2.5 text-[13.5px] text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-soft shrink-0 mt-2"></span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* REWARDS */}
      <section className="border-y border-line2 bg-surface">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16 lg:py-20">
          <div className="max-w-2xl mb-10">
            <h2 className="text-[11px] uppercase tracking-[0.12em] text-muted font-medium mb-3">
              Rewards
            </h2>
            <h3 className="text-3xl font-semibold text-ink tracking-tight">Reward tiers.</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {TIERS.map((tier) => (
              <div key={tier.level} className="card card-pad p-7 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-[24px] font-semibold text-ink tracking-tight">
                    {tier.level}
                  </span>
                  <TierBadge tone={tier.tone} />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.10em] text-muted font-medium">
                    {tier.label}
                  </div>
                  <div className="text-3xl font-semibold text-ink tracking-tight numeric mt-1">
                    {tier.reward}
                  </div>
                </div>
                <p className="text-[12.5px] text-muted leading-relaxed">{tier.description}</p>
                <div className="pt-3 border-t border-line2">
                  <p className="text-[10.5px] uppercase tracking-[0.10em] text-muted font-semibold mb-2">
                    Examples
                  </p>
                  <ul className="space-y-1.5">
                    {tier.examples.map((e) => (
                      <li key={e} className="text-[12px] text-ink leading-snug">
                        · {e}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-8 text-[12.5px] text-muted max-w-3xl">
            Final reward determined by Door 2 Digital&apos;s security team based on impact, novelty,
            quality of report, and whether the issue was previously known internally. We aim to
            triage within 24 hours, acknowledge within 48, and resolve per severity SLA.
          </p>
        </div>
      </section>

      {/* RULES */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
        <div className="max-w-2xl mb-10">
          <h2 className="text-[11px] uppercase tracking-[0.12em] text-muted font-medium mb-3">
            Rules of engagement
          </h2>
          <h3 className="text-3xl font-semibold text-ink tracking-tight">Test in good faith.</h3>
        </div>

        <div className="card card-pad p-8">
          <ol className="space-y-3">
            {RULES.map((r, i) => (
              <li key={r} className="flex items-start gap-4 text-[13.5px] text-ink leading-relaxed">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-accentSoft text-accent text-[11.5px] font-semibold shrink-0 mt-px">
                  {i + 1}
                </span>
                <span dangerouslySetInnerHTML={{ __html: r }} />
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* HALL OF FAME */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
        <div className="card card-pad p-10 text-center bg-gradient-to-br from-surface to-paper">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-accent text-surface mb-4">
            <Award className="h-6 w-6" />
          </div>
          <h3 className="text-2xl font-semibold text-ink tracking-tight">Hall of Fame</h3>
          <p className="mt-3 text-[14px] text-muted max-w-xl mx-auto leading-relaxed">
            Coming soon — Phase 4 launch. We&apos;ll publicly credit researchers (with consent) who
            help us harden D2D. First three names go live the day the program opens publicly.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-warnSoft text-warn text-[11.5px] font-medium uppercase tracking-[0.10em]">
            Public launch · Phase 4
          </div>
        </div>
      </section>

      {/* HOW TO REPORT */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card card-pad p-8">
            <div className="inline-flex items-center justify-center h-10 w-10 rounded-md bg-accentSoft text-accent mb-4">
              <Mail className="h-5 w-5" />
            </div>
            <h3 className="text-[18px] font-semibold text-ink tracking-tight">How to report</h3>
            <ol className="mt-4 space-y-3 text-[13.5px] text-ink leading-relaxed">
              <li>
                <span className="font-semibold">1.</span> Email{' '}
                <a
                  href="mailto:security@door2digital.io"
                  className="text-accent hover:underline font-mono"
                >
                  security@door2digital.io
                </a>{' '}
                with a clear title.
              </li>
              <li>
                <span className="font-semibold">2.</span> Include reproduction steps,
                screenshots/video, impact assessment, and any PoC code.
              </li>
              <li>
                <span className="font-semibold">3.</span> Encrypt with our PGP key for sensitive
                reports (optional but appreciated).
              </li>
              <li>
                <span className="font-semibold">4.</span> We acknowledge within 24h, triage within
                48h, and remediate per severity SLA.
              </li>
              <li>
                <span className="font-semibold">5.</span> Reward issued after fix is deployed and
                confirmed.
              </li>
            </ol>
          </div>

          <div className="card card-pad p-0 bg-ink overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-3 border-b border-heroLine">
              <KeyRound className="h-4 w-4 text-soft" />
              <span className="text-[12px] text-soft font-medium">PGP key block (decorative)</span>
            </div>
            <pre className="p-5 text-[11px] text-surface font-mono leading-relaxed overflow-x-auto">
              <code>{PGP_BLOCK}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-line2 bg-paper">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
          <div className="card card-pad p-10 text-center max-w-3xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-semibold text-ink tracking-tight">
              Find something. Tell us. Get paid.
            </h2>
            <p className="mt-3 text-[14px] text-muted leading-relaxed">
              Public program launching with Phase 4. Invite-only researchers already credited
              against pre-launch reports.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="mailto:security@door2digital.io?subject=Bug%20report"
                className="inline-flex items-center justify-center gap-2 bg-ink text-surface text-[14px] font-semibold px-5 py-3 rounded-md hover:bg-ink2 transition"
              >
                Submit a report <ArrowRight className="h-4 w-4" />
              </a>
              <Link
                href="/public/security"
                className="inline-flex items-center justify-center gap-2 bg-surface text-ink text-[14px] font-medium px-5 py-3 rounded-md border border-line hover:bg-paper transition"
              >
                Security posture
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
