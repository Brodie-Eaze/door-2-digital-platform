import { Compass, HeartHandshake, ShieldCheck, Layers, ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import { Reveal } from '@d2d/ui-web';
import { SiteContainer, Eyebrow, SectionHeading, CtaLink } from '@/components/site';

export const metadata: Metadata = {
  title: 'Company',
  description:
    'Door 2 Digital is modernising door-to-door — charity fundraising and commercial field sales — with audit-grade engineering and an operator-first model.',
};

const PRINCIPLES = [
  {
    icon: <Compass size={18} />,
    title: 'Close the loop',
    body: 'A knock is worthless if its data dies at the door. Every interaction feeds the next stage — capture, follow-up, retargeting, conversion, commission — and every dollar traces back to the door that started it.',
  },
  {
    icon: <ShieldCheck size={18} />,
    title: 'Audit-grade or it didn’t happen',
    body: 'We hold a door-to-door platform to a payments-platform bar: immutable audit, tenant isolation, region pinning, idempotent money paths. Trust is not a marketing word here — it is the architecture.',
  },
  {
    icon: <HeartHandshake size={18} />,
    title: 'Operator-first, honestly',
    body: 'We run campaigns with our own field team before we sell software to anyone. We feel the friction firsthand, so the product is shaped by the doorstep, not by a roadmap written far from it.',
  },
  {
    icon: <Layers size={18} />,
    title: 'Both verticals, one system',
    body: 'A charity gift and a commercial sale are the same shape underneath. Building for both from day one keeps the platform honest and the compliance engine general.',
  },
];

export default function CompanyPage(): JSX.Element {
  return (
    <>
      {/* Hero */}
      <section className="bg-hero">
        <SiteContainer className="py-16 sm:py-20">
          <Reveal>
            <div className="max-w-2xl">
              <Eyebrow tone="surface">Company</Eyebrow>
              <h1 className="mt-4 text-[32px] font-semibold leading-[1.1] tracking-tight text-surface sm:text-[42px]">
                Door-to-door deserves better than clipboards.
              </h1>
              <p className="mt-5 text-[16px] leading-relaxed text-surface/75">
                Field sales — charity fundraising and commercial alike — still runs on paper,
                WhatsApp groups and disposable lead lists. The interaction at the door is the most
                valuable signal in the funnel, and almost nobody does anything with it. Door 2
                Digital exists to change that.
              </p>
            </div>
          </Reveal>
        </SiteContainer>
      </section>

      {/* Mission */}
      <section className="border-b border-line bg-paper py-16 sm:py-20">
        <SiteContainer>
          <div className="grid items-start gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <Reveal>
              <SectionHeading
                eyebrow="Why we exist"
                title="One operating system for the doorstep"
                sub="Incumbents each own a slice — a map here, a dialer there. None owns the integrated loop from the knock to the converted donor, with the audit trail and compliance gates the work actually requires."
              />
            </Reveal>
            <Reveal delay={100}>
              <div className="space-y-4 text-[14px] leading-relaxed text-muted">
                <p>
                  We started where the pain is sharpest: a field operation that captures real
                  interest at thousands of doors and then loses it to a spreadsheet. The follow-up
                  never happens, the retargeting never fires, and the rep who made the connection
                  never sees the conversion attributed back to them.
                </p>
                <p>
                  So we built the loop. Field capture flows into a CRM, knocked-not-converted
                  addresses become hashed ad audiences, conversions are modelled the same whether
                  they are a recurring donation or a one-shot sale, and commissions accrue against
                  the exact door that earned them.
                </p>
                <p>
                  And we built it at a fintech bar — because the moment you move money and hold
                  donor PII, a door-to-door tool becomes a regulated platform whether it admits it
                  or not. We admit it.
                </p>
              </div>
            </Reveal>
          </div>
        </SiteContainer>
      </section>

      {/* Principles */}
      <section className="border-b border-line bg-surface py-16 sm:py-20">
        <SiteContainer>
          <Reveal>
            <SectionHeading eyebrow="How we operate" title="Four principles we don’t bend" />
          </Reveal>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {PRINCIPLES.map((p, i) => (
              <Reveal key={p.title} delay={(i % 2) * 80}>
                <div className="card card-pad h-full">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accentSoft text-accent">
                    {p.icon}
                  </div>
                  <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-ink">
                    {p.title}
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted">{p.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </SiteContainer>
      </section>

      {/* Where we are — honest stage */}
      <section className="bg-paper py-16 sm:py-20">
        <SiteContainer>
          <Reveal>
            <div className="card card-pad max-w-3xl">
              <Eyebrow>Where we are</Eyebrow>
              <h2 className="mt-3 text-[22px] font-semibold tracking-tight text-ink">
                Early, in pilot, and building in the open about it
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-muted">
                Door 2 Digital is in pilot with an enterprise charity and a commercial operator in
                the United States. We are not a public SaaS yet — there is no self-serve sign-up,
                and we onboard partners hands-on. Australia and Singapore follow once US clearances
                are broad. If that stage fits what you need, we would like to talk; if you need a
                turnkey product today, we will tell you straight.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <CtaLink href="/contact" className="px-5 py-3">
                  Request access
                  <ArrowRight size={16} />
                </CtaLink>
                <CtaLink href="/platform" variant="secondary" className="px-5 py-3">
                  See the platform
                </CtaLink>
              </div>
            </div>
          </Reveal>
        </SiteContainer>
      </section>
    </>
  );
}
