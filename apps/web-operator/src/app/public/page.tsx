import Link from 'next/link';
import {
  ArrowRight,
  Radio,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Map as MapIcon,
  TrendingUp,
  Globe2,
  CheckCircle2,
} from 'lucide-react';
import { PublicShell } from '@/components/PublicShell';

export const metadata = {
  title: 'Door 2 Digital — The operating system for door-to-door',
  description:
    'Modernising the industry that runs on clipboards. Live field map, instrumented commissions, AI-powered marketing, audit-grade compliance.',
};

const PILLARS = [
  {
    icon: Radio,
    title: 'Live mission control',
    body: 'Every knock, conversation, conversion and payment streams to a NASA-style console. Filter by region, vertical, knocker, hour. No clipboards, no spreadsheets, no shadow CRMs.',
  },
  {
    icon: Sparkles,
    title: 'AI Marketing Studio',
    body: 'Generate compliant door-flyers, retargeting creative, and SMS in seconds. Brand-safety scoring + auto-policy enforcement built in. One studio, every campaign.',
  },
  {
    icon: ShieldCheck,
    title: 'Audit-grade compliance',
    body: 'Hash-chained audit log, S3 Object Lock 7-year retention, per-state clearance tracking, GDPR/CCPA/AU Privacy Act ready. Built for the next subpoena before it lands.',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Onboard the business',
    body: 'Brand, jurisdiction, plan, processor — wired in under 10 min.',
  },
  {
    n: '02',
    title: 'Provision the Knocker iOS app',
    body: 'TestFlight or production build, scoped to that account.',
  },
  {
    n: '03',
    title: 'Knockers hit the field',
    body: 'Every door logs to the live map with offline-first sync.',
  },
  {
    n: '04',
    title: 'Conversions stream in',
    body: 'Donations, sales, leads — instrumented for commission engine.',
  },
  {
    n: '05',
    title: 'Commissions settle',
    body: 'Per-bucket rake computed, processor invoice posted, payouts released.',
  },
];

const STATS = [
  { value: '218', label: 'Active knockers' },
  { value: '12', label: 'Live territories' },
  { value: '$1.6M', label: 'Conversion volume MTD' },
  { value: '7yr', label: 'Audit retention' },
  { value: '3', label: 'Regions (US · AU · SG)' },
  { value: '99.97%', label: 'Uptime trailing 90d' },
];

const CUSTOMER_TYPES = [
  'Charity & non-profit fundraising',
  'Pest control & home services',
  'Healthcare outreach',
  'Solar & energy',
  'Telco & ISP acquisition',
  'Religious & advocacy',
];

