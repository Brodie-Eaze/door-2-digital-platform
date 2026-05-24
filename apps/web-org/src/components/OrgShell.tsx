'use client';

import {
  Activity,
  BarChart3,
  Bell,
  CreditCard,
  DollarSign,
  Inbox,
  Kanban,
  LayoutDashboard,
  Map,
  Megaphone,
  Phone,
  Settings,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Wallet,
  Workflow,
} from 'lucide-react';
import { AppShell, Sidebar, TopBar, type NavGroup } from '@d2d/ui-web';

const NAV: NavGroup[] = [
  { label: 'Daily', items: [{ href: '/today', label: 'Today', icon: LayoutDashboard }] },
  {
    label: 'Field',
    items: [
      { href: '/territories', label: 'Territories', icon: Map },
      { href: '/knockers', label: 'Knockers', icon: Users },
      { href: '/marketing', label: 'Campaigns', icon: Megaphone },
    ],
  },
  {
    label: 'Pipeline',
    items: [
      { href: '/leads', label: 'Leads', icon: Inbox },
      { href: '/pipeline', label: 'Pipeline', icon: Kanban },
      { href: '/inside-sales', label: 'Inside sales', icon: Phone },
    ],
  },
  {
    label: 'Marketing studio',
    items: [{ href: '/marketing/studio', label: 'AI creative', icon: Sparkles }],
  },
  {
    label: 'Revenue',
    items: [
      { href: '/conversions', label: 'Conversions', icon: DollarSign },
      { href: '/commissions', label: 'Commissions', icon: Trophy },
      { href: '/payouts', label: 'Payouts', icon: Wallet },
      { href: '/billing', label: 'Billing', icon: CreditCard },
    ],
  },
  {
    label: 'Insights',
    items: [
      { href: '/reports', label: 'Reports', icon: BarChart3 },
      { href: '/alerts', label: 'Alerts', icon: Bell },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/compliance', label: 'Compliance', icon: ShieldCheck },
      { href: '/automations', label: 'Automations', icon: Workflow },
      { href: '/health', label: 'System health', icon: Activity, roles: ['org_admin'] },
      { href: '/settings', label: 'Settings', icon: Settings, roles: ['org_admin'] },
    ],
  },
];

interface OrgShellProps {
  children: React.ReactNode;
  pageTitle?: string;
}

export function OrgShell({ children, pageTitle }: OrgShellProps): JSX.Element {
  const userRole = 'org_admin';
  const userEmail = 'sarah@hopeforward.org';
  const env = process.env.NEXT_PUBLIC_ENV ?? 'local';

  return (
    <AppShell
      sidebar={
        <Sidebar
          appName="Hope Forward"
          appTagline="FIELD OPS"
          homeHref="/today"
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
              <span className="mono">SH</span>
              <div className="text-xs leading-tight hidden sm:block">
                <div className="font-medium text-ink truncate max-w-[180px]">Sarah Harris</div>
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
