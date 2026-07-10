import { KpiCard, Money, Section } from '@d2d/ui-web';
import { PortalShell } from '@/components/PortalShell';
import {
  BILLING_PERIODS,
  BUCKET_DESCRIPTION,
  BUCKET_LABEL,
  CLIENT,
  CURRENT_PERIOD,
  RAKE_BPS,
  type AttributionBucket,
  blendedTakeRate,
  bucketRake,
  conversionCount,
  grossCents,
  totalRakeCents,
} from '@/lib/portal-data';

const BUCKETS: AttributionBucket[] = ['door', 'insideSales', 'retargeting'];

/** Share of a part within a whole as a 0–100 number, for bar widths only. */
function sharePct(part: bigint, whole: bigint): number {
  if (whole === 0n) return 0;
  return Math.round((Number(part) / Number(whole)) * 1000) / 10;
}

export default function AttributionPage(): JSX.Element {
  const totalGross = grossCents(CURRENT_PERIOD);

  return (
    <PortalShell pageTitle="Attribution">
      <div className="space-y-6 max-w-[1400px]">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Conversions"
            value={conversionCount(CURRENT_PERIOD)}
            hint={CURRENT_PERIOD.label}
          />
          <KpiCard
            label="Gross value"
            value={<Money cents={totalGross} region={CLIENT.region} />}
            animate={false}
          />
          <KpiCard
            label="D2D rake"
            value={<Money cents={totalRakeCents(CURRENT_PERIOD)} region={CLIENT.region} />}
            animate={false}
          />
          <KpiCard label="Blended take rate" value={blendedTakeRate(CURRENT_PERIOD)} />
        </div>

        <Section
          title={`Attribution mix — ${CURRENT_PERIOD.label}`}
          subtitle="Each conversion is attributed to exactly one bucket, which sets its rake rate. Share is by gross value."
        >
          <div className="space-y-5">
            {BUCKETS.map((b) => {
              const share = sharePct(CURRENT_PERIOD.buckets[b].grossCents, totalGross);
              return (
                <div key={b}>
                  <div className="flex items-baseline justify-between gap-3 mb-1.5">
                    <div className="min-w-0">
                      <span className="text-[13px] font-medium text-ink">{BUCKET_LABEL[b]}</span>
                      <span className="ml-2 text-[11px] text-muted">{RAKE_BPS[b] / 100}% rake</span>
                    </div>
                    <div className="text-[12px] text-muted shrink-0">
                      <span className="numeric">{CURRENT_PERIOD.buckets[b].count}</span> conv ·{' '}
                      <Money cents={CURRENT_PERIOD.buckets[b].grossCents} region={CLIENT.region} />{' '}
                      · <span className="numeric font-medium text-ink">{share}%</span>
                    </div>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${share}%` }} />
                  </div>
                  <div className="mt-1.5 text-[11px] text-muted">{BUCKET_DESCRIPTION[b]}</div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section
          title="Per-bucket trend"
          subtitle="Conversions and D2D rake by attribution bucket across recent periods."
          paddedBody={false}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Period</th>
                {BUCKETS.map((b) => (
                  <th key={b} className="text-right">
                    {BUCKET_LABEL[b]}
                  </th>
                ))}
                <th className="text-right">Total conv</th>
                <th className="text-right">Total rake</th>
              </tr>
            </thead>
            <tbody>
              {BILLING_PERIODS.map((p) => {
                const r = bucketRake(p);
                return (
                  <tr key={p.id}>
                    <td className="font-medium text-ink">{p.label}</td>
                    {BUCKETS.map((b) => (
                      <td key={b} className="text-right">
                        <div className="numeric">{p.buckets[b].count}</div>
                        <div className="text-[11px] text-muted">
                          <Money cents={r[b]} region={CLIENT.region} />
                        </div>
                      </td>
                    ))}
                    <td className="text-right numeric font-medium">{conversionCount(p)}</td>
                    <td className="text-right font-medium text-ink">
                      <Money cents={totalRakeCents(p)} region={CLIENT.region} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>

        <Section
          title="How retargeting closes the loop"
          subtitle="The 5% bucket exists because of the field-to-ad attribution chain."
        >
          <ol className="space-y-2.5 text-[13px] text-ink2">
            <li className="flex gap-3">
              <span className="tag shrink-0">1</span>
              <span>
                A knocker visits an address; the resident is interested but does not convert at the
                door. The visit is logged as a knocked-not-converted lead.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="tag shrink-0">2</span>
              <span>
                That lead is added to a hashed custom audience and served an AI-generated
                retargeting ad on Meta / Google / TikTok — never with raw PII.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="tag shrink-0">3</span>
              <span>
                The resident clicks through and converts online. The conversion returns tagged{' '}
                <span className="mono">attributionSource = retargeting</span> and is billed at the{' '}
                {RAKE_BPS.retargeting / 100}% rate — the lowest of the three buckets.
              </span>
            </li>
          </ol>
        </Section>
      </div>
    </PortalShell>
  );
}
