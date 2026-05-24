'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

interface AppShellProps {
  sidebar: ReactNode;
  topBar: ReactNode;
  children: ReactNode;
}

/**
 * Viewport-pinned app shell — sidebar + topbar + scrollable main.
 *
 * `h-screen` (not min-h-screen) pins the shell so the window never scrolls.
 * The sidebar and <main> each have their own `overflow-y-auto` and scroll
 * independently. Resets <main> scroll on route change because Next's Link
 * default `scroll: true` resets window scroll — but the window never scrolled
 * to begin with; <main> did.
 *
 * Mirrors EazePay Intelligence AppShell.tsx exactly.
 */
export function AppShell({ sidebar, topBar, children }: AppShellProps): JSX.Element {
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
      </div>
    </div>
  );
}
