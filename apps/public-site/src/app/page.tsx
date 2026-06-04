import type { CSSProperties } from 'react';
import {
  DoorOpen,
  Users,
  Target,
  CircleDollarSign,
  Wallet,
  ShieldCheck,
  ArrowRight,
  HeartHandshake,
  Building2,
  MapPinned,
  FileCheck2,
} from 'lucide-react';
import { Reveal } from '@d2d/ui-web';
import { HeroDeck } from '@/components/HeroDeck';
import { AnimatedLoop } from '@/components/AnimatedLoop';
import { ProductShowcase } from '@/components/ProductShowcase';
import { ModuleGrid } from '@/components/PlatformOverview';
import { FieldFlow } from '@/components/FieldFlow';
import { CallCentreFlow } from '@/components/CallCentreFlow';
import { CreativeStudio } from '@/components/CreativeStudio';
import { KnockerAppShowcase } from '@/components/KnockerScreens';
import { DigitalEngine } from '@/components/DigitalEngine';
import { FieldMarquee } from '@/components/FieldMarquee';
import { CountUp } from '@/components/CountUp';
import { SiteContainer, Eyebrow, SectionHeading, CtaLink, FeatureCard } from '@/components/site';

/** Stagger helper for the hero entrance (mk-rise reads --d as its delay).
 *  Custom CSS properties aren't in the CSSProperties interface, so we cast. */
const stagger = (ms: number): CSSProperties => ({ '--d': `${ms}ms` }) as unknown as CSSProperties;

const CAPABILITIES = [
  {
    icon: <DoorOpen size={18} />,
    title: 'Field capture',
    body: 'Offline-first iOS app. Every knock carries GPS, disposition, photo, signature and device-clock fraud signals — reconciled idempotently the moment a rep comes back online.',
    meta: 'PostGIS · offline queue',
  },
  {
    icon: <Users size={18} />,
    title: 'CRM + inside sales',
    body: 'Interested-at-the-door leads route to the call centre with the full doorstep context attached — pipeline, sequences, soft-phone, and the disposition that started it.',
    meta: 'lead lifecycle · sequences',
  },
  {
    icon: <Target size={18} />,
    title: 'AI retargeting',
    body: 'Knocked-not-converted becomes a hashed custom audience across Meta, Google and TikTok — then returns as a lead, tagged so the conversion routes to the right rake bucket.',
    meta: 'provenance · brand-safety',
  },
  {
    icon: <CircleDollarSign size={18} />,
    title: 'Conversion attribution',
    body: 'One polymorphic conversion — donation or sale — carries a single attribution source: door, inside-sales or retargeting. That enum is the source of truth for every dollar.',
    meta: 'donation | sale',
  },
  {
    icon: <Wallet size={18} />,
    title: 'Commissions + payouts',
    body: 'Per-knock, per-sale and hybrid plans with crew-leader overrides accrue daily. Payouts generate an instruction file — the platform instructs, it never auto-debits.',
    meta: 'instruct-only · ADR-0019',
  },
  {
    icon: <FileCheck2 size={18} />,
    title: 'Compliance engine',
    body: 'Campaigns only deliver to states where the paid-solicitor registration has cleared. Cooling-off timers, DNC/DNK scrub and consent capture are gates, not checklists.',
    meta: 'state-clearance · TCPA · DNC',
  },
];

const STATS = [
  {
    value: 3,
    suffix: '',
    label: 'Regions — US, AU, SG — pinned at org creation, never replicated across',
  },
  { value: 7, suffix: 'yr', label: 'Hash-chained, Object-Lock immutable audit retention' },
  { value: 8, suffix: '', label: 'Platform roles behind row-level tenant isolation' },
  { value: 100, suffix: '%', label: 'POST mutations idempotent — replay-safe by contract' },
];

