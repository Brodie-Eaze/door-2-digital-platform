import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import type { Tone } from '../types';

interface BannerProps {
  tone?: Tone;
  children: ReactNode;
  /** Optional action button on the right. */
  action?: ReactNode;
  className?: string;
}

const TONE_CLASS: Record<Tone, string> = {
  info: 'bg-accentSoft border-accent/20 text-ink',
  success: 'bg-successSoft border-success/20 text-ink',
  warn: 'bg-warnSoft border-warn/20 text-ink',
  danger: 'bg-dangerSoft border-danger/30 text-ink',
  muted: 'bg-line2 border-line text-ink2',
};

export function Banner({
  tone = 'info',
  children,
  action,
  className,
}: BannerProps): JSX.Element {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border text-[13px]',
        TONE_CLASS[tone],
        className,
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
