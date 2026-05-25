'use client';

import { useState } from 'react';
import { AlertTriangle, Coffee, Info } from 'lucide-react';
import { Section, StatusPill } from '@d2d/ui-web';
import type { AnomalyItem } from './types';

interface AnomaliesPanelProps {
  anomalies: AnomalyItem[];
  scopeLabel: string;
}

const ICON_FOR_SEVERITY = {
  critical: AlertTriangle,
  warn: Coffee,
  info: Info,
} as const;

const TONE_FOR_SEVERITY = {
  critical: 'text-rose-600',
  warn: 'text-warn',
  info: 'text-accent',
} as const;

/**
 * Anomalies · AI watch. Shows a stack of detected anomalies with a tone-coded
 * icon and an action link. Each card can be dismissed (kept client-side only).
 */
export function AnomaliesPanel({ anomalies, scopeLabel }: AnomaliesPanelProps): JSX.Element {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = anomalies.filter((a) => !dismissed.has(a.id));

  return (
    <Section
      title="Anomalies · AI watch"
      subtitle={`Real-time pattern detection · ${scopeLabel}`}
      action={
        <StatusPill tone={visible.length > 0 ? 'warn' : 'success'}>{visible.length}</StatusPill>
      }
    >
      <div className="space-y-3">
        {visible.length === 0 ? (
          <div className="text-[12px] text-muted py-4 text-center">
            No anomalies — fleet running clean.
          </div>
        ) : (
          visible.map((a) => {
            const Icon = ICON_FOR_SEVERITY[a.severity];
            const tone = TONE_FOR_SEVERITY[a.severity];
            return (
              <div
                key={a.id}
                className="bg-paper border border-line2 rounded-xl p-3 flex items-start gap-2.5"
              >
                <Icon size={14} className={`${tone} shrink-0 mt-0.5`} />
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-semibold text-ink">{a.title}</div>
                  <div className="text-[10.5px] text-muted mt-0.5">{a.detail}</div>
                  <div className="mt-1.5 flex items-center gap-3">
                    {a.actionHref ? (
                      <a
                        href={a.actionHref}
                        className="text-[10px] text-accent font-medium hover:underline"
                      >
                        {a.actionLabel} &rarr;
                      </a>
                    ) : (
                      <button
                        type="button"
                        className="text-[10px] text-accent font-medium hover:underline"
                      >
                        {a.actionLabel} &rarr;
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDismissed((d) => new Set(d).add(a.id))}
                      className="text-[10px] text-soft hover:text-muted"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Section>
  );
}
