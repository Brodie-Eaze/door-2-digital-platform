'use client';

/**
 * Door 2 Digital — public marketing shell.
 *
 * Used by every page under `/public/*`. Intentionally distinct from PlatformShell:
 *  - no sidebar, no operator chrome
 *  - airy whitespace + navy/light-blue palette
 *  - top nav + footer for marketing surfaces
 *
 * Do NOT use this for operator routes. Use PlatformShell for those.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

interface PublicShellProps {
  children: ReactNode;
  activeNav?: 'product' | 'pricing' | 'customers' | 'security' | 'docs' | 'home';
}

const NAV_LINKS = [
  { href: '/public/product', label: 'Product', key: 'product' as const },
  { href: '/public/pricing', label: 'Pricing', key: 'pricing' as const },
  { href: '/public/customers', label: 'Customers', key: 'customers' as const },
  { href: '/public/security', label: 'Security', key: 'security' as const },
  { href: '/public/docs', label: 'Docs', key: 'docs' as const },
];

function Logo(): JSX.Element {
  return (
    <Link href="/public" className="flex items-center gap-2.5 group">
      <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-ink text-surface text-[13px] font-semibold tracking-tight">
        D2
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[15px] font-semibold text-ink tracking-tight">Door 2 Digital</span>
        <span className="text-[10px] uppercase tracking-[0.12em] text-muted">Operating system</span>
      </span>
    </Link>
  );
}

export function PublicShell({ children, activeNav = 'home' }: PublicShellProps): JSX.Element {
  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b border-line2 bg-surface/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 lg:px-10 h-16">
          <Logo />
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const active = activeNav === link.key;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={
                    active
                      ? 'text-[13.5px] font-medium text-ink px-3.5 py-2 rounded-md bg-line2/70 transition'
                      : 'text-[13.5px] font-medium text-muted hover:text-ink px-3.5 py-2 rounded-md transition'
                  }
                >
                  {link.label}
                </Link>
              );
            })}
            <Link
              href="/login"
              className="text-[13.5px] font-medium text-muted hover:text-ink px-3.5 py-2 rounded-md transition ml-1"
            >
              Login
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/public/signup"
              className="hidden sm:inline-flex text-[13px] font-medium text-muted hover:text-ink px-3.5 py-2 rounded-md transition"
            >
              Start free
            </Link>
            <Link
              href="/public/signup?intent=demo"
              className="inline-flex items-center text-[13px] font-semibold bg-ink text-surface px-4 py-2 rounded-md hover:bg-ink2 transition tracking-tight"
            >
              Book demo
            </Link>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-line2 bg-surface mt-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-14">
            <div className="col-span-2 md:col-span-1">
              <Logo />
              <p className="text-[13px] text-muted leading-relaxed mt-4 max-w-xs">
                The operating system for door-to-door — modernising the industry that runs on
                clipboards.
              </p>
            </div>
            <div>
              <h3 className="text-[11px] uppercase tracking-[0.10em] text-muted font-medium mb-4">
                Product
              </h3>
              <ul className="space-y-2.5 text-[13.5px]">
                <li>
                  <Link href="/public/product" className="text-ink hover:text-accent transition">
                    Overview
                  </Link>
                </li>
                <li>
                  <Link href="/public/pricing" className="text-ink hover:text-accent transition">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/public/docs" className="text-ink hover:text-accent transition">
                    API docs
                  </Link>
                </li>
                <li>
                  <Link href="/public/status" className="text-ink hover:text-accent transition">
                    Status
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-[11px] uppercase tracking-[0.10em] text-muted font-medium mb-4">
                Company
              </h3>
              <ul className="space-y-2.5 text-[13.5px]">
                <li>
                  <Link href="/public/customers" className="text-ink hover:text-accent transition">
                    Customers
                  </Link>
                </li>
                <li>
                  <Link href="/public/security" className="text-ink hover:text-accent transition">
                    Security
                  </Link>
                </li>
                <li>
                  <Link href="/public/bug-bounty" className="text-ink hover:text-accent transition">
                    Bug bounty
                  </Link>
                </li>
                <li>
                  <a
                    href="mailto:hello@door2digital.io"
                    className="text-ink hover:text-accent transition"
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-[11px] uppercase tracking-[0.10em] text-muted font-medium mb-4">
                Resources
              </h3>
              <ul className="space-y-2.5 text-[13.5px]">
                <li>
                  <Link href="/public/docs" className="text-ink hover:text-accent transition">
                    Quickstart
                  </Link>
                </li>
                <li>
                  <a
                    href="/.well-known/security.txt"
                    className="text-ink hover:text-accent transition"
                  >
                    security.txt
                  </a>
                </li>
                <li>
                  <Link href="/public/signup" className="text-ink hover:text-accent transition">
                    Start trial
                  </Link>
                </li>
                <li>
                  <Link
                    href="/public/signup?intent=demo"
                    className="text-ink hover:text-accent transition"
                  >
                    Book demo
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-line2 mt-10 pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-[12px] text-muted">
              &copy; 2026 Door 2 Digital, Inc. All rights reserved.
            </p>
            <div className="flex items-center gap-5 text-[12px] text-muted">
              <Link href="/public/security" className="hover:text-ink transition">
                Privacy
              </Link>
              <Link href="/public/security" className="hover:text-ink transition">
                Terms
              </Link>
              <a href="/.well-known/security.txt" className="hover:text-ink transition">
                security.txt
              </a>
              <Link href="/public/status" className="hover:text-ink transition">
                Status
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
