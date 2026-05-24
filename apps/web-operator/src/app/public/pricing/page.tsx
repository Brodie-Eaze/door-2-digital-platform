'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { Check, X, ChevronDown, ArrowRight } from 'lucide-react';
import { PublicShell } from '@/components/PublicShell';

interface Plan {
  name: string;
  tagline: string;
  price: string;
  priceSub: string;
  rake: string;
  cta: string;
  ctaHref: string;
  highlighted?: boolean;
  features: string[];
  limits: string[];
}

const PLANS: Plan[] = [
  {
    name: 'Trial',
    tagline: 'Test-drive the operating system.',
    price: 'Free',
    priceSub: '14 days · no card',
    rake: 'No rake during trial',
    cta: 'Start free trial',
    ctaHref: '/public/signup?plan=trial',
    features: [
      'Up to 5 knockers',
      'Basic CRM (pipeline, conversions)',
      '1 territory, 1 region',
      'Knocker iOS preview build',
      'Community support',
      'Read-only audit log',
    ],
    limits: ['No commission engine', 'No multi-region', 'No SSO / WebAuthn', 'No white-label'],
  },
  {
    name: 'Growth',
    tagline: 'The default for growing field teams.',
    price: '$1,500',
    priceSub: 'per month + 8% blended rake',
    rake: '8% blended rake across all conversions',
    cta: 'Start Growth',
    ctaHref: '/public/signup?plan=growth',
    highlighted: true,
    features: [
      'Up to 25 knockers',
      'Full CRM + workflow engine',
      'Up to 8 territories, 1 region',
      'Knocker iOS production build',
      'AI Marketing Studio (50 generations/mo)',
      'Commission engine + processor integration',
      'Hash-chained audit log + 7-yr retention',
      'Email + Slack support',
    ],
    limits: ['Single region', 'Shared infra (multi-tenant DB)', 'No SSO'],
  },
  {
    name: 'Enterprise',
    tagline: 'For multi-region operators and regulated verticals.',
    price: '$2,500',
    priceSub: 'per month + per-bucket rake',
    rake: '5% door · 10% inside · 15% retargeting',
    cta: 'Talk to sales',
    ctaHref: '/public/signup?plan=enterprise&intent=demo',
    features: [
      'Unlimited knockers',
      'Unlimited territories, US + AU + SG',
      'Knocker iOS white-label build',
      'AI Marketing Studio (unlimited)',
      'Commission engine with per-bucket rake',
      'Dedicated database (single-tenant)',
      'SSO (SAML / OIDC) + WebAuthn for admin',
      'SOC 2 Type II report + DPA',
      'Dedicated CSM + 24/7 priority support',
      'Quarterly business review',
      'Custom integrations + onboarding',
    ],
    limits: [],
  },
];

interface ComparisonRow {
  feature: string;
  trial: string | boolean;
  growth: string | boolean;
  enterprise: string | boolean;
}

