'use client';

import { use } from 'react';

import { AccountShell } from '@/components/AccountShell';
import { PlanningEmpty } from '@/components/AccountEmptyStates';

/**
 * /accounts/[slug]/planning — the campaign planner.
 *
 * The planner (day/week/month plans, forecasts, AI staffing recommendations)
 * has no live backing model yet — that's a propensity-engine feature (same
 * category as the Command Centre's AI-zone suggestions, which also render an
 * honest empty state). Until it lands we show the real "No plans staged" empty
 * state rather than a fabricated forecast an operator could staff a shift
 * against. No seed/fixture data is imported.
 */
export default function Page({
  params: paramsPromise,
}: {
  params: Promise<{ slug: string }>;
}): JSX.Element {
  const params = use(paramsPromise);
  const accountName = params.slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <AccountShell accountSlug={params.slug} pageTitle="Planning · day / week / month">
      <div className="space-y-5 max-w-[1400px]">
        <PlanningEmpty slug={params.slug} accountName={accountName} />
      </div>
    </AccountShell>
  );
}
