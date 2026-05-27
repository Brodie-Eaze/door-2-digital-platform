import { KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { REP_STATUS_LABEL, REP_STATUS_TONE } from '@d2d/ui-tokens/taxonomy';
import { AccountShell } from '@/components/AccountShell';
import { KnockersEmpty, FirstRunBanner } from '@/components/AccountEmptyStates';
import { accountData } from '@/lib/account-fixtures';
import { rollupFor } from '@/lib/seed/kpis';
import { firstRunSnapshot } from '@/lib/first-run';

function tenureLabel(days: number): string {
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}yr`;
}

export default function KnockersPage({ params }: { params: { slug: string } }): JSX.Element {
  const firstRun = firstRunSnapshot(params.slug);
  if (firstRun.isFirstRun) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Knockers">
        <div className="space-y-5 max-w-[1400px]">
          <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          <KnockersEmpty slug={params.slug} accountName={firstRun.accountName} />
        </div>
      </AccountShell>
    );
  }
  const { account, knockers } = accountData(params.slug);
  if (!account || knockers.length === 0) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Knockers">
        <div className="space-y-5 max-w-[1400px]">
          {firstRun.isFirstRun && (
            <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          )}
          <KnockersEmpty slug={params.slug} accountName={firstRun.accountName} />
        </div>
      </AccountShell>
    );
  }

  const rollup = rollupFor(params.slug);
  const active = knockers.filter((n) => n.status === 'active');
  const onBreak = knockers.filter((n) => n.status === 'break');
  const idle = knockers.filter((n) => n.status === 'idle');
  const offline = knockers.filter((n) => n.status === 'offline');
  const totalRev = knockers.reduce((s, n) => s + n.revenueCents, 0n);
  const totalKnocks = knockers.reduce((s, n) => s + n.knocks, 0);

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Knockers">
      <div className="space-y-6 max-w-[1400px]">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard
            label="Roster"
            value={rollup.rosterSize.toLocaleString()}
            hint={`${active.length} active now`}
          />
          <KpiCard
            label="On shift"
            value={(active.length + onBreak.length).toLocaleString()}
            hint={`${onBreak.length} on break`}
          />
          <KpiCard
            label="Idle / Offline"
            value={(idle.length + offline.length).toLocaleString()}
            hint={idle.length > 0 ? `${idle.length} idle · auto-SMS` : 'roster clean'}
          />
          <KpiCard
            label="Knocks today"
            value={totalKnocks.toLocaleString()}
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
          title={`Today's roster · ${knockers.length} of ${rollup.rosterSize} shown`}
          subtitle="Sorted by conversions · varied tenure (1d–4yr) · conv rate spread 3-38%"
          paddedBody={false}
        >
          <div className="max-h-[800px] overflow-y-auto">
            <table className="tbl">
              <thead className="sticky top-0 bg-surface z-10">
                <tr>
                  <th>Knocker</th>
                  <th>Tenure</th>
                  <th>Territory</th>
                  <th>Status</th>
                  <th>Knocks</th>
                  <th>Conv.</th>
                  <th>Today rate</th>
                  <th>Lifetime rate</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {[...knockers]
                  .sort((a, b) => b.conversions - a.conversions)
                  .map((n) => {
                    const todayRate = n.knocks > 0 ? (n.conversions / n.knocks) * 100 : 0;
                    return (
                      <tr key={n.initials + n.name}>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="mono">{n.initials}</span>
                            <span className="text-[13px] text-ink">{n.name}</span>
                          </div>
                        </td>
                        <td className="text-[12px] text-muted numeric">
                          {tenureLabel(n.tenureDays)}
                        </td>
                        <td className="text-[12px] text-muted">{n.territory}</td>
                        <td>
                          <StatusPill
                            tone={REP_STATUS_TONE[n.status === 'training' ? 'idle' : n.status]}
                          >
                            {REP_STATUS_LABEL[n.status === 'training' ? 'idle' : n.status]}
                          </StatusPill>
                        </td>
                        <td className="numeric text-[13px]">{n.knocks}</td>
                        <td className="numeric text-[13px]">{n.conversions}</td>
                        <td className="numeric text-[13px]">
                          {n.knocks > 0 ? (
                            `${todayRate.toFixed(1)}%`
                          ) : (
                            <span className="text-soft">—</span>
                          )}
                        </td>
                        <td className="numeric text-[12px] text-muted">{n.convRate.toFixed(1)}%</td>
                        <td>
                          <Money
                            cents={n.revenueCents}
                            region={account.region === 'AU' ? 'AU' : 'US'}
                            emptyAsDash
                          />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </AccountShell>
  );
}
