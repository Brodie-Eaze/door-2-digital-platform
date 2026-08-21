import { EmptyState, KpiCard, Money, Section } from '@d2d/ui-web';
import type { AttributionSource } from '@d2d/shared-types';
import { PortalShell } from '@/components/PortalShell';
import {
  apiFetch,
  getSession,
  sumWireCents,
  wireCents,
  type ConversionPublic,
  type PageResponse,
} from '@/lib/api';

const BUCKETS: { source: AttributionSource; label: string; description: string }[] = [
  { source: 'door', label: 'Door-closed', description: 'Closed at the door by a D2D knocker.' },
  {
    source: 'inside_sales',
    label: 'Inside-sales',
    description: 'Closed by the inside-sales desk after a warm field lead.',
  },
  {
    source: 'retargeting',
    label: 'Retargeting',
    description: 'Closed via an AI-retargeting ad after a knocked-not-converted visit.',
  },
];

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Share of a part within a whole as a 0–100 number, for bar widths only. */
function sharePct(part: bigint, whole: bigint): number {
  if (whole === 0n) return 0;
  return Math.round((Number(part) / Number(whole)) * 1000) / 10;
}

export default async function AttributionPage(): Promise<JSX.Element> {
  const { user, org } = await getSession();
  const { data: conversions } =
    await apiFetch<PageResponse<ConversionPublic>>('/conversions?limit=100');

  const totalGross = sumWireCents(conversions, (c) => c.amountCents);
  const totalRake = sumWireCents(conversions, (c) => c.d2dRakeCents);

  const buckets = BUCKETS.map((b) => {
    const rows = conversions.filter((c) => c.attributionSource === b.source);
    return {
      ...b,
      count: rows.length,
      grossCents: sumWireCents(rows, (c) => c.amountCents),
      rakeCents: sumWireCents(rows, (c) => c.d2dRakeCents),
    };
  });

  const recent = [...conversions]
    .sort((a, b) => new Date(b.signedAt).getTime() - new Date(a.signedAt).getTime())
    .slice(0, 15);

  return (
    <PortalShell
      pageTitle="Attribution"
      orgName={org.tradingName}
      userName={`${user.givenName} ${user.familyName}`}
      userEmail={user.email}
      userRole={user.role}
    >
      <div className="space-y-6 max-w-[1400px]">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Conversions loaded" value={conversions.length} hint="latest 100" />
          <KpiCard
            label="Gross value"
            value={<Money cents={totalGross} region={org.regionCode} />}
            animate={false}
          />
          <KpiCard
            label="D2D rake"
            value={<Money cents={totalRake} region={org.regionCode} />}
            animate={false}
          />
          <KpiCard
            label="Blended take rate"
            value={
              totalGross === 0n
                ? '—'
                : `${((Number(totalRake) / Number(totalGross)) * 100).toFixed(2)}%`
            }
          />
        </div>

        {conversions.length === 0 ? (
          <Section title="Attribution mix">
            <EmptyState
              title="No conversions yet"
              description="Attribution buckets fill in as knockers, inside sales, and retargeting close conversions."
            />
          </Section>
        ) : (
          <Section
            title="Attribution mix"
            subtitle="Each conversion is attributed to exactly one bucket, which sets its rake rate. Share is by gross value."
          >
            <div className="space-y-5">
              {buckets.map((b) => {
                const share = sharePct(b.grossCents, totalGross);
                const takeRate =
                  b.grossCents === 0n ? 0 : (Number(b.rakeCents) / Number(b.grossCents)) * 100;
                return (
                  <div key={b.source}>
                    <div className="flex items-baseline justify-between gap-3 mb-1.5">
                      <div className="min-w-0">
                        <span className="text-[13px] font-medium text-ink">{b.label}</span>
                        <span className="ml-2 text-[11px] text-muted">
                          {takeRate.toFixed(1)}% rake
                        </span>
                      </div>
                      <div className="text-[12px] text-muted shrink-0">
                        <span className="numeric">{b.count}</span> conv ·{' '}
                        <Money cents={b.grossCents} region={org.regionCode} /> ·{' '}
                        <span className="numeric font-medium text-ink">{share}%</span>
                      </div>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${share}%` }} />
                    </div>
                    <div className="mt-1.5 text-[11px] text-muted">{b.description}</div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {recent.length > 0 && (
          <Section
            title="Recent conversions"
            subtitle="Latest signed conversions, most recent first."
            paddedBody={false}
          >
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Bucket</th>
                  <th className="text-right">Gross</th>
                  <th className="text-right">D2D rake</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((c) => (
                  <tr key={c.id}>
                    <td className="text-muted">{fmtDate(c.signedAt)}</td>
                    <td className="font-medium text-ink">
                      {BUCKETS.find((b) => b.source === c.attributionSource)?.label ??
                        c.attributionSource}
                    </td>
                    <td className="text-right">
                      <Money cents={wireCents(c.amountCents)} region={org.regionCode} />
                    </td>
                    <td className="text-right">
                      <Money cents={wireCents(c.d2dRakeCents)} region={org.regionCode} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        <Section
          title="How retargeting closes the loop"
          subtitle="The lowest-rake bucket exists because of the field-to-ad attribution chain."
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
                <span className="mono">attributionSource = retargeting</span>.
              </span>
            </li>
          </ol>
        </Section>
      </div>
    </PortalShell>
  );
}
