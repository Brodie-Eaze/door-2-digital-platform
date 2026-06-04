import {
  ShieldCheck,
  Lock,
  KeyRound,
  FileLock2,
  ScrollText,
  Globe2,
  EyeOff,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
} from 'lucide-react';
import type { Metadata } from 'next';
import { Reveal } from '@d2d/ui-web';
import { SiteContainer, Eyebrow, SectionHeading, CtaLink, SpecRow } from '@/components/site';

export const metadata: Metadata = {
  title: 'Security & compliance',
  description:
    'How Door 2 Digital protects donor and customer data — multi-region residency, envelope-encrypted PII, an immutable audit chain, and defence-in-depth tenant isolation.',
};

const CONTROLS = [
  {
    icon: <Globe2 size={18} />,
    title: 'Data residency by design',
    body: 'Postgres-per-region, not a global replica. An org is pinned to its region at creation and the pin is immutable — enforced by a database trigger, not a policy memo. Australian donor PII never leaves Sydney; US data never leaves us-east-1.',
  },
  {
    icon: <FileLock2 size={18} />,
    title: 'PII envelope encryption',
    body: 'Sensitive fields are encrypted with a per-row data key wrapped by a region-pinned KMS key. Searchable fields use deterministic AES-SIV so we can match without decrypting. No homebrew crypto anywhere in the path.',
  },
  {
    icon: <EyeOff size={18} />,
    title: 'Just-in-time unmask',
    body: 'Plaintext PII is never the default view. An operator requests a reveal, a second admin approves, the grant lasts 30 minutes, and every single reveal click writes an audit row. Sensitive reveals require a hardware security key.',
  },
  {
    icon: <ScrollText size={18} />,
    title: 'Immutable audit chain',
    body: 'Every mutation writes a hash-chained AuditEvent in the same transaction it describes, shipped to S3 Object Lock with 7-year COMPLIANCE retention. A weekly job replays the Merkle root and fails the build on any mismatch.',
  },
  {
    icon: <Lock size={18} />,
    title: 'Defence-in-depth isolation',
    body: 'Four independent layers stand between a request and another tenant’s data: the route guard, a tenant guard that injects the orgId filter, Postgres row-level security, and a region guard. A bypass at one layer is refused by the next.',
  },
  {
    icon: <KeyRound size={18} />,
    title: 'Strong authentication',
    body: 'First-party short-lived JWTs, MFA for every admin role, SAML 2.0 federation for enterprise IdPs, and WebAuthn hardware keys required for payout instruction and PII unmask approval.',
  },
];

const POSTURE = [
  { state: 'live', label: 'Hash-chained immutable audit (7-year retention)' },
  { state: 'live', label: 'Envelope-encrypted PII with JIT dual-control unmask' },
  { state: 'live', label: 'Row-level security + tenant + region guards' },
  { state: 'live', label: 'Idempotency keys on every state-changing request' },
  { state: 'live', label: 'CI gates: gitleaks, Semgrep, Trivy, cross-tenant probe' },
  { state: 'progress', label: 'SOC 2 Type I — controls implemented, report in progress' },
  { state: 'progress', label: 'Independent penetration test — scheduled pre-launch' },
  { state: 'progress', label: 'SOC 2 Type II observation window — opens after Type I' },
];