const COMPARISON: { group: string; rows: ComparisonRow[] }[] = [
  {
    group: 'Capacity',
    rows: [
      { feature: 'Knockers', trial: '5', growth: '25', enterprise: 'Unlimited' },
      { feature: 'Territories', trial: '1', growth: '8', enterprise: 'Unlimited' },
      { feature: 'Regions', trial: '1', growth: '1', enterprise: 'US · AU · SG' },
    ],
  },
  {
    group: 'Field & Operator',
    rows: [
      { feature: 'Knocker iOS preview', trial: true, growth: true, enterprise: true },
      { feature: 'Knocker iOS production build', trial: false, growth: true, enterprise: true },
      { feature: 'White-label Knocker app', trial: false, growth: false, enterprise: true },
      { feature: 'Live field map', trial: true, growth: true, enterprise: true },
      { feature: 'Workflow engine', trial: false, growth: true, enterprise: true },
    ],
  },
  {
    group: 'Marketing Studio',
    rows: [
      { feature: 'AI generations', trial: '5/mo', growth: '50/mo', enterprise: 'Unlimited' },
      { feature: 'Brand safety scoring', trial: false, growth: true, enterprise: true },
      { feature: 'Campaign orchestration', trial: false, growth: true, enterprise: true },
      { feature: 'Retargeting flows', trial: false, growth: true, enterprise: true },
    ],
  },
  {
    group: 'Commissions & Finance',
    rows: [
      { feature: 'Commission engine', trial: false, growth: true, enterprise: true },
      { feature: 'Per-bucket rake', trial: false, growth: false, enterprise: true },
      {
        feature: 'Processor integration (MiCamp/Stripe)',
        trial: false,
        growth: true,
        enterprise: true,
      },
      { feature: 'Custom invoice flow', trial: false, growth: false, enterprise: true },
    ],
  },
  {
    group: 'Security & Compliance',
    rows: [
      {
        feature: 'Audit log',
        trial: 'Read-only',
        growth: 'Hash-chained',
        enterprise: 'Hash-chained + Object Lock',
      },
      { feature: 'SSO (SAML / OIDC)', trial: false, growth: false, enterprise: true },
      { feature: 'WebAuthn admin', trial: false, growth: false, enterprise: true },
      { feature: 'Dedicated database', trial: false, growth: false, enterprise: true },
      { feature: 'SOC 2 Type II report', trial: false, growth: false, enterprise: true },
      { feature: 'Custom DPA', trial: false, growth: false, enterprise: true },
    ],
  },
  {
    group: 'Support',
    rows: [
      { feature: 'Community', trial: true, growth: true, enterprise: true },
      { feature: 'Email + Slack', trial: false, growth: true, enterprise: true },
      { feature: 'Dedicated CSM', trial: false, growth: false, enterprise: true },
      { feature: '24/7 priority', trial: false, growth: false, enterprise: true },
    ],
  },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'What is the blended rake on Growth?',
    a: 'Growth applies a flat 8% rake across all conversion types — door, inside, retargeting. Enterprise unlocks per-bucket rake (5% door / 10% inside / 15% retargeting) which is usually more favourable for door-heavy operations.',
  },
  {
    q: 'Do I pay the rake on trial conversions?',
    a: 'No — Trial accounts pay no rake at all. The 14-day window is fully free, no card required.',
  },
  {
    q: 'Can I switch plans?',
    a: 'Yes, anytime. Upgrades take effect immediately. Downgrades take effect at the end of the current billing cycle. We pro-rate fairly.',
  },
  {
    q: 'Is there a setup fee?',
    a: 'No setup fee on Trial or Growth. Enterprise includes white-glove onboarding (territory import, branding, knocker rollout) priced separately if you need it.',
  },
  {
    q: 'What happens to my data if I cancel?',
    a: 'You can export everything (CSV/JSON) at any time. After cancellation we retain encrypted backups for 30 days then permanently destroy. Audit logs remain under S3 Object Lock for the regulatory 7-year window where applicable.',
  },
  {
    q: 'Do you support custom integrations?',
    a: 'Yes, on Enterprise. Webhooks ship with every plan; bespoke integrations (your CRM, payment processor, identity provider) are scoped under Enterprise onboarding.',
  },
  {
    q: 'Can I run multiple regions on Growth?',
    a: 'No — Growth is single-region. Multi-region (US + AU + SG) requires Enterprise because each region runs its own residency, processors, and compliance stack.',
  },
  {
    q: 'What about SOC 2?',
    a: 'SOC 2 Type II is in active observation window with a target close in Q3 2026. Enterprise customers receive the report under NDA the day it lands. See /public/security for the full compliance posture.',
  },
];

function PlanCard({ plan }: { plan: Plan }): JSX.Element {
  return (
    <div
      className={
        plan.highlighted
          ? 'relative card card-pad p-8 border-2 border-accent shadow-lg flex flex-col'
          : 'relative card card-pad p-8 flex flex-col'
      }
    >
      {plan.highlighted && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-accent text-surface text-[10.5px] uppercase tracking-[0.12em] font-semibold">
          Most popular
        </span>
      )}
      <div>
        <h3 className="text-[18px] font-semibold text-ink tracking-tight">{plan.name}</h3>
        <p className="text-[13px] text-muted mt-1">{plan.tagline}</p>
      </div>
      <div className="mt-6 pb-6 border-b border-line2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-4xl font-semibold text-ink tracking-tight numeric">
            {plan.price}
          </span>
        </div>
        <div className="text-[12.5px] text-muted mt-1">{plan.priceSub}</div>
        <div className="text-[12px] text-accent mt-2 font-medium">{plan.rake}</div>
      </div>
      <ul className="mt-6 space-y-2.5 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-[13px] text-ink">
            <Check className="h-4 w-4 text-accent shrink-0 mt-0.5" />
            <span>{f}</span>
          </li>
        ))}
        {plan.limits.map((l) => (
          <li key={l} className="flex items-start gap-2.5 text-[13px] text-muted">
            <X className="h-4 w-4 text-soft shrink-0 mt-0.5" />
            <span>{l}</span>
          </li>
        ))}
      </ul>
      <Link
        href={plan.ctaHref}
        className={
          plan.highlighted
            ? 'mt-7 inline-flex items-center justify-center gap-2 bg-ink text-surface text-[13.5px] font-semibold px-5 py-3 rounded-md hover:bg-ink2 transition tracking-tight'
            : 'mt-7 inline-flex items-center justify-center gap-2 bg-surface text-ink text-[13.5px] font-semibold px-5 py-3 rounded-md border border-line hover:bg-paper transition tracking-tight'
        }
      >
        {plan.cta}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function ComparisonCell({ value }: { value: string | boolean }): JSX.Element {
  if (value === true) {
    return <Check className="h-4 w-4 text-accent mx-auto" />;
  }
  if (value === false) {
    return <X className="h-4 w-4 text-soft mx-auto" />;
  }
  return <span className="text-[13px] text-ink text-center block">{value}</span>;
}

