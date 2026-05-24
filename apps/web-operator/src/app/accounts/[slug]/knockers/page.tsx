import { KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { accountData } from '@/lib/account-fixtures';

export default function KnockersPage({ params }: { params: { slug: string } }): JSX.Element {
  const { account, knockers } = accountData(params.slug);
  if (!account)
    return (
      <AccountShell accountSlug={params.slug}>
        <div>Not found</div>
      </AccountShell>
    );
  const active = knockers.filter((n) => n.status === 'active');
  const idle = knockers.filter((n) => n.status === 'idle');
  const totalRev = active.reduce((s, n) => s + n.revenueCents, 0n);

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Knockers">
      <div className="space-y-6 max-w-[1400px]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Active today"
            value={active.length}
            hint={`${knockers.length} on roster`}
          />
          <KpiCard label="Idle past start" value={idle.length} hint="auto-SMS sent" />
          <KpiCard
            label="Total knocks"
            value={active.reduce((s, n) => s + n.knocks, 0)}
            delta="+8.4%"
            deltaTone="positive"
          />
          <KpiCard
            label="Revenue today"
            value={<Money cents={totalRev} region={account.region === 'AU' ? 'AU' : 'US'} />}
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
                <th>Knocker</th>
                <th>Territory</th>
                <th>Status</th>
                <th>Knocks</th>
                <th>Conv.</th>
                <th>Conv. rate</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {[...knockers]
                .sort((a, b) => b.conversions - a.conversions)
                .map((n) => (
                  <tr key={n.initials}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="mono">{n.initials}</span>
                        <span className="text-[13px] text-ink">{n.name}</span>
                      </div>
                    </td>
                    <td className="text-[12px] text-muted">{n.territory}</td>
                    <td>
                      <StatusPill tone={n.status === 'active' ? 'success' : 'warn'}>
                        {n.status === 'active' ? 'Active' : 'Idle'}
                      </StatusPill>
                    </td>
                    <td className="numeric text-[13px]">{n.knocks}</td>
                    <td className="numeric text-[13px]">{n.conversions}</td>
                    <td className="numeric text-[13px]">
                      {n.knocks > 0 ? (
                        `${((n.conversions / n.knocks) * 100).toFixed(1)}%`
                      ) : (
                        <span className="text-soft">—</span>
                      )}
                    </td>
                    <td>
                      <Money
                        cents={n.revenueCents}
                        region={account.region === 'AU' ? 'AU' : 'US'}
                        emptyAsDash
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Section>
      </div>
    </AccountShell>
  );
}
