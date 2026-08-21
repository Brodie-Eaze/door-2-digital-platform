import {
  DoorOpen,
  Users,
  Target,
  CircleDollarSign,
  Wallet,
  FileCheck2,
  Database,
  ShieldCheck,
  GitBranch,
  ArrowRight,
  Layers,
  Radio,
  MapPinned,
} from 'lucide-react';
import type { Metadata } from 'next';
import { Reveal } from '@d2d/ui-web';
import { AnimatedLoop } from '@/components/AnimatedLoop';
import { PlatformTour } from '@/components/PlatformTour';
import { IncludedMatrix } from '@/components/PlatformOverview';
import {
  SiteContainer,
  Eyebrow,
  SectionHeading,
  CtaLink,
  FeatureCard,
  SpecRow,
  Stat,
} from '@/components/site';

export const metadata: Metadata = {
  title: 'Platform',
  description:
    'Everything a business gets on Door 2 Digital — field capture, CRM, AI retargeting, conversions, commissions, payouts, compliance, audit, analytics and enterprise controls, on audit-grade multi-region infrastructure.',
};

const STAGES = [
  {
    icon: <DoorOpen size={18} />,
    step: '01',
    title: 'Knock — field capture',
    body: 'The iOS app records every doorstep: GPS, disposition, photo, signature, device-clock offset. Offline-first — knocks queue locally and reconcile idempotently on reconnect, so a dead-zone street never loses a record.',
    meta: 'PostGIS · offline queue · App Attest',
  },
  {
    icon: <Users size={18} />,
    step: '02',
    title: 'CRM — lead + inside sales',
    body: 'An interested-at-the-door disposition becomes a lead with the full doorstep context attached, routed to the call centre with pipeline stages, sequences and a soft-phone. The conversation continues where the knock left off.',
    meta: 'lead lifecycle · sequences',
  },
  {
    icon: <Target size={18} />,
    step: '03',
    title: 'Retarget — AI audiences',
    body: 'Knocked-not-converted addresses become a hashed custom audience across Meta, Google and TikTok. Brand-safety gates run before any creative ships. When the click comes back it returns as a tagged lead.',
    meta: 'hashed match · provenance',
  },
  {
    icon: <CircleDollarSign size={18} />,
    step: '04',
    title: 'Convert — donation or sale',
    body: 'One polymorphic conversion models both a recurring donation and a one-shot commercial sale. Each carries a single attributionSource enum — door, inside-sales or retargeting — the source of truth for every dollar.',
    meta: 'polymorphic · idempotent',
  },
  {
    icon: <Wallet size={18} />,
    step: '05',
    title: 'Commission — payout instruction',
    body: 'Per-knock, per-sale and hybrid plans with crew-leader overrides accrue daily. A payout run generates an instruction file. The platform instructs; it never auto-debits — money movement stays a human decision.',
    meta: 'instruct-only · ADR-0019',
  },
  {
    icon: <FileCheck2 size={18} />,
    step: '06',
    title: 'Comply — gates, not checklists',
    body: 'Campaigns only deliver to states where the paid-solicitor registration has cleared. Cooling-off timers, DNC/DNK scrub and consent capture are enforced in code at the point of action, not chased after the fact.',
    meta: 'state-clearance · TCPA · DNC',
  },
];

