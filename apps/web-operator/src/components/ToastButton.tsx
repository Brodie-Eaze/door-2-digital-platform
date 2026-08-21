'use client';

/**
 * ToastButton — a `<Button>` whose onClick fires a placeholder toast.
 *
 * Server Component pages cannot pass event handlers to Client Component
 * props (the RSC boundary can't serialize a function), so any page that has
 * been converted to a server component for live DB reads needs its
 * interactive "coming soon" affordances (export, file, view) pulled into a
 * small client leaf like this one instead of an inline `onClick`.
 */
import type { ComponentProps, ReactNode } from 'react';
import { Button } from '@d2d/ui-web';
import { toast } from '@/components/Toaster';

type ButtonProps = ComponentProps<typeof Button>;

export function ToastButton({
  message,
  children,
  ...buttonProps
}: {
  message: string;
  children: ReactNode;
} & Omit<ButtonProps, 'onClick' | 'children'>): JSX.Element {
  return (
    <Button {...buttonProps} onClick={() => toast.info(message)}>
      {children}
    </Button>
  );
}
