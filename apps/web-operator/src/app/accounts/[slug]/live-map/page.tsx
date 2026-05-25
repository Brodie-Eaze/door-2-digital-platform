import { Banner, KpiCard } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { AccountLiveMap } from '@/components/AccountLiveMap';
import { getAccount } from '@/lib/accounts';
import { getAccountFleet } from '@/lib/account-fleet';

export default function Page({ params }: { params: { slug: string } }): JSX.Element {
  const account = getAccount(params.slug);
  const fleet = getAccountFleet(params.slug);
  const activeCount = fleet?.reps.filter((r) => r.status === 'active').length ?? 0;
  const totalKnocks = fleet?.reps.reduce((s, r) => s + r.knocksToday, 0) ?? 0;
  const totalConv = fleet?.reps.reduce((s, r) => s + r.conversionsToday, 0) ?? 0;
  const convRate = totalKnocks > 0 ? `${((totalConv / totalKnocks) * 100).toFixed(1)}%` : '—';

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Live field map">
      <div className="space-y-5 max-w-[1700px]">
        <Banner tone="info">
          <span className="text-[13px]">
            Live GPS view of every <strong>{account?.shortName ?? 'account'}</strong> rep currently
            in the field. Pins update every 30s. Click any rep for full shift detail — call,
            message, or send on break without leaving the map.
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard label="Reps in field" value={fleet?.reps.length ?? 0} />
          <KpiCard label="Active now" value={activeCount} />
          <KpiCard label="Knocks today" value={totalKnocks} />
          <KpiCard label="Conversions today" value={totalConv} />
          <KpiCard label="Conv rate" value={convRate} />
        </div>

        <AccountLiveMap accountSlug={params.slug} />
      </div>
    </AccountShell>
  );
}