export default function HomePage(): JSX.Element {
  return (
    <>
      {/* ─────────────────────────── Hero ─────────────────────────── */}
      <section className="hero-glow hero-veil relative overflow-hidden bg-hero">
        <div
          aria-hidden
          className="bg-grid-navy pointer-events-none absolute inset-0 opacity-100"
        />
        <SiteContainer className="relative py-16 sm:py-24 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-[1.04fr_0.96fr]">
            <div>
              <div className="mk-rise" style={stagger(0)}>
                <span className="inline-flex items-center gap-2 rounded-full border border-surface/15 bg-surface/[0.06] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-surface/70">
                  <span className="d2d-status-pulse inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                  Field Sales Operating System
                </span>
              </div>
              <h1
                className="mk-rise mt-5 text-[36px] font-semibold leading-[1.06] tracking-tight text-surface sm:text-[52px] lg:text-[58px]"
                style={stagger(90)}
              >
                Close the <span className="text-gradient">loop</span> from the knock to the
                converted donor.
              </h1>
              <p
                className="mk-rise mt-5 max-w-xl text-[16px] leading-relaxed text-surface/75 sm:text-[17px]"
                style={stagger(170)}
              >
                Door-to-door runs on clipboards and disposable lead lists. Door 2 Digital connects
                field capture, CRM, AI retargeting, conversion and commissions into one auditable
                system — for charity fundraising and commercial field sales alike.
              </p>
              <div className="mk-rise mt-8 flex flex-wrap items-center gap-3" style={stagger(250)}>
                <CtaLink href="/contact" variant="surface" className="px-5 py-3">
                  Request access
                  <ArrowRight size={16} />
                </CtaLink>
                <CtaLink
                  href="/platform"
                  className="border border-surface/20 bg-transparent px-5 py-3 text-surface hover:bg-surface/10"
                >
                  See the platform
                </CtaLink>
              </div>
              <div
                className="mk-rise mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-surface/55"
                style={stagger(330)}
              >
                <span className="inline-flex items-center gap-2">
                  <span className="d2d-status-pulse inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                  In pilot with a US enterprise charity + commercial operator
                </span>
                <span className="font-mono uppercase tracking-[0.12em]">
                  SOC 2 Type I in progress
                </span>
              </div>
            </div>

            <div className="mk-rise" style={stagger(220)}>
              <HeroDeck />
            </div>
          </div>
        </SiteContainer>
      </section>

      {/* ───────────────────── Field marquee (proof) ───────────────────── */}
      <section className="border-b border-line bg-surface py-8">
        <SiteContainer>
          <p className="mb-5 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-soft">
            Built for every program that knocks
          </p>
          <FieldMarquee />
        </SiteContainer>
      </section>

      {/* ─────────────────────────── The loop ─────────────────────────── */}
      <section id="loop" className="border-b border-line bg-paper py-16 sm:py-24">
        <SiteContainer>
          <div className="grid items-center gap-12 lg:grid-cols-[0.95fr_1.05fr]">
            <Reveal>
              <Eyebrow>The loop</Eyebrow>
              <h2 className="mt-3 text-[28px] font-semibold leading-[1.12] tracking-tight text-ink sm:text-[36px]">
                The data doesn&apos;t die at the door anymore.
              </h2>
              <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted">
                Five stages, one continuous loop — and a single attribution source on every
                conversion ties it together. Door, inside-sales or retargeting: the enum that
                records how a dollar was won is the same enum that bills for it and pays the rep.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  [
                    'Knock → CRM',
                    'Doorstep context follows the lead into the call centre — nothing re-keyed.',
                  ],
                  [
                    'Retarget → Convert',
                    'The knocked-not-converted come back as a tagged lead, not a cold one.',
                  ],
                  [
                    'Convert → Commission',
                    'One conversion drives the receipt, the invoice line and the payout — to the cent.',
                  ],
                ].map(([h, b]) => (
                  <li key={h} className="flex gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <span className="text-[14px] leading-relaxed text-ink2">
                      <span className="font-semibold text-ink">{h}.</span> {b}
                    </span>
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={120}>
              <AnimatedLoop />
            </Reveal>
          </div>
        </SiteContainer>
      </section>

      {/* ───────────────── How a campaign runs (market → field → platform) ───────────────── */}
      <section className="border-b border-line bg-surface py-16 sm:py-24">
        <SiteContainer>
          <Reveal>
            <SectionHeading
              eyebrow="How a campaign runs"
              title="We warm the area before anyone knocks"
              sub="Most door-to-door starts cold. We don't. Marketing softens the neighborhood first, the field team works the warmed blocks, and every result flows back into the platform — and into targeting the next area."
            />
          </Reveal>
          <Reveal delay={100}>
            <div className="mt-10">
              <FieldFlow />
            </div>
          </Reveal>
        </SiteContainer>
      </section>

      {/* ───────────────────── Product showcase ───────────────────── */}
      <section className="border-b border-line bg-paper py-16 sm:py-24">
        <SiteContainer>
          <Reveal>
            <SectionHeading
              eyebrow="See the whole operation"
              title="Not a brochure — the actual surfaces"
              sub="The pipeline your inside-sales team works, the invoice your client receives, the app your knockers carry. One system, end to end."
            />
          </Reveal>
          <Reveal delay={120}>
            <div className="mt-10">
              <ProductShowcase />
            </div>
          </Reveal>
        </SiteContainer>
      </section>

      {/* ───────────────────── The app ───────────────────── */}
      <section className="border-b border-line bg-surface py-16 sm:py-24">
        <SiteContainer>
          <Reveal>
            <SectionHeading
              eyebrow="The app your reps carry"
              title="Built for the doorstep, not the desk"
              sub="The Knocker iOS app turns a phone into the field's source of truth — live satellite tracking, the day's optimised route, one-thumb capture, and the rep's own commission, all offline-first."
            />
          </Reveal>
          <Reveal delay={100}>
            <div className="mt-10">
              <KnockerAppShowcase />
            </div>
          </Reveal>
          <Reveal delay={140}>
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {[
                'Offline-first sync',
                'Live satellite tracking',
                'One-thumb disposition',
                'Biometric re-auth',
                'App Attest / Play Integrity',
                'Commission preview',
              ].map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-line bg-paper px-3 py-1.5 font-mono text-[11px] text-muted"
                >
                  {t}
                </span>
              ))}
            </div>
          </Reveal>
        </SiteContainer>
      </section>

      {/* ───────────── From the door to the call centre ───────────── */}
      <section className="border-b border-line bg-paper py-16 sm:py-24">
        <SiteContainer>
          <Reveal>
            <SectionHeading
              eyebrow="Door to call centre"
              title="A lead at the door is a call queued for tomorrow"
              sub="The moment a rep tags a door — sale, lead, callback — that outcome flows into the D2D pipeline with the full doorstep context, and the call centre gets a prioritised queue to work it over the next seven days, while it's still warm."
            />
          </Reveal>
          <Reveal delay={100}>
            <div className="mt-10">
              <CallCentreFlow />
            </div>
          </Reveal>
        </SiteContainer>
      </section>

      {/* ─────────────── Everything a business gets (module grid) ─────────────── */}
      <section className="border-b border-line bg-surface py-16 sm:py-24">
        <SiteContainer>
          <Reveal>
            <SectionHeading
              eyebrow="Everything you get"
              title="The whole platform a business receives"
              sub="Twelve core modules, one auditable system — field operations, CRM, AI marketing, money, compliance and enterprise controls. Every business gets the full stack from the first campaign."
            />
          </Reveal>
          <Reveal delay={100}>
            <div className="mt-10">
              <ModuleGrid />
            </div>
          </Reveal>
          <Reveal delay={160}>
            <div className="mt-8 flex justify-center">
              <CtaLink href="/platform" variant="secondary" className="px-5 py-3">
                Tour every module
                <ArrowRight size={16} />
              </CtaLink>
            </div>
          </Reveal>
        </SiteContainer>
      </section>

      {/* ───────────────────── The digital engine (navy) ───────────────────── */}
      <section className="hero-glow relative overflow-hidden bg-hero py-16 sm:py-24">
        <div aria-hidden className="bg-grid-navy pointer-events-none absolute inset-0" />
        <SiteContainer className="relative">
          <Reveal>
            <SectionHeading
              tone="surface"
              eyebrow="The digital side"
              title="An intelligence engine behind every doorstep"
              sub="Every knock, call and conversion is a signal. They flow into a per-region warehouse and AI models that hand back propensity heatmaps, retargeting audiences, anomaly alerts — and the targeting for the next area. The loop gets smarter every campaign."
            />
          </Reveal>
          <Reveal delay={100}>
            <div className="mt-12">
              <DigitalEngine />
            </div>
          </Reveal>
        </SiteContainer>
      </section>

      {/* ───────────── Creative studio / marketing department ───────────── */}
      <section className="border-b border-line bg-surface py-16 sm:py-24">
        <SiteContainer>
          <Reveal>
            <CreativeStudio />
          </Reveal>
        </SiteContainer>
      </section>

      {/* ─────────────────────── Capabilities ─────────────────────── */}
      <section className="border-b border-line bg-paper py-16 sm:py-24">
        <SiteContainer>
          <Reveal>
            <SectionHeading
              eyebrow="One platform, six bounded contexts"
              title="Every stage of the doorstep, instrumented"
              sub="No more data dying at the door. Each capability is a real bounded context with its own service, audit trail and tenant isolation — not a feature bolted onto a CRM."
            />
          </Reveal>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((c, i) => (
              <Reveal key={c.title} delay={(i % 3) * 80}>
                <FeatureCard icon={c.icon} title={c.title} body={c.body} meta={c.meta} />
              </Reveal>
            ))}
          </div>
        </SiteContainer>
      </section>

      {/* ───────────────────────── Verticals ───────────────────────── */}
      <section className="border-b border-line bg-surface py-16 sm:py-24">
        <SiteContainer>
          <Reveal>
            <SectionHeading
              eyebrow="Both verticals, day one"
              title="Charity and commercial, on the same rails"
              sub="A donation and a solar sale are the same shape underneath — a polymorphic conversion with its own compliance gates. One platform routes both correctly."
            />
          </Reveal>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <Reveal>
              <div className="card card-pad h-full">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accentSoft text-accent">
                    <HeartHandshake size={18} />
                  </span>
                  <h3 className="text-[16px] font-semibold tracking-tight text-ink">
                    Charity fundraising
                  </h3>
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-muted">
                  Recurring and one-off giving with tax-compliant receipts, paid-solicitor state
                  clearance, cooling-off enforcement and a charity-signed authority letter on every
                  knocker&apos;s badge screen.
                </p>
                <ul className="mt-4 space-y-2 font-mono text-[11px] uppercase tracking-[0.10em] text-soft">
                  <li>— Recurring + one-off donations</li>
                  <li>— Paid-solicitor registration engine</li>
                  <li>— 501(c)(3) / DGR receipts</li>
                </ul>
              </div>
            </Reveal>
            <Reveal delay={80}>
              <div className="card card-pad h-full">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accentSoft text-accent">
                    <Building2 size={18} />
                  </span>
                  <h3 className="text-[16px] font-semibold tracking-tight text-ink">
                    Commercial field sales
                  </h3>
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-muted">
                  Pest control, solar, energy and telecom — one-shot sales with installer scheduling
                  handoff, substantiation gates on ad copy, and the same knock-to-commission loop
                  behind it.
                </p>
                <ul className="mt-4 space-y-2 font-mono text-[11px] uppercase tracking-[0.10em] text-soft">
                  <li>— One-shot sale + install handoff</li>
                  <li>— Vertical-specific ad substantiation</li>
                  <li>— Crew-leader override commissions</li>
                </ul>
              </div>
            </Reveal>
          </div>
        </SiteContainer>
      </section>

      {/* ─────────────────── Architecture proof (navy) ─────────────────── */}
      <section className="hero-glow relative overflow-hidden bg-hero py-16 sm:py-24">
        <div aria-hidden className="bg-grid-navy pointer-events-none absolute inset-0" />
        <SiteContainer className="relative">
          <Reveal>
            <SectionHeading
              tone="surface"
              eyebrow="Engineered at a fintech bar"
              title="Audit-grade from the first commit"
              sub="The same engineering discipline behind a payments platform — multi-region residency, immutable audit, idempotent money paths — applied to door-to-door."
            />
          </Reveal>
          <div className="mt-12 grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
            {STATS.map((s, i) => (
              <Reveal key={s.label} delay={i * 80}>
                <div>
                  <div className="numeric font-mono text-[40px] font-semibold leading-none tracking-tight text-surface sm:text-[48px]">
                    <CountUp value={s.value} suffix={s.suffix} />
                  </div>
                  <div className="mt-3 text-[12px] leading-snug text-surface/60">{s.label}</div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={120}>
            <div className="mt-12 flex flex-wrap items-center gap-3">
              <CtaLink href="/security" variant="surface" className="px-5 py-3">
                <ShieldCheck size={16} />
                Security &amp; compliance
              </CtaLink>
              <CtaLink
                href="/platform"
                className="border border-surface/20 bg-transparent px-5 py-3 text-surface hover:bg-surface/10"
              >
                How it fits together
                <ArrowRight size={16} />
              </CtaLink>
            </div>
          </Reveal>
        </SiteContainer>
      </section>

      {/* ───────────────────── About Door 2 Digital ───────────────────── */}
      <section className="border-b border-line bg-paper py-16 sm:py-24">
        <SiteContainer>
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_0.9fr]">
            <Reveal>
              <Eyebrow>About Door 2 Digital</Eyebrow>
              <h2 className="mt-3 text-[28px] font-semibold leading-[1.12] tracking-tight text-ink sm:text-[36px]">
                The operating system for door-to-door — run for you, not just sold to you.
              </h2>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
                Door-to-door is one of the highest-converting channels in fundraising and home
                services — and the worst instrumented. Interest gets captured on a clipboard and
                dies there. Door 2 Digital rebuilds the whole motion on an audit-grade spine: market
                the area, work the doors, close from the call centre, retarget the rest, and pay the
                team — with every dollar traceable to the door it came from.
              </p>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
                And we operate it with you. Our own field team, call centre and in-house creative
                studio run your campaign under your brand, on your dedicated, audit-grade tenant —
                so you get the channel without having to build the machine.
              </p>
              <div className="mt-6">
                <CtaLink href="/company" variant="secondary" className="px-5 py-3">
                  More about us
                  <ArrowRight size={16} />
                </CtaLink>
              </div>
            </Reveal>
            <Reveal delay={100}>
              <div className="card card-pad">
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-soft">
                  How we engage
                </div>
                <ol className="mt-4 space-y-4">
                  {[
                    [
                      'Bring us a territory',
                      'Tell us the program, the vertical and the area. We scope the campaign and the cleared states.',
                    ],
                    [
                      'We run it operator-first',
                      'Our field team, call centre + creative studio run it under your brand, on your dedicated, audit-grade tenant.',
                    ],
                    [
                      'You see every dollar',
                      'Live dashboards, a client portal, and provenance on every conversion — door, inside-sales or retargeting.',
                    ],
                  ].map(([t, b], i) => (
                    <li key={t} className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ink font-mono text-[11px] font-semibold text-surface">
                        {i + 1}
                      </span>
                      <div>
                        <div className="text-[14px] font-semibold tracking-tight text-ink">{t}</div>
                        <div className="mt-0.5 text-[13px] leading-relaxed text-muted">{b}</div>
                      </div>
                    </li>
                  ))}
                </ol>
                <blockquote className="mt-5 border-t border-line2 pt-4 text-[13px] italic leading-relaxed text-ink2">
                  &ldquo;You bring a territory — we close the loop and show you every dollar&apos;s
                  provenance.&rdquo;
                </blockquote>
              </div>
            </Reveal>
          </div>
        </SiteContainer>
      </section>

      {/* ─────────────────── Multi-region strip ─────────────────── */}
      <section className="border-b border-line bg-surface py-14">
        <SiteContainer>
          <Reveal>
            <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-accentSoft text-accent">
                  <MapPinned size={18} />
                </span>
                <div>
                  <h3 className="text-[15px] font-semibold tracking-tight text-ink">
                    Residency that survives an audit
                  </h3>
                  <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-muted">
                    Postgres-per-region, not a global replica. Australian donor PII never leaves
                    Sydney; US data never leaves us-east-1. Region is set once at org creation and
                    enforced by a database trigger.
                  </p>
                </div>
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-soft">
                us-east-1 · ap-southeast-2 · ap-southeast-1
              </div>
            </div>
          </Reveal>
        </SiteContainer>
      </section>

      {/* ─────────────────────────── Final CTA ─────────────────────────── */}
      <section className="bg-paper py-20">
        <SiteContainer>
          <Reveal>
            <div className="hero-glow relative overflow-hidden rounded-2xl bg-hero shadow-[0_1px_0_rgba(15,23,42,0.04),0_40px_80px_-44px_rgba(15,23,42,0.45)]">
              <div
                aria-hidden
                className="bg-grid-navy pointer-events-none absolute inset-0 opacity-80"
              />
              <div className="relative grid items-center gap-8 p-8 sm:p-12 md:grid-cols-[1.4fr_1fr]">
                <div>
                  <Eyebrow tone="surface">Operator-first, SaaS later</Eyebrow>
                  <h2 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight text-surface sm:text-[34px]">
                    Bring us a territory. We&apos;ll close the loop.
                  </h2>
                  <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-surface/70">
                    Door 2 Digital runs campaigns operator-first — our field team, your brand, one
                    auditable system. Tell us about your program and we&apos;ll walk the platform
                    end to end.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:items-end">
                  <CtaLink
                    href="/contact"
                    variant="surface"
                    className="w-full justify-center px-5 py-3 sm:w-auto"
                  >
                    Request access
                    <ArrowRight size={16} />
                  </CtaLink>
                  <CtaLink
                    href="/pricing"
                    className="w-full justify-center border border-surface/20 bg-transparent px-5 py-3 text-surface hover:bg-surface/10 sm:w-auto"
                  >
                    See pricing
                  </CtaLink>
                </div>
              </div>
            </div>
          </Reveal>
        </SiteContainer>
      </section>
    </>
  );
}
