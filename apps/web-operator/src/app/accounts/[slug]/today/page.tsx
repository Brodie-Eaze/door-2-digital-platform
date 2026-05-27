import {
  Trophy,
  MapPin,
  Users,
  TrendingUp,
  Sparkles,
  AlertCircle,
  ShieldCheck,
  Activity,
  Phone,
  MessageSquare,
  Heart,
  DollarSign,
  Bot,
  Zap,
  Target,
  CheckCircle2,
  Clock,
  Calendar,
  Database,
  Wifi,
  GitBranch,
  Lock,
  ArrowUpRight,
  ChevronRight,
} from 'lucide-react';
import { AnomalyCard, KpiCard, Money, Section, StatusPill, Banner, Reveal } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { TodayFirstRun } from '@/components/AccountEmptyStates';
import { accountData, PIPELINE_STAGES } from '@/lib/account-fixtures';
import { rollupFor } from '@/lib/seed/kpis';
import { values as seriesValues } from '@/lib/seed/time-series';
import { firstRunSnapshot } from '@/lib/first-run';

export default function TodayPage({ params }: { params: { slug: string } }): JSX.Element {
  const firstRun = firstRunSnapshot(params.slug);
  if (firstRun.isFirstRun) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Command centre">
        <TodayFirstRun slug={params.slug} accountName={firstRun.accountName} />
      </AccountShell>
    );
  }

  const { account, anomalies, knockers, leads } = accountData(params.slug);
  if (!account) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Command centre">
        <TodayFirstRun slug={params.slug} accountName={firstRun.accountName} />
      </AccountShell>
    );
  }

  // Pull canonical rollup so headline numbers reconcile with the
  // command-centre + reports view.
  const rollup = rollupFor(params.slug);
  const region = account.region === 'AU' ? 'AU' : 'US';
  const isCharity = account.vertical === 'charity';
  const isHealth = account.vertical === 'healthcare';
  const valueLabel = isCharity ? 'donations' : isHealth ? 'pledges' : 'closed deals';
  const repsLabel = isCharity || isHealth ? 'fundraisers' : 'techs';

  const activeKnockers = knockers.filter((n) => n.status === 'active');
  const topKnockers = [...activeKnockers].sort((a, b) => b.conversions - a.conversions).slice(0, 6);

  // Headline numbers from rollup (account-wide), not just the 6 we display.
  const todayRev = rollup.revenueCentsToday;
  const totalKnocks = rollup.knocksToday;
  const totalConv = rollup.conversionsToday;

  // Build pipeline snapshot — 5 columns with top 2 leads each
  const pipelineSnapshot = PIPELINE_STAGES.map((s) => ({
    ...s,
    leads: leads.filter((l) => l.status === s.status).slice(0, 2),
    count: leads.filter((l) => l.status === s.status).length,
  }));

  // Revenue chart data — 14 days from the seed time-series (real weekly
  // pattern + trend + noise; same chart as /reports).
  const revSeries = seriesValues(rollup.revenueCents14d).map((c) => Math.round(c / 100));

  // Conversion funnel data
  const funnelSteps = isCharity
    ? [
        { name: 'Knocked', count: totalKnocks * 4, color: 'bg-slate-400' },
        { name: 'Conversation', count: Math.round(totalKnocks * 1.8), color: 'bg-blue-400' },
        { name: 'Interested', count: Math.round(totalKnocks * 0.6), color: 'bg-blue-500' },
        { name: 'Pledged', count: totalConv * 2, color: 'bg-emerald-500' },
        { name: 'Paid', count: totalConv, color: 'bg-emerald-600' },
      ]
    : isHealth
      ? [
          { name: 'Approached', count: totalKnocks * 3, color: 'bg-slate-400' },
          { name: 'Met', count: Math.round(totalKnocks * 1.4), color: 'bg-blue-400' },
          { name: 'Qualified', count: Math.round(totalKnocks * 0.5), color: 'bg-blue-500' },
          { name: 'Pledged', count: totalConv, color: 'bg-emerald-500' },
          { name: 'Signed', count: Math.round(totalConv * 0.7), color: 'bg-emerald-600' },
        ]
      : [
          { name: 'Knocked', count: totalKnocks * 3, color: 'bg-slate-400' },
          { name: 'Quoted', count: Math.round(totalKnocks * 1.2), color: 'bg-blue-400' },
          { name: 'Negotiated', count: Math.round(totalKnocks * 0.5), color: 'bg-blue-500' },
          { name: 'Sold', count: totalConv, color: 'bg-emerald-500' },
          { name: 'Installed', count: Math.round(totalConv * 0.6), color: 'bg-emerald-600' },
        ];

  const funnelMax = funnelSteps[0]!.count;

  // Top performers leaderboard
  const performers = topKnockers.slice(0, 5);

  // Recent activity stream
  const activityStream: { time: string; icon: typeof Phone; iconColor: string; text: string }[] = [
    {
      time: '2m',
      icon: DollarSign,
      iconColor: 'text-success',
      text: `Walker Estate · ${isCharity ? '$1,200 gift logged' : isHealth ? '$5,000 pledge confirmed' : '$2,180 contract signed'}`,
    },
    {
      time: '4m',
      icon: Phone,
      iconColor: 'text-accent',
      text:
        'Sarah H. completed callback · Maria Santos · ' +
        (isCharity ? 'pledged $25/mo' : 'booked service'),
    },
    {
      time: '6m',
      icon: MessageSquare,
      iconColor: 'text-blue-600',
      text: 'Auto-SMS sent · 14 leads in nurture seq',
    },
    {
      time: '9m',
      icon: Heart,
      iconColor: 'text-rose-500',
      text:
        'New ' +
        (isCharity ? 'monthly donor' : isHealth ? 'family circle member' : 'pro plan subscription'),
    },
    {
      time: '12m',
      icon: Phone,
      iconColor: 'text-accent',
      text: 'Jordan D. dialled 8, connected 3',
    },
    {
      time: '14m',
      icon: DollarSign,
      iconColor: 'text-success',
      text: 'Stripe charge succeeded · $84',
    },
    {
      time: '18m',
      icon: AlertCircle,
      iconColor: 'text-amber-600',
      text: 'Lead aged 6d in Contacted · auto-escalated',
    },
    {
      time: '22m',
      icon: CheckCircle2,
      iconColor: 'text-success',
      text: `${isCharity ? 'Donation' : isHealth ? 'Pledge' : 'Quote'} workflow ran · 11 actions`,
    },
    {
      time: '24m',
      icon: Phone,
      iconColor: 'text-accent',
      text: 'Asha M. closed inbound call · qualified',
    },
    {
      time: '27m',
      icon: MessageSquare,
      iconColor: 'text-blue-600',
      text: 'NPS responses · 8 new · avg 9.2',
    },
  ];

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Command centre">
      <div className="space-y-5 max-w-[1500px]">
        {/* Welcome banner */}
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Sparkles size={13} />
            <span>
              <span className="font-semibold">{account.shortName}</span> · {account.region} ·{' '}
              {account.plan} plan · last sync 47 seconds ago. All systems nominal.
            </span>
          </span>
        </Banner>

        {/* Row 1: KPI rail (6 cards) */}
        <Reveal delay={0} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            label={`${isCharity ? 'Donations' : isHealth ? 'Gifts' : 'Revenue'} today`}
            value={<Money cents={todayRev} region={region} />}
            delta="+18%"
            deltaTone="positive"
            hint="vs yesterday"
          />
          <KpiCard
            label="Conv. rate"
            value="14.8%"
            delta="+0.6pp"
            deltaTone="positive"
            hint="14d avg"
          />
          <KpiCard
            label={`Active ${repsLabel}`}
            value={rollup.activeReps}
            hint={`of ${rollup.rosterSize} on roster`}
          />
          <KpiCard
            label="Open pipeline"
            value={<Money cents={account.revenueCentsMTD / 7n} region={region} />}
            delta="+22%"
            deltaTone="positive"
            hint="weighted forecast"
          />
          <KpiCard
            label="Bookings · 7d"
            value="42"
            delta="+24%"
            deltaTone="positive"
            hint="appointments"
          />
          <KpiCard
            label="AI assists · today"
            value="318"
            delta="+8%"
            deltaTone="positive"
            hint="automations fired"
          />
        </Reveal>

        {/* Row 2: Revenue chart + AI summary */}
        <Reveal delay={80} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <Section
              title={`${isCharity ? 'Giving' : isHealth ? 'Pledges' : 'Revenue'} · 14-day trend`}
              subtitle="Daily total · seasonality-adjusted"
              action={
                <span className="text-[11px] text-success flex items-center gap-1">
                  <TrendingUp size={11} /> +24% vs prior 14d
                </span>
              }
            >
              <RevenueChart data={revSeries} region={region} />
              <div className="mt-4 pt-3 border-t border-line2 grid grid-cols-4 gap-3 text-center">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted">14d total</div>
                  <div className="text-[14px] font-semibold text-ink numeric mt-0.5">
                    <Money
                      cents={BigInt(Math.round(revSeries.reduce((s, v) => s + v, 0))) * 100n}
                      region={region}
                    />
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted">Best day</div>
                  <div className="text-[14px] font-semibold text-success numeric mt-0.5">
                    <Money cents={BigInt(Math.max(...revSeries)) * 100n} region={region} />
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted">Avg / day</div>
                  <div className="text-[14px] font-semibold text-ink numeric mt-0.5">
                    <Money
                      cents={
                        BigInt(
                          Math.round(revSeries.reduce((s, v) => s + v, 0) / revSeries.length),
                        ) * 100n
                      }
                      region={region}
                    />
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted">
                    Forecast EOM
                  </div>
                  <div className="text-[14px] font-semibold text-accent numeric mt-0.5">
                    <Money cents={(account.revenueCentsMTD * 13n) / 10n} region={region} />
                  </div>
                </div>
              </div>
            </Section>
          </div>

          <Section
            title="AI insights"
            subtitle="Last refresh · 4m ago"
            action={
              <button className="text-[11px] text-accent font-medium hover:underline">
                Refresh
              </button>
            }
          >
            <div className="space-y-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-success font-semibold mb-1.5 flex items-center gap-1">
                  <TrendingUp size={10} /> Top 3 wins
                </div>
                <ul className="space-y-1.5 text-[12px] text-ink">
                  <li className="flex items-start gap-2">
                    <span className="text-success mt-0.5">·</span>
                    <span>
                      <span className="font-medium">{performers[0]?.name ?? 'Top rep'}</span> at
                      +47% vs personal baseline
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-success mt-0.5">·</span>
                    <span>
                      Monthly upgrade flow A/B test winning at{' '}
                      <span className="font-semibold">+12%</span> conv
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-success mt-0.5">·</span>
                    <span>
                      Door-attribution <span className="font-semibold">{valueLabel}</span> up 22%
                      WoW
                    </span>
                  </li>
                </ul>
              </div>

              <div className="pt-3 border-t border-line2">
                <div className="text-[10px] uppercase tracking-wider text-rose-700 font-semibold mb-1.5 flex items-center gap-1">
                  <AlertCircle size={10} /> Top 3 risks
                </div>
                <ul className="space-y-1.5 text-[12px] text-ink">
                  <li className="flex items-start gap-2">
                    <span className="text-rose-600 mt-0.5">·</span>
                    <span>
                      <span className="font-semibold">17 leads</span> stuck in Contacted &gt; 5d
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-600 mt-0.5">·</span>
                    <span>
                      {account.region === 'AU' ? 'Melbourne CBD' : 'Austin-East'} conv ↓ 11pp ·
                      script review
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-600 mt-0.5">·</span>
                    <span>Payment retry workflow at 88% · investigate failure</span>
                  </li>
                </ul>
              </div>

              <div className="pt-3 border-t border-line2">
                <div className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-1.5 flex items-center gap-1">
                  <Target size={10} /> Top 3 actions
                </div>
                <ul className="space-y-1.5 text-[12px] text-ink">
                  <li className="flex items-start gap-2">
                    <span className="text-accent mt-0.5">·</span>
                    <span>Bulk-assign 17 aged leads to Sarah H.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent mt-0.5">·</span>
                    <span>
                      Push v3.3 script to {account.region === 'AU' ? 'Melbourne' : 'Austin'} reps
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent mt-0.5">·</span>
                    <span>Trigger winback SMS to 142 lapsed cohort</span>
                  </li>
                </ul>
              </div>

              <button className="mt-2 w-full text-[12px] text-accent font-medium hover:underline flex items-center justify-center gap-1 pt-2 border-t border-line2">
                <Bot size={11} /> Ask AI about today
              </button>
            </div>
          </Section>
        </Reveal>

        {/* Row 3: Funnel + Top performers */}
        <Reveal delay={160} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <Section
              title="Conversion funnel · today"
              subtitle="Door → close progression"
              action={
                <span className="text-[11px] text-muted numeric">
                  Overall:{' '}
                  <span className="text-success font-semibold">
                    {((funnelSteps[funnelSteps.length - 1]!.count / funnelMax) * 100).toFixed(1)}%
                  </span>
                </span>
              }
            >
              <div className="space-y-2">
                {funnelSteps.map((step, i) => {
                  const pct = (step.count / funnelMax) * 100;
                  const prev = funnelSteps[i - 1];
                  const stepConv = prev ? (step.count / prev.count) * 100 : 100;
                  return (
                    <div key={step.name}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-soft numeric">#{i + 1}</span>
                          <span className="text-[12.5px] font-medium text-ink">{step.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px]">
                          <span className="text-muted numeric">{step.count.toLocaleString()}</span>
                          <span className="font-semibold text-ink numeric w-12 text-right">
                            {stepConv.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="relative h-7 bg-paper rounded overflow-hidden border border-line2">
                        <div
                          className={`h-full ${step.color} transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          </div>

          <Section title="Top performers" subtitle="Today's leaderboard" paddedBody={false}>
            <div className="divide-y divide-line2">
              {performers.map((n, i) => (
                <div key={n.initials} className="flex items-center gap-3 px-5 py-3">
                  <div
                    className={`w-5 text-[11px] font-semibold ${i === 0 ? 'text-success' : 'text-soft'}`}
                  >
                    #{i + 1}
                  </div>
                  <span className="mono">{n.initials}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-ink truncate">{n.name}</div>
                    <div className="text-[11px] text-muted numeric">
                      {n.knocks} knocks · {n.conversions} conv ·{' '}
                      <Money cents={n.revenueCents} region={region} />
                    </div>
                  </div>
                  {i === 0 && <Trophy size={14} className="text-success" />}
                </div>
              ))}
            </div>
          </Section>
        </Reveal>

        {/* Row 4: Anomalies + Recent activity */}
        <Reveal delay={240} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="h-section flex items-center gap-1.5">
                <AlertCircle size={13} className="text-rose-600" /> Needs attention
              </h2>
              <span className="text-[11px] text-muted">{anomalies.length} active</span>
            </div>
            <div className="space-y-3">
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
          </div>

          <Section
            title="Activity stream"
            subtitle="Real-time across this account"
            paddedBody={false}
            action={
              <span className="flex items-center gap-1 text-[11px] text-success">
                <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" /> Live
              </span>
            }
          >
            <div className="divide-y divide-line2 max-h-[440px] overflow-y-auto">
              {activityStream.map((a, i) => (
                <div key={i} className="px-5 py-2.5 flex items-start gap-2.5">
                  <a.icon size={12} className={`${a.iconColor} mt-1 shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-ink leading-snug">{a.text}</div>
                  </div>
                  <span className="text-[10px] text-soft numeric whitespace-nowrap">{a.time}</span>
                </div>
              ))}
            </div>
          </Section>
        </Reveal>

        {/* Row 5: Pipeline snapshot + Knocker live status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <Section
              title="Pipeline snapshot"
              subtitle="Top 2 leads per stage"
              action={
                <a
                  href={`/accounts/${params.slug}/pipeline`}
                  className="text-[11px] text-accent font-medium hover:underline flex items-center gap-1"
                >
                  Open full pipeline <ArrowUpRight size={11} />
                </a>
              }
            >
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                {pipelineSnapshot.map((s) => (
                  <div key={s.status} className="bg-paper rounded-lg border border-line2 p-2.5">
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <div className="text-[10.5px] font-semibold text-ink truncate">{s.stage}</div>
                      <span className="mono !w-4 !h-4 !text-[9px]">{s.count}</span>
                    </div>
                    <div className="space-y-1.5">
                      {s.leads.length === 0 && (
                        <div className="text-[10px] text-soft text-center py-2">empty</div>
                      )}
                      {s.leads.map((l) => (
                        <div
                          key={l.id}
                          className="bg-surface rounded p-1.5 border border-line2 text-[10.5px]"
                        >
                          <div className="font-medium text-ink truncate">{l.name}</div>
                          <div className="text-[9px] text-muted truncate">{l.address}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          <Section
            title="Field status"
            subtitle={`${repsLabel} live · ${rollup.activeReps} on shift of ${rollup.rosterSize} roster`}
            paddedBody={false}
          >
            <div className="px-5 py-3 border-b border-line2">
              <div className="relative h-32 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 rounded-lg overflow-hidden">
                {/* mini "map" — pseudo dots */}
                {topKnockers.map((_, i) => {
                  const x = 15 + ((i * 47) % 70);
                  const y = 20 + ((i * 31) % 60);
                  return (
                    <div
                      key={i}
                      className="absolute w-2 h-2 bg-emerald-400 rounded-full animate-pulse"
                      style={{ left: `${x}%`, top: `${y}%` }}
                    />
                  );
                })}
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] text-surface/70">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />{' '}
                    {topKnockers.length} active
                  </span>
                  <span>{account.region === 'AU' ? 'AU regions' : 'US regions'}</span>
                </div>
              </div>
            </div>
            <div className="divide-y divide-line2">
              <div className="px-5 py-2.5 flex items-center justify-between">
                <span className="text-[11px] text-muted">Active now</span>
                <span className="text-[13px] font-semibold text-success numeric">
                  {rollup.activeReps}
                </span>
              </div>
              <div className="px-5 py-2.5 flex items-center justify-between">
                <span className="text-[11px] text-muted">Idle / break / offline</span>
                <span className="text-[13px] font-semibold text-soft numeric">
                  {rollup.rosterSize - rollup.activeReps}
                </span>
              </div>
              <div className="px-5 py-2.5 flex items-center justify-between">
                <span className="text-[11px] text-muted">Avg ping latency</span>
                <span className="text-[13px] font-semibold text-ink numeric">247ms</span>
              </div>
              <div className="px-5 py-2.5 flex items-center justify-between">
                <span className="text-[11px] text-muted">Offline-queue depth</span>
                <span className="text-[13px] font-semibold text-ink numeric">14</span>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-line2">
              <a
                href={`/accounts/${params.slug}/knockers`}
                className="text-[11px] text-accent font-medium hover:underline flex items-center gap-1"
              >
                Open live map <ChevronRight size={11} />
              </a>
            </div>
          </Section>
        </div>

        {/* Row 6: Compliance / system health strip */}
        <Section title="System health" subtitle="Compliance · uptime · audit" paddedBody={false}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-x divide-line2">
            {[
              {
                label: 'State clearance',
                value: '100%',
                sub: '7/7 active states',
                icon: ShieldCheck,
                color: 'text-success',
                pill: 'success' as const,
              },
              {
                label: 'Audit chain',
                value: 'Healthy',
                sub: 'last verified 4m ago',
                icon: GitBranch,
                color: 'text-success',
                pill: 'success' as const,
              },
              {
                label: 'Stripe uptime',
                value: '99.98%',
                sub: '30d rolling',
                icon: DollarSign,
                color: 'text-success',
                pill: 'success' as const,
              },
              {
                label: 'API latency P95',
                value: '184ms',
                sub: '24h rolling',
                icon: Wifi,
                color: 'text-success',
                pill: 'success' as const,
              },
              {
                label: 'Data residency',
                value: account.region === 'AU' ? 'AU Sydney' : 'US East',
                sub: 'enforced · TXTd',
                icon: Database,
                color: 'text-accent',
                pill: 'info' as const,
              },
              {
                label: 'PCI scope',
                value: 'Minimal',
                sub: 'no card data stored',
                icon: Lock,
                color: 'text-success',
                pill: 'success' as const,
              },
            ].map((m) => (
              <div key={m.label} className="px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <m.icon size={11} className={m.color} />
                  <div className="text-[10px] uppercase tracking-wider text-muted">{m.label}</div>
                </div>
                <div className="text-[14px] font-semibold text-ink numeric">{m.value}</div>
                <div className="text-[10px] text-soft mt-0.5">{m.sub}</div>
                <StatusPill tone={m.pill}>
                  <span className="text-[9px]">ok</span>
                </StatusPill>
              </div>
            ))}
          </div>
        </Section>

        {/* Quick links footer */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          {[
            { label: 'Calendars', href: `/accounts/${params.slug}/calendars`, icon: Calendar },
            { label: 'Tasks', href: `/accounts/${params.slug}/tasks`, icon: CheckCircle2 },
            { label: 'Workflows', href: `/accounts/${params.slug}/workflows`, icon: Zap },
            { label: 'Memberships', href: `/accounts/${params.slug}/memberships`, icon: Heart },
            { label: 'Forms', href: `/accounts/${params.slug}/forms`, icon: Activity },
            { label: 'Files', href: `/accounts/${params.slug}/files`, icon: Clock },
          ].map((q) => (
            <a
              key={q.label}
              href={q.href}
              className="card !shadow-none border border-line2 hover:border-line hover:shadow-md transition card-pad flex items-center gap-2"
            >
              <q.icon size={13} className="text-accent" />
              <span className="text-[12.5px] font-medium text-ink">{q.label}</span>
              <div className="flex-1" />
              <ChevronRight size={12} className="text-soft" />
            </a>
          ))}
        </div>

        {/* Territories strip (preserved from old page) */}
        <Section
          title="Active territories"
          subtitle={`${account.territoriesActive} live · today's coverage`}
          paddedBody={false}
        >
          <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-line2">
            {Array.from({ length: Math.min(account.territoriesActive, 5) }).map((_, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3">
                <MapPin size={12} className="text-soft shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] text-ink truncate">
                    {account.region === 'AU'
                      ? [
                          'Melbourne CBD',
                          'Sydney Inner',
                          'Brisbane North',
                          'Perth West',
                          'Adelaide East',
                        ][i]
                      : ['Austin East', 'Dallas Metro', 'Phoenix West', 'Atlanta N', 'Houston SE'][
                          i
                        ]}
                  </div>
                  <div className="text-[10px] text-muted numeric flex items-center gap-1.5">
                    <Users size={9} /> {3 + ((i * 3) % 10)} · {40 + ((i * 9) % 50)}% covered
                  </div>
                </div>
                <StatusPill tone="success">{(8 + i * 2).toFixed(1)}%</StatusPill>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </AccountShell>
  );
}

/**
 * Hand-rolled SVG line + area chart — no external library.
 */
function RevenueChart({ data, region }: { data: number[]; region: 'AU' | 'US' }): JSX.Element {
  const w = 720;
  const h = 200;
  const pad = 16;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const xStep = (w - pad * 2) / (data.length - 1);

  const points = data.map((v, i) => {
    const x = pad + i * xStep;
    const y = h - pad - ((v - min) / range) * (h - pad * 2 - 8);
    return [x, y] as const;
  });

  // Smooth Catmull-Rom-ish path via simple quadratic
  const line = points
    .map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`))
    .join(' ');
  const area = `${line} L ${points[points.length - 1]![0]} ${h - pad} L ${points[0]![0]} ${h - pad} Z`;

  // Y grid lines (4 horizontal)
  const yLines = Array.from({ length: 4 }, (_, i) => pad + ((h - pad * 2) / 3) * i);

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Grid */}
        {yLines.map((y, i) => (
          <line
            key={i}
            x1={pad}
            x2={w - pad}
            y1={y}
            y2={y}
            stroke="#e2e8f0"
            strokeWidth="0.5"
            strokeDasharray="2 3"
          />
        ))}
        <path d={area} fill="url(#rev-grad)" />
        <path d={line} fill="none" stroke="#3b82f6" strokeWidth="2.5" />
        {points.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="#3b82f6" />
        ))}
        {/* X-axis labels (every 2 days) */}
        {data.map((_, i) =>
          i % 2 === 0 ? (
            <text
              key={`x-${i}`}
              x={pad + i * xStep}
              y={h - 2}
              fontSize="9"
              fill="#94a3b8"
              textAnchor="middle"
              fontFamily="ui-monospace, monospace"
            >
              D-{data.length - 1 - i}
            </text>
          ) : null,
        )}
      </svg>
      <div className="text-[10px] text-soft text-center mt-1 numeric">
        Y-axis: {region === 'AU' ? 'AUD' : 'USD'} · 14d trailing
      </div>
    </div>
  );
}
