import type { CSSProperties } from 'react';
import { cn } from '../lib/cn';

interface SkeletonProps {
  /** Tailwind width class. Defaults to 'w-full'. */
  width?: string;
  /** Tailwind height class. Defaults to 'h-4'. */
  height?: string;
  /** Tailwind rounding class. Defaults to 'rounded'. */
  rounded?: string;
  /** Extra classes (e.g. mt-2, max-w-[60%]). */
  className?: string;
  /** Inline style escape hatch for arbitrary widths. */
  style?: CSSProperties;
}

/**
 * Soft pulsing placeholder for loading states.
 *
 * Uses the `animate-pulse-soft` keyframe defined in `@d2d/ui-tokens`
 * tailwind preset — a gentler 2s cycle (opacity 0.6 → 1.0 → 0.6) vs
 * Tailwind's default 1s pulse, which feels frantic for a trust-first UI.
 *
 * Respects `prefers-reduced-motion: reduce` via `motion-reduce:animate-none`
 * + a static 0.8 opacity fallback.
 */
export function Skeleton({
  width = 'w-full',
  height = 'h-4',
  rounded = 'rounded',
  className,
  style,
}: SkeletonProps): JSX.Element {
  return (
    <div
      aria-hidden
      className={cn(
        'bg-line2/60 animate-pulse-soft motion-reduce:animate-none motion-reduce:opacity-80',
        width,
        height,
        rounded,
        className,
      )}
      style={style}
    />
  );
}