function FaqItem({ q, a }: { q: string; a: string }): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between py-5 text-left"
        aria-expanded={open}
      >
        <span className="text-[14.5px] font-medium text-ink tracking-tight pr-6">{q}</span>
        <ChevronDown
          className={
            open
              ? 'h-4 w-4 text-muted shrink-0 transition-transform rotate-180'
              : 'h-4 w-4 text-muted shrink-0 transition-transform'
          }
        />
      </button>
      {open && <p className="text-[13.5px] text-muted leading-relaxed pb-5 max-w-3xl">{a}</p>}
    </div>
  );
}

export default function PublicPricingPage(): JSX.Element {
  return (
    <PublicShell activeNav="pricing">
      {/* HERO */}
      <section className="border-b border-line2 bg-gradient-to-b from-surface to-paper">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accentSoft text-accent text-[11px] uppercase tracking-[0.12em] font-medium mb-6">
              Pricing
            </div>
            <h1 className="text-4xl sm:text-5xl font-semibold text-ink tracking-tight leading-[1.05]">
              Pricing that scales with your field, not your headcount.
            </h1>
            <p className="mt-5 text-lg text-muted max-w-2xl leading-relaxed">
              Flat platform fee plus a rake on conversions. No per-seat tax, no surprise overage —
              you only pay more when you sell more.
            </p>
          </div>
        </div>
      </section>

      {/* PLAN CARDS */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-7">
          {PLANS.map((p) => (
            <PlanCard key={p.name} plan={p} />
          ))}
        </div>
        <p className="mt-8 text-center text-[12px] text-muted">
          All prices in USD. AU + SG customers billed in AUD / SGD at month-start FX. Annual prepay
          available with 10% discount on platform fee — contact sales.
        </p>
      </section>

      {/* COMPARISON TABLE */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-12 lg:py-16">
        <div className="max-w-2xl mb-10">
          <h2 className="text-[11px] uppercase tracking-[0.12em] text-muted font-medium mb-3">
            Compare
          </h2>
          <h3 className="text-3xl font-semibold text-ink tracking-tight">Plans side by side.</h3>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-paper border-b border-line2">
                  <th className="text-left px-5 py-4 text-[11px] uppercase tracking-[0.08em] text-muted font-medium w-2/5">
                    Feature
                  </th>
                  <th className="text-center px-5 py-4 text-[12.5px] font-semibold text-ink">
                    Trial
                  </th>
                  <th className="text-center px-5 py-4 text-[12.5px] font-semibold text-ink bg-accentSoft/30">
                    Growth
                  </th>
                  <th className="text-center px-5 py-4 text-[12.5px] font-semibold text-ink">
                    Enterprise
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((group) => (
                  <Fragment key={group.group}>
                    <tr className="bg-paper/50">
                      <td
                        colSpan={4}
                        className="px-5 py-3 text-[11px] uppercase tracking-[0.10em] text-muted font-semibold"
                      >
                        {group.group}
                      </td>
                    </tr>
                    {group.rows.map((r) => (
                      <tr key={r.feature} className="border-b border-line2 last:border-b-0">
                        <td className="px-5 py-3.5 text-[13px] text-ink">{r.feature}</td>
                        <td className="px-5 py-3.5 text-center">
                          <ComparisonCell value={r.trial} />
                        </td>
                        <td className="px-5 py-3.5 text-center bg-accentSoft/20">
                          <ComparisonCell value={r.growth} />
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <ComparisonCell value={r.enterprise} />
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-4xl mx-auto px-6 lg:px-10 py-16 lg:py-20">
        <div className="mb-8">
          <h2 className="text-[11px] uppercase tracking-[0.12em] text-muted font-medium mb-3">
            FAQ
          </h2>
          <h3 className="text-3xl font-semibold text-ink tracking-tight">Pricing questions.</h3>
        </div>
        <div>
          {FAQS.map((f) => (
            <FaqItem key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-line2 bg-paper">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
          <div className="card card-pad p-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-semibold text-ink tracking-tight">
              Start free. Upgrade when the rake hurts more than the platform fee.
            </h2>
            <p className="mt-4 text-[14.5px] text-muted max-w-xl mx-auto">
              Most teams convert from Trial to Growth between week 2 and 3. Enterprise is for
              multi-region operators with their own compliance bar.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/public/signup"
                className="inline-flex items-center justify-center gap-2 bg-ink text-surface text-[14px] font-semibold px-6 py-3.5 rounded-md hover:bg-ink2 transition tracking-tight"
              >
                Start free trial <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/public/signup?intent=demo"
                className="inline-flex items-center justify-center gap-2 bg-surface text-ink text-[14px] font-semibold px-6 py-3.5 rounded-md border border-line hover:bg-paper transition tracking-tight"
              >
                Talk to sales
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
