import { CheckCircle2 } from 'lucide-react';
import { Banner, EmptyState, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { ATTRIBUTION_LABEL, type AttributionSource } from '@d2d/ui-tokens/taxonomy';
import { AccountShell } from '@/components/AccountShell';
import { FirstRunBanner } from '@/components/AccountEmptyStates';
import { getAccount } from '@/lib/accounts';
import { seedFor } from '@/lib/seed';
import { rollupFor } from '@/lib/seed/kpis';
import { firstRunSnapshot } from '@/lib/first-run';

const FREQ_LABEL: Record<string, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
  'one-off': 'One-off',
};

const ATTRIBUTION_TONE: Record<AttributionSource, 'success' | 'info' | 'warn' | 'muted'> = {
  door: 'success',
  inside_sales: 'info',
  retargeting: 'warn',
  other: 'muted',
};

const PAYMENT_TONE: Record<string, 'success' | 'warn' | 'danger'> = {
  cleared: 'success',
  pending: 'warn',
  declined: 'danger',
};

function timeAgo(iso: string, now = new Date()): string {
  const diff = (now.getTime() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

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
    {} as Record<AttributionSource, number>,
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

        <Section
          title={`Recent ledger · ${seed.conversions.length} entries`}
          subtitle="Reverse-chronological · click any row for the full audit chain"
          action={
            <span className="text-[11px] text-muted numeric">
              Total visible: <Money cents={ledgerTotal} region={region} className="!text-[12px]" />
            </span>
          }
          paddedBody={false}
        >
          <div className="max-h-[760px] overflow-y-auto">
            <table className="tbl">
              <thead className="sticky top-0 bg-surface z-10">
                <tr>
                  <th>When</th>
                  <th>Donor / customer</th>
                  <th>Amount</th>
                  <th>Frequency</th>
                  <th>Attribution</th>
                  <th>Rep</th>
                  <th>Territory</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {seed.conversions.map((c) => (
                  <tr key={c.id}>
                    <td className="text-[11px] text-muted numeric">{timeAgo(c.capturedAt)}</td>
                    <td>
                      <div className="text-[13px] text-ink">{c.donorName}</div>
                      <div className="text-[10px] text-muted mono">{c.donorEmailMasked}</div>
                    </td>
                    <td>
                      <Money cents={c.amountCents} region={region} />
                    </td>
                    <td className="text-[12px] text-muted">{FREQ_LABEL[c.frequency]}</td>
                    <td>
                      <StatusPill tone={ATTRIBUTION_TONE[c.attribution]}>
                        {ATTRIBUTION_LABEL[c.attribution]}
                      </StatusPill>
                    </td>
                    <td>
                      <span className="mono">{c.repInitials}</span>
                    </td>
                    <td className="text-[12px] text-muted">{c.territory}</td>
                    <td>
                      <StatusPill tone={PAYMENT_TONE[c.paymentStatus]!}>
                        {c.paymentStatus[0]!.toUpperCase() + c.paymentStatus.slice(1)}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </AccountShell>
  );
}
