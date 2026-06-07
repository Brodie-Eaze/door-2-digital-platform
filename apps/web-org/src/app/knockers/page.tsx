import { KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { OrgShell } from '@/components/OrgShell';
import { KNOCKERS } from '@/lib/fixtures';

export default function KnockersPage(): JSX.Element {
  const active = KNOCKERS.filter((k) => k.status === 'active');
  const idle = KNOCKERS.filter((k) => k.status === 'idle');
  const totalKnocks = active.reduce((sum, k) => sum + k.knocks, 0);
  const totalRev = active.reduce((sum, k) => sum + k.revenueCents, 0n);

  return (
    <OrgShell pageTitle="Knockers">
      <div className="space-y-6 max-w-[1400px]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Active today"
            value={active.length}
            hint={`${KNOCKERS.length} on roster`}
          />
          <KpiCard label="Idle past start" value={idle.length} hint="SMS auto-sent" />
          <KpiCard label="Total knocks" value={totalKnocks} delta="+8.4%" deltaTone="positive" />
          <KpiCard
            label="Total revenue today"
            value={<Money cents={totalRev} region="US" />}
            delta="+18.2%"
            deltaTone="positive"
          />
        </div>

        <Section
          title="Today's roster"
          subtitle="Active rep performance · ranked by conversions"
          paddedBody={false}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Rep</th>
                <th>Status</th>
                <th>Knocks</th>
                <th>Conversions</th>
                <th>Conv. rate</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {[...KNOCKERS]
                .sort((a, b) => b.conversions - a.conversions)
                .map((k) => (
                  <tr key={k.initials}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="mono">{k.initials}</span>
                        <span className="text-[13px] text-ink">{k.name}</span>
                      </div>
                    </td>
                    <td>
                      <StatusPill tone={k.status === 'active' ? 'success' : 'warn'}>
                        {k.status === 'active' ? 'Active' : 'Idle'}
                      </StatusPill>
                    </td>
                    <td className="numeric text-[13px]">{k.knocks}</td>
                    <td className="numeric text-[13px]">{k.conversions}</td>
                    <td>
                      {k.conversionRate > 0 ? (
                        <span className="numeric text-[13px]">{k.conversionRate}%</span>
                      ) : (
                        <span className="text-soft">—</span>
                      )}
                    </td>
                    <td>
                      <Money cents={k.revenueCents} region="US" emptyAsDash />
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
