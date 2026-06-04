import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Banner, Card, KpiCard, Money, RegionBadge, Section, StatusPill } from '@d2d/ui-web';
import { PortalShell } from '@/components/PortalShell';
import { invoiceLabel, invoiceTone, solicitorLabel, solicitorTone } from '@/lib/status';
import {
  BILLING_PERIODS,
  BUCKET_LABEL,
  CLIENT,
  CURRENT_PERIOD,
  PLATFORM_FEE_CENTS,
  RAKE_BPS,
  STATE_REGISTRATIONS,
  type AttributionBucket,
  blendedTakeRate,
  bucketRake,
  conversionCount,
  fmtDate,
  grossCents,
  invoiceTotalCents,
  netRemittanceCents,
  stateCounts,
} from '@/lib/portal-data';

/** Percent change between two BigInt cent figures, for display deltas only. */
function pctDelta(
  curr: bigint,
  prev: bigint,
): { label: string; tone: 'positive' | 'negative' | 'neutral' } {
  if (prev === 0n) return { label: '—', tone: 'neutral' };
  const pct = (Number(curr - prev) / Number(prev)) * 100;
  const rounded = Math.round(pct * 10) / 10;
  const sign = rounded > 0 ? '+' : '';
  return {
    label: `${sign}${rounded.toFixed(1)}% vs ${PRIOR.label}`,
    tone: rounded > 0 ? 'positive' : rounded < 0 ? 'negative' : 'neutral',
  };
}

const PRIOR = BILLING_PERIODS[1]!;
const BUCKETS: AttributionBucket[] = ['door', 'insideSales', 'retargeting'];

