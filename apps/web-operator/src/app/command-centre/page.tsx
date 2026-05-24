'use client';

import { Radio, Sparkles, AlertTriangle, TrendingUp, Coffee, MapPin } from 'lucide-react';
import { Banner, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { HQLiveMap } from '@/components/HQLiveMap';
import { FLEET_REPS } from '@/lib/fleet-reps';

export default function CommandCentrePage(): JSX.Element {
  const active = FLEET_REPS.filter((r) => r.status === 'active').length;
  const onBreak = FLEET_REPS.filter((r) => r.status === 'break').length;
  const idle = FLEET_REPS.filter((r) => r.status === 'idle').length;
  const offline = FLEET_REPS.filter((r) => r.status === 'offline').length;
  const totalKnocks = FLEET_REPS.reduce((s, r) => s + r.knocksToday, 0);
  const totalConv = FLEET_REPS.reduce((s, r) => s + r.conversionsToday, 0);

  return (
    <PlatformShell pageTitle="Command Centre · Live field map">
      <div className="space-y-5 max-w-[1700px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Radio size={13} className="text-accent" />
            <span>
              Live satellite view of every <span className="font-semibold">Knocker iOS</span> iPad
              in the field, across all accounts. Pins update from GPS every 30 seconds. AI-suggested
              next zones pulse blue. Click any rep for shift + activity detail.
            </span>
          </span>
        </Banner>

        {/* Fleet KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <KpiCard
            label="Active iPads"
            value={active}
            hint={`of ${FLEET_REPS.length} on roster`}
            delta="+2 last hour"
            deltaTone="positive"
          />
          <KpiCard label="On break" value={onBreak} hint="lunch / scheduled" />
          <KpiCard label="Idle > 15min" value={idle} hint="manager nudge sent" />
          <KpiCard label="Offline" value={offline} hint="not clocked in" />
          <KpiCard label="Knocks today" value={totalKnocks} delta="+8.4%" deltaTone="positive" />
          <KpiCard
            label="Conv. today"
            value={totalConv}
            delta="+12%"
            deltaTone="positive"
            hint={`${((totalConv / totalKnocks) * 100).toFixed(1)}% rate`}
          />
        </div>

        {/* The main live map */}
        <HQLiveMap />

        {/* AI Insights + alerts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Section
            title="AI: where to send reps next"
            subtitle="External data + propensity model · refreshed hourly"
            action={<StatusPill tone="success">Live</StatusPill>}
          >
            <div className="space-y-3">
              {[
                {
                  name: 'Austin South · 78704',
                  score: 0.81,
                  lift: '+14pp vs avg',
                  reason: 'ACS median income $94k · charity-giving propensity 0.83 · 0% saturation',
                },
                {
                  name: 'Plano · 75024',
                  score: 0.78,
                  lift: '+11pp vs avg',
                  reason: 'Lookalike to top-performing Highland Park · low Dallas saturation',
                },
                {
                  name: 'Sugar Land · 77479',
                  score: 0.74,
                  lift: '+9pp vs avg',
                  reason: '24% knocks-not-converted in nearby Bellaire = warm re-engage pool',
                },
              ].map((s) => (
                <div
                  key={s.name}
                  className="bg-paper border border-line2 rounded-xl p-3 hover:border-accent transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-semibold text-ink flex items-center gap-1.5">
                        <MapPin size={11} className="text-accent" /> {s.name}
                      </div>
                      <div className="text-[10px] text-muted mt-0.5 line-clamp-2">{s.reason}</div>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold text-accent bg-accentSoft">
                        <Sparkles size={9} />
                        <span className="numeric">{s.score.toFixed(2)}</span>
                      </span>
                      <span className="text-[9px] text-success numeric mt-1">{s.lift}</span>
                    </div>
                  </div>
                  <button className="mt-2 w-full text-[11px] py-1.5 rounded bg-ink text-surface font-semibold">
                    Assign 2 reps →
                  </button>
                </div>
              ))}
            </div>
          </Section>

          <Section
            title="Anomalies · AI watch"
            subtitle="Real-time pattern detection"
            action={<StatusPill tone="warn">3</StatusPill>}
          >
            <div className="space-y-3">
              {[
                {
                  icon: AlertTriangle,
                  tone: 'text-rose-600',
                  title: 'Devon R offline since 09:00',
                  detail:
                    'Houston SE shift uncovered. Auto-SMS + push sent. Backup: reassign to Marcus L.',
                  action: 'Reassign',
                },
                {
                  icon: Coffee,
                  tone: 'text-warn',
                  title: 'Tomás M lunch break > 45min',
                  detail: 'On break since 12:48. Auto-reminder push sent.',
                  action: 'Nudge',
                },
                {
                  icon: AlertTriangle,
                  tone: 'text-warn',
                  title: 'Hiroshi K conv. rate dropped 11pp',
                  detail:
                    'Last 4 hours vs trailing avg. Try script v3.2 + check territory saturation.',
                  action: 'Open 1:1',
                },
              ].map((a, i) => (
                <div
                  key={i}
                  className="bg-paper border border-line2 rounded-xl p-3 flex items-start gap-2.5"
                >
                  <a.icon size={14} className={`${a.tone} shrink-0 mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold text-ink">{a.title}</div>
                    <div className="text-[10.5px] text-muted mt-0.5">{a.detail}</div>
                    <button className="mt-1.5 text-[10px] text-accent font-medium hover:underline">
                      {a.action} →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section
            title="Live activity feed"
            subtitle="Last 5 minutes · all accounts"
            action={
              <span className="text-[10px] text-success flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live
              </span>
            }
          >
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {[
                {
                  t: '14:42',
                  who: 'JD',
                  what: 'Conversion captured',
                  detail: 'Maria Santos · $24/mo · Austin East',
                  tone: 'text-success',
                },
                {
                  t: '14:41',
                  who: 'JM',
                  what: 'Knock recorded · LEAD',
                  detail: '4218 Lakeview Dr',
                  tone: 'text-accent',
                },
                {
                  t: '14:40',
                  who: 'KP',
                  what: 'Callback scheduled',
                  detail: 'Robert Kim · Tue 3pm',
                  tone: 'text-accent',
                },
                {
                  t: '14:38',
                  who: 'AR',
                  what: 'Started shift',
                  detail: 'Austin North · 8h shift',
                  tone: 'text-muted',
                },
                {
                  t: '14:36',
                  who: 'BC',
                  what: 'Conversion captured',
                  detail: 'PestMax service contract · $480',
                  tone: 'text-success',
                },
                {
                  t: '14:35',
                  who: 'TM',
                  what: 'Returned from break',
                  detail: 'Lunch 45m',
                  tone: 'text-muted',
                },
                {
                  t: '14:32',
                  who: 'AM',
                  what: 'Knock recorded · SALE',
                  detail: '1502 Cedar St · $36/mo recurring',
                  tone: 'text-success',
                },
                {
                  t: '14:30',
                  who: 'JM',
                  what: 'Knock recorded · NOT HOME',
                  detail: '4216 Lakeview Dr',
                  tone: 'text-muted',
                },
              ].map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px]">
                  <span className="text-soft numeric shrink-0 w-9">{e.t}</span>
                  <span className="mono !w-5 !h-5 !text-[9px] shrink-0">{e.who}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium ${e.tone}`}>{e.what}</div>
                    <div className="text-muted truncate">{e.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* Quick push-to-field action */}
        <Section
          title="Push to field"
          subtitle="Broadcast a config or message — pushed instantly to every active iPad"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {[
              {
                title: 'Broadcast message',
                desc: 'Send to all active reps · push + in-app',
                icon: Radio,
              },
              {
                title: 'Update pitch script',
                desc: 'New version syncs on next app open',
                icon: Sparkles,
              },
              { title: 'Reassign territories', desc: 'Drag-drop reps between zones', icon: MapPin },
              { title: 'End shift early', desc: 'Manager-initiated wrap', icon: TrendingUp },
            ].map((a) => (
              <button
                key={a.title}
                className="card card-pad text-left hover:shadow-md hover:border-line transition flex items-start gap-3"
              >
                <div className="w-10 h-10 rounded-lg bg-accentSoft text-accent flex items-center justify-center shrink-0">
                  <a.icon size={16} />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-ink">{a.title}</div>
                  <div className="text-[10.5px] text-muted mt-0.5">{a.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </Section>
      </div>
    </PlatformShell>
  );
}
