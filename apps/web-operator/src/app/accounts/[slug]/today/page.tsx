import { Trophy, MapPin, Users } from 'lucide-react';
import { AnomalyCard, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { accountData } from '@/lib/account-fixtures';

export default function TodayPage({ params }: { params: { slug: string } }): JSX.Element {
  const { account, anomalies, noctuas } = accountData(params.slug);
  if (!account)
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Not found">
        <div>Account not found</div>
      </AccountShell>
    );

  const topNoctuas = [...noctuas]
    .filter((n) => n.status === 'active')
    .sort((a, b) => b.conversions - a.conversions)
    .slice(0, 5);
  const todayRev = topNoctuas.reduce((s, n) => s + n.revenueCents, 0n);

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Today">
      <div className="space-y-6 max-w-[1400px]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Knocks today"
            value={topNoctuas.reduce((s, n) => s + n.knocks, 0)}
            delta="+8.4%"
            deltaTone="positive"
          />
          <KpiCard
            label="Conversions today"
            value={topNoctuas.reduce((s, n) => s + n.conversions, 0)}
            delta="+12.1%"
            deltaTone="positive"
          />
          <KpiCard label="Conv. rate" value="14.8%" delta="+0.6pp" deltaTone="positive" />
          <KpiCard
            label="Revenue today"
            value={<Money cents={todayRev} region={account.region === 'AU' ? 'AU' : 'US'} />}
            delta="+18.2%"
            deltaTone="positive"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="h-section">Needs attention</h2>
            {anomalies.map((a, i) => (
              <AnomalyCard
                key={i}
                severity={a.severity}
                title={a.title}
                description={a.description}
                timestamp={a.timestamp}
              />
            ))}
          </div>

          <div className="space-y-4">
            <Section
              title="Live leaderboard"
              subtitle={`Top Noctuas — ${account.shortName}`}
              paddedBody={false}
            >
              <div className="divide-y divide-line2">
                {topNoctuas.map((n, i) => (
                  <div key={n.initials} className="flex items-center gap-3 px-5 py-3">
                    <div
                      className={`w-5 text-[11px] font-semibold ${i === 0 ? 'text-success' : 'text-soft'}`}
                    >
                      {i + 1}
                    </div>
                    <span className="mono">{n.initials}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-ink truncate">{n.name}</div>
                      <div className="text-[11px] text-muted numeric">
                        {n.knocks} knocks · {n.conversions} conv.
                      </div>
                    </div>
                    {i === 0 && <Trophy size={14} className="text-success" />}
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Active territories" subtitle="Today's coverage" paddedBody={false}>
              <div className="divide-y divide-line2">
                {Array.from({ length: account.territoriesActive })
                  .slice(0, 5)
                  .map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-5 py-3">
                      <MapPin size={14} className="text-soft shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-ink truncate">
                          {account.region === 'AU'
                            ? [
                                'Melbourne CBD',
                                'Sydney Inner',
                                'Brisbane North',
                                'Perth West',
                                'Adelaide East',
                              ][i]
                            : [
                                'Austin East',
                                'Dallas Metro',
                                'Phoenix West',
                                'Atlanta N',
                                'Houston SE',
                              ][i]}
                        </div>
                        <div className="text-[11px] text-muted numeric flex items-center gap-2">
                          <Users size={10} /> {3 + ((i * 3) % 10)} · {40 + ((i * 9) % 50)}% covered
                        </div>
                      </div>
                      <StatusPill tone="success">{(8 + i * 2).toFixed(1)}%</StatusPill>
                    </div>
                  ))}
              </div>
            </Section>
          </div>
        </div>
      </div>
    </AccountShell>
  );
}
