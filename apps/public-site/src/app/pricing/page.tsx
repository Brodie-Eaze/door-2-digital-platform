import { DoorOpen, Users, Target, Check, ArrowRight, Building2 } from 'lucide-react';
import type { Metadata } from 'next';
import { Reveal } from '@d2d/ui-web';
import { SiteContainer, Eyebrow, SectionHeading, CtaLink } from '@/components/site';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Operator-first pricing — a flat platform fee plus a rake that differs by how each conversion was won: door, inside-sales or retargeting.',
};

const BUCKETS = [
  {
    icon: <DoorOpen size={18} />,
    source: 'Door-closed',
    rate: '15%',
    body: 'A conversion signed at the doorstep by a field rep. The highest rake — it reflects the full field operation behind every knock.',
  },
  {
    icon: <Users size={18} />,
    source: 'Inside-sales-closed',
    rate: '10%',
    body: 'A door-interested lead that the call centre closed. The rake reflects the doorstep that started it plus the inside-sales work that finished it.',
  },
  {
    icon: <Target size={18} />,
    source: 'Retargeting-attributed',
    rate: '5%',
    body: 'A knocked-not-converted address that came back through a hashed ad audience and converted online. The lightest rake on the loop.',
  },
];

export default function PricingPage(): JSX.Element {
  return (
    <>
      {/* Hero */}
      <section className="bg-hero">
        <SiteContainer className="py-16 sm:py-20">
          <Reveal>
            <div className="max-w-2xl">
              <Eyebrow tone="surface">Pricing</Eyebrow>
              <h1 className="mt-4 text-[32px] font-semibold leading-[1.1] tracking-tight text-surface sm:text-[42px]">
                You pay for outcomes, weighted by how they were won.
              </h1>
              <p className="mt-5 text-[16px] leading-relaxed text-surface/75">
                Door 2 Digital runs operator-first: our field team runs your campaigns under your
                brand. Pricing is a flat platform fee plus a rake on each conversion — and the rake
                differs by attribution, because a door close and a retargeted click are not the same
                work.
              </p>
            </div>
          </Reveal>
        </SiteContainer>
      </section>

      {/* The model */}
      <section className="border-b border-line bg-paper py-16 sm:py-20">
        <SiteContainer>
          <Reveal>
            <SectionHeading
              eyebrow="The two-part model"
              title="A platform fee plus a per-bucket rake"
              sub="Every conversion carries a single attributionSource. That enum decides the rake bucket — there is no double-counting and no reconstruction after the fact."
            />
          </Reveal>

          <div className="mt-10 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
            <Reveal>
              <div className="card card-pad flex h-full flex-col">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accentSoft text-accent">
                  <Building2 size={20} />
                </span>
                <div className="mt-5 font-mono text-[11px] uppercase tracking-[0.16em] text-soft">
                  Platform fee
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="numeric font-mono text-[40px] font-semibold tracking-tight text-ink">
                    $2,500
                  </span>
                  <span className="text-[14px] text-muted">/ month</span>
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-muted">
                  Covers the platform, the operator console, the white-label mobile build, hosting
                  in your region, and the audit + compliance engine. Representative — set per
                  engagement.
                </p>
                <ul className="mt-5 space-y-2.5">
                  {[
                    'Dedicated single-tenant database',
                    'White-label iOS build under your brand',
                    'SSO / SAML for your IdP',
                    'Region-pinned data residency',
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[13px] text-ink2">
                      <Check size={15} className="mt-0.5 shrink-0 text-accent" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div className="card card-pad h-full">
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-soft">
                  Conversion rake — by attribution
                </div>
                <div className="mt-4 space-y-3">
                  {BUCKETS.map((b) => (
                    <div
                      key={b.source}
                      className="flex items-start gap-4 rounded-xl border border-line2 bg-paper p-4"
                    >
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accentSoft text-accent">
                        {b.icon}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[14px] font-semibold tracking-tight text-ink">
                            {b.source}
                          </span>
                          <span className="numeric font-mono text-[20px] font-semibold tracking-tight text-accent">
                            {b.rate}
                          </span>
                        </div>
                        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{b.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-[12px] leading-relaxed text-soft">
                  Rates shown are the representative defaults the billing engine ships with. Actual
                  rates are configured per engagement and can change without a redeploy — every
                  invoice line item is traced back to the conversions that produced it.
                </p>
              </div>
            </Reveal>
          </div>
        </SiteContainer>
      </section>

      {/* Worked example */}
      <section className="border-b border-line bg-surface py-16 sm:py-20">
        <SiteContainer>
          <Reveal>
            <SectionHeading
              eyebrow="A worked month"
              title="How an invoice actually adds up"
              sub="Illustrative numbers, real arithmetic. The billing engine sums each bucket from tagged conversions, applies the configured rate, and adds the platform fee."
            />
          </Reveal>
          <Reveal delay={80}>
            <div className="mt-8 overflow-hidden rounded-xl border border-line">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-paper">
                    <th className="px-5 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-soft">
                      Line item
                    </th>
                    <th className="px-5 py-3 text-right font-mono text-[11px] uppercase tracking-[0.14em] text-soft">
                      Volume
                    </th>
                    <th className="px-5 py-3 text-right font-mono text-[11px] uppercase tracking-[0.14em] text-soft">
                      Rate
                    </th>
                    <th className="px-5 py-3 text-right font-mono text-[11px] uppercase tracking-[0.14em] text-soft">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="text-[13px]">
                  {[
                    ['Platform fee', '—', 'flat', '$2,500'],
                    ['Door-closed conversions', '$40,000', '15%', '$6,000'],
                    ['Inside-sales-closed', '$22,000', '10%', '$2,200'],
                    ['Retargeting-attributed', '$10,000', '5%', '$500'],
                  ].map((row) => (
                    <tr key={row[0]} className="border-t border-line2">
                      <td className="px-5 py-3 text-ink2">{row[0]}</td>
                      <td className="numeric px-5 py-3 text-right font-mono text-muted">
                        {row[1]}
                      </td>
                      <td className="numeric px-5 py-3 text-right font-mono text-muted">
                        {row[2]}
                      </td>
                      <td className="numeric px-5 py-3 text-right font-mono font-semibold text-ink">
                        {row[3]}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-line bg-paper">
                    <td className="px-5 py-3 font-semibold text-ink" colSpan={3}>
                      Total — illustrative month
                    </td>
                    <td className="numeric px-5 py-3 text-right font-mono text-[15px] font-semibold text-accent">
                      $11,200
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-4 text-[12px] text-soft">
              Figures are an example to show the mechanics, not a quoted result. Your numbers depend
              on volume, vertical and the rates set in your agreement.
            </p>
          </Reveal>
        </SiteContainer>
      </section>

      {/* What's not here yet — honesty */}
      <section className="bg-paper py-16 sm:py-20">
        <SiteContainer>
          <Reveal>
            <div className="card card-pad max-w-3xl">
              <Eyebrow>Straight about the stage</Eyebrow>
              <h2 className="mt-3 text-[22px] font-semibold tracking-tight text-ink">
                There is no self-serve sign-up yet
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-muted">
                Door 2 Digital is in pilot. We onboard operators and clients hands-on, not through a
                credit-card wall. Public self-serve and a published price book come later, once the
                first engagements are live and the compliance clearances are broad. Until then,
                pricing is a conversation — and the model above is exactly how it works.
              </p>
              <div className="mt-6">
                <CtaLink href="/contact" className="px-5 py-3">
                  Talk to us about a program
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
