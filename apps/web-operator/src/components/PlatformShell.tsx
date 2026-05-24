'use client';

/**
 * Door 2 Digital Command Centre — top-level HQ shell.
 *
 * This is the ONE main account Brodie's team logs into. Everything operator-side
 * lives here: portfolio, live field ops, finance, compliance, and the Knocker iOS
 * preview surface. Clicking any account in /accounts drops you into THAT
 * sub-account's self-contained workspace (rendered by AccountShell).
 */
import { useEffect, useState } from 'react';
import {
  Building2,
  CreditCard,
  FileText,
  Scroll,
  ShieldCheck,
  Activity,
  Settings,
  Smartphone,
  Radio,
  CalendarClock,
  Map,
  Target,
  UserPlus,
  Image as ImageIcon,
  Globe2,
  Sparkles,
  Wand2,
  Megaphone,
  ExternalLink,
  Plug,
} from 'lucide-react';
import { AppShell, Sidebar, TopBar, type NavGroup } from '@d2d/ui-web';

const NAV: NavGroup[] = [
  {
    label: 'Portfolio',
    items: [
      { href: '/accounts', label: 'All accounts', icon: Building2 },
      { href: '/onboard-account', label: 'Onboard new business', icon: UserPlus },
    ],
  },
  {
    label: 'Field ops',
    items: [
      { href: '/command-centre', label: 'Live field map', icon: Radio },
      { href: '/territory-intel', label: 'Territory intel', icon: Map },
      { href: '/roster', label: 'Roster & shifts', icon: CalendarClock },
      { href: '/planning', label: 'Planning', icon: Target },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/billing', label: 'Billing & invoices', icon: CreditCard },
      { href: '/billing/processor', label: 'Processor (MiCamp)', icon: FileText },
    ],
  },
  {
    label: 'Compliance & audit',
    items: [
      { href: '/compliance', label: 'Compliance', icon: ShieldCheck },
      { href: '/compliance/state-clearance', label: 'State clearance', icon: ShieldCheck },
      { href: '/audit', label: 'Audit log', icon: Scroll },
    ],
  },
  {
    label: 'Field app',
    items: [{ href: '/mobile-preview', label: 'Knocker iOS preview', icon: Smartphone }],
  },
  {
    label: 'Marketing Studio',
    items: [
      { href: '/marketing-studio', label: 'Overview', icon: Sparkles },
      { href: '/marketing-studio/generate', label: 'Generator', icon: Wand2 },
      { href: '/marketing-studio/library', label: 'Library', icon: ImageIcon },
      { href: '/marketing-studio/campaigns', label: 'Campaigns', icon: Megaphone },
      { href: '/marketing-studio/brand-safety', label: 'Brand safety', icon: ShieldCheck },
      { href: '/marketing-studio/retargeting', label: 'Retargeting', icon: Target },
      { href: '/marketing-studio/integrations', label: 'Integrations', icon: Plug },
    ],
  },
  {
    label: 'Regions',
    items: [
      { href: '/regions/au', label: 'AU · operations', icon: Globe2 },
      { href: '/regions/au/compliance', label: 'AU · compliance', icon: ShieldCheck },
      { href: '/regions/au/payments', label: 'AU · payments', icon: CreditCard },
      { href: '/regions/au/territory-intel', label: 'AU · territory intel', icon: Map },
      { href: '/regions/sg', label: 'SG · operations', icon: Globe2 },
      { href: '/regions/sg/compliance', label: 'SG · compliance', icon: ShieldCheck },
      { href: '/regions/sg/payments', label: 'SG · payments', icon: CreditCard },
      { href: '/regions/sg/territory-intel', label: 'SG · territory intel', icon: Map },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/public', label: 'Public site', icon: ExternalLink },
      { href: '/screens', label: 'Screens gallery', icon: ImageIcon, roles: ['super_admin'] },
      { href: '/ops/health', label: 'System health', icon: Activity, roles: ['super_admin'] },
      { href: '/settings', label: 'Platform settings', icon: Settings, roles: ['super_admin'] },
    ],
  },
];

type RegionFilter = 'ALL' | 'US' | 'AU' | 'SG';
const REGION_CHOICES: { value: RegionFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'US', label: 'US' },
  { value: 'AU', label: 'AU' },
  { value: 'SG', label: 'SG' },
];

function RegionToggle(): JSX.Element {
  const [region, setRegion] = useState<RegionFilter>('ALL');

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('d2d.region');
      if (raw === 'ALL' || raw === 'US' || raw === 'AU' || raw === 'SG') {
        setRegion(raw);
      }
    } catch {
      // ignore
    }
  }, []);

  function pick(next: RegionFilter): void {
    setRegion(next);
    try {
      window.localStorage.setItem('d2d.region', next);
    } catch {
      // ignore
    }
  }

  return (
    <div
      className="hidden md:inline-flex items-center gap-0.5 p-0.5 rounded-full border border-line2 bg-paper"
      role="group"
      aria-label="Region filter"
    >
      {REGION_CHOICES.map((choice) => {
        const active = choice.value === region;
        return (
          <button
            key={choice.value}
            type="button"
            onClick={() => pick(choice.value)}
            className={
              active
                ? 'text-[10.5px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-ink text-surface transition'
                : 'text-[10.5px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full text-muted hover:text-ink transition'
            }
            aria-pressed={active}
          >
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}

interface PlatformShellProps {
  children: React.ReactNode;
  pageTitle?: string;
}

export function PlatformShell({ children, pageTitle }: PlatformShellProps): JSX.Element {
  return (
    <AppShell
      sidebar={
        <Sidebar
          appName="Door 2 Digital"
          appTagline="COMMAND CENTRE"
          homeHref="/command-centre"
          groups={NAV}
          userRole="super_admin"
          footer={
            <>
              <div>v0.5.0 · {process.env.NEXT_PUBLIC_ENV ?? 'local'}</div>
              <div className="truncate">brodie@door2digital.com</div>
            </>
          }
        />
      }
      topBar={
        <TopBar
          title={pageTitle}
          env={process.env.NEXT_PUBLIC_ENV ?? 'local'}
          rightSlot={
            <div className="flex items-center gap-3">
              <RegionToggle />
              <div className="flex items-center gap-2">
                <span className="mono">BR</span>
                <div className="text-xs leading-tight hidden sm:block">
                  <div className="font-medium text-ink truncate max-w-[180px]">Brodie</div>
                  <div className="text-muted text-[10px] uppercase tracking-wider">super_admin</div>
                </div>
              </div>
            </div>
          }
        />
      }
    >
      {children}
    </AppShell>
  );
}
