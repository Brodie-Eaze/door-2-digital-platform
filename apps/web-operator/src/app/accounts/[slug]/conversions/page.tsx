import { CheckCircle2 } from 'lucide-react';
import { Banner, EmptyState, KpiCard, Money } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { FirstRunBanner } from '@/components/AccountEmptyStates';
import { getAccount } from '@/lib/accounts';
import { seedFor } from '@/lib/seed';
import { rollupFor } from '@/lib/seed/kpis';
import { firstRunSnapshot } from '@/lib/first-run';
import { ConversionsLedger } from './ConversionsLedger';

export default function ConversionsPage({ params }: { params: { slug: string } }): JSX.Element {
  const account = getAccount(params.slug);
  const firstRun = firstRunSnapshot(params.slug);
  if (!account || firstRun.isFirstRun) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Conversions">
        <div className="space-y-5 max-w-[1400px]">
          {firstRun.isFirstRun && (
            <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          )}
          <EmptyState
            icon={CheckCircle2}
            title="No conversions yet."
            description="Every door, call, and retarget click that lands a sale shows up here with full attribution: which knocker, which campaign, which ticket size. The first one usually lands inside 90 minutes of the first shift."
            primaryAction={{
              label: 'Onboard knockers',
              href: `/accounts/${params.slug}/knockers`,
            }}
            secondaryAction={{
              label: 'See an example',
              href: '/accounts/hope-forward/conversions',
            }}
            variant="first-run"
          />
        </div>
      </AccountShell>
    );
  }
  const seed = seedFor(params.slug);
  const rollup = rollupFor(params.slug);
  const region = account.region === 'AU' ? 'AU' : 'US';

  // Attribution breakdown on the visible 60-row ledger.
  const byAttribution = seed.conversions.reduce(
    (acc, c) => {
      acc[c.attribution] = (acc[c.attribution] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const doorCount = byAttribution.door ?? 0;
  const insideCount = byAttribution.inside_sales ?? 0;
  const retargCount = byAttribution.retargeting ?? 0;

  // Sum of recent 60 entries — for the ledger header KPI.
  const ledgerTotal = seed.conversions.reduce((s, c) => s + c.amountCents, 0n);

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Conversions">
      <div className="space-y-5 max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px]">
            Conversion ledger for <span className="font-semibold">{account.shortName}</span> · every
            captured pledge, donation, or contract scored by attribution (door / inside /
            retargeting). Payments cleared via{' '}
            {account.region === 'AU' ? 'Stripe AU + GoCardless NPP' : 'MiCamp'}.
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Conv · today"
            value={rollup.conversionsToday.toLocaleString()}
            hint={`${rollup.convRateToday.toFixed(1)}% rate`}
            delta="+12%"
            deltaTone="positive"
          />
          <KpiCard
            label="Conv · 7d"
            value={rollup.conversionsWeek.toLocaleString()}
            delta="+18%"
            deltaTone="positive"
          />
          <KpiCard
            label="Conv · MTD"
            value={rollup.conversionsMTD.toLocaleString()}
            delta="+22%"
            deltaTone="positive"
          />
          <KpiCard
            label="Revenue · MTD"
            value={<Money cents={rollup.revenueCentsMTD} region={region} />}
            delta="+18.2%"
            deltaTone="positive"
            hint={`LTV ${(rollup.ltvCentsMTD / rollup.revenueCentsMTD).toString()}x`}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard label="Door" value={doorCount} hint="recent 60" />
          <KpiCard label="Inside sales" value={insideCount} hint="recent 60" />
          <KpiCard label="Retargeting" value={retargCount} hint="recent 60" />
        </div>

        <ConversionsLedger
          rows={seed.conversions}
          region={region}
          ledgerTotalCents={ledgerTotal}
        />
      </div>
    </AccountShell>
  );
}
