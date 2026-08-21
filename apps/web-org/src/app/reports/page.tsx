import { KpiCard, Money, Section } from '@d2d/ui-web';
import { OrgShell } from '@/components/OrgShell';
import {
  apiFetch,
  sumWireCents,
  type CommissionsResponse,
  type ConversionPublic,
  type PageResponse,
} from '@/lib/api';

export const dynamic = 'force-dynamic';

interface MonthRow {
  key: string;
  label: string;
  conversions: number;
  grossCents: bigint;
  rakeCents: bigint;
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Monthly performance rollup — computed from the org's own live conversions
 * and commissions (latest 100 each; older history extends as pagination
 * lands). No figure here exists outside the database.
 */
export default async function ReportsPage(): Promise<JSX.Element> {
  const [{ data: conversions }, commissions] = await Promise.all([
    apiFetch<PageResponse<ConversionPublic>>('/conversions?limit=100'),
    apiFetch<CommissionsResponse>('/commissions?limit=100'),
  ]);

  const totalGross = sumWireCents(conversions, (c) => c.amountCents);
  const totalRake = sumWireCents(conversions, (c) => c.d2dRakeCents);
  const accrued = commissions.commissions.filter((c) => c.status === 'accrued');
  const accruedCents = sumWireCents(accrued, (c) => c.amountCents);

  const byMonth = new Map<string, MonthRow>();
  for (const c of conversions) {
    const key = monthKey(c.signedAt);
    const row = byMonth.get(key) ?? {
      key,
      label: monthLabel(key),
      conversions: 0,
      grossCents: 0n,
      rakeCents: 0n,
    };
    row.conversions += 1;
    row.grossCents += BigInt(c.amountCents);
    row.rakeCents += BigInt(c.d2dRakeCents);
    byMonth.set(key, row);
  }
  const months = [...byMonth.values()].sort((a, b) => (a.key < b.key ? 1 : -1));

  return (
    <OrgShell pageTitle="Reports">
      <div className="space-y-6 max-w-[1400px]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Conversions" value={conversions.length} hint="latest 100" />
          <KpiCard label="Gross value" value={<Money cents={totalGross} />} animate={false} />
          <KpiCard label="D2D rake" value={<Money cents={totalRake} />} animate={false} />
          <KpiCard
            label="Team commissions accrued"
            value={<Money cents={accruedCents} />}
            hint={`${accrued.length} accrual${accrued.length === 1 ? '' : 's'}`}
            animate={false}
          />
        </div>

        <Section
          title="Monthly performance"
          subtitle="Conversions, gross value and D2D rake by calendar month — live from your account's records."
          paddedBody={months.length === 0}
        >
          {months.length === 0 ? (
            <div className="py-8 text-center">
              <div className="text-[13px] font-medium text-ink">No conversions recorded yet</div>
              <div className="mt-1 text-[12px] text-muted">
                This report fills as your team converts leads in the field.
              </div>
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="text-right">Conversions</th>
                  <th className="text-right">Gross</th>
                  <th className="text-right">D2D rake</th>
                  <th className="text-right">Net of rake</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.key}>
                    <td className="font-medium text-ink">{m.label}</td>
                    <td className="text-right numeric">{m.conversions}</td>
                    <td className="text-right">
                      <Money cents={m.grossCents} />
                    </td>
                    <td className="text-right">
                      <Money cents={m.rakeCents} />
                    </td>
                    <td className="text-right font-medium text-ink">
                      <Money cents={m.grossCents - m.rakeCents} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>
    </OrgShell>
  );
}
