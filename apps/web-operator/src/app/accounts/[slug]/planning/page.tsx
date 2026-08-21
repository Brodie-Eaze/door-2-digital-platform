'use client';

import { use } from 'react';

import { AccountShell } from '@/components/AccountShell';
import { PlanningSurface } from '@/components/PlanningSurface';
import { PlanningEmpty, FirstRunBanner } from '@/components/AccountEmptyStates';
import { getAccount } from '@/lib/accounts';
import { getAccountPlanning } from '@/lib/account-planning';
import { firstRunSnapshot } from '@/lib/first-run';

export default function Page({
  params: paramsPromise,
}: {
  params: Promise<{ slug: string }>;
}): JSX.Element {
  const params = use(paramsPromise);
  const account = getAccount(params.slug);
  const firstRun = firstRunSnapshot(params.slug);
  if (firstRun.isFirstRun) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Planning · day / week / month">
        <div className="space-y-5 max-w-[1400px]">
          <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          <PlanningEmpty slug={params.slug} accountName={firstRun.accountName} />
        </div>
      </AccountShell>
    );
  }
  const planning = getAccountPlanning(params.slug);
  const scopeLabel = account ? `${account.shortName} · ${account.region}` : 'Account';

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Planning · day / week / month">
      <PlanningSurface
        scopeLabel={scopeLabel}
        defaultPlans={planning.plans}
        weekForecast={planning.weekForecast}
        monthRecos={planning.monthRecos}
        iPadCount={planning.iPadCount}
      />
    </AccountShell>
  );
}
