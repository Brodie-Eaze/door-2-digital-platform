'use client';

import { Search } from 'lucide-react';
import type { ReactNode } from 'react';

interface TopBarProps {
  /** Page title shown on the left. */
  title?: string;
  /** Optional content for the right side (user menu, badges, etc.). */
  rightSlot?: ReactNode;
  /** Show command-palette trigger button. Default: true. */
  showCommandPalette?: boolean;
  /** Called when the command palette is opened (Cmd/Ctrl+K or trigger click). */
  onOpenCommandPalette?: () => void;
  /** Environment label (local | dev | staging | production). */
  env?: string;
}

const ENV_COLOR: Record<string, string> = {
  local: 'bg-slate-500/10 text-slate-600 border-slate-500/30',
  dev: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
  staging: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  production: 'bg-rose-500/10 text-rose-700 border-rose-500/30',
};

/**
 * 14px-tall sticky header — title + env badge | command palette | right slot.
 * Mirrors EazePay Intelligence TopBar.tsx.
 */
export function TopBar({
  title,
  rightSlot,
  showCommandPalette = true,
  onOpenCommandPalette,
  env = 'local',
}: TopBarProps): JSX.Element {
  const envClass = ENV_COLOR[env] ?? ENV_COLOR['local'];
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="h-14 border-b border-line2 px-6 flex items-center justify-between gap-4 bg-surface/95 backdrop-blur sticky top-0 z-10">
      <div className="flex items-center gap-3 min-w-0">
        {title && (
          <span className="text-sm font-semibold text-ink tracking-tight truncate">{title}</span>
        )}
        <span
          className={`inline-flex items-center text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full border ${envClass}`}
        >
          {env}
        </span>
      </div>

      {showCommandPalette && (
        <button
          onClick={onOpenCommandPalette}
          className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-line2 bg-paper hover:bg-surface hover:border-line transition min-w-[300px] max-w-[440px]"
        >
          <Search size={14} className="text-soft" />
          <span className="text-[12px] text-muted flex-1 text-left">
            Jump to · search lead · address · campaign…
          </span>
          <kbd className="inline-flex items-center gap-0.5 text-[10px] text-soft border border-line2 rounded px-1.5 py-0.5 bg-surface font-mono">
            {isMac ? '⌘' : 'Ctrl'}K
          </kbd>
        </button>
      )}

      <div className="flex items-center gap-4">{rightSlot}</div>
    </header>
  );
}
