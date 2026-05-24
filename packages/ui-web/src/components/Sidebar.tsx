'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /**
   * If set, only users with these roles see this item.
   * Server still enforces; sidebar just hides routes that would 403.
   */
  roles?: string[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

interface SidebarProps {
  /** App display name (e.g. 'Door 2 Digital', 'Operator Console'). */
  appName: string;
  /** Small tagline shown beneath (e.g. 'OPERATOR', 'KNOCKER OPS'). */
  appTagline?: string;
  /** Nav groups; filtered by `userRole`. */
  groups: NavGroup[];
  /** Current user role for role-based filtering. */
  userRole?: string;
  /** Optional footer content (version, email, env). */
  footer?: React.ReactNode;
  /** Home href — clicking the logo navigates here. */
  homeHref?: string;
}

/**
 * 256px sidebar — navy rail on light surface, mirrors EazePay Intelligence.
 *
 * Single active route per render via longest-prefix matching to avoid
 * double-highlighting when `/foo` is a prefix of `/foo/bar`.
 */
export function Sidebar({
  appName,
  appTagline,
  groups,
  userRole,
  footer,
  homeHref = '/',
}: SidebarProps): JSX.Element {
  const path = usePathname();

  const filtered = groups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        if (!item.roles || item.roles.length === 0) return true;
        if (!userRole) return false;
        return item.roles.includes(userRole);
      }),
    }))
    .filter((g) => g.items.length > 0);

  const activeHref = ((): string | null => {
    if (!path) return null;
    let bestHref: string | null = null;
    let bestLen = -1;
    for (const group of filtered) {
      for (const item of group.items) {
        if (path === item.href) return item.href;
        if (item.href !== homeHref && path.startsWith(`${item.href}/`)) {
          if (item.href.length > bestLen) {
            bestLen = item.href.length;
            bestHref = item.href;
          }
        }
      }
    }
    return bestHref;
  })();

  return (
    <aside className="w-64 shrink-0 border-r border-line2 bg-surface px-3 py-6 flex flex-col h-full overflow-y-auto">
      <Link href={homeHref} className="block mb-7 px-3">
        <div className="font-semibold tracking-tight text-ink text-[17px] leading-none">
          {appName}
        </div>
        {appTagline && (
          <div className="text-accent text-[10px] font-semibold tracking-[0.18em] mt-1.5">
            {appTagline}
          </div>
        )}
      </Link>

      {filtered.map((group) => (
        <div key={group.label} className="mb-5">
          <div className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-soft mb-2">
            {group.label}
          </div>
          <nav className="space-y-0.5">
            {group.items.map((item) => {
              const active = item.href === activeHref;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] tracking-tight transition ${
                    active
                      ? 'bg-ink text-surface font-medium shadow-sm'
                      : 'text-ink2 hover:bg-paper'
                  }`}
                >
                  <Icon
                    size={16}
                    strokeWidth={active ? 2 : 1.75}
                    className={active ? 'text-surface' : 'text-soft'}
                  />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      ))}

      {footer && (
        <div className="mt-auto px-3 pt-4 border-t border-line2 text-[10px] text-soft space-y-0.5">
          {footer}
        </div>
      )}
    </aside>
  );
}