export default function PlatformPage(): JSX.Element {
  return (
    <>
      {/* Hero */}
      <section className="hero-glow relative overflow-hidden bg-hero">
        <div aria-hidden className="bg-grid-navy pointer-events-none absolute inset-0" />
        <SiteContainer className="relative py-16 sm:py-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_0.9fr]">
            <Reveal>
              <Eyebrow tone="surface">The platform</Eyebrow>
              <h1 className="mt-4 max-w-xl text-[32px] font-semibold leading-[1.08] tracking-tight text-surface sm:text-[44px]">
                Everything a business gets on Door 2 Digital.
              </h1>
              <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-surface/75">
                Not a CRM with a map bolted on. From the knock to the converted donor — field ops,
                CRM, AI marketing, conversions, money, compliance, audit and enterprise controls —
                every surface below is a real part of the platform a customer org receives.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <CtaLink href="#command-centre" variant="surface" className="px-5 py-3">
                  Tour the platform
                  <ArrowRight size={16} />
                </CtaLink>
                <CtaLink
                  href="/security"
                  className="border border-surface/20 bg-transparent px-5 py-3 text-surface hover:bg-surface/10"
                >
                  Security &amp; compliance
                </CtaLink>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] uppercase tracking-[0.12em] text-surface/55">
                <span>14 modules</span>
                <span>2 verticals</span>
                <span>3 regions</span>
                <span>1 auditable loop</span>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <AnimatedLoop />
            </Reveal>
          </div>
        </SiteContainer>
      </section>

      {/* THE FULL TOUR — every module a business gets */}
      <PlatformTour />

      {/* Everything included — exhaustive checklist */}
      <section className="border-b border-line bg-paper py-16 sm:py-20">
        <SiteContainer>
          <Reveal>
            <SectionHeading
              eyebrow="Everything included"
              title="The complete surface, on day one"
              sub="No upsell tiers hiding the basics. Every business on the platform gets the full stack — field, CRM, marketing, money, compliance and enterprise — from the first campaign."
            />
          </Reveal>
          <Reveal delay={100}>
            <div className="mt-10">
              <IncludedMatrix />
            </div>
          </Reveal>
        </SiteContainer>
      </section>

      {/* The loop, stage by stage */}
      <section id="loop" className="border-b border-line bg-surface py-16 sm:py-20">
        <SiteContainer>
          <Reveal>
            <SectionHeading
              eyebrow="How the loop works"
              title="From the knock to the converted donor"
              sub="Every stage hands the next one real context. Attribution ties the whole ring together so the platform knows which dollar came from which door."
            />
          </Reveal>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {STAGES.map((s, i) => (
              <Reveal key={s.step} delay={(i % 3) * 80}>
                <div className="card card-pad h-full">
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accentSoft text-accent">
                      {s.icon}
                    </span>
                    <span className="font-mono text-[11px] tracking-[0.18em] text-soft">
                      {s.step}
                    </span>
                  </div>
                  <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-ink">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted">{s.body}</p>
                  <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-soft">
                    {s.meta}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </SiteContainer>
      </section>

      {/* Architecture */}
      <section className="hero-glow relative overflow-hidden bg-hero py-16 sm:py-20">
        <div aria-hidden className="bg-grid-navy pointer-events-none absolute inset-0" />
        <SiteContainer className="relative">
          <Reveal>
            <SectionHeading
              tone="surface"
              eyebrow="How it's built"
              title="Engineered at a fintech bar"
              sub="The same discipline behind a payments platform, applied to door-to-door: every regulated row is tenant-scoped, region-pinned and written to an immutable audit chain."
            />
          </Reveal>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <Reveal>
              <ArchCard
                icon={<Database size={18} />}
                title="Postgres-per-region"
                body="Not a global replica. US data stays in us-east-1, Australian donor PII never leaves Sydney. Region is pinned once at org creation and enforced by a database trigger."
              />
            </Reveal>
            <Reveal delay={80}>
              <ArchCard
                icon={<ShieldCheck size={18} />}
                title="Immutable audit"
                body="Every mutation writes a hash-chained AuditEvent in the same transaction, shipped to S3 Object Lock for 7-year retention. The chain is Merkle-replayed in CI and fails the build on mismatch."
              />
            </Reveal>
            <Reveal delay={160}>
              <ArchCard
                icon={<GitBranch size={18} />}
                title="Idempotent by contract"
                body="Every POST mutation carries an Idempotency-Key. Replays return the original response. Money paths never double-charge, even when a knocker's phone retries a sync on a flaky connection."
              />
            </Reveal>
            <Reveal>
              <ArchCard
                icon={<Layers size={18} />}
                title="Defence in depth"
                body="Route guard → tenant guard → Postgres row-level security → region guard. Four independent layers refuse a cross-tenant or cross-region read, and write an audit row on the attempt."
              />
            </Reveal>
            <Reveal delay={80}>
              <ArchCard
                icon={<Radio size={18} />}
                title="Event-driven core"
                body="Bounded contexts communicate over a typed event bus with a transactional outbox, so a conversion fans out to commissions, receipts and webhooks without losing an event."
              />
            </Reveal>
            <Reveal delay={160}>
              <ArchCard
                icon={<MapPinned size={18} />}
                title="Geospatial native"
                body="Territories are real PostGIS polygons with S2/H3 cell covering for heatmaps. Turf assignment, draw tools and demographic overlays read straight off the geometry."
              />
            </Reveal>
          </div>
          <Reveal delay={120}>
            <div className="mt-10 grid grid-cols-2 gap-8 sm:grid-cols-4">
              <Stat tone="surface" value="14" label="Modules in the platform a business receives" />
              <Stat
                tone="surface"
                value="3"
                label="Regions — US, AU, SG — pinned at org creation"
              />
              <Stat tone="surface" value="7yr" label="Hash-chained, Object-Lock audit retention" />
              <Stat tone="surface" value="100%" label="POST mutations idempotent by contract" />
            </div>
          </Reveal>
        </SiteContainer>
      </section>

      {/* Polymorphic conversion */}
      <section className="border-b border-line bg-paper py-16 sm:py-20">
        <SiteContainer>
          <div className="grid items-start gap-10 lg:grid-cols-2">
            <Reveal>
              <SectionHeading
                eyebrow="One shape, both verticals"
                title="A donation and a solar sale are the same object"
                sub="Underneath, a charity gift and a commercial sale share one polymorphic conversion. The vertical drives which compliance gates fire — not a separate data model."
              />
              <div className="mt-6">
                <FeatureCard
                  icon={<CircleDollarSign size={18} />}
                  title="attributionSource is the source of truth"
                  body="door | inside_sales | retargeting | other. The enum on every conversion is what the billing engine reads to compute the rake bucket — so revenue is never reconstructed from guesswork."
                  meta="donation | sale"
                />
              </div>
            </Reveal>
            <Reveal delay={100}>
              <div className="card card-pad">
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-soft">
                  Conversion — shared fields
                </div>
                <dl className="mt-3">
                  <SpecRow label="type">
                    donation_recurring · donation_oneoff · sale_commercial
                  </SpecRow>
                  <SpecRow label="attributionSource">
                    door · inside_sales · retargeting · other
                  </SpecRow>
                  <SpecRow label="amountCents">BigInt — money is never a float</SpecRow>
                  <SpecRow label="knockerId / closerId">
                    Door attribution and the closer, tracked separately
                  </SpecRow>
                  <SpecRow label="paymentProvider">
                    micamp (US) · stripe (AU / SG) via one adapter interface
                  </SpecRow>
                  <SpecRow label="idempotencyKey">Unique — finalisation is replay-safe</SpecRow>
                </dl>
              </div>
            </Reveal>
          </div>
        </SiteContainer>
      </section>

      {/* CTA */}
      <section className="bg-surface py-16">
        <SiteContainer>
          <Reveal>
            <div className="card overflow-hidden">
              <div className="flex flex-col items-start justify-between gap-6 p-8 sm:flex-row sm:items-center sm:p-10">
                <div>
                  <h2 className="text-[22px] font-semibold tracking-tight text-ink">
                    See it run against a real territory
                  </h2>
                  <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-muted">
                    We run campaigns operator-first — our field team, your brand, one auditable
                    system. Tell us about your program and we&apos;ll walk every module end to end.
                  </p>
                </div>
                <CtaLink href="/contact" className="shrink-0 px-5 py-3">
                  Request access
                  <ArrowRight size={16} />
                </CtaLink>
              </div>
            </div>
          </Reveal>
        </SiteContainer>
      </section>
    </>
  );
}

function ArchCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}): JSX.Element {
  return (
    <div className="h-full rounded-xl border border-surface/10 bg-surface/[0.04] p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface/10 text-accent">
        {icon}
      </div>
      <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-surface">{title}</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-surface/65">{body}</p>
    </div>
  );
}
