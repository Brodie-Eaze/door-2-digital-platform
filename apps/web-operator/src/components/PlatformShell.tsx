'use client';

/**
 * Door 2 Digital OS — top-level HQ shell.
 * The Command Centre your team logs into. Cross-account views live here.
 */
import {
  Building2,
  CreditCard,
  Scroll,
  ShieldCheck,
  Activity,
  Settings,
  Image as ImageIcon,
  Smartphone,
  Radio,
  CalendarClock,
  Map,
  Target,
} from 'lucide-react';
import { AppShell, Sidebar, TopBar, type NavGroup } from '@d2d/ui-web';

const NAV: NavGroup[] = [
  {
    label: 'Portfolio',
    items: [{ href: '/accounts', label: 'All accounts', icon: Building2 }],
  },
  {
    label: 'Command Centre',
    items: [
      { href: '/command-centre', label: 'Live field map', icon: Radio },
      { href: '/territory-intel', label: 'Territory intel', icon: Map },
      { href: '/roster', label: 'Roster & shifts', icon: CalendarClock },
      { href: '/planning', label: 'Planning', icon: Target },
    ],
  },
  {
    label: 'Cross-account',
    items: [
      { href: '/billing', label: 'Billing & invoices', icon: CreditCard },
      { href: '/audit', label: 'Audit log', icon: Scroll },
      { href: '/compliance', label: 'Compliance', icon: ShieldCheck },
    ],
  },
  {
    label: 'Design',
    items: [
      { href: '/screens', label: 'Screens gallery', icon: ImageIcon },
      { href: '/mobile-preview', label: 'Knocker iOS preview', icon: Smartphone },
    ],
  },
  {
    label: 'System',
    items: [
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
          appTagline="HQ · COMMAND CENTRE"
          homeHref="/accounts"
          groups={NAV}
          userRole="super_admin"
          footer={
            <>
              <div>v0.4.0 · {process.env.NEXT_PUBLIC_ENV ?? 'local'}</div>
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
