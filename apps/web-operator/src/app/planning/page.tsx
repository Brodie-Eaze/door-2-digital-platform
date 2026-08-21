'use client';

import { CalendarClock } from 'lucide-react';
import { PlatformShell } from '@/components/PlatformShell';

/**
 * /planning — HQ campaign planner (all accounts).
 *
 * The planner (forecasts + AI staffing recommendations) has no live backing
 * model yet — it's a propensity-engine feature. Rather than render fabricated
 * cross-account forecasts an operator could act on, we show an honest
 * "not yet available" state. No seed/fixture data is imported.
 */
export default function PlanningPage(): JSX.Element {
  return (
    <PlatformShell pageTitle="Planning · day / week / month">
      <div className="max-w-[720px] mx-auto mt-16">
        <div className="card card-pad flex flex-col items-center text-center gap-4 py-12">
          <div className="rounded-full bg-accentSoft p-4">
            <CalendarClock size={28} className="text-accent" />
          </div>
          <h2 className="text-lg font-semibold text-ink">Planning is not live yet</h2>
          <p className="text-[13px] text-muted max-w-[440px]">
            Cross-account forecasting and AI staffing recommendations arrive with the propensity
            engine. Until then this surface stays empty rather than showing estimated numbers you
            could staff a shift against. Day-to-day territory assignment and rostering are live in
            each account&apos;s console.
          </p>
        </div>
      </div>
    </PlatformShell>
  );
}
