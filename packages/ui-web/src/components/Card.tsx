import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Apply default p-5 padding. Set false to control padding inside. */
  padded?: boolean;
}

/**
 * Surface card — white background, 12px radius, subtle 1px stroke shadow.
 * Uses .card and .card-pad classes from @d2d/ui-tokens globals.css.
 */
export function Card({ children, className, padded = true }: CardProps): JSX.Element {
  return <div className={cn('card', padded && 'card-pad', className)}>{children}</div>;
}
