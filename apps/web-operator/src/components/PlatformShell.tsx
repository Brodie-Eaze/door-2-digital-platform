'use client';

/**
 * Top-level platform shell — used for the NoctuaOS home and global pages
 * (accounts list, billing, audit, compliance, screens gallery, settings).
 * Renamed from OperatorShell to reflect that this is the team-wide CRM
 * not just an admin tool.
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
} from 'lucide-react';
import { AppShell, Sidebar, TopBar, type NavGroup } from '@d2d/ui-web';

const NAV: NavGroup[] = [
  {
    label: 'Portfolio',
    items: [{ href: '/accounts', label: 'All accounts', icon: Building2 }],
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
      { href: '/mobile-preview', label: 'NoctuaOS app preview', icon: Smartphone },
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
          appName="NoctuaOS"
          appTagline="HQ"
          homeHref="/accounts"
          groups={NAV}
          userRole="super_admin"
          footer={
            <>
              <div>v0.3.0 · {process.env.NEXT_PUBLIC_ENV ?? 'local'}</div>
              <div className="truncate">brodie@noctuaos.com</div>
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
