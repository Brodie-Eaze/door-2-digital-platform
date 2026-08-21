/*
 * PlatformOverview — two home-page surfaces that signal the full breadth a
 * business receives: ModuleGrid (every module as a compact card, linking into
 * the deep tour) and IncludedMatrix (the exhaustive "what's included" checklist
 * grouped by area). Server components, no motion of their own.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  Radio,
  MapPinned,
  Smartphone,
  Users,
  GitBranch,
  Sparkles,
  CircleDollarSign,
  Wallet,
  Banknote,
  FileCheck2,
  BarChart3,
  LayoutDashboard,
  Check,
} from 'lucide-react';

type ModuleCard = { icon: ReactNode; title: string; blurb: string; href: string; group: string };

const MODULES: ModuleCard[] = [
  {
    group: 'Field operations',
    icon: <Radio size={16} />,
    title: 'Command Centre',
    blurb: 'Live field map, roster, anomaly detection.',
    href: '/platform#command-centre',
  },
  {
    group: 'Field operations',
    icon: <MapPinned size={16} />,
    title: 'Territory intelligence',
    blurb: 'Draw turf; predicted-conversion heatmap.',
    href: '/platform#territories',
  },
  {
    group: 'Field operations',
    icon: <Smartphone size={16} />,
    title: 'Knocker iOS app',
    blurb: 'Offline-first capture in four taps.',
    href: '/platform#knocker-app',
  },
  {
    group: 'CRM & sales',
    icon: <Users size={16} />,
    title: 'CRM + dialer',
    blurb: 'Pipeline, sequences, soft-phone cockpit.',
    href: '/platform#crm',
  },
  {
    group: 'CRM & sales',
    icon: <GitBranch size={16} />,
    title: 'Lead journey',
    blurb: 'Every touch on one timeline.',
    href: '/platform#lead-journey',
  },
  {
    group: 'Marketing',
    icon: <Sparkles size={16} />,
    title: 'AI Marketing Studio',
    blurb: 'Generate creative; retarget; close the loop.',
    href: '/platform#marketing',
  },
  {
    group: 'Money',
    icon: <CircleDollarSign size={16} />,
    title: 'Conversions',
    blurb: 'Donation or sale, one attributed object.',
    href: '/platform#conversions',
  },
  {
    group: 'Money',
    icon: <Wallet size={16} />,
    title: 'Commissions',
    blurb: 'Per-knock / sale / hybrid, daily accrual.',
    href: '/platform#commissions',
  },
  {
    group: 'Money',
    icon: <Banknote size={16} />,
    title: 'Payouts',
    blurb: 'Instruction files — never auto-debits.',
    href: '/platform#payouts',
  },
  {
    group: 'Compliance',
    icon: <FileCheck2 size={16} />,
    title: 'Compliance engine',
    blurb: 'State clearance, cooling-off, DNC, consent.',
    href: '/platform#compliance',
  },
  {
    group: 'Analytics',
    icon: <BarChart3 size={16} />,
    title: 'Reports & analytics',
    blurb: 'Funnel, cohorts, leaderboards, exports.',
    href: '/platform#reports',
  },
  {
    group: 'Enterprise',
    icon: <LayoutDashboard size={16} />,
    title: 'Client portal',
    blurb: 'Invoices, payouts, compliance — self-serve.',
    href: '/platform#partner-portal',
  },
];

export function ModuleGrid(): JSX.Element {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {MODULES.map((m) => (
        <Link
          key={m.title}
          href={m.href}
          className="group card card-pad flex flex-col transition-shadow hover:shadow-[0_1px_0_rgba(15,23,42,0.04),0_18px_36px_-24px_rgba(15,23,42,0.25)]"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accentSoft text-accent">
              {m.icon}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-soft">
              {m.group}
            </span>
          </div>
          <h3 className="mt-3 text-[14px] font-semibold tracking-tight text-ink">{m.title}</h3>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">{m.blurb}</p>
        </Link>
      ))}
    </div>
  );
}

/* ───────────────────────── Included matrix ───────────────────────── */

const INCLUDED: { group: string; items: string[] }[] = [
  {
    group: 'Field operations',
    items: [
      'Native offline-first iOS knocker app',
      'GPS + photo + signature capture',
      'Device-clock + attestation fraud signals',
      'PostGIS territories + draw tools',
      'ACS / SEIFA propensity heatmaps',
      'Live Command Centre + rep map',
      'Roster, shifts + clock-in/out',
      'Do-not-knock address overlay',
    ],
  },
  {
    group: 'CRM & inside sales',
    items: [
      'Lead lifecycle (state machine)',
      'Pipeline kanban + multi-pipeline',
      'Sequences + drip campaigns',
      'Soft-phone dialer cockpit',
      'Smart lists + saved filters',
      'AI lead scoring',
      'Time-in-stage warnings',
      'Team conversations + notes',
    ],
  },
  {
    group: 'Marketing & retargeting',
    items: [
      'AI copy / image / video generation',
      'Meta · Google · TikTok delivery',
      'Hashed retargeting audiences',
      'Brand-safety + legal-hold gates',
      'C2PA provenance manifests',
      'ROAS + attribution dashboard',
      'Landing pages',
      'Per-org AI budget caps',
    ],
  },
  {
    group: 'Conversions & money',
    items: [
      'Polymorphic donation | sale',
      'Recurring + one-off donations',
      '501(c)(3) / DGR tax receipts',
      'Commercial sale + install handoff',
      'Commission plans + crew overrides',
      'Payout instruction files (NACHA/CSV)',
      'MiCamp (US) · Stripe (AU/SG) adapters',
      'Client invoicing with bucketed rake',
    ],
  },
  {
    group: 'Compliance & trust',
    items: [
      'Paid-solicitor state-clearance engine',
      'Cooling-off enforcement timers',
      'DNC / DNK scrub (FTC + FCC + state)',
      'TCPA written consent capture',
      'Hash-chained immutable audit (7yr)',
      'PII vault + dual-control JIT unmask',
      'US · AU · SG data residency',
      'SOC 2 control mapping',
    ],
  },
  {
    group: 'Enterprise & platform',
    items: [
      'SAML SSO (Okta, Azure AD, generic)',
      'White-label brand on web + mobile',
      'Dedicated single-tenant DB option',
      '8-role RBAC + ABAC + WebAuthn',
      'Self-service client portal',
      'Public REST API + signed webhooks',
      'Realtime feeds (live knock / leaderboard)',
      'Multi-region, idempotent by contract',
    ],
  },
];

export function IncludedMatrix(): JSX.Element {
  return (
    <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
      {INCLUDED.map((col) => (
        <div key={col.group}>
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">
            {col.group}
          </div>
          <ul className="mt-3 space-y-2">
            {col.items.map((it) => (
              <li key={it} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accentSoft text-accent">
                  <Check size={11} strokeWidth={3} />
                </span>
                <span className="text-[13px] leading-snug text-ink2">{it}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
