'use client';

import type { ReactNode } from 'react';
import { CheckCircle2, Circle, ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '../lib/cn';
import { Reveal } from './Reveal';

export interface FirstRunMilestone {
  id: string;
  label: string;
  /** Short helper line under the label. */
  hint?: string;
  /** Progress fraction in [0, 1]. `1` => milestone complete. */
  progress: number;
  /** Optional numeric counter, e.g. "3 / 10". Overrides `progress` rendering. */
  counter?: { current: number; target: number };
  /** Optional CTA to drive this milestone forward. */
  cta?: { label: string; href?: string; onClick?: () => void };
}

interface FirstRunChecklistProps {
  /** Display name of the account / workspace, used in the header copy. */
  accountName: string;
  /** Milestone list — render order defines display order. */
  milestones: FirstRunMilestone[];
  /** Optional dismiss handler — renders a small "Hide" link top-right. */
  onDismiss?: () => void;
  /** When true, wraps in `<Reveal>` for staggered fade-in. Default true. */
  animate?: boolean;
  className?: string;
}

/**
 * First-run checklist — anchored to the top of `/today` for newly
 * onboarded accounts. Auto-hides once every milestone hits `progress === 1`.
 *
 * Sprint C contract: shows up only when the account is new (no roster,
 * no conversions MTD, contracted < 7d ago). Caller decides; this component
 * is pure UI.
 *
 * Visual DNA: accent-tinted card matching the EmptyState `first-run` variant
 * so the two read as the same family of "we just got here, here's the path
 * forward" affordance.
 */
export function FirstRunChecklist({
  accountName,
  milestones,
  onDismiss,
  animate = true,
  className,
}: FirstRunChecklistProps): JSX.Element | null {
  if (milestones.length === 0) return null;
  const completed = milestones.filter((m) => m.progress >= 1).length;
  const allDone = completed === milestones.length;
  if (allDone) return null;
  const overallPct = Math.round(
    (milestones.reduce((s, m) => s + Math.min(1, Math.max(0, m.progress)), 0) / milestones.length) *
      100,
  );

  const body = (
    <section
      role="region"
      aria-label={`First-run checklist for ${accountName}`}
      data-first-run-checklist
      className={cn(
        'card !p-0 ring-1 ring-accent/30 bg-gradient-to-br from-accentSoft/60 to-surface overflow-hidden',
        className,
      )}
    >
      <header className="px-5 py-4 flex items-start justify-between gap-3 border-b border-accent/15">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-accent font-semibold">
            <Sparkles size={11} strokeWidth={2} /> Get this account live
          </div>
          <h2 className="mt-1 text-[15px] font-semibold text-ink tracking-tight">
            Get {accountName} live — finish setup to start capturing leads.
          </h2>
          <p className="mt-0.5 text-[12px] text-muted">
            {completed} of {milestones.length} complete · card auto-hides when every step lands.
          </p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-[11px] text-muted hover:text-ink transition shrink-0"
          >
            Hide
          </button>
        )}
      </header>

      {/* Overall progress bar */}
      <div className="px-5 pt-3">
        <div className="h-1.5 w-full rounded-full bg-line2 overflow-hidden">
          <div
            className="h-full bg-accent transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${overallPct}%` }}
            aria-hidden
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] text-muted numeric">
          <span>{overallPct}% complete</span>
          <span>{milestones.length - completed} remaining</span>
        </div>
      </div>

      <ol className="divide-y divide-line2/60">
        {milestones.map((m, i) => (
          <MilestoneRow key={m.id} milestone={m} index={i} />
        ))}
      </ol>
    </section>
  );

  if (!animate) return body;
  return <Reveal>{body}</Reveal>;
}

function MilestoneRow({
  milestone,
  index,
}: {
  milestone: FirstRunMilestone;
  index: number;
}): JSX.Element {
  const done = milestone.progress >= 1;
  const pct = Math.min(100, Math.max(0, Math.round(milestone.progress * 100)));
  return (
    <li className="px-5 py-3.5 flex items-start gap-3">
      <div className="shrink-0 mt-0.5" aria-hidden>
        {done ? (
          <CheckCircle2 size={18} className="text-success" strokeWidth={2} />
        ) : (
          <Circle size={18} className="text-soft" strokeWidth={1.75} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <div
              className={cn(
                'text-[13px] font-medium',
                done ? 'text-soft line-through' : 'text-ink',
              )}
            >
              <span className="text-[10px] text-muted mr-1.5 numeric">#{index + 1}</span>
              {milestone.label}
            </div>
            {milestone.hint && (
              <div className="text-[11.5px] text-muted mt-0.5 leading-snug">{milestone.hint}</div>
            )}
          </div>
          {milestone.counter ? (
            <span className="mono text-[10px] !w-auto !px-2 shrink-0">
              {milestone.counter.current} / {milestone.counter.target}
            </span>
          ) : (
            <span className="mono text-[10px] !w-auto !px-2 shrink-0">{pct}%</span>
          )}
        </div>
        {!done && (
          <div className="mt-2 h-1 w-full rounded-full bg-line2 overflow-hidden">
            <div
              className="h-full bg-accent transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{ width: `${pct}%` }}
              aria-hidden
            />
          </div>
        )}
        {milestone.cta && !done && (
          <div className="mt-2.5">
            <MilestoneCta cta={milestone.cta} />
          </div>
        )}
      </div>
    </li>
  );
}

function MilestoneCta({ cta }: { cta: NonNullable<FirstRunMilestone['cta']> }): JSX.Element {
  const cls =
    'inline-flex items-center gap-1 text-[11.5px] font-semibold text-accent hover:underline';
  const content: ReactNode = (
    <>
      {cta.label}
      <ArrowRight size={11} />
    </>
  );
  if (cta.href) {
    return (
      <a href={cta.href} onClick={cta.onClick} className={cls}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={cta.onClick} className={cls}>
      {content}
    </button>
  );
}
