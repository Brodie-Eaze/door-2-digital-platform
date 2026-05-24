'use client';

import {
  LayoutDashboard,
  Users,
  Map,
  Inbox,
  Kanban,
  ListChecks,
  Megaphone,
  MailPlus,
  Phone,
  DollarSign,
  Trophy,
  Sparkles,
  Workflow,
  Settings,
  Bell,
} from 'lucide-react';
import { AppShell, Sidebar, TopBar, type NavGroup } from '@d2d/ui-web';
import { AccountSwitcher } from './AccountSwitcher';
import { getAccount } from '@/lib/accounts';

interface AccountShellProps {
  accountSlug: string;
  pageTitle?: string;
  children: React.ReactNode;
}

export function AccountShell({ accountSlug, pageTitle, children }: AccountShellProps): JSX.Element {
  const account = getAccount(accountSlug);
  const base = `/accounts/${accountSlug}`;

  const NAV: NavGroup[] = [
    {
      label: 'Mission control',
      items: [{ href: `${base}/today`, label: 'Today', icon: LayoutDashboard }],
    },
    {
      label: 'Field',
      items: [
        { href: `${base}/noctuas`, label: 'Noctuas', icon: Users },
        { href: `${base}/territories`, label: 'Territories', icon: Map },
      ],
    },
    {
      label: 'CRM',
      items: [
        { href: `${base}/leads`, label: 'Leads inbox', icon: Inbox },
        { href: `${base}/pipeline`, label: 'Pipeline (drag-drop)', icon: Kanban },
        { href: `${base}/lead-lists`, label: 'Smart lead lists', icon: ListChecks },
        { href: `${base}/inside-sales`, label: 'Inside sales dialer', icon: Phone },
      ],
    },
    {
      label: 'Marketing',
      items: [
        { href: `${base}/campaigns`, label: 'Campaigns', icon: Megaphone },
        { href: `${base}/drip`, label: 'Email drips', icon: MailPlus },
        { href: `${base}/marketing-studio`, label: 'AI creative studio', icon: Sparkles },
      ],
    },
    {
      label: 'Revenue',
      items: [
        { href: `${base}/conversions`, label: 'Conversions', icon: DollarSign },
        { href: `${base}/commissions`, label: 'Commissions', icon: Trophy },
      ],
    },
    {
      label: 'Ops',
      items: [
        { href: `${base}/automations`, label: 'Automations', icon: Workflow },
        { href: `${base}/settings`, label: 'Settings', icon: Settings, roles: ['org_admin'] },
      ],
    },
  ];

  return (
    <AppShell
      sidebar={
        <Sidebar
          appName="NoctuaOS"
          appTagline={account?.shortName.toUpperCase() ?? 'ACCOUNT'}
          homeHref={`${base}/today`}
          groups={NAV}
          userRole="org_admin"
          footer={
            <>
              <div>
                {account?.logo} {account?.shortName}
              </div>
              <div className="text-soft">
                {account?.vertical} · {account?.region}
              </div>
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
              <AccountSwitcher currentSlug={accountSlug} />
              <button className="w-8 h-8 rounded-md hover:bg-paper flex items-center justify-center">
                <Bell size={16} className="text-soft" />
              </button>
              <span className="mono">BR</span>
            </div>
          }
        />
      }
    >
      {children}
    </AppShell>
  );
}
