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
  Calendar,
  FileText,
  Globe,
  Heart,
  CheckSquare,
  Workflow,
  FolderOpen,
  CalendarClock,
  CreditCard,
  ShieldCheck,
  ArrowLeft,
  Compass,
  Sparkles,
  Radio,
} from 'lucide-react';
import Link from 'next/link';
import { AppShell, Sidebar, TopBar, type NavGroup } from '@d2d/ui-web';
import { AccountSwitcher } from './AccountSwitcher';
import { getAccount, accountMonogram } from '@/lib/accounts';

interface AccountShellProps {
  accountSlug: string;
  pageTitle?: string;
  children: React.ReactNode;
}

/**
 * Sub-account workspace shell — each business gets its own self-contained
 * command surface inside the Door 2 Digital Command Centre. Structure mirrors
 * across all accounts (charity, commercial, healthcare) so onboarding a new
 * one drops a fully-equipped workspace in. All data inside is scoped to this
 * account only — no cross-account leakage.
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
        { href: `${base}/marketing-studio`, label: 'Marketing Studio', icon: Sparkles },
        { href: `${base}/reports`, label: 'Reports', icon: BarChart3 },
      ],
    },
    {
      label: 'Field ops',
      items: [
        { href: `${base}/live-map`, label: 'Live field map', icon: Radio },
        { href: `${base}/knockers`, label: 'Knockers', icon: MapIcon },
        { href: `${base}/territories`, label: 'Territories', icon: Compass },
        { href: `${base}/roster`, label: 'Roster & shifts', icon: CalendarClock },
        { href: `${base}/knocker-ios`, label: 'Knocker iOS preview', icon: Smartphone },
      ],
    },
    {
      label: 'Operate',
      items: [
        { href: `${base}/calendars`, label: 'Calendars', icon: Calendar },
        { href: `${base}/forms`, label: 'Forms', icon: FileText },
        { href: `${base}/sites`, label: 'Sites & Funnels', icon: Globe },
        { href: `${base}/memberships`, label: 'Memberships', icon: Heart },
        { href: `${base}/tasks`, label: 'Tasks', icon: CheckSquare },
        { href: `${base}/workflows`, label: 'Workflows', icon: Workflow },
        { href: `${base}/files`, label: 'Files', icon: FolderOpen },
      ],
    },
    {
      label: 'Finance & compliance',
      items: [
        { href: `${base}/invoices`, label: 'Invoices', icon: CreditCard },
        { href: `${base}/compliance`, label: 'Compliance', icon: ShieldCheck },
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
          appName={account?.shortName ?? 'Account'}
          appTagline="SUB-ACCOUNT"
          homeHref={`${base}/today`}
          groups={NAV}
          userRole="org_admin"
          footer={
            <>
              <Link
                href="/accounts"
                className="flex items-center gap-1.5 text-[10px] text-accent hover:underline mb-1.5"
              >
                <ArrowLeft size={10} /> Back to Command Centre
              </Link>
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
              <Link
                href="/command-centre"
                className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-muted hover:bg-paper hover:text-ink transition"
                title="Back to Door 2 Digital Command Centre"
              >
                <Compass size={12} /> Command Centre
              </Link>
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
