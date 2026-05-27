'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/cn';
import { Reveal } from './Reveal';

export type EmptyStateVariant = 'default' | 'anomaly' | 'first-run';

interface EmptyStateAction {
  /** Visible label for the CTA. */
  label: string;
  /** Anchor href (router-driven). If both `href` and `onClick` are provided,
   *  the rendered element is an `<a>` and `onClick` runs alongside navigation. */
  href?: string;
  onClick?: () => void;
}

interface EmptyStateProps {
  /** Lucide icon — renders inside the tinted circle. Default = none. */
  icon?: LucideIcon;
  /** One-line headline (~6-9 words). Concrete, not chatty. */
  title: string;
  /** Sub-headline (~10-20 words). Explain what this surface does + when it
   *  fills. */
  description?: string;
  /** Primary CTA — single action, never two competing primaries. */
  primaryAction?: EmptyStateAction;
  /** Secondary CTA — "see example", "import", "learn more". */
  secondaryAction?: EmptyStateAction;
  /** Optional hero illustration (large icon, SVG, or composed block). */
  illustration?: ReactNode;
  /** `default` (centred, muted), `anomaly` (amber accent ring — something's
   *  off), `first-run` (new account onboarding). */
  variant?: EmptyStateVariant;
  /** Set when the EmptyState replaces a card body — drops the outer card
   *  styling so it inherits the parent surface. */
  bare?: boolean;
  /** When true, wraps in `<Reveal>` for staggered fade-in (matches sprint A
   *  motion). Default true. */
  animate?: boolean;
  /** Accessible label override for the landmark. Defaults to `title`. */
  ariaLabel?: string;
  className?: string;
  /** Optional legacy slot — overrides primaryAction render when arbitrary
   *  JSX is needed (kept for backward compat with existing callers that may
   *  pass <Button>s directly). */
  action?: ReactNode;
}

const VARIANT_ICON_BG: Record<EmptyStateVariant, string> = {
  default: 'bg-line2 text-soft',
  anomaly: 'bg-warnSoft text-warn ring-2 ring-warn/20',
  'first-run': 'bg-accentSoft text-accent',
};

const VARIANT_TITLE: Record<EmptyStateVariant, string> = {
  default: 'text-ink',
  anomaly: 'text-ink',
  'first-run': 'text-ink',
};

const VARIANT_WRAPPER: Record<EmptyStateVariant, string> = {
  default: '',
  anomaly: 'ring-1 ring-warn/30 bg-warnSoft/30 rounded-xl',
  'first-run': 'ring-1 ring-accent/20 bg-accentSoft/40 rounded-xl',
};

function ActionButton({
  action,
  primary,
}: {
  action: EmptyStateAction;
  primary: boolean;
}): JSX.Element {
  const cls = cn(
    'inline-flex items-center justify-center rounded-lg font-medium tracking-tight text-[12.5px]',
    'h-8 px-3.5 gap-1.5 transition-[background-color,color,box-shadow,transform] duration-150 ease-out',
    'active:scale-[0.985] motion-reduce:transform-none motion-reduce:transition-none',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
    primary
      ? 'bg-ink text-surface hover:bg-ink2 hover:shadow shadow-sm'
      : 'bg-surface text-ink border border-line hover:bg-paper active:bg-line2',
  );
  if (action.href) {
    return (
      <a
        href={action.href}
        onClick={action.onClick}
        className={cls}
        data-empty-state-action={primary ? 'primary' : 'secondary'}
      >
        {action.label}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={action.onClick}
      className={cls}
      data-empty-state-action={primary ? 'primary' : 'secondary'}
    >
      {action.label}
    </button>
  );
}

/**
 * Empty state — used wherever a surface has loaded but the dataset is zero.
 *
 * Convention (sprint C):
 *   - `default`     → routine empty (no leads in a stage, no tasks yet, etc.)
 *   - `anomaly`     → empty when it should NOT be (no reps on the field at
 *                      10am, no callbacks fired all day) — amber accent ring.
 *   - `first-run`   → new account, nothing configured yet — onboarding CTA.
 *
 * Always render an icon + title + description + at least one action. Skeleton
 * loaders (still-fetching) are a separate component — use `<Skeleton/>` while
 * the data is in flight, then swap to `<EmptyState/>` once we know it really
 * is empty.
 *
 * Wraps in `<Reveal>` for the standard 360ms fade-up unless `animate={false}`.
 * Respects `prefers-reduced-motion` via Reveal.
 *
 * Accessibility:
 *   - landmark `role="region"`, `aria-label` defaults to the title.
 *   - actions are real `<a>` / `<button>` so keyboard nav + screen readers
 *     announce them naturally.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  illustration,
  variant = 'default',
  bare = false,
  animate = true,
  ariaLabel,
  className,
  action,
}: EmptyStateProps): JSX.Element {
  const inner = (
    <div
      role="region"
      aria-label={ariaLabel ?? title}
      className={cn(
        'flex flex-col items-center text-center',
        bare ? 'py-10 px-6' : 'py-14 px-8',
        !bare && VARIANT_WRAPPER[variant],
        className,
      )}
      data-empty-state={variant}
    >
      {illustration && <div className="mb-4">{illustration}</div>}
      {!illustration && Icon && (
        <div
          className={cn(
            'inline-flex items-center justify-center w-12 h-12 rounded-full mb-4',
            VARIANT_ICON_BG[variant],
          )}
          aria-hidden
        >
          <Icon size={20} strokeWidth={1.75} />
        </div>
      )}
      <h3
        className={cn('text-[14px] font-semibold tracking-tight max-w-md', VARIANT_TITLE[variant])}
      >
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 text-[12.5px] text-muted leading-relaxed max-w-md">{description}</p>
      )}
      {(primaryAction || secondaryAction || action) && (
        <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
          {action /* legacy slot */}
          {primaryAction && <ActionButton action={primaryAction} primary />}
          {secondaryAction && <ActionButton action={secondaryAction} primary={false} />}
        </div>
      )}
    </div>
  );

  if (!animate) return inner;
  return <Reveal>{inner}</Reveal>;
}
