import { KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { OrgShell } from '@/components/OrgShell';
import { apiFetch, wireCents, type ConversionPublic, type PageResponse } from '@/lib/api';

function shortId(id: string): string {
  return id.slice(-6).toUpperCase();
}

function conversionFrequency(conversion: ConversionPublic): string {
  if (conversion.donation) return conversion.donation.frequency ?? 'one-off';
  if (conversion.sale) return conversion.sale.productSku;
  return conversion.type.replace('_', ' ');
}

function conversionStatus(conversion: ConversionPublic): string {
  return conversion.donation?.status ?? conversion.sale?.status ?? 'signed';
}

export default async function ConversionsPage(): Promise<JSX.Element> {
  const conversionPage = await apiFetch<PageResponse<ConversionPublic>>('/conversions');
  const conversions = conversionPage.data;
  const door = conversions.filter((conversion) => conversion.attributionSource === 'door').length;
  const inside = conversions.filter(
    (conversion) => conversion.attributionSource === 'inside_sales',
  ).length;
  const retarget = conversions.filter(
    (conversion) => conversion.attributionSource === 'retargeting',
  ).length;

  return (
    <OrgShell pageTitle="Conversions">
      <div className="space-y-6 max-w-[1400px]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Loaded" value={conversions.length} hint="first page" animate={false} />
          <KpiCard label="Door" value={door} hint="15% rake bucket" animate={false} />
          <KpiCard label="Inside sales" value={inside} hint="10% rake bucket" animate={false} />
          <KpiCard label="Retargeting" value={retarget} hint="5% rake bucket" animate={false} />
        </div>

        <Section
          title="Conversions"
          subtitle="Latest first · attribution drives D2D's rake calculation"
          paddedBody={false}
        >
          {conversions.length === 0 ? (
            <div className="text-[12px] text-muted p-5">
              No conversions yet — they appear when leads become donors or customers.
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Lead / donor</th>
                  <th>Amount</th>
                  <th>Frequency</th>
                  <th>Attribution</th>
                  <th>Processor</th>
                  <th>Knocker</th>
                  <th>Signed</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {conversions.map((conversion) => (
                  <tr key={conversion.id}>
                    <td className="text-[13px] text-ink">
                      {conversion.donation?.donorEmail ?? `Lead ${shortId(conversion.leadId)}`}
                    </td>
                    <td className="font-medium">
                      <Money cents={wireCents(conversion.amountCents)} region="US" />
                    </td>
                    <td className="text-[12px] text-muted">{conversionFrequency(conversion)}</td>
                    <td>
                      <span className="tag">{conversion.attributionSource.replace('_', ' ')}</span>
                    </td>
                    <td className="text-[11px]">
                      <span className="font-mono tracking-tight">{conversion.paymentProvider}</span>
                    </td>
                    <td>
                      {conversion.knockerId ? (
                        <span className="mono">{shortId(conversion.knockerId)}</span>
                      ) : (
                        <span className="text-soft">—</span>
                      )}
                    </td>
                    <td className="text-[11px] text-muted numeric">
                      {new Date(conversion.signedAt).toISOString().slice(11, 16)}
                    </td>
                    <td>
                      <StatusPill tone="success">{conversionStatus(conversion)}</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
        {conversionPage.nextCursor && (
          <div className="text-[11px] text-muted">
            More conversions are available after this first page.
          </div>
        )}
      </div>
    </OrgShell>
  );
}
