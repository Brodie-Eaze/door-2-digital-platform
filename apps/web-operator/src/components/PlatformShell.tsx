'use client';

/**
 * Door 2 Digital Command Centre — top-level HQ shell.
 *
 * This is the ONE main account Brodie's team logs into. Everything operator-side
 * lives here: portfolio, live field ops, finance, compliance, and the Knocker iOS
 * preview surface. Clicking any account in /accounts drops you into THAT
 * sub-account's self-contained workspace (rendered by AccountShell).
 */
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
    label: 'System',
    items: [
      { href: '/screens', label: 'Screens gallery', icon: ImageIcon, roles: ['super_admin'] },
      { href: '/ops/health', label: 'System health', icon: Activity, roles: ['super_admin'] },
      { href: '/settings', label: 'Platform settings', icon: Settings, roles: ['super_admin'] },
    ],
  },
];

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
            <div className="flex items-center gap-2">
              <span className="mono">BR</span>
              <div className="text-xs leading-tight hidden sm:block">
                <div className="font-medium text-ink truncate max-w-[180px]">Brodie</div>
                <div className="text-muted text-[10px] uppercase tracking-wider">super_admin</div>
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
