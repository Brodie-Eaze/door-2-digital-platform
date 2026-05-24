import { Target, Sparkles, MapPin, Route, Calendar, TrendingUp, CheckCircle2 } from 'lucide-react';
import { Banner, Button, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';

export default function PlanningPage(): JSX.Element {
  return (
    <PlatformShell pageTitle="Planning · day / week / month">
      <div className="space-y-5 max-w-[1700px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Sparkles size={13} className="text-accent" />
            <span>
              Manager planning surface — AI-suggested day / week / month plans built from propensity
              scores, rep availability, and travel optimisation. Confirm a plan and it pushes to
              every Knocker iOS in one click.
            </span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Plans drafted (week)" value="12" delta="+3" deltaTone="positive" />
          <KpiCard label="Plans confirmed" value="8" hint="pushed to field" />
          <KpiCard
            label="Avg travel saved"
            value="42min"
            delta="-18%"
            deltaTone="positive"
            hint="vs manual routing"
          />
          <KpiCard label="Forecast hit rate" value="91%" hint="targets actually met" />
        </div>

        {/* Time-horizon switcher */}
        <div className="flex items-center gap-2">
          {['Today · May 19', 'This week', 'This month', 'Quarter'].map((t, i) => (
            <button
              key={t}
              className={`px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition ${i === 0 ? 'bg-ink text-surface' : 'bg-paper text-muted hover:text-ink hover:bg-line2'}`}
            >
              {t}
            </button>
          ))}
          <div className="flex-1" />
          <Button variant="ghost" size="sm" leftIcon={<Sparkles size={13} />}>
            Auto-generate plan
          </Button>
          <Button variant="primary" size="sm">
            Push to field
          </Button>
        </div>

        {/* Today's plan */}
        <Section
          title="Today's plan — AI-generated · review & push"
          subtitle="Texas region · 10 active Knockers · 4 territories · est. 78 conversions"
          action={<StatusPill tone="warn">Pending review</StatusPill>}
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[
              {
                team: 'Austin team',
                reps: ['JM', 'JD', 'AR', 'TM'],
                territory: 'Austin East + Austin South (NEW)',
                hours: '09:00–17:00',
                forecast: '32 conv · $9,800 GMV',
                travel: '12min between zones',
                priority: 'high',
                rationale:
                  'AI: Push 2 reps from Austin East (saturation 42%) to Austin South (propensity 0.81). +14pp lift expected.',
              },
              {
                team: 'Dallas team',
                reps: ['AM', 'BC', 'HK'],
                territory: 'Dallas Metro + Plano (NEW)',
                hours: '08:00–17:30',
                forecast: '24 conv · $7,200 GMV',
                travel: '18min Dallas→Plano',
                priority: 'high',
                rationale:
                  'AI: Plano is a lookalike to top Highland Park cohort. Move HK who is idle today.',
              },
              {
                team: 'Houston team',
                reps: ['KP', 'ML'],
                territory: 'Houston SE',
                hours: '09:00–17:00',
                forecast: '14 conv · $4,200 GMV',
                travel: 'In-zone only',
                priority: 'medium',
                rationale:
                  'DR offline today — KP + ML cover. Saturation at 64% — start considering Sugar Land for next week.',
              },
            ].map((p, i) => (
              <div
                key={i}
                className={`card card-pad border-l-4 ${p.priority === 'high' ? 'border-l-accent' : 'border-l-muted'}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="text-[13px] font-semibold text-ink">{p.team}</div>
                  <StatusPill tone={p.priority === 'high' ? 'info' : 'muted'}>
                    {p.priority}
                  </StatusPill>
                </div>
                <div className="space-y-1.5 text-[12px] mb-3">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={11} className="text-soft" />
                    <span className="text-ink">{p.territory}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar size={11} className="text-soft" />
                    <span className="text-ink numeric">{p.hours}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Route size={11} className="text-soft" />
                    <span className="text-muted">{p.travel}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Target size={11} className="text-success" />
                    <span className="text-success font-semibold">{p.forecast}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {p.reps.map((r) => (
                    <span key={r} className="mono !w-6 !h-6 !text-[10px]">
                      {r}
                    </span>
                  ))}
                </div>
                <div className="bg-accentSoft/30 border border-accent/20 rounded-lg p-2.5 text-[11px] text-muted flex items-start gap-1.5">
                  <Sparkles size={11} className="text-accent shrink-0 mt-0.5" />
                  <span>{p.rationale}</span>
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                  <button className="flex-1 py-1.5 rounded text-[11px] font-semibold bg-ink text-surface flex items-center justify-center gap-1">
                    <CheckCircle2 size={11} /> Confirm
                  </button>
                  <button className="flex-1 py-1.5 rounded text-[11px] font-semibold bg-paper border border-line2 text-ink">
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Forecast vs actuals */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section
            title="Week forecast · AI-projected"
            subtitle="If approved plans execute as drafted"
          >
            <div className="space-y-3">
              {[
                { day: 'Mon', forecast: 78, prev: 65 },
                { day: 'Tue', forecast: 82, prev: 71 },
                { day: 'Wed', forecast: 76, prev: 68 },
                { day: 'Thu', forecast: 84, prev: 74 },
                { day: 'Fri', forecast: 91, prev: 79 },
                { day: 'Sat', forecast: 42, prev: 38 },
              ].map((d) => (
                <div key={d.day} className="flex items-center gap-3">
                  <div className="w-10 text-[12px] text-muted font-medium">{d.day}</div>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-6 bg-paper rounded relative overflow-hidden border border-line2">
                      <div
                        className="h-full bg-accent/70"
                        style={{ width: `${(d.forecast / 100) * 100}%` }}
                      />
                      <div className="absolute inset-0 flex items-center px-2 text-[11px] font-medium text-ink numeric">
                        {d.forecast} conv forecast
                      </div>
                    </div>
                    <span className="text-[11px] text-success numeric w-12 text-right">
                      +{d.forecast - d.prev}
                    </span>
                  </div>
                </div>
              ))}
              <div className="text-[11px] text-muted pt-2 border-t border-line2 flex items-center gap-1.5">
                <TrendingUp size={12} className="text-success" />
                Week total: <span className="font-semibold text-ink">453 conversions</span> ·{' '}
                <span className="text-success font-semibold">+17%</span> vs LW
              </div>
            </div>
          </Section>

          <Section
            title="Month outlook · what AI recommends"
            subtitle="Strategic moves for next 30 days"
          >
            <div className="space-y-3">
              {[
                {
                  title: 'Bring AZ region online',
                  detail:
                    'CA reg pending, AZ cleared. Pre-position 8 reps in Phoenix West (propensity 0.76).',
                },
                {
                  title: 'Recruit 12 Knockers in Dallas',
                  detail: 'Dallas demand exceeds capacity. Funnel can absorb 12 new hires in 30d.',
                },
                {
                  title: 'Push retargeting harder',
                  detail:
                    'Smart list "Knocked-not-converted 7d" has 142 hot leads. Spend $4k on Meta this month.',
                },
                {
                  title: 'Sunset Highland Park',
                  detail: 'Propensity 0.42, conv. rate 4.1%. Pull 1 rep, reassign to Plano.',
                },
              ].map((rec, i) => (
                <div key={i} className="bg-paper rounded-xl border border-line2 p-3">
                  <div className="text-[13px] font-semibold text-ink flex items-center gap-1.5">
                    <Sparkles size={11} className="text-accent" /> {rec.title}
                  </div>
                  <div className="text-[11px] text-muted mt-1">{rec.detail}</div>
                  <button className="mt-2 text-[11px] text-accent font-medium hover:underline">
                    Add to plan →
                  </button>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </PlatformShell>
  );
}
