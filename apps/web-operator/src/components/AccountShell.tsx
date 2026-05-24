'use client';

import {
  LayoutDashboard,
  MessageCircle,
  Inbox,
  Kanban,
  ListChecks,
  Megaphone,
  Phone,
  BarChart3,
  Users,
  Settings,
  Bell,
  Search,
  Smartphone,
  Map as MapIcon,
} from 'lucide-react';
import { AppShell, Sidebar, TopBar, type NavGroup } from '@d2d/ui-web';
import { AccountSwitcher } from './AccountSwitcher';
import { getAccount, accountMonogram } from '@/lib/accounts';

interface AccountShellProps {
  accountSlug: string;
  pageTitle?: string;
  children: React.ReactNode;
}

/**
 * Consolidated GHL-style nav — 9 items grouped into single-line groups.
 * Matches Brodie's brief: simplified IA so the sales team can navigate fast.
 */
export function AccountShell({ accountSlug, pageTitle, children }: AccountShellProps): JSX.Element {
  const account = getAccount(accountSlug);
  const base = `/accounts/${accountSlug}`;

  const NAV: NavGroup[] = [
    {
      label: 'Overview',
      items: [
        { href: `${base}/today`, label: 'Dashboard', icon: LayoutDashboard },
        { href: `${base}/conversations`, label: 'Conversations', icon: MessageCircle },
      ],
    },
    {
      label: 'Contacts',
      items: [
        { href: `${base}/leads`, label: 'Leads inbox', icon: Inbox },
        { href: `${base}/smart-lists`, label: 'Smart Lists', icon: ListChecks },
        { href: `${base}/pipeline`, label: 'Pipeline', icon: Kanban },
        { href: `${base}/inside-sales`, label: 'Calls', icon: Phone },
      ],
    },
    {
      label: 'Growth',
      items: [
        { href: `${base}/campaigns`, label: 'Marketing', icon: Megaphone },
        { href: `${base}/reports`, label: 'Reports', icon: BarChart3 },
      ],
    },
    {
      label: 'Field ops',
      items: [
        { href: `${base}/knockers`, label: 'Knockers', icon: MapIcon },
        { href: `${base}/knocker-ios`, label: 'Knocker iOS preview', icon: Smartphone },
      ],
    },
    {
      label: 'Workspace',
      items: [
        { href: `${base}/team`, label: 'Team', icon: Users },
        { href: `${base}/settings`, label: 'Settings', icon: Settings, roles: ['org_admin'] },
      ],
    },
  ];

  return (
    <AppShell
      sidebar={
        <Sidebar
          appName="Door 2 Digital OS"
          appTagline={account?.shortName.toUpperCase() ?? 'ACCOUNT'}
          homeHref={`${base}/today`}
          groups={NAV}
          userRole="org_admin"
          footer={
            <>
              <div className="flex items-center gap-2">
                {account && <Monogram letters={accountMonogram(account.shortName)} small />}
                <span>{account?.shortName}</span>
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
              <button
                className="w-8 h-8 rounded-md hover:bg-paper flex items-center justify-center"
                title="Search"
              >
                <Search size={16} className="text-soft" />
              </button>
              <AccountSwitcher currentSlug={accountSlug} />
              <button
                className="w-8 h-8 rounded-md hover:bg-paper flex items-center justify-center"
                title="Notifications"
              >
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

function Monogram({ letters, small }: { letters: string; small?: boolean }): JSX.Element {
  return (
    <span
      className="inline-flex items-center justify-center rounded bg-ink text-surface font-semibold tracking-tight"
      style={{
        width: small ? 16 : 20,
        height: small ? 16 : 20,
        fontSize: small ? 8 : 10,
      }}
    >
      {letters}
    </span>
  );
}
