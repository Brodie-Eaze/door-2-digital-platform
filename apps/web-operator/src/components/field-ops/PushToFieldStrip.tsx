'use client';

import { useState } from 'react';
import { MapPin, Radio, Sparkles, TrendingUp } from 'lucide-react';
import { Section } from '@d2d/ui-web';
import { toast } from '@/components/Toaster';
import type { BroadcastResult } from '@/app/api/broadcast/route';
import type { PushToFieldAction } from './types';

interface PushToFieldStripProps {
  scopeLabel: string;
  /**
   * Fired for the non-broadcast actions (update pitch script, reassign
   * territories, end shift early) — the page decides what to do (open a
   * wizard, toast an honest "queued" message). The `broadcast_message`
   * action is handled inside this strip with a real POST /api/broadcast.
   */
  onAction: (kind: PushToFieldAction) => void;
}

const ACTIONS: ReadonlyArray<{
  kind: PushToFieldAction;
  title: string;
  desc: string;
  icon: typeof Radio;
}> = [
  {
    kind: 'broadcast_message',
    title: 'Broadcast message',
    desc: 'Send to all active reps · push + in-app',
    icon: Radio,
  },
  {
    kind: 'update_pitch_script',
    title: 'Update pitch script',
    desc: 'New version syncs on next app open',
    icon: Sparkles,
  },
  {
    kind: 'reassign_territories',
    title: 'Reassign territories',
    desc: 'Drag-drop reps between zones',
    icon: MapPin,
  },
  {
    kind: 'end_shift_early',
    title: 'End shift early',
    desc: 'Manager-initiated wrap',
    icon: TrendingUp,
  },
];

/**
 * Push to field. 4-button broadcast strip. Each click is dispatched to the
 * parent via onAction so each page can decide what to do (open modal, route
 * to a wizard, fire an API call). For now consumers just console.log.
 */
export function PushToFieldStrip({ scopeLabel, onAction }: PushToFieldStripProps): JSX.Element {
  return (
    <Section
      title="Push to field"
      subtitle={`Broadcast a config or message — pushed instantly to every active iPad · ${scopeLabel}`}
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {ACTIONS.map((a) => (
          <button
            key={a.kind}
            type="button"
            onClick={() => onAction(a.kind)}
            className="card card-pad text-left hover:shadow-md hover:border-line transition flex items-start gap-3"
          >
            <div className="w-10 h-10 rounded-lg bg-accentSoft text-accent flex items-center justify-center shrink-0">
              <a.icon size={16} />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-ink">{a.title}</div>
              <div className="text-[10.5px] text-muted mt-0.5">{a.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </Section>
  );
}