export default function SecurityPage(): JSX.Element {
  return (
    <>
      {/* Hero */}
      <section className="bg-hero">
        <SiteContainer className="py-16 sm:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <Reveal>
              <Eyebrow tone="surface">Security &amp; compliance</Eyebrow>
              <h1 className="mt-4 max-w-xl text-[32px] font-semibold leading-[1.1] tracking-tight text-surface sm:text-[42px]">
                Trust is the product. Everything else is plumbing.
              </h1>
              <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-surface/75">
                Door 2 Digital handles donor PII, payment instruments and field-rep movement data.
                We built the controls a regulator and an acquirer would expect to find before either
                came looking — and we are honest about which of them are certified versus in
                progress.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <CtaLink href="/.well-known/security.txt" variant="surface" className="px-5 py-3">
                  <ShieldCheck size={16} />
                  Report a vulnerability
                </CtaLink>
                <CtaLink
                  href="/contact"
                  className="border border-surface/20 bg-transparent px-5 py-3 text-surface hover:bg-surface/10"
                >
                  Request our security brief
                </CtaLink>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="rounded-2xl border border-surface/10 bg-surface/[0.04] p-6">
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-surface/50">
                  Posture at a glance
                </div>
                <ul className="mt-4 space-y-3">
                  {POSTURE.map((p) => (
                    <li key={p.label} className="flex items-start gap-3">
                      {p.state === 'live' ? (
                        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accent" />
                      ) : (
                        <CircleDashed size={16} className="mt-0.5 shrink-0 text-surface/40" />
                      )}
                      <span className="text-[13px] leading-snug text-surface/75">{p.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </SiteContainer>
      </section>

      {/* Controls grid */}
      <section className="border-b border-line bg-paper py-16 sm:py-20">
        <SiteContainer>
          <Reveal>
            <SectionHeading
              eyebrow="Controls that are live today"
              title="The data-protection core"
              sub="These are implemented and running, not roadmap. Each one is verifiable in code and exercised in CI."
            />
          </Reveal>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CONTROLS.map((c, i) => (
              <Reveal key={c.title} delay={(i % 3) * 80}>
                <div className="card card-pad h-full">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accentSoft text-accent">
                    {c.icon}
                  </div>
                  <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-ink">
                    {c.title}
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted">{c.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </SiteContainer>
      </section>

      {/* Compliance program */}
      <section className="border-b border-line bg-surface py-16 sm:py-20">
        <SiteContainer>
          <div className="grid items-start gap-10 lg:grid-cols-2">
            <Reveal>
              <SectionHeading
                eyebrow="The compliance program"
                title="Door-to-door is a regulated act"
                sub="Knocking on a door to solicit on a charity’s behalf is governed by paid-solicitor law, cooling-off rules, do-not-call and do-not-knock registries, and privacy statutes that differ by jurisdiction. We treat these as gates in code."
              />
            </Reveal>
            <Reveal delay={100}>
              <div className="card card-pad">
                <dl>
                  <SpecRow label="Paid-solicitor">
                    Campaigns only deliver to states where the registration has cleared. Un-cleared
                    states are refused at the point of delivery, with an audit row.
                  </SpecRow>
                  <SpecRow label="Cooling-off">
                    State-aware timers block payout instruction until the window closes, with the
                    correct cancellation notice attached to the signed agreement.
                  </SpecRow>
                  <SpecRow label="DNC / DNK">
                    Federal and state do-not-call plus do-not-knock and HOA overlays are scrubbed
                    before a revisit task is ever created.
                  </SpecRow>
                  <SpecRow label="Consent (TCPA)">
                    Prior express written consent is captured with a signed token and transcript
                    snapshot, retained for the statutory minimum.
                  </SpecRow>
                  <SpecRow label="Privacy">
                    Region-appropriate handling for US state privacy laws, the Australian Privacy
                    Act, and Singapore PDPA — with breach-notification clocks built in.
                  </SpecRow>
                </dl>
              </div>
            </Reveal>
          </div>
        </SiteContainer>
      </section>

      {/* Honesty block */}
      <section className="bg-paper py-16 sm:py-20">
        <SiteContainer>
          <Reveal>
            <div className="card card-pad max-w-3xl border-l-2 border-l-accent">
              <div className="flex items-center gap-2.5">
                <AlertTriangle size={18} className="text-accent" />
                <Eyebrow>What we will not claim</Eyebrow>
              </div>
              <h2 className="mt-3 text-[22px] font-semibold tracking-tight text-ink">
                Honest about certified versus in-progress
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-muted">
                We are <span className="font-medium text-ink2">not</span> SOC 2 certified yet — the
                controls are implemented and the Type I report is in progress. We have{' '}
                <span className="font-medium text-ink2">not</span> completed an independent
                penetration test in production; one is scheduled before launch. We will publish the
                report status as it changes, and we will never put a badge on this page that we
                cannot stand behind in a customer security review.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <CtaLink href="/contact" className="px-5 py-3">
                  Request access
                  <ArrowRight size={16} />
                </CtaLink>
                <CtaLink href="/legal/privacy" variant="secondary" className="px-5 py-3">
                  Read the privacy policy
                </CtaLink>
              </div>
            </div>
          </Reveal>
        </SiteContainer>
      </section>
    </>
  );
}
