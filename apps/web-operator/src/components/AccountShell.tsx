'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  Target,
  LogOut,
} from 'lucide-react';
import Link from 'next/link';
import { AppShell, Sidebar, TopBar, Reveal, type NavGroup } from '@d2d/ui-web';
import { AccountSwitcher } from './AccountSwitcher';
import { getAccount, accountMonogram } from '@/lib/accounts';

interface SessionUser {
  userId: string;
  email: string;
  role: string;
  initials: string;
  givenName: string;
  demo: boolean;
}

function useSession(): SessionUser | null {
  const [user, setUser] = useState<SessionUser | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/session/me', { credentials: 'include' })
      .then(async (r) => (r.ok ? ((await r.json()) as { session: SessionUser }) : null))
      .then((data) => {
        if (!cancelled && data) setUser(data.session);
      })
      .catch(() => {
        // ignore
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return user;
}

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
  const router = useRouter();
  const user = useSession();
  const [signingOut, setSigningOut] = useState(false);
  async function signOut(): Promise<void> {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch('/api/session/logout', { method: 'POST', credentials: 'include' });
    } finally {
      router.push('/login');
      router.refresh();
    }
  }

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
        { href: `${base}/planning`, label: 'Planning', icon: Target },
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
    <>
      {/* Per-account brand accent — 2px stripe in the account's avatarBg
          colour, painted across the very top of the viewport. Free brand
          differentiator: a screenshot of Hope Forward vs PestMax vs World
          Vision instantly reads as different products. */}
      {account?.avatarBg && (
        <div
          aria-hidden
          className="fixed top-0 left-0 right-0 z-[60] h-[2px] pointer-events-none"
          style={{ background: account.avatarBg }}
        />
      )}
      <AppShell
        sidebar={
          <AccountSidebarReveal key={accountSlug}>
            <Sidebar
              appName={account?.shortName ?? 'Account'}
              appTagline="SUB-ACCOUNT"
              homeHref={`${base}/today`}
              groups={NAV}
              userRole={(user?.role as 'org_admin') ?? 'org_admin'}
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
          </AccountSidebarReveal>
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
                <span className="mono" aria-label="Signed-in user initials">
                  {user?.initials ?? '··'}
                </span>
                {user && (
                  <div className="hidden md:block text-[10.5px] leading-tight">
                    <div className="font-medium text-ink truncate max-w-[120px]">
                      {user.givenName}
                    </div>
                    <div className="text-muted uppercase tracking-wider text-[9.5px]">
                      {user.role}
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => void signOut()}
                  disabled={signingOut}
                  title="Sign out"
                  className="w-8 h-8 rounded-md hover:bg-paper flex items-center justify-center text-soft hover:text-ink transition disabled:opacity-50"
                >
                  <LogOut size={14} />
                </button>
              </div>
            }
          />
        }
      >
        {children}
      </AppShell>
    </>
  );
}

/**
 * Sub-account sidebar entry transition — slides in from the left by 12px and
 * fades in over 280ms when the user drops into a new account context. Keyed
 * by `accountSlug` upstream so React remounts the wrapper per account entry,
 * making the motion read as "you entered a new context" rather than constant
 * decoration. Respects prefers-reduced-motion.
 */
function AccountSidebarReveal({ children }: { children: React.ReactNode }): JSX.Element {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Defer one frame so the initial 0/-12 paints before transitioning.
    const t = window.setTimeout(() => setMounted(true), 16);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div
      className={`transition-[opacity,transform] duration-[280ms] ease-out motion-reduce:transition-none motion-reduce:transform-none motion-reduce:opacity-100 h-full ${
        mounted ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-3'
      }`}
    >
      {children}
    </div>
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
