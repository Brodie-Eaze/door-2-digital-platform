import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  /** Left-icon slot. */
  leftIcon?: ReactNode;
  /** Right-icon slot. */
  rightIcon?: ReactNode;
  /** Loading state — disables and shows pulse. */
  loading?: boolean;
}

const VARIANT: Record<Variant, string> = {
  primary: 'bg-ink text-surface hover:bg-ink2 active:bg-ink2 shadow-sm',
  secondary: 'bg-surface text-ink border border-line hover:bg-paper active:bg-line2',
  ghost: 'bg-transparent text-ink hover:bg-paper active:bg-line2',
  danger: 'bg-dangerSoft text-danger border border-danger/30 hover:bg-danger/10',
};

const SIZE: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-[12px] gap-1.5',
  md: 'h-8.5 px-3.5 text-[13px] gap-2',
  lg: 'h-10 px-5 text-sm gap-2',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  children,
  leftIcon,
  rightIcon,
  loading,
  disabled,
  className,
  ...rest
}: ButtonProps): JSX.Element {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium tracking-tight transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        loading && 'animate-pulse',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
    >
      {leftIcon && <span className="shrink-0">{leftIcon}</span>}
      <span className="truncate">{children}</span>
      {rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  );
}
