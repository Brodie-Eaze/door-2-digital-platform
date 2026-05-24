import Link from 'next/link';
import {
  ArrowRight,
  Smartphone,
  Radio,
  Sparkles,
  Globe2,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { PublicShell } from '@/components/PublicShell';

export const metadata = {
  title: 'Product — Door 2 Digital',
  description:
    'Knocker iOS field app, operator console, AI Marketing Studio, multi-region residency, SOC 2 compliance.',
};

interface ProductSection {
  id: string;
  icon: typeof Smartphone;
  eyebrow: string;
  title: string;
  blurb: string;
  bullets: string[];
  screenshot: { title: string; sub: string };
}

const SECTIONS: ProductSection[] = [
  {
    id: 'knocker',
    icon: Smartphone,
    eyebrow: 'Field surface',
    title: 'Knocker iOS field app',
    blurb:
      'A focused, offline-first iOS app for the only person who matters at 6:47 PM on a Tuesday — the knocker at the door. No clutter, no menus, just the next door and the next conversation.',
    bullets: [
      'Offline-first knock logging with background sync — works in basements, lifts, dead zones.',
      'Pinned to a single account: branded, scoped, signed via TestFlight or production bundle.',
      'Live territory polygon + heatmap overlay — no door knocked twice, no street skipped.',
      'In-app conversation capture: voice-to-text notes, follow-up timestamps, donor card scan.',
      'Hourly performance tile — knocks, contacts, conversions, $ — visible only to that knocker.',
    ],
    screenshot: {
      title: 'Knocker iOS · live territory view',
      sub: 'Decorative — actual app served via TestFlight per account.',
    },
  },
  {
    id: 'operator',
    icon: Radio,
    eyebrow: 'Mission control',
    title: 'Operator console',
    blurb:
      'NASA-style mission control for the whole portfolio. One screen, every account, every region — the same console your team logs into every morning.',
    bullets: [
      'Live field map across every active territory, with knocker pins + last-ping latency.',
      'Per-account workspaces — pipeline, finance, compliance, comms — fully isolated.',
      'Commission engine with per-bucket rake (door / inside / retargeting), audit-trailed.',
      'Live alerts: territory drop-off, conversion velocity dip, compliance flag, payout anomaly.',
      'Audit log with hash-chained tamper detection + S3 Object Lock 7-year retention.',
    ],
    screenshot: {
      title: 'Operator console · live field map',
      sub: 'Decorative — log in to see your portfolio rendered here.',
    },
  },
  {
    id: 'marketing',
    icon: Sparkles,
    eyebrow: 'AI marketing',
    title: 'AI Marketing Studio',
    blurb:
      'One studio, every campaign. Generate flyers, retargeting creative, and SMS — brand-safety scored, jurisdiction-aware, ready to ship.',
    bullets: [
      'Prompt-to-creative pipeline for flyers, door-hangers, social, and retargeting ads.',
      'Brand-safety scoring with policy-aware guardrails for charity, healthcare, financial verticals.',
      'Reusable asset library with searchable tags, regions, campaigns and rights tracking.',
      'Campaign orchestration: schedule, target, measure — exportable to Meta, Google, TikTok.',
      'Retargeting flows tied directly to knock + conversion events.',
    ],
    screenshot: {
      title: 'Marketing Studio · generator',
      sub: 'Decorative — try it after sign-up.',
    },
  },
  {
    id: 'regions',
    icon: Globe2,
    eyebrow: 'Multi-region',
    title: 'Multi-region operations',
    blurb:
      'Door-to-door is a local sport. Run US, AU and SG operations side-by-side with the right processors, residency, and compliance baked in.',
    bullets: [
      'US: Stripe + MiCamp processor stack, per-state clearance, TCPA-aware SMS.',
      'AU: Stripe AU + Privacy Act 1988 + ASIC AFSL guardrails, GST handling, BSB/PayID.',
      'SG: Stripe SG + PDPA + IMDA DNC list + per-block HDB territory mapping.',
      'Per-region data residency — US data stays US, AU data stays AU, SG data stays SG.',
      'Single login, region-toggle in the top bar — the right console for the right deal.',
    ],
    screenshot: {
      title: 'Regions · US · AU · SG dashboards',
      sub: 'Decorative — switch regions via top-bar toggle.',
    },
  },
  {
    id: 'soc2',
    icon: ShieldCheck,
    eyebrow: 'Compliance posture',
    title: 'SOC 2 + enterprise security',
    blurb:
      'Built for the next subpoena before it lands. SOC 2 Type II in flight, KMS envelope encryption, WebAuthn for admin, deterministic-SIV for searchable PII.',
    bullets: [
      'SOC 2 Type II in active observation window (target close: Q3 2026).',
      'KMS envelope encryption per tenant; deterministic-SIV for searchable PII fields.',
      'Hash-chained audit log + S3 Object Lock 7-year retention.',
      'WebAuthn for admin login; RBAC across super_admin / admin / accountant / broker / read-only.',
      'Quarterly penetration tests + invite-only bug bounty (public Phase 4).',
    ],
    screenshot: {
      title: 'Compliance posture report',
      sub: 'Decorative — full report on /public/security.',
    },
  },
];

function ScreenshotPlaceholder({ title, sub }: { title: string; sub: string }): JSX.Element {
  return (
    <div className="card card-pad bg-ink p-0 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-2.5 border-b border-heroLine">
        <span className="h-2.5 w-2.5 rounded-full bg-soft/30"></span>
        <span className="h-2.5 w-2.5 rounded-full bg-soft/30"></span>
        <span className="h-2.5 w-2.5 rounded-full bg-soft/30"></span>
      </div>
      <div className="aspect-[16/10] flex flex-col items-center justify-center p-10 text-center bg-gradient-to-br from-ink2 to-ink">
        <span className="text-[11px] uppercase tracking-[0.12em] text-soft font-medium">
          Screenshot
        </span>
        <h4 className="mt-3 text-[15px] font-semibold text-surface tracking-tight">{title}</h4>
        <p className="mt-1.5 text-[12px] text-soft max-w-xs leading-relaxed">{sub}</p>
      </div>
    </div>
  );
}

export default function PublicProductPage(): JSX.Element {
  return (
    <PublicShell activeNav="product">
      {/* HERO */}
      <section className="border-b border-line2 bg-gradient-to-b from-surface to-paper">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accentSoft text-accent text-[11px] uppercase tracking-[0.12em] font-medium mb-6">
              Product
            </div>
            <h1 className="text-4xl sm:text-5xl font-semibold text-ink tracking-tight leading-[1.05]">
              Five surfaces, one operating system.
            </h1>
            <p className="mt-5 text-lg text-muted max-w-2xl leading-relaxed">
              From the knocker&apos;s phone to the operator&apos;s console to the auditor&apos;s SOC
              2 report — every D2D surface is wired into the same instrumented backbone.
            </p>
            <div className="mt-8 flex flex-wrap gap-x-7 gap-y-2 text-[13px] text-muted">
              {SECTIONS.map((s) => (
                <a key={s.id} href={`#${s.id}`} className="hover:text-ink transition">
                  {s.title}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PRODUCT SECTIONS */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16 lg:py-20 space-y-24 lg:space-y-32">
        {SECTIONS.map((section, idx) => {
          const Icon = section.icon;
          const reverse = idx % 2 === 1;
          return (
            <section
              key={section.id}
              id={section.id}
              className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center scroll-mt-20"
            >
              <div className={reverse ? 'order-2 lg:order-2' : 'order-2 lg:order-1'}>
                <div className="inline-flex items-center gap-2 mb-4">
                  <span className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-accentSoft text-accent">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.12em] text-muted font-medium">
                    {section.eyebrow}
                  </span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-semibold text-ink tracking-tight leading-tight">
                  {section.title}
                </h2>
                <p className="mt-5 text-[15px] text-muted leading-relaxed">{section.blurb}</p>
                <ul className="mt-8 space-y-3.5">
                  {section.bullets.map((b) => (
                    <li
                      key={b}
                      className="flex items-start gap-3 text-[14px] text-ink leading-relaxed"
                    >
                      <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-px" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={reverse ? 'order-1 lg:order-1' : 'order-1 lg:order-2'}>
                <ScreenshotPlaceholder {...section.screenshot} />
              </div>
            </section>
          );
        })}
      </div>

      {/* CTA */}
      <section className="border-t border-line2 bg-paper">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
          <div className="card card-pad p-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-semibold text-ink tracking-tight">
              Walk a knocker, an operator and an auditor through the same screen.
            </h2>
            <p className="mt-4 text-[14.5px] text-muted max-w-xl mx-auto">
              Book a 30-minute demo and we&apos;ll show you all five surfaces with your industry,
              region, and compliance shape in mind.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/public/signup?intent=demo"
                className="inline-flex items-center justify-center gap-2 bg-ink text-surface text-[14px] font-semibold px-6 py-3.5 rounded-md hover:bg-ink2 transition tracking-tight"
              >
                Book demo <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/public/pricing"
                className="inline-flex items-center justify-center gap-2 bg-surface text-ink text-[14px] font-semibold px-6 py-3.5 rounded-md border border-line hover:bg-paper transition tracking-tight"
              >
                See pricing
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
