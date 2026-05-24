import { Trophy, MapPin, Users } from 'lucide-react';
import { AnomalyCard, KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { OrgShell } from '@/components/OrgShell';
import { TODAY_KPIS, ANOMALIES, KNOCKERS, TERRITORIES } from '@/lib/fixtures';

export default function TodayPage(): JSX.Element {
  const topKnockers = [...KNOCKERS]
    .filter((k) => k.status === 'active')
    .sort((a, b) => b.conversions - a.conversions)
    .slice(0, 5);
  const liveTerritories = TERRITORIES.filter((t) => t.cleared).slice(0, 5);

  return (
    <OrgShell pageTitle="Today">
      <div className="space-y-6 max-w-[1400px]">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Knocks today"
            value={TODAY_KPIS.knocksToday.toLocaleString()}
            delta={TODAY_KPIS.knocksDelta}
            deltaTone="positive"
            hint="vs yesterday"
          />
          <KpiCard
            label="Conversions today"
            value={TODAY_KPIS.conversionsToday}
            delta={TODAY_KPIS.conversionsDelta}
            deltaTone="positive"
          />
          <KpiCard
            label="Conversion rate"
            value={`${TODAY_KPIS.conversionRate}%`}
            delta={TODAY_KPIS.conversionRateDelta}
            deltaTone="positive"
            hint="all sources"
          />
          <KpiCard
            label="Revenue today"
            value={<Money cents={TODAY_KPIS.revenueTodayCents} region="US" />}
            delta={TODAY_KPIS.revenueDelta}
            deltaTone="positive"
            hint="GMV (donor side)"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Anomalies (2/3) */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="h-section">Needs attention</h2>
            {ANOMALIES.map((a, i) => (
              <AnomalyCard
                key={i}
                severity={a.severity}
                title={a.title}
                description={a.description}
                timestamp={a.timestamp}
              />
            ))}
          </div>

          {/* Side rail */}
          <div className="space-y-4">
            <Section title="Live leaderboard" subtitle="Top 5 knockers today" paddedBody={false}>
              <div className="divide-y divide-line2">
                {topKnockers.map((k, i) => (
                  <div key={k.initials} className="flex items-center gap-3 px-5 py-3">
                    <div
                      className={`w-5 text-[11px] font-semibold ${i === 0 ? 'text-success' : 'text-soft'}`}
                    >
                      {i + 1}
                    </div>
                    <span className="mono">{k.initials}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-ink truncate">{k.name}</div>
                      <div className="text-[11px] text-muted numeric">
                        {k.knocks} knocks · {k.conversions} conv.
                      </div>
                    </div>
                    {i === 0 && <Trophy size={14} className="text-success" />}
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Active territories" subtitle="Today's coverage" paddedBody={false}>
              <div className="divide-y divide-line2">
                {liveTerritories.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                    <MapPin size={14} className="text-soft shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-ink truncate">{t.name}</div>
                      <div className="text-[11px] text-muted numeric flex items-center gap-2">
                        <Users size={10} /> {t.knockers} ·{' '}
                        {Math.round((t.doorsKnocked / t.doorsTotal) * 100)}% covered
                      </div>
                    </div>
                    <StatusPill tone={t.conversionRate > 8 ? 'success' : 'warn'}>
                      {t.conversionRate}%
                    </StatusPill>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </div>
      </div>
    </OrgShell>
  );
}
