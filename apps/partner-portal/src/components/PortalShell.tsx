'use client';

import {
  KeyRound,
  LayoutDashboard,
  Palette,
  PieChart,
  Receipt,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { AppShell, Sidebar, TopBar, type NavGroup } from '@d2d/ui-web';

const NAV: NavGroup[] = [
  { label: 'Overview', items: [{ href: '/', label: 'Overview', icon: LayoutDashboard }] },
  {
    label: 'Billing',
    items: [
      { href: '/invoices', label: 'Invoices', icon: Receipt },
      { href: '/payouts', label: 'Payout statements', icon: Wallet },
    ],
  },
  {
    label: 'Performance',
    items: [{ href: '/attribution', label: 'Attribution', icon: PieChart }],
  },
  {
    label: 'Compliance',
    items: [{ href: '/state-clearance', label: 'State clearance', icon: ShieldCheck }],
  },
  {
    label: 'Configuration',
    items: [
      { href: '/brand-kit', label: 'Brand kit', icon: Palette },
      { href: '/sso', label: 'SSO / SAML', icon: KeyRound },
    ],
  },
];

interface PortalShellProps {
  children: React.ReactNode;
  pageTitle?: string;
  /** Org trading name — always derived server-side from the session, never hardcoded. */
  orgName: string;
  /** Signed-in user, for the top-bar identity chip. */
  userName: string;
  userEmail: string;
  userRole: string;
}

export function PortalShell({
  children,
  pageTitle,
  orgName,
  userName,
  userEmail,
  userRole,
}: PortalShellProps): JSX.Element {
  const env = process.env.NEXT_PUBLIC_ENV ?? 'local';
  const initials = userName
    .split(' ')
    .map((w) => w.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <AppShell
      sidebar={
        <Sidebar
          appName={orgName}
          appTagline="PARTNER PORTAL"
          homeHref="/"
          groups={NAV}
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
              <span className="mono">{initials}</span>
              <div className="text-xs leading-tight hidden sm:block">
                <div className="font-medium text-ink truncate max-w-[180px]">{userName}</div>
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