export default function PublicHomePage(): JSX.Element {
  return (
    <PublicShell activeNav="home">
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-b from-surface to-paper border-b border-line2">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-24 lg:py-32">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accentSoft text-accent text-[11px] uppercase tracking-[0.12em] font-medium mb-7">
              <span className="h-1.5 w-1.5 rounded-full bg-accent"></span>
              Now live in US · AU · SG
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-ink tracking-tight leading-[1.05]">
              The operating system for door-to-door.
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-muted max-w-2xl leading-relaxed">
              Modernising the industry that runs on clipboards. Live field map, instrumented
              commissions, AI-powered marketing, audit-grade compliance — in one console.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <Link
                href="/public/signup?intent=demo"
                className="inline-flex items-center justify-center gap-2 bg-ink text-surface text-[14px] font-semibold px-6 py-3.5 rounded-md hover:bg-ink2 transition tracking-tight"
              >
                Book a demo
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/public/signup"
                className="inline-flex items-center justify-center gap-2 bg-surface text-ink text-[14px] font-semibold px-6 py-3.5 rounded-md border border-line transition hover:bg-paper tracking-tight"
              >
                Start 14-day trial
              </Link>
              <Link
                href="/public/product"
                className="inline-flex items-center justify-center gap-2 text-muted text-[14px] font-medium px-6 py-3.5 rounded-md hover:text-ink transition tracking-tight"
              >
                See the product
              </Link>
            </div>
            <p className="mt-6 text-[12.5px] text-muted">
              No credit card required. SOC 2 in flight. Self-serve onboarding.
            </p>
          </div>
        </div>
      </section>

      {/* THREE PILLARS */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
        <div className="max-w-2xl mb-14">
          <h2 className="text-[11px] uppercase tracking-[0.12em] text-muted font-medium mb-3">
            Why D2D
          </h2>
          <h3 className="text-3xl sm:text-4xl font-semibold text-ink tracking-tight leading-tight">
            One console for every door, conversation and dollar.
          </h3>
          <p className="mt-5 text-[15px] text-muted leading-relaxed">
            We replaced three categories — field CRM, marketing automation, and compliance — with a
            single instrumented surface. Operators see everything; knockers see only their next
            door.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.title}
                className="card card-pad flex flex-col gap-4 hover:-translate-y-0.5 transition"
              >
                <div className="inline-flex items-center justify-center h-10 w-10 rounded-md bg-accentSoft text-accent">
                  <Icon className="h-5 w-5" />
                </div>
                <h4 className="text-[16.5px] font-semibold text-ink tracking-tight">
                  {pillar.title}
                </h4>
                <p className="text-[13.5px] text-muted leading-relaxed">{pillar.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* LOGO WALL */}
      <section className="border-y border-line2 bg-surface">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted font-medium text-center mb-10">
            Verticals on D2D today
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-6">
            {CUSTOMER_TYPES.map((t) => (
              <div
                key={t}
                className="flex items-center justify-center text-[12.5px] text-muted text-center font-medium tracking-tight px-4 py-3 rounded-md border border-line2 bg-paper hover:border-line transition"
              >
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
        <div className="max-w-2xl mb-12">
          <h2 className="text-[11px] uppercase tracking-[0.12em] text-muted font-medium mb-3">
            How it works
          </h2>
          <h3 className="text-3xl sm:text-4xl font-semibold text-ink tracking-tight leading-tight">
            From signed contract to first dollar in five steps.
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {STEPS.map((step) => (
            <div
              key={step.n}
              className="flex flex-col gap-3 p-5 rounded-lg border border-line2 bg-surface hover:border-line transition"
            >
              <span className="text-[11px] uppercase tracking-[0.12em] text-accent font-semibold">
                Step {step.n}
              </span>
              <h4 className="text-[14.5px] font-semibold text-ink tracking-tight">{step.title}</h4>
              <p className="text-[12.5px] text-muted leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* STATS STRIP */}
      <section className="border-y border-line2 bg-ink">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-y-10 gap-x-6">
            {STATS.map((s) => (
              <div key={s.label} className="text-center sm:text-left">
                <div className="text-3xl sm:text-4xl font-semibold text-surface tracking-tight numeric">
                  {s.value}
                </div>
                <div className="text-[11px] uppercase tracking-[0.10em] text-soft font-medium mt-2">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CUSTOMER QUOTE */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
        <div className="card card-pad p-10 sm:p-14 max-w-4xl mx-auto">
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted font-medium mb-4">
            What operators say
          </p>
          <blockquote className="text-2xl sm:text-3xl font-medium text-ink tracking-tight leading-snug">
            &ldquo;We replaced four tools with D2D in our first quarter — the field CRM, the
            commission tracker, the marketing platform, and the compliance binder. Operations went
            from a 14-tab spreadsheet to a single screen.&rdquo;
          </blockquote>
          <div className="mt-7 flex items-center gap-4">
            <span className="mono">HF</span>
            <div className="text-[13px]">
              <div className="font-semibold text-ink">VP Field Operations</div>
              <div className="text-muted">National charity, US Southeast (anonymised)</div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="border-t border-line2 bg-paper">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-24">
          <div className="card card-pad p-12 sm:p-16 text-center bg-ink">
            <h2 className="text-3xl sm:text-4xl font-semibold text-surface tracking-tight leading-tight max-w-2xl mx-auto">
              Stop running door-to-door on clipboards.
            </h2>
            <p className="mt-5 text-[15px] text-soft max-w-xl mx-auto leading-relaxed">
              Start a free 14-day trial — five knockers, basic CRM, no card. Or book a 30-minute
              demo and we&apos;ll show you the live console with your data shape in mind.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/public/signup"
                className="inline-flex items-center justify-center gap-2 bg-surface text-ink text-[14px] font-semibold px-6 py-3.5 rounded-md hover:bg-paper transition tracking-tight"
              >
                Start free trial
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/public/signup?intent=demo"
                className="inline-flex items-center justify-center gap-2 bg-ink2 text-surface text-[14px] font-semibold px-6 py-3.5 rounded-md hover:bg-muted transition tracking-tight border border-soft/20"
              >
                Book a demo
              </Link>
            </div>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-[12px] text-soft">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> No credit card
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Cancel anytime
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> SOC 2 in flight
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Multi-region residency
              </span>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
