'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronsUpDown, Building2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { ACCOUNTS, getAccount, type Account } from '@/lib/accounts';
import { AccountAvatar } from './AccountAvatar';

export function AccountSwitcher({ currentSlug }: { currentSlug: string }): JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const path = usePathname();
  const current: Account | undefined = getAccount(currentSlug);

  useEffect(() => {
    function onDown(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  if (!current) return <div />;

  // Preserve the current sub-route when switching accounts
  const subPath = path?.replace(`/accounts/${currentSlug}`, '') ?? '/today';
  const targetSub = subPath || '/today';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border border-line2 bg-paper hover:bg-surface hover:border-line transition min-w-[260px]"
      >
        <AccountAvatar account={current} size={28} />
        <div className="flex-1 text-left min-w-0">
          <div className="text-[12px] font-semibold text-ink truncate">{current.name}</div>
          <div className="text-[10px] text-muted uppercase tracking-wider">
            {current.vertical} · {current.region}
          </div>
        </div>
        <ChevronsUpDown size={14} className="text-soft shrink-0" />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-2 w-[360px] card !p-0 z-50 overflow-hidden"
          style={{ boxShadow: '0 8px 32px rgba(15,23,42,0.16), 0 0 0 1px rgba(15,23,42,0.06)' }}
        >
          <div className="px-4 py-2.5 border-b border-line2 bg-paper/40">
            <div className="h-section">Switch account</div>
          </div>
          {ACCOUNTS.map((a) => (
            <Link
              key={a.slug}
              href={`/accounts/${a.slug}${targetSub}`}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-4 py-2.5 hover:bg-paper transition border-b border-line2 last:border-b-0 ${
                a.slug === currentSlug ? 'bg-accentSoft/50' : ''
              }`}
            >
              <AccountAvatar account={a} size={32} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-ink truncate">{a.name}</div>
                <div className="text-[10px] text-muted">
                  {a.vertical} · {a.region} · {a.noctuas} Noctuas
                </div>
              </div>
              <span
                className={`pill ${
                  a.health === 'healthy'
                    ? 'pill-success'
                    : a.health === 'attention'
                      ? 'pill-warn'
                      : 'pill-danger'
                }`}
              >
                {a.plan}
              </span>
            </Link>
          ))}
          <Link
            href="/accounts"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-[12px] text-accent hover:bg-paper transition border-t border-line2"
          >
            <Building2 size={14} />
            All accounts
          </Link>
        </div>
      )}
    </div>
  );
}
