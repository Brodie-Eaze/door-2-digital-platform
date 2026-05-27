import { Globe2 } from 'lucide-react';
import { cn } from '../lib/cn';
import type { RegionCode } from '../types';

interface RegionBadgeProps {
  region: RegionCode;
  className?: string;
}

const LABEL: Record<RegionCode, string> = {
  AU: 'Australia',
  US: 'United States',
  SG: 'Singapore',
};

/**
 * Compact region pill — 2-letter ISO code prefixed by a Globe icon.
 *
 * Sprint D removed the flag emoji prefix: emoji rendering is OS-dependent
 * (macOS shows Apple's flag art, Windows often shows letter pairs), the
 * glyphs read as decorative in an operator console, and the no-emoji
 * voice rule is lint-enforced. Hover for the full country name.
 */
export function RegionBadge({ region, className }: RegionBadgeProps): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-line2 text-muted text-[11px] font-medium tracking-tight',
        className,
      )}
      title={LABEL[region]}
    >
      <Globe2 aria-hidden size={11} className="opacity-70" />
      <span>{region}</span>
    </span>
  );
}
