'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { cn } from '@d2d/ui-web';
import { Wordmark, CtaLink } from './site';

const NAV = [
  { href: '/platform', label: 'Platform' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/security', label: 'Security' },
  { href: '/company', label: 'Company' },
] as const;

export function SiteHeader(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = (): void => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b bg-surface/85 backdrop-blur-sm transition-shadow',
        scrolled
          ? 'border-line shadow-[0_1px_0_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.25)]'
          : 'border-transparent',
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="Door 2 Digital home" className="shrink-0">
          <Wordmark />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
                  active ? 'text-ink bg-line2' : 'text-muted hover:text-ink hover:bg-paper',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/contact"
            className="rounded-md px-3 py-1.5 text-[13px] font-medium text-muted transition-colors hover:text-ink"
          >
            Sign in
          </Link>
          <CtaLink href="/contact" className="px-3.5 py-2 text-[13px]">
            Request access
          </CtaLink>
        </div>

        <button
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line text-ink md:hidden"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-line bg-surface md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col px-5 py-3 sm:px-8">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-2.5 text-sm font-medium text-ink2 hover:bg-paper"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-line2 pt-3">
              <CtaLink href="/contact" variant="secondary" className="w-full">
                Sign in
              </CtaLink>
              <CtaLink href="/contact" className="w-full">
                Request access
              </CtaLink>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
