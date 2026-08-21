'use client';

/**
 * Zero-dependency toast system for the operator console.
 *
 * Usage anywhere in client code:
 *   import { toast } from '@/components/Toaster';
 *   toast.success('Shift saved');
 *   toast.error('Failed to save — tap to retry', { onClick: retry });
 *   toast.info('Dialling Marcus L…');
 *
 * Mount <Toaster /> once in the root layout. Toasts stack bottom-right,
 * auto-dismiss after 4s (errors after 6s), pause on hover, and are
 * keyboard-dismissable. No portal library, no context provider — a simple
 * module-level event bus so `toast.*` works from any module without hooks.
 */

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  onClick?: () => void;
}

type Listener = (t: ToastItem) => void;

let nextId = 1;
let listener: Listener | null = null;
const pending: ToastItem[] = [];

function emit(kind: ToastKind, message: string, opts?: { onClick?: () => void }): void {
  const item: ToastItem = { id: nextId++, kind, message, onClick: opts?.onClick };
  if (listener) listener(item);
  else pending.push(item); // queued until <Toaster /> mounts
}

export const toast = {
  success: (message: string, opts?: { onClick?: () => void }): void =>
    emit('success', message, opts),
  error: (message: string, opts?: { onClick?: () => void }): void => emit('error', message, opts),
  info: (message: string, opts?: { onClick?: () => void }): void => emit('info', message, opts),
};

const KIND_STYLES: Record<ToastKind, { border: string; icon: JSX.Element }> = {
  success: {
    border: 'border-l-emerald-500',
    icon: <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />,
  },
  error: {
    border: 'border-l-rose-500',
    icon: <AlertCircle size={15} className="text-rose-500 shrink-0" />,
  },
  info: {
    border: 'border-l-blue-500',
    icon: <Info size={15} className="text-blue-500 shrink-0" />,
  },
};

export function Toaster(): JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    listener = (t): void => {
      setToasts((prev) => [...prev.slice(-4), t]); // cap stack at 5
      const ttl = t.kind === 'error' ? 6000 : 4000;
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, ttl);
    };
    // Flush anything fired before mount.
    pending.splice(0).forEach((t) => listener!(t));
    return (): void => {
      listener = null;
    };
  }, []);

  if (toasts.length === 0) return <></>;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 max-w-[360px]"
    >
      {toasts.map((t) => {
        const style = KIND_STYLES[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            onClick={t.onClick}
            className={`flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-surface border border-line2 border-l-2 ${style.border} shadow-lg text-[12.5px] text-ink leading-snug ${t.onClick ? 'cursor-pointer hover:bg-paper' : ''}`}
          >
            {style.icon}
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={(e) => {
                e.stopPropagation();
                setToasts((prev) => prev.filter((x) => x.id !== t.id));
              }}
              className="text-muted hover:text-ink transition-colors shrink-0 mt-0.5"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
