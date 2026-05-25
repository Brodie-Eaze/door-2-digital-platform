'use client';

import { MapPin, Sparkles } from 'lucide-react';
import { Section, StatusPill } from '@d2d/ui-web';
import type { AiZoneSuggestion } from './types';

interface AiNextZonesPanelProps {
  zones: AiZoneSuggestion[];
  scopeLabel: string;
}

/**
 * AI: where to send reps next. Renders propensity zone cards with an
 * "Assign N reps" CTA. Pure presentational — data comes from page.
 */
export function AiNextZonesPanel({ zones, scopeLabel }: AiNextZonesPanelProps): JSX.Element {
  return (
    <Section
      title="AI: where to send reps next"
      subtitle={`External data + propensity model · ${scopeLabel}`}
      action={<StatusPill tone="success">Live</StatusPill>}
    >
      <div className="space-y-3">
        {zones.map((zone) => (
          <div
            key={zone.id}
            className="bg-paper border border-line2 rounded-xl p-3 hover:border-accent transition"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[12.5px] font-semibold text-ink flex items-center gap-1.5">
                  <MapPin size={11} className="text-accent" /> {zone.name}
                </div>
                <div className="text-[10px] text-muted mt-0.5 line-clamp-2">
                  {zone.reasonOneLiner}
                </div>
                <div className="text-[9.5px] text-soft mt-1 numeric">
                  Saturation {zone.saturationPercent}% · lookalike pool
                </div>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold text-accent bg-accentSoft">
                  <Sparkles size={9} />
                  <span className="numeric">{zone.propensity.toFixed(2)}</span>
                </span>
                <span className="text-[9px] text-success numeric mt-1">
                  +{zone.estLiftPp}pp vs avg
                </span>
              </div>
            </div>
            <button className="mt-2 w-full text-[11px] py-1.5 rounded bg-ink text-surface font-semibold">
              Assign {zone.recommendedReps} rep{zone.recommendedReps === 1 ? '' : 's'} &rarr;
            </button>
          </div>
        ))}
      </div>
    </Section>
  );
}
