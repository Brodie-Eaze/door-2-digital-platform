'use client';

import {
  BarChart3,
  FileText,
  LayoutDashboard,
  Palette,
  Shield,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { AppShell, Sidebar, TopBar, type NavGroup } from '@d2d/ui-web';

const NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Billing',
    items: [
      { href: '/invoices', label: 'Invoices', icon: FileText },
      { href: '/payouts', label: 'Payout statements', icon: Wallet },
    ],
  },
  {
    label: 'Performance',
    items: [{ href: '/conversions', label: 'Conversions', icon: BarChart3 }],
  },
  {
    label: 'Compliance',
    items: [{ href: '/compliance', label: 'State clearances', icon: ShieldCheck }],
  },
  {
    label: 'Settings',
    items: [
      { href: '/settings/brand', label: 'Brand kit', icon: Palette },
      { href: '/settings/sso', label: 'SSO / SAML', icon: Shield },
    ],
  },
];

interface PartnerShellProps {
  children: React.ReactNode;
  pageTitle?: string;
}

export function PartnerShell({ children, pageTitle }: PartnerShellProps): JSX.Element {
  const userRole = 'org_admin';
  const userEmail = 'mike@pilotcharlie.org';
  const env = process.env.NEXT_PUBLIC_ENV ?? 'local';

  return (
    <AppShell
      sidebar={
        <Sidebar
          appName="Pilot-Charlie"
          appTagline="PARTNER PORTAL"
          homeHref="/dashboard"
          groups={NAV}
          userRole={userRole}
          footer={
            <>
              <div>powered by D2D · {env}</div>
              <div className="truncate">{userEmail}</div>
            </>
          }
        />
      }
      topBar={
        <TopBar
          title={pageTitle}
          env={env}
          rightSlot={
            <div className="flex items-center gap-2">
              <span className="mono">MC</span>
              <div className="text-xs leading-tight hidden sm:block">
                <div className="font-medium text-ink truncate max-w-[180px]">Mike Chen</div>
                <div className="text-muted text-[10px] uppercase tracking-wider">{userRole}</div>
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
