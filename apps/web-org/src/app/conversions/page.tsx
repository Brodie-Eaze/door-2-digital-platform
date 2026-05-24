import { KpiCard, Money, RegionBadge, Section, StatusPill } from '@d2d/ui-web';
import { OrgShell } from '@/components/OrgShell';
import { CONVERSIONS } from '@/lib/fixtures';

export default function ConversionsPage(): JSX.Element {
  const door = CONVERSIONS.filter((c) => c.source === 'door').length;
  const inside = CONVERSIONS.filter((c) => c.source === 'inside_sales').length;
  const retarget = CONVERSIONS.filter((c) => c.source === 'retargeting').length;

  return (
    <OrgShell pageTitle="Conversions">
      <div className="space-y-6 max-w-[1400px]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Today" value={CONVERSIONS.length} delta="+12" deltaTone="positive" />
          <KpiCard label="Door" value={door} hint="15% rake bucket" />
          <KpiCard label="Inside sales" value={inside} hint="10% rake bucket" />
          <KpiCard label="Retargeting" value={retarget} hint="5% rake bucket" />
        </div>

        <Section
          title="Today's conversions"
          subtitle="Latest first · attribution drives D2D's rake calculation"
          paddedBody={false}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Donor</th>
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
              {CONVERSIONS.map((c, i) => (
                <tr key={i}>
                  <td className="text-[13px] text-ink">{c.donor}</td>
                  <td className="font-medium">
                    <Money cents={c.amountCents} region="US" />
                  </td>
                  <td className="text-[12px] text-muted">
                    {c.frequency ? c.frequency : 'one-off'}
                  </td>
                  <td>
                    <span className="tag">{c.source.replace('_', ' ')}</span>
                  </td>
                  <td className="text-[11px]">
                    <span className="font-mono tracking-tight">MiCamp</span>
                  </td>
                  <td>
                    {c.knocker !== '—' ? (
                      <span className="mono">{c.knocker}</span>
                    ) : (
                      <span className="text-soft">—</span>
                    )}
                  </td>
                  <td className="text-[11px] text-muted numeric">
                    {new Date(c.signedAt).toISOString().slice(11, 16)}
                  </td>
                  <td>
                    <StatusPill tone="success">Signed</StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
    </OrgShell>
  );
}
