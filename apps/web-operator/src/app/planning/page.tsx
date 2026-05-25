'use client';

import { PlatformShell } from '@/components/PlatformShell';
import { PlanningSurface } from '@/components/PlanningSurface';
import { HQ_PLANNING } from '@/lib/account-planning';

export default function PlanningPage(): JSX.Element {
  return (
    <PlatformShell pageTitle="Planning · day / week / month">
      <PlanningSurface
        scopeLabel="Texas region · all accounts"
        defaultPlans={HQ_PLANNING.plans}
        weekForecast={HQ_PLANNING.weekForecast}
        monthRecos={HQ_PLANNING.monthRecos}
        iPadCount={HQ_PLANNING.iPadCount}
      />
    </PlatformShell>
  );
}
