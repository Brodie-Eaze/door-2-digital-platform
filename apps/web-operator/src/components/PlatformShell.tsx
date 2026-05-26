'use client';

/**
 * Door 2 Digital Command Centre — top-level HQ shell.
 *
 * This is the ONE main account Brodie's team logs into. Everything operator-side
 * lives here: portfolio, live field ops, finance, compliance, and the Knocker iOS
 * preview surface. Clicking any account in /accounts drops you into THAT
 * sub-account's self-contained workspace (rendered by AccountShell).
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  CreditCard,
  FileText,
  Scroll,
  ShieldCheck,
  Activity,
  Settings,
  Smartphone,
  Radio,
  CalendarClock,
  Map,
  Target,
  UserPlus,
  Image as ImageIcon,
  Globe2,
  Sparkles,
  Wand2,
  Megaphone,
  ExternalLink,
  Plug,
  LogOut,
} from 'lucide-react';
import { AppShell, Sidebar, TopBar, type NavGroup } from '@d2d/ui-web';

interface SessionUser {
  userId: string;
  email: string;
  role: string;
  initials: string;
  givenName: string;
  demo: boolean;
}

const NAV: NavGroup[] = [
  {
    label: 'Portfolio',
    items: [
      { href: '/accounts', label: 'All accounts', icon: Building2 },
      { href: '/onboard-account', label: 'Onboard new business', icon: UserPlus },
    ],
  },
  {
    label: 'Field ops',
    items: [
      { href: '/command-centre', label: 'Live field map', icon: Radio },
      { href: '/territory-intel', label: 'Territory intel', icon: Map },
      { href: '/roster', label: 'Roster & shifts', icon: CalendarClock },
      { href: '/planning', label: 'Planning', icon: Target },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/billing', label: 'Billing & invoices', icon: CreditCard },
      { href: '/billing/processor', label: 'Processor (MiCamp)', icon: FileText },
    ],
  },
  {
    label: 'Compliance & audit',
    items: [
      { href: '/compliance', label: 'Compliance', icon: ShieldCheck },
      { href: '/compliance/state-clearance', label: 'State clearance', icon: ShieldCheck },
      { href: '/audit', label: 'Audit log', icon: Scroll },
    ],
  },
  {
    label: 'Field app',
    items: [{ href: '/mobile-preview', label: 'Knocker iOS preview', icon: Smartphone }],
  },
  {
    label: 'Marketing Studio',
    items: [
      { href: '/marketing-studio', label: 'Overview', icon: Sparkles },
      { href: '/marketing-studio/generate', label: 'Generator', icon: Wand2 },
      { href: '/marketing-studio/library', label: 'Library', icon: ImageIcon },
      { href: '/marketing-studio/campaigns', label: 'Campaigns', icon: Megaphone },
      { href: '/marketing-studio/brand-safety', label: 'Brand safety', icon: ShieldCheck },
      { href: '/marketing-studio/retargeting', label: 'Retargeting', icon: Target },
      { href: '/marketing-studio/integrations', label: 'Integrations', icon: Plug },
    ],
  },
  {
    label: 'Regions',
    items: [
      { href: '/regions/au', label: 'AU · operations', icon: Globe2 },
      { href: '/regions/au/compliance', label: 'AU · compliance', icon: ShieldCheck },
      { href: '/regions/au/payments', label: 'AU · payments', icon: CreditCard },
      { href: '/regions/au/territory-intel', label: 'AU · territory intel', icon: Map },
      { href: '/regions/sg', label: 'SG · operations', icon: Globe2 },
      { href: '/regions/sg/compliance', label: 'SG · compliance', icon: ShieldCheck },
      { href: '/regions/sg/payments', label: 'SG · payments', icon: CreditCard },
      { href: '/regions/sg/territory-intel', label: 'SG · territory intel', icon: Map },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/public', label: 'Public site', icon: ExternalLink },
      { href: '/screens', label: 'Screens gallery', icon: ImageIcon, roles: ['super_admin'] },
      { href: '/ops/health', label: 'System health', icon: Activity, roles: ['super_admin'] },
      { href: '/settings', label: 'Platform settings', icon: Settings, roles: ['super_admin'] },
    ],
  },
];

type RegionFilter = 'ALL' | 'US' | 'AU' | 'SG';
const REGION_CHOICES: { value: RegionFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'US', label: 'US' },
  { value: 'AU', label: 'AU' },
  { value: 'SG', label: 'SG' },
];

function RegionToggle(): JSX.Element {
  const [region, setRegion] = useState<RegionFilter>('ALL');

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('d2d.region');
      if (raw === 'ALL' || raw === 'US' || raw === 'AU' || raw === 'SG') {
        setRegion(raw);
      }
    } catch {
      // ignore
    }
  }, []);

  function pick(next: RegionFilter): void {
    setRegion(next);
    try {
      window.localStorage.setItem('d2d.region', next);
    } catch {
      // ignore
    }
  }

  return (
    <div
      className="hidden md:inline-flex items-center gap-0.5 p-0.5 rounded-full border border-line2 bg-paper"
      role="group"
      aria-label="Region filter"
    >
      {REGION_CHOICES.map((choice) => {
        const active = choice.value === region;
        return (
          <button
            key={choice.value}
            type="button"
            onClick={() => pick(choice.value)}
            className={
              active
                ? 'text-[10.5px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-ink text-surface transition'
                : 'text-[10.5px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full text-muted hover:text-ink transition'
            }
            aria-pressed={active}
          >
            {choice.label}
          </button>
        );
      })}
    </div>
  );
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
        // ignore — middleware handles unauth redirect
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return user;
}

function UserBadge({ user }: { user: SessionUser | null }): JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function signOut(): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      await fetch('/api/session/logout', { method: 'POST', credentials: 'include' });
    } finally {
      router.push('/login');
      router.refresh();
    }
  }
  const initials = user?.initials ?? '··';
  const name = user?.givenName ?? '—';
  const role = user?.role ?? 'viewer';
  return (
    <div className="flex items-center gap-2">
      <span className="mono" aria-hidden>
        {initials}
      </span>
      <div className="text-xs leading-tight hidden sm:block">
        <div className="font-medium text-ink truncate max-w-[180px]">{name}</div>
        <div className="text-muted text-[10px] uppercase tracking-wider">{role}</div>
      </div>
      <button
        type="button"
        onClick={() => void signOut()}
        disabled={busy}
        title="Sign out"
        className="ml-1 w-8 h-8 rounded-md hover:bg-paper flex items-center justify-center text-soft hover:text-ink transition disabled:opacity-50"
      >
        <LogOut size={14} />
      </button>
    </div>
  );
}

interface PlatformShellProps {
  children: React.ReactNode;
  pageTitle?: string;
}

export function PlatformShell({ children, pageTitle }: PlatformShellProps): JSX.Element {
  const user = useSession();
  const sidebarEmail = user?.email ?? 'brodie@door2digital.com';
  return (
    <AppShell
      sidebar={
        <Sidebar
          appName="Door 2 Digital"
          appTagline="COMMAND CENTRE"
          homeHref="/command-centre"
          groups={NAV}
          userRole={(user?.role as 'super_admin') ?? 'super_admin'}
          footer={
            <>
              <div>v0.5.0 · {process.env.NEXT_PUBLIC_ENV ?? 'local'}</div>
              <div className="truncate">{sidebarEmail}</div>
              {user?.demo && (
                <div className="text-amber-700 mt-0.5 text-[9.5px] uppercase tracking-wider">
                  Demo session
                </div>
              )}
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
              <RegionToggle />
              <UserBadge user={user} />
            </div>
          }
        />
      }
    >
      {children}
    </AppShell>
  );
}