export default function OverviewPage(): JSX.Element {
  const rake = bucketRake(CURRENT_PERIOD);
  const counts = stateCounts();
  const activeStates = STATE_REGISTRATIONS.filter((s) => s.status === 'approved');
  const blockedStates = STATE_REGISTRATIONS.filter((s) => s.status !== 'approved');

  const invoiceDelta = pctDelta(invoiceTotalCents(CURRENT_PERIOD), invoiceTotalCents(PRIOR));
  const grossDelta = pctDelta(grossCents(CURRENT_PERIOD), grossCents(PRIOR));
  const convDelta = pctDelta(
    BigInt(conversionCount(CURRENT_PERIOD)),
    BigInt(conversionCount(PRIOR)),
  );

  return (
    <PortalShell pageTitle="Overview">
      <div className="space-y-6 max-w-[1400px]">
        <Banner
          tone="info"
          action={
            <Link href="/invoices" className="pill pill-info whitespace-nowrap">
              View invoice
            </Link>
          }
        >
          <span className="font-medium text-ink">{CURRENT_PERIOD.label} invoice is open.</span>{' '}
          <span className="text-ink2">
            <Money cents={invoiceTotalCents(CURRENT_PERIOD)} region={CLIENT.region} /> due{' '}
            {fmtDate(CURRENT_PERIOD.dueAt)}.
          </span>
        </Banner>

        {/* Identity strip */}
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="h-section">Engagement</div>
              <div className="mt-1 text-[18px] font-semibold text-ink tracking-tight">
                {CLIENT.legalName}
              </div>
              <div className="mt-1 text-[13px] text-muted">
                {CLIENT.vertical} · Operated by {CLIENT.accountManager}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <RegionBadge region={CLIENT.region} />
              <div className="text-right">
                <div className="h-section">Blended take rate</div>
                <div className="mt-1 text-[18px] font-semibold text-ink numeric">
                  {blendedTakeRate(CURRENT_PERIOD)}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label={`${CURRENT_PERIOD.label} invoice`}
            value={<Money cents={invoiceTotalCents(CURRENT_PERIOD)} region={CLIENT.region} />}
            delta={invoiceDelta.label}
            deltaTone={invoiceDelta.tone}
            hint={invoiceLabel(CURRENT_PERIOD.status)}
          />
          <KpiCard
            label="Conversions"
            value={conversionCount(CURRENT_PERIOD)}
            delta={convDelta.label}
            deltaTone={convDelta.tone}
            hint="this period"
          />
          <KpiCard
            label="Gross collected"
            value={<Money cents={grossCents(CURRENT_PERIOD)} region={CLIENT.region} />}
            delta={grossDelta.label}
            deltaTone={grossDelta.tone}
            hint="all attribution buckets"
          />
          <KpiCard
            label="Net remittance"
            value={<Money cents={netRemittanceCents(CURRENT_PERIOD)} region={CLIENT.region} />}
            hint="pending settlement"
            animate={false}
          />
        </div>

        {/* Current period breakdown */}
        <Section
          title={`${CURRENT_PERIOD.label} — attribution & rake`}
          subtitle="Every D2D fee derives from the conversions in each bucket. The flat platform fee is added once."
          action={
            <Link
              href="/attribution"
              className="text-[12px] text-accent hover:underline inline-flex items-center gap-1"
            >
              Full report <ArrowRight size={12} aria-hidden />
            </Link>
          }
          paddedBody={false}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Bucket</th>
                <th className="text-right">Conversions</th>
                <th className="text-right">Gross</th>
                <th className="text-right">Rate</th>
                <th className="text-right">D2D rake</th>
              </tr>
            </thead>
            <tbody>
              {BUCKETS.map((b) => (
                <tr key={b}>
                  <td className="font-medium text-ink">{BUCKET_LABEL[b]}</td>
                  <td className="text-right numeric">{CURRENT_PERIOD.buckets[b].count}</td>
                  <td className="text-right">
                    <Money cents={CURRENT_PERIOD.buckets[b].grossCents} region={CLIENT.region} />
                  </td>
                  <td className="text-right numeric text-muted">{RAKE_BPS[b] / 100}%</td>
                  <td className="text-right">
                    <Money cents={rake[b]} region={CLIENT.region} />
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-line">
                <td className="font-semibold text-ink">Platform fee</td>
                <td className="text-right text-muted">—</td>
                <td className="text-right text-muted">—</td>
                <td className="text-right text-muted">flat</td>
                <td className="text-right">
                  <Money cents={PLATFORM_FEE_CENTS} region={CLIENT.region} />
                </td>
              </tr>
              <tr className="bg-paper">
                <td className="font-semibold text-ink">Invoice total</td>
                <td className="text-right numeric font-semibold">
                  {conversionCount(CURRENT_PERIOD)}
                </td>
                <td className="text-right font-semibold">
                  <Money cents={grossCents(CURRENT_PERIOD)} region={CLIENT.region} />
                </td>
                <td className="text-right text-muted">{blendedTakeRate(CURRENT_PERIOD)}</td>
                <td className="text-right font-semibold text-ink">
                  <Money cents={invoiceTotalCents(CURRENT_PERIOD)} region={CLIENT.region} />
                </td>
              </tr>
            </tbody>
          </table>
        </Section>

        {/* Compliance snapshot */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section
            title="State clearance"
            subtitle="Campaigns deliver only to approved states. This gate is enforced in code."
            action={
              <Link
                href="/state-clearance"
                className="text-[12px] text-accent hover:underline inline-flex items-center gap-1"
              >
                Matrix <ArrowRight size={12} aria-hidden />
              </Link>
            }
          >
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div>
                <div className="text-[22px] font-semibold text-ink numeric">{counts.approved}</div>
                <div className="h-section">Approved</div>
              </div>
              <div>
                <div className="text-[22px] font-semibold text-ink numeric">{counts.submitted}</div>
                <div className="h-section">Submitted</div>
              </div>
              <div>
                <div className="text-[22px] font-semibold text-ink numeric">{counts.pending}</div>
                <div className="h-section">In prep</div>
              </div>
              <div>
                <div className="text-[22px] font-semibold text-ink numeric">{counts.expired}</div>
                <div className="h-section">Expired</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeStates.map((s) => (
                <span key={s.state} className="tag" title={`${s.name} · approved`}>
                  {s.state}
                </span>
              ))}
              {blockedStates.map((s) => (
                <span
                  key={s.state}
                  className="tag opacity-50"
                  title={`${s.name} · ${solicitorLabel(s.status)} — not yet delivering`}
                >
                  {s.state}
                </span>
              ))}
            </div>
          </Section>

          <Section
            title="Billing history"
            subtitle="Last three periods."
            action={
              <Link
                href="/invoices"
                className="text-[12px] text-accent hover:underline inline-flex items-center gap-1"
              >
                All invoices <ArrowRight size={12} aria-hidden />
              </Link>
            }
            paddedBody={false}
          >
            <table className="tbl">
              <thead>
                <tr>
                  <th>Period</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {BILLING_PERIODS.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link
                        href={`/invoices/${p.id}`}
                        className="font-medium text-ink hover:text-accent"
                      >
                        {p.label}
                      </Link>
                      <div className="text-[11px] text-muted mono">{p.id}</div>
                    </td>
                    <td className="text-right">
                      <Money cents={invoiceTotalCents(p)} region={CLIENT.region} />
                    </td>
                    <td className="text-right">
                      <StatusPill tone={invoiceTone(p.status)}>{invoiceLabel(p.status)}</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </div>
      </div>
    </PortalShell>
  );
}
