'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';

interface RevealProps {
  children: ReactNode;
  /** Delay in ms before this Reveal starts its animation. Stagger by passing 0/80/160/240 etc. */
  delay?: number;
  /** Disable for static fallback. */
  enabled?: boolean;
  /** Wrapping element tag. Defaults to 'div'. */
  as?: 'div' | 'section' | 'article';
  className?: string;
}

/**
 * Staggered fade-up reveal. On first client-side mount, animates
 * opacity 0 → 1 + translateY(8px) → 0 over ~360ms with cubic ease-out.
 *
 * Pass `delay` to cascade siblings (0 / 80 / 160 / 240ms is the D2D motion
 * cadence). Respects `prefers-reduced-motion: reduce` — reduced-motion users
 * jump straight to the mounted state with no transform.
 *
 * Pure CSS via Tailwind utility classes — no JS animation loops, no deps.
 */
export function Reveal({
  children,
  delay = 0,
  enabled = true,
  as = 'div',
  className,
}: RevealProps): JSX.Element {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setMounted(true);
      return;
    }
    const t = window.setTimeout(() => setMounted(true), delay);
    return () => window.clearTimeout(t);
  }, [delay, enabled]);

  const Tag = as;
  return (
    <Tag
      className={cn(
        'transition-[opacity,transform] duration-[360ms] ease-out',
        'motion-reduce:transition-none motion-reduce:transform-none motion-reduce:opacity-100',
        mounted || !enabled ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
