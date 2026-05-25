'use client';

import { useEffect, useRef } from 'react';
import { Section } from '@d2d/ui-web';
import type { ActivityEvent, ActivityEventType } from './types';

interface LiveActivityFeedProps {
  events: ActivityEvent[];
  scopeLabel: string;
}

const TONE_FOR_TYPE: Record<ActivityEventType, string> = {
  conversion: 'text-success',
  knock_sale: 'text-success',
  knock_lead: 'text-accent',
  callback_scheduled: 'text-accent',
  shift_start: 'text-muted',
  shift_break_return: 'text-muted',
  shift_break_start: 'text-warn',
  knock_not_home: 'text-muted',
};

/**
 * Live activity feed. Auto-scrolls to the top whenever events change so the
 * latest activity is visible without manual scroll. Tone-coded by event type.
 */
export function LiveActivityFeed({ events, scopeLabel }: LiveActivityFeedProps): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events]);

  return (
    <Section
      title="Live activity feed"
      subtitle={`Last 5 minutes · ${scopeLabel}`}
      action={
        <span className="text-[10px] text-success flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live
        </span>
      }
    >
      <div ref={scrollRef} className="space-y-2 max-h-[300px] overflow-y-auto">
        {events.length === 0 ? (
          <div className="text-[12px] text-muted py-4 text-center">
            No activity in the last 5 minutes.
          </div>
        ) : (
          events.map((e) => (
            <div key={e.id} className="flex items-start gap-2 text-[11px]">
              <span className="text-soft numeric shrink-0 w-9">{e.at}</span>
              <span className="mono !w-5 !h-5 !text-[9px] shrink-0">{e.actorInitials}</span>
              <div className="flex-1 min-w-0">
                <div className={`font-medium ${TONE_FOR_TYPE[e.type]}`}>{e.primary}</div>
                <div className="text-muted truncate">{e.secondary}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </Section>
  );
}
