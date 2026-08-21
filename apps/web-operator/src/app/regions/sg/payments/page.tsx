'use client';

import { useEffect, useState } from 'react';
import { CreditCard, CheckCircle2 } from 'lucide-react';
import { Banner, KpiCard, Money, Section } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { DataSourceBadge, useDataFreshness } from '@/components/DataSourceBadge';
import {
  PaymentFeedEmpty,
  MandatesEmpty,
  CohortRetentionEmpty,
} from '@/components/RegionEmptyStates';

/**
 * There is no Stripe webhook-event log, PayNow mandate table, or cohort
 * retention aggregate in the schema — the fixtures that used to live here
 * (STRIPE_SG_EVENTS, PAYNOW_MANDATES, SG_COHORTS) were pure fabrication.
 * What IS real: Conversion.amountCents/d2dRakeCents/processorResidualCents
 * and Donation.status, aggregated region-wide by GET /api/regions/SG/billing.
 */
interface BillingResponse {
  mtd: { volumeCents: string; rakeCents: string; residualCents: string; conversionCount: number };
  byProvider: { provider: string; volumeCents: string; count: number }[];
  recurringActive: number;
  lastConversion: { signedAt: string; provider: string; amountCents: string } | null;
}

export default function SgPaymentsPage(): JSX.Element {
  const [billing, setBilling] = useState<BillingResponse | null>(null);
  const { source, markFresh, markFixture } = useDataFreshness('fixture');

  useEffect(() => {
    let cancelled = false;
    (async (): Promise<void> => {
      try {
        const res = await fetch('/api/regions/SG/billing', {
          headers: { accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`billing ${res.status}`);
        const json = (await res.json()) as BillingResponse;
        if (cancelled) return;
        setBilling(json);
        markFresh();
      } catch {
        if (cancelled) return;
        markFixture();
      }
    })();
    return (): void => {
      cancelled = true;
    };
  }, [markFresh, markFixture]);

  return (
    <PlatformShell pageTitle="SG payments · Stripe SG + PayNow">
      <div className="space-y-5 max-w-[1700px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <CreditCard size={14} className="text-accent" />
            <span>
              SG money rails. <span className="font-semibold">Stripe SG</span> for card + recurring
              (SGD settled to DBS). <span className="font-semibold">PayNow Corporate</span> for QR
              push-pay against UEN <span className="mono">T26CC0021K</span>. MAS Outsourcing notice
              on file · AWS ap-southeast-1 residency.
            </span>
          </span>
        </Banner>

        <div className="flex items-center justify-end gap-2">
          <DataSourceBadge source={source} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="Total MTD volume"
            value={<Money cents={BigInt(billing?.mtd.volumeCents ?? '0')} region="SG" />}
            hint={`${billing?.mtd.conversionCount ?? 0} conversions`}
          />
          <KpiCard
            label="D2D rake MTD"
            value={<Money cents={BigInt(billing?.mtd.rakeCents ?? '0')} region="SG" />}
          />
          <KpiCard
            label="Processor residual MTD"
            value={<Money cents={BigInt(billing?.mtd.residualCents ?? '0')} region="SG" />}
          />
          <KpiCard
            label="Recurring active"
            value={billing?.recurringActive ?? 0}
            hint="active Donation subscriptions"
          />
        </div>

        <Section
          title="Stripe SG · payment event feed"
          subtitle="Per-webhook activity stream"
          paddedBody={false}
        >
          <PaymentFeedEmpty />
        </Section>

        <Section
          title="PayNow Corporate · QR-code mandates"
          subtitle="UEN T26CC0021K"
          paddedBody={false}
        >
          <MandatesEmpty />
        </Section>

        <Section
          title="Recurring giving cohort · net retention (SG)"
          subtitle="By sign-up month"
          paddedBody={false}
        >
          <CohortRetentionEmpty />
        </Section>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SignalCard
            icon={<CheckCircle2 size={14} className="text-success" />}
            label="Last conversion settled"
            value={
              billing?.lastConversion
                ? new Date(billing.lastConversion.signedAt).toLocaleString('en-SG')
                : 'No conversions yet'
            }
            hint={
              billing?.lastConversion
                ? `${billing.lastConversion.provider} · S$${(
                    Number(BigInt(billing.lastConversion.amountCents)) / 100
                  ).toLocaleString()}`
                : 'Region has no settled conversions'
            }
          />
        </div>
      </div>
    </PlatformShell>
  );
}

function SignalCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}): JSX.Element {
  return (
    <div className="card card-pad">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted font-medium">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-[16px] font-semibold text-ink tracking-tight numeric">
        {value}
      </div>
      <div className="text-[11px] text-muted mt-0.5">{hint}</div>
    </div>
  );
}
