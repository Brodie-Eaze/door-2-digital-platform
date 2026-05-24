import { cn } from '../lib/cn';
import type { RegionCode } from '../types';

interface RegionBadgeProps {
  region: RegionCode;
  className?: string;
}

const FLAGS: Record<RegionCode, string> = {
  AU: '🇦🇺',
  US: '🇺🇸',
  SG: '🇸🇬',
};

const LABEL: Record<RegionCode, string> = {
  AU: 'Australia',
  US: 'United States',
  SG: 'Singapore',
};

export function RegionBadge({ region, className }: RegionBadgeProps): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-line2 text-muted text-[11px] font-medium tracking-tight',
        className,
      )}
      title={LABEL[region]}
    >
      <span aria-hidden>{FLAGS[region]}</span>
      <span>{region}</span>
    </span>
  );
}
