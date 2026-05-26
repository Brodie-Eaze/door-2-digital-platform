'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

interface AppShellProps {
  sidebar: ReactNode;
  topBar: ReactNode;
  children: ReactNode;
  /**
   * Optional footer rendered BELOW the scrollable <main> area. Used by
   * D2D's TrustFooter (SOC 2 badge · TLS · region · audit-trail counter).
   * Sits inside the viewport-pinned column so it never scrolls away — the
   * "is this product real?" answer is always present in the chrome.
   */
  footer?: ReactNode;
}

/**
 * Viewport-pinned app shell — sidebar + topbar + scrollable main (+ optional footer).
 *
 * `h-screen` (not min-h-screen) pins the shell so the window never scrolls.
 * The sidebar and <main> each have their own `overflow-y-auto` and scroll
 * independently. Resets <main> scroll on route change because Next's Link
 * default `scroll: true` resets window scroll — but the window never scrolled
 * to begin with; <main> did.
 *
 * Mirrors EazePay Intelligence AppShell.tsx — plus the optional `footer`
 * slot for D2D's Security & Trust strip.
 */
export function AppShell({ sidebar, topBar, children, footer }: AppShellProps): JSX.Element {
  const path = usePathname();
  const mainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    mainRef.current?.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant' as ScrollBehavior,
    });
  }, [path]);

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebar}
      <div className="flex-1 flex flex-col min-w-0">
        {topBar}
        <main ref={mainRef} className="flex-1 p-6 lg:p-8 overflow-y-auto bg-paper">
          {children}
        </main>
        {footer}
      </div>
    </div>
  );
}
