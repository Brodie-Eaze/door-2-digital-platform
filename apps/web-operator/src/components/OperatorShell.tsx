'use client';

import {
  LayoutDashboard,
  Briefcase,
  CreditCard,
  Scroll,
  ShieldCheck,
  Activity,
  Settings,
  Bell,
  Users,
  Tags,
  KeyRound,
  Database,
  Map,
  Megaphone,
} from 'lucide-react';
import { AppShell, Sidebar, TopBar, type NavGroup } from '@d2d/ui-web';

const NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ href: '/overview', label: 'Cross-org overview', icon: LayoutDashboard }],
  },
  {
    label: 'Tenants',
    items: [
      { href: '/orgs', label: 'Client orgs', icon: Briefcase },
      { href: '/orgs/provisioning', label: 'Provisioning queue', icon: Users },
    ],
  },
  {
    label: 'Field operations',
    items: [
      { href: '/territories', label: 'Territories', icon: Map },
      { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
    ],
  },
  {
    label: 'Revenue',
    items: [
      { href: '/billing', label: 'Billing & invoices', icon: CreditCard },
      { href: '/billing/processor', label: 'MiCamp residuals', icon: CreditCard },
    ],
  },
  {
    label: 'Governance',
    items: [
      { href: '/audit', label: 'Audit log', icon: Scroll },
      { href: '/compliance', label: 'Compliance', icon: ShieldCheck },
      { href: '/compliance/state-clearance', label: 'State clearance', icon: ShieldCheck },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/alerts', label: 'Alerts', icon: Bell },
      { href: '/ops/health', label: 'System health', icon: Activity },
      { href: '/ops/data-sources', label: 'Data sources', icon: Database },
    ],
  },
  {
    label: 'Admin',
    items: [
      { href: '/admin/users', label: 'Operator users', icon: Users, roles: ['super_admin'] },
      { href: '/admin/secrets', label: 'Secrets inventory', icon: KeyRound, roles: ['super_admin'] },
      { href: '/admin/plans', label: 'Pricing config', icon: Tags, roles: ['super_admin'] },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

interface OperatorShellProps {
  children: React.ReactNode;
  /** Page title shown in topbar. */
  pageTitle?: string;
}

export function OperatorShell({ children, pageTitle }: OperatorShellProps): JSX.Element {
  // TODO Phase 1.1: replace with real user from session/auth context.
  const userRole = 'super_admin';
  const userEmail = 'brodie@door2digital.io';
  const env = process.env.NEXT_PUBLIC_ENV ?? 'local';

  return (
    <AppShell
      sidebar={
        <Sidebar
          appName="Door 2 Digital"
          appTagline="OPERATOR"
          homeHref="/overview"
          groups={NAV}
          userRole={userRole}
          footer={
            <>
              <div>v0.1.0 · {env}</div>
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
              <span className="mono">{userEmail.slice(0, 2).toUpperCase()}</span>
              <div className="text-xs leading-tight hidden sm:block">
                <div className="font-medium text-ink truncate max-w-[180px]">{userEmail}</div>
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
