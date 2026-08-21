/**
 * Shared marketing primitives for the D2D public site.
 *
 * Visual register: the locked EazePay navy DNA (no glass, no aurora) pushed
 * toward an "operational instrument" feel — JetBrains Mono (font-mono) as the
 * technical accent for eyebrows / metrics / stage labels, generous structure,
 * tabular-nums on every number. Server-component-safe (no client hooks here).
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@d2d/ui-web';

/** Door glyph + wordmark. The "2" is the accent gateway between two posts. */
export function Wordmark({
  className,
  tone = 'ink',
}: {
  className?: string;
  tone?: 'ink' | 'surface';
}): JSX.Element {
  const text = tone === 'surface' ? 'text-surface' : 'text-ink';
  const sub = tone === 'surface' ? 'text-surface/60' : 'text-soft';
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <DoorMark />
      <span className="leading-none">
        <span className={cn('block text-[15px] font-semibold tracking-tight', text)}>
          Door 2 Digital
        </span>
        <span className={cn('block font-mono text-[9px] uppercase tracking-[0.22em] mt-0.5', sub)}>
          Field Sales OS
        </span>
      </span>
    </span>
  );
}

export function DoorMark({ size = 26 }: { size?: number }): JSX.Element {
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center rounded-md bg-ink"
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
        <rect x="5" y="3" width="14" height="18" rx="1.5" stroke="#F7F8FA" strokeWidth="1.6" />
        <path d="M12 3v18" stroke="#3B82F6" strokeWidth="1.6" />
        <circle cx="9.5" cy="12" r="1" fill="#3B82F6" />
      </svg>
    </span>
  );
}

export function SiteContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return <div className={cn('mx-auto w-full max-w-6xl px-5 sm:px-8', className)}>{children}</div>;
}

export function Eyebrow({
  children,
  tone = 'accent',
}: {
  children: ReactNode;
  tone?: 'accent' | 'muted' | 'surface';
}): JSX.Element {
  const color =
    tone === 'surface' ? 'text-surface/70' : tone === 'muted' ? 'text-muted' : 'text-accent';
  return (
    <span className={cn('font-mono text-[11px] uppercase tracking-[0.20em] font-medium', color)}>
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  sub,
  align = 'left',
  tone = 'ink',
}: {
  eyebrow?: string;
  title: ReactNode;
  sub?: ReactNode;
  align?: 'left' | 'center';
  tone?: 'ink' | 'surface';
}): JSX.Element {
  const headColor = tone === 'surface' ? 'text-surface' : 'text-ink';
  const subColor = tone === 'surface' ? 'text-surface/70' : 'text-muted';
  return (
    <div className={cn(align === 'center' && 'text-center mx-auto max-w-2xl')}>
      {eyebrow ? (
        <Eyebrow tone={tone === 'surface' ? 'surface' : 'accent'}>{eyebrow}</Eyebrow>
      ) : null}
      <h2
        className={cn(
          'mt-3 text-[26px] sm:text-[32px] font-semibold tracking-tight leading-[1.15]',
          headColor,
        )}
      >
        {title}
      </h2>
      {sub ? <p className={cn('mt-3 text-[15px] leading-relaxed', subColor)}>{sub}</p> : null}
    </div>
  );
}

/** Primary CTA — navy fill, mirrors the Button `primary` variant as a link. */
export function CtaLink({
  href,
  children,
  variant = 'primary',
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'surface';
  className?: string;
}): JSX.Element {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium px-4 py-2.5 transition-colors';
  const styles = {
    primary: 'bg-ink text-surface hover:bg-ink2',
    secondary: 'bg-surface text-ink border border-line hover:bg-paper',
    surface: 'bg-surface text-ink hover:bg-paper',
  } as const;
  const external = href.startsWith('http') || href.startsWith('/.well-known');
  if (external) {
    return (
      <a href={href} className={cn(base, styles[variant], className)}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cn(base, styles[variant], className)}>
      {children}
    </Link>
  );
}

export function Stat({
  value,
  label,
  tone = 'ink',
}: {
  value: ReactNode;
  label: ReactNode;
  tone?: 'ink' | 'surface';
}): JSX.Element {
  const v = tone === 'surface' ? 'text-surface' : 'text-ink';
  const l = tone === 'surface' ? 'text-surface/60' : 'text-muted';
  return (
    <div>
      <div className={cn('numeric font-mono text-[28px] font-semibold tracking-tight', v)}>
        {value}
      </div>
      <div className={cn('mt-1 text-[12px] leading-snug', l)}>{label}</div>
    </div>
  );
}

export function FeatureCard({
  icon,
  title,
  body,
  meta,
}: {
  icon: ReactNode;
  title: string;
  body: ReactNode;
  meta?: string;
}): JSX.Element {
  return (
    <div className="card card-pad h-full flex flex-col">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accentSoft text-accent">
        {icon}
      </div>
      <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-ink">{title}</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-muted flex-1">{body}</p>
      {meta ? (
        <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-soft">
          {meta}
        </div>
      ) : null}
    </div>
  );
}

/** A labelled spec row — used on Platform / Security pages for dense, honest detail. */
export function SpecRow({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-1 sm:gap-6 py-3.5 border-b border-line2 last:border-b-0">
      <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted pt-0.5">
        {label}
      </dt>
      <dd className="text-[13px] leading-relaxed text-ink2">{children}</dd>
    </div>
  );
}
