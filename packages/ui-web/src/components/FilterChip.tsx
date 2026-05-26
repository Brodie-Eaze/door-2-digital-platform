'use client';

import type { ReactNode } from 'react';

/**
 * FilterChip — the canonical filter-chip primitive.
 *
 * Visual treatment is uniform across every operator surface:
 *   - rounded-full, px-3 py-1, text-[11px]
 *   - inactive: bg-paper / border-line2 / text-muted (hover → text-ink)
 *   - active:   bg-ink / text-surface (the "selected" affordance)
 *   - optional count badge follows the label (small numeric tabular)
 *   - 150ms colour transition (matches Sprint A motion timing)
 *
 * Always render chips inside a <FilterChipStrip> for consistent spacing
 * and optional uppercase label.
 */

interface FilterChipProps {
  active: boolean;
  onClick?: () => void;
  /** Optional count badge shown to the right of the label. */
  count?: number;
  children: ReactNode;
  /** Optional title / aria-label override. */
  title?: string;
}

export function FilterChip({
  active,
  onClick,
  count,
  children,
  title,
}: FilterChipProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={
        active
          ? 'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold bg-ink text-surface transition-colors duration-150 ease-out'
          : 'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium bg-paper text-muted hover:text-ink hover:bg-line2/50 border border-line2 transition-colors duration-150 ease-out'
      }
    >
      <span>{children}</span>
      {typeof count === 'number' && (
        <span
          className={
            active ? 'numeric text-[10px] text-surface/70' : 'numeric text-[10px] text-soft'
          }
        >
          {count}
        </span>
      )}
    </button>
  );
}

interface FilterChipStripProps {
  children: ReactNode;
  /** Optional uppercase prefix label (e.g. "Show", "Filter by"). */
  label?: string;
  className?: string;
}

export function FilterChipStrip({ children, label, className }: FilterChipStripProps): JSX.Element {
  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${className ?? ''}`}>
      {label && (
        <span className="text-[10px] uppercase tracking-wider text-muted mr-1 font-semibold">
          {label}
        </span>
      )}
      {children}
    </div>
  );
}
