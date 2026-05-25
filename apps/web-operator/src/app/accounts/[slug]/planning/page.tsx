'use client';

import { AccountShell } from '@/components/AccountShell';
import { PlanningSurface } from '@/components/PlanningSurface';
import { getAccount } from '@/lib/accounts';
import { getAccountPlanning } from '@/lib/account-planning';

export default function Page({ params }: { params: { slug: string } }): JSX.Element {
  const account = getAccount(params.slug);
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
