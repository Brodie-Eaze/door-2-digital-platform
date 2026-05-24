import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  /** Optional left adornment (icon, prefix). */
  leftSlot?: ReactNode;
  /** Optional right adornment. */
  rightSlot?: ReactNode;
}

export function Input({
  label,
  hint,
  error,
  leftSlot,
  rightSlot,
  className,
  id,
  ...rest
}: InputProps): JSX.Element {
  const inputId = id ?? rest.name;
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-[12px] font-medium text-ink tracking-tight mb-1"
        >
          {label}
        </label>
      )}
      <div
        className={cn(
          'flex items-center gap-2 px-3 h-9 rounded-lg border bg-surface',
          'border-line hover:border-soft focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20',
          error && 'border-danger/40 focus-within:border-danger focus-within:ring-danger/20',
          className,
        )}
      >
        {leftSlot && <span className="shrink-0 text-soft">{leftSlot}</span>}
        <input
          id={inputId}
          {...rest}
          className="flex-1 bg-transparent text-[13px] text-ink placeholder:text-soft outline-none disabled:cursor-not-allowed disabled:text-muted"
        />
        {rightSlot && <span className="shrink-0 text-soft">{rightSlot}</span>}
      </div>
      {(hint || error) && (
        <p className={cn('mt-1 text-[11px]', error ? 'text-danger' : 'text-muted')}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
