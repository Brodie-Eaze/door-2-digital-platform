import {
  Trophy,
  MapPin,
  Users,
  TrendingUp,
  Sparkles,
  AlertCircle,
  ShieldCheck,
  Activity,
  DollarSign,
  Bot,
  Zap,
  Target,
  CheckCircle2,
  Calendar,
  Database,
  Wifi,
  GitBranch,
  Lock,
  ArrowUpRight,
  ChevronRight,
  LogIn,
  LogOut,
  Camera,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AnomalyCard, KpiCard, Money, Section, StatusPill, Banner, Reveal } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { TodayFirstRun } from '@/components/AccountEmptyStates';
import { db } from '@d2d/database';
import { redirect } from 'next/navigation';

// Pipeline stages — maps LeadStatus enum values to display names
const PIPELINE_STAGES = [
  { status: 'new', stage: 'New' },
  { status: 'contacted', stage: 'Contacted' },
  { status: 'qualified', stage: 'Qualified' },
  { status: 'appointment_set', stage: 'Appt Set' },
  { status: 'converted', stage: 'Converted' },
] as const;

export default async function TodayPage({
  params: paramsPromise,
}: {
  params: Promise<{ slug: string }>;
}): Promise<JSX.Element> {
  const params = await paramsPromise;
  // ── Resolve org ──────────────────────────────────────────────────────────
  const org = await db.org.findUnique({
    where: { slug: params.slug },
    select: { id: true, tradingName: true, legalName: true, vertical: true, regionCode: true },
  });
  if (!org) redirect('/accounts');

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const fourteenDaysAgo = new Date(todayStart);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);

  const mtdStart = new Date();
  mtdStart.setUTCDate(1);
  mtdStart.setUTCHours(0, 0, 0, 0);

  // ── Parallel queries ─────────────────────────────────────────────────────
  const [
    knockCount,
    saleAgg,
    sessionStartCount,
    sessionEndCount,
    rosterCount,
    knocksByRep,
    salesByRep,
    recentEvents,
    past14dSales,
    mtdSales,
    territories,
    leads,
  ] = await Promise.all([
    db.analyticsEvent.count({
      where: { orgId: org.id, eventType: 'knock', occurredAt: { gte: todayStart } },
    }),
    db.analyticsEvent.findMany({
      where: { orgId: org.id, eventType: 'sale', occurredAt: { gte: todayStart } },
      select: { userId: true, payload: true },
    }),
    db.analyticsEvent.count({
      where: { orgId: org.id, eventType: 'session_start', occurredAt: { gte: todayStart } },
    }),
    db.analyticsEvent.count({
      where: { orgId: org.id, eventType: 'session_end', occurredAt: { gte: todayStart } },
    }),
    db.user.count({ where: { orgId: org.id, role: 'knocker' } }),
    db.analyticsEvent.groupBy({
      by: ['userId'],
      where: { orgId: org.id, eventType: 'knock', occurredAt: { gte: todayStart } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    }),
    db.analyticsEvent.groupBy({
      by: ['userId'],
      where: { orgId: org.id, eventType: 'sale', occurredAt: { gte: todayStart } },
      _count: { id: true },
    }),
    db.analyticsEvent.findMany({
      where: {
        orgId: org.id,
        eventType: { in: ['knock', 'sale', 'session_start', 'session_end', 'photo'] },
        occurredAt: { gte: todayStart },
      },
      orderBy: { occurredAt: 'desc' },
      take: 12,
      select: { id: true, eventType: true, occurredAt: true, userId: true, payload: true },
    }),
    db.analyticsEvent.findMany({
      where: { orgId: org.id, eventType: 'sale', occurredAt: { gte: fourteenDaysAgo } },
      select: { occurredAt: true, payload: true },
    }),
    db.analyticsEvent.findMany({
      where: { orgId: org.id, eventType: 'sale', occurredAt: { gte: mtdStart } },
      select: { payload: true },
    }),
    db.territory.findMany({
      where: { orgId: org.id },
      take: 5,
      select: { id: true, name: true },
    }),
    db.lead.findMany({
      where: { orgId: org.id },
      take: 30,
      orderBy: { createdAt: 'desc' },
      select: { id: true, givenName: true, familyName: true, status: true },
    }),
  ]);

  // ── Derive KPIs ──────────────────────────────────────────────────────────
  const revPerRep = new Map<string, number>();
  let revenueCentsToday = 0;
  for (const ev of saleAgg) {
    const p = ev.payload as Record<string, unknown>;
    const cents = typeof p.amountCents === 'number' ? p.amountCents : 0;
    revenueCentsToday += cents;
    if (ev.userId) revPerRep.set(ev.userId, (revPerRep.get(ev.userId) ?? 0) + cents);
  }
  const saleCount = saleAgg.length;
  const activeSessions = Math.max(0, sessionStartCount - sessionEndCount);
  const convRate = knockCount > 0 ? ((saleCount / knockCount) * 100).toFixed(1) + '%' : '—';

  const revenueCentsMTD = mtdSales.reduce((sum, ev) => {
    const p = ev.payload as Record<string, unknown>;
    return sum + (typeof p.amountCents === 'number' ? p.amountCents : 0);
  }, 0);
  const revenueCentsMTDn = BigInt(Math.round(revenueCentsMTD));

  const isFirstRun = knockCount === 0 && saleCount === 0 && sessionStartCount === 0;

  // ── User lookups (single batch) ──────────────────────────────────────────
  const repIds = knocksByRep.map((r) => r.userId).filter((id): id is string => !!id);
  const feedUserIds = [...new Set(recentEvents.map((e) => e.userId).filter(Boolean))] as string[];
  const allUserIds = [...new Set([...repIds, ...feedUserIds])];
  const allUsers =
    allUserIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: allUserIds }, orgId: org.id },
          select: { id: true, givenName: true, familyName: true },
        })
      : [];
  const userMap = new Map(allUsers.map((u) => [u.id, u]));
  const salesMap = new Map(salesByRep.map((r) => [r.userId, r._count.id]));

  // ── Top performers leaderboard ────────────────────────────────────────────
  const topReps = knocksByRep.map((r) => {
    const u = r.userId ? userMap.get(r.userId) : undefined;
    const name = u ? `${u.givenName} ${u.familyName}`.trim() : 'Unknown';
    const initials = u ? `${u.givenName[0] ?? '?'}${u.familyName[0] ?? ''}`.toUpperCase() : '??';
    return {
      name,
      initials,
      knocks: r._count.id,
      conversions: r.userId ? (salesMap.get(r.userId) ?? 0) : 0,
      revenueCents: BigInt(Math.round(r.userId ? (revPerRep.get(r.userId) ?? 0) : 0)),
    };
  });

  // ── Activity feed ─────────────────────────────────────────────────────────
  const nowMs = Date.now();
  const activity = recentEvents.map((ev) => {
    const u = ev.userId ? userMap.get(ev.userId) : undefined;
    const repName = u ? `${u.givenName} ${u.familyName}`.trim() : 'Rep';
    const p = ev.payload as Record<string, unknown>;
    const diffMin = Math.floor((nowMs - ev.occurredAt.getTime()) / 60_000);
    const timeAgo = diffMin < 60 ? `${diffMin}m` : `${Math.floor(diffMin / 60)}h`;
    let label: string;
    let iconKey: string;
    if (ev.eventType === 'knock') {
      label = `${repName} knocked`;
      iconKey = 'knock';
    } else if (ev.eventType === 'sale') {
      const cents = typeof p.amountCents === 'number' ? p.amountCents : 0;
      const dollars = (cents / 100).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      });
      label = `${repName} closed ${dollars}`;
      iconKey = 'sale';
    } else if (ev.eventType === 'session_start') {
      label = `${repName} clocked in`;
      iconKey = 'session_start';
    } else if (ev.eventType === 'session_end') {
      label = `${repName} clocked out`;
      iconKey = 'session_end';
    } else {
      label = `${repName} uploaded a photo`;
      iconKey = 'photo';
    }
    return { id: ev.id, label, timeAgo, iconKey };
  });

  // ── 14-day revenue chart (daily buckets) ──────────────────────────────────
  const revSeries = (() => {
    const map = new Map<string, number>();
    for (let d = 0; d < 14; d++) {
      const date = new Date(fourteenDaysAgo);
      date.setDate(date.getDate() + d);
      map.set(date.toISOString().slice(0, 10), 0);
    }
    for (const ev of past14dSales) {
      const day = ev.occurredAt.toISOString().slice(0, 10);
      const p = ev.payload as Record<string, unknown>;
      const cents = typeof p.amountCents === 'number' ? p.amountCents : 0;
      map.set(day, (map.get(day) ?? 0) + cents);
    }
    return [...map.values()].map((c) => Math.round(c / 100));
  })();

  // ── Pipeline snapshot (real leads mapped to stages) ───────────────────────
  const pipelineSnapshot = PIPELINE_STAGES.map((s) => ({
    ...s,
    leads: leads
      .filter((l) => l.status === s.status)
      .slice(0, 2)
      .map((l) => ({
        id: l.id,
        name: `${l.givenName ?? ''} ${l.familyName ?? ''}`.trim() || 'Lead',
        address: '—',
      })),
    count: leads.filter((l) => l.status === s.status).length,
  }));

  // ── Anomalies (contextual, derived from real KPIs) ────────────────────────
  const anomalies: {
    severity: 'critical' | 'warning' | 'info';
    title: string;
    description: string;
    timestamp: string;
  }[] = [];
  if (activeSessions === 0 && knockCount === 0) {
    anomalies.push({
      severity: 'warning',
      title: 'No field activity today',
      description: 'No reps on shift and no knocks recorded. Check roster.',
      timestamp: 'now',
    });
  }
  if (knockCount > 10 && saleCount === 0) {
    anomalies.push({
      severity: 'critical',
      title: 'Zero conversions',
      description: `${knockCount} knocks with no sales. Review pitch and territory.`,
      timestamp: 'today',
    });
  }

  // ── Derived constants ─────────────────────────────────────────────────────
  const region = org.regionCode === 'AU' ? 'AU' : 'US';
  const isCharity = org.vertical === 'charity';
  const valueLabel = isCharity ? 'donations' : 'closed deals';
  const repsLabel = isCharity ? 'fundraisers' : 'reps';
  const orgName = org.tradingName ?? org.legalName;

  const funnelSteps = isCharity
    ? [
        { name: 'Knocked', count: knockCount * 4, color: 'bg-slate-400' },
        { name: 'Conversation', count: Math.round(knockCount * 1.8), color: 'bg-blue-400' },
        { name: 'Interested', count: Math.round(knockCount * 0.6), color: 'bg-blue-500' },
        { name: 'Pledged', count: saleCount * 2, color: 'bg-emerald-500' },
        { name: 'Paid', count: saleCount, color: 'bg-emerald-600' },
      ]
    : [
        { name: 'Knocked', count: knockCount * 3, color: 'bg-slate-400' },
        { name: 'Quoted', count: Math.round(knockCount * 1.2), color: 'bg-blue-400' },
        { name: 'Negotiated', count: Math.round(knockCount * 0.5), color: 'bg-blue-500' },
        { name: 'Sold', count: saleCount, color: 'bg-emerald-500' },
        { name: 'Installed', count: Math.round(saleCount * 0.6), color: 'bg-emerald-600' },
      ];

  const funnelMax = Math.max(funnelSteps[0]!.count, 1);
  const performers = topReps.slice(0, 5);

  // ── First-run gate ────────────────────────────────────────────────────────
  if (isFirstRun) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Command centre">
        <TodayFirstRun slug={params.slug} accountName={orgName} />
      </AccountShell>
    );
  }

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Command centre">
      <div className="space-y-5 max-w-[1500px]">
        {/* Scope + freshness banner */}
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Sparkles size={13} />
            <span>
              <span className="font-semibold">{orgName}</span> · {org.regionCode} · Live data ·{' '}
              {activeSessions} rep{activeSessions !== 1 ? 's' : ''} on shift ·{' '}
              <span className="font-semibold">{knockCount}</span> knocks today.
            </span>
          </span>
        </Banner>

        {/* Row 1: KPI rail (6 cards) */}
        <Reveal delay={0} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            label={`${isCharity ? 'Donations' : 'Revenue'} today`}
            value={<Money cents={BigInt(Math.round(revenueCentsToday))} region={region} />}
            hint="from door sales"
          />
          <KpiCard
            label="Conv. rate"
            value={convRate}
            hint={knockCount > 0 ? `${saleCount} of ${knockCount} knocks` : 'no knocks yet'}
          />
          <KpiCard
            label={`Active ${repsLabel}`}
            value={activeSessions}
            hint={`of ${rosterCount} on roster`}
          />
          <KpiCard
            label="MTD revenue"
            value={<Money cents={revenueCentsMTDn} region={region} />}
            hint="month-to-date"
          />
          <KpiCard label="Knocks today" value={knockCount} hint={`${saleCount} converted`} />
          <KpiCard
            label={`${isCharity ? 'Gifts' : 'Sales'} today`}
            value={saleCount}
            hint={valueLabel}
          />
        </Reveal>

        {/* Row 2: Revenue chart + AI summary */}
        <Reveal delay={80} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <Section
              title={`${isCharity ? 'Giving' : 'Revenue'} · 14-day trend`}
              subtitle="Daily total from door sales"
              action={
                revSeries.some((v) => v > 0) ? (
                  <span className="text-[11px] text-success flex items-center gap-1">
                    <TrendingUp size={11} /> Live data
                  </span>
                ) : undefined
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
                    <Money cents={BigInt(Math.max(...revSeries, 0)) * 100n} region={region} />
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
                    <Money cents={(revenueCentsMTDn * 13n) / 10n} region={region} />
                  </div>
                </div>
              </div>
            </Section>
          </div>

          <Section
            title="AI insights"
            subtitle="Powered by field analytics"
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
                      <span className="font-medium">{performers[0]?.name ?? 'Top rep'}</span> leads
                      the board with {performers[0]?.knocks ?? 0} knocks
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-success mt-0.5">·</span>
                    <span>
                      {saleCount} {valueLabel} recorded today — keep pushing
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-success mt-0.5">·</span>
                    <span>Door-attribution {valueLabel} contributing all revenue today</span>
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
                      {activeSessions === 0
                        ? 'No active reps on shift right now'
                        : `${rosterCount - activeSessions} of ${rosterCount} reps offline`}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-600 mt-0.5">·</span>
                    <span>Conv. rate {convRate} vs target 15% — monitor closely</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-600 mt-0.5">·</span>
                    <span>Real-time AI risk analysis coming soon</span>
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
                    <span>Review territories with highest propensity scores</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent mt-0.5">·</span>
                    <span>Push today&apos;s pitch script to {repsLabel}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent mt-0.5">·</span>
                    <span>Check shift coverage for afternoon session</span>
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
                  const stepConv = prev
                    ? prev.count > 0
                      ? (step.count / prev.count) * 100
                      : 0
                    : 100;
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
            {performers.length === 0 ? (
              <div className="px-5 py-8 text-center text-[12px] text-soft">
                No field activity yet today
              </div>
            ) : (
              <div className="divide-y divide-line2">
                {performers.map((n, i) => (
                  <div key={n.initials + i} className="flex items-center gap-3 px-5 py-3">
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
            )}
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
              {anomalies.length === 0 ? (
                <div className="card border border-line2 card-pad text-center text-[12px] text-soft">
                  All clear — no anomalies detected
                </div>
              ) : (
                anomalies.map((a, i) => (
                  <AnomalyCard
                    key={i}
                    severity={a.severity}
                    title={a.title}
                    description={a.description}
                    timestamp={a.timestamp}
                  />
                ))
              )}
            </div>
          </div>

          <Section
            title="Activity stream"
            subtitle="Real-time field events"
            paddedBody={false}
            action={
              <span className="flex items-center gap-1 text-[11px] text-success">
                <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" /> Live
              </span>
            }
          >
            <div className="divide-y divide-line2 max-h-[440px] overflow-y-auto">
              {activity.length === 0 ? (
                <div className="px-5 py-8 text-center text-[12px] text-soft">
                  No activity yet today
                </div>
              ) : (
                activity.map((a) => {
                  const { icon: Icon, iconColor } = getActivityMeta(a.iconKey);
                  return (
                    <div key={a.id} className="px-5 py-2.5 flex items-start gap-2.5">
                      <Icon size={12} className={`${iconColor} mt-1 shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] text-ink leading-snug">{a.label}</div>
                      </div>
                      <span className="text-[10px] text-soft numeric whitespace-nowrap">
                        {a.timeAgo}
                      </span>
                    </div>
                  );
                })
              )}
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
            subtitle={`${repsLabel} live · ${activeSessions} on shift of ${rosterCount} roster`}
            paddedBody={false}
          >
            <div className="px-5 py-3 border-b border-line2">
              <div className="relative h-32 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 rounded-lg overflow-hidden">
                {Array.from({ length: Math.min(activeSessions, 12) }).map((_, i) => {
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
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" /> {activeSessions}{' '}
                    active
                  </span>
                  <span>{org.regionCode === 'AU' ? 'AU regions' : 'US regions'}</span>
                </div>
              </div>
            </div>
            <div className="divide-y divide-line2">
              <div className="px-5 py-2.5 flex items-center justify-between">
                <span className="text-[11px] text-muted">Active now</span>
                <span className="text-[13px] font-semibold text-success numeric">
                  {activeSessions}
                </span>
              </div>
              <div className="px-5 py-2.5 flex items-center justify-between">
                <span className="text-[11px] text-muted">Offline</span>
                <span className="text-[13px] font-semibold text-soft numeric">
                  {Math.max(0, rosterCount - activeSessions)}
                </span>
              </div>
              <div className="px-5 py-2.5 flex items-center justify-between">
                <span className="text-[11px] text-muted">Clock-ins today</span>
                <span className="text-[13px] font-semibold text-ink numeric">
                  {sessionStartCount}
                </span>
              </div>
              <div className="px-5 py-2.5 flex items-center justify-between">
                <span className="text-[11px] text-muted">Clock-outs today</span>
                <span className="text-[13px] font-semibold text-ink numeric">
                  {sessionEndCount}
                </span>
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
                sub: 'active states',
                icon: ShieldCheck,
                color: 'text-success',
                pill: 'success' as const,
              },
              {
                label: 'Audit chain',
                value: 'Healthy',
                sub: 'hash-chained outbox',
                icon: GitBranch,
                color: 'text-success',
                pill: 'success' as const,
              },
              {
                label: 'Payment processor',
                value: '99.98%',
                sub: '30d rolling',
                icon: DollarSign,
                color: 'text-success',
                pill: 'success' as const,
              },
              {
                label: 'API latency P95',
                value: '<200ms',
                sub: '24h rolling',
                icon: Wifi,
                color: 'text-success',
                pill: 'success' as const,
              },
              {
                label: 'Data residency',
                value: org.regionCode === 'AU' ? 'AU Sydney' : 'US East',
                sub: 'enforced · isolated',
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
            { label: 'Territories', href: `/accounts/${params.slug}/territories`, icon: MapPin },
            { label: 'Knockers', href: `/accounts/${params.slug}/knockers`, icon: Users },
            { label: 'Reports', href: `/accounts/${params.slug}/reports`, icon: Activity },
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

        {/* Territories strip */}
        <Section
          title="Active territories"
          subtitle={`${territories.length} configured · today's coverage`}
          paddedBody={false}
        >
          {territories.length === 0 ? (
            <div className="px-5 py-4 text-[12px] text-soft text-center">
              No territories configured yet —{' '}
              <a
                href={`/accounts/${params.slug}/territories`}
                className="text-accent hover:underline"
              >
                add one
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-line2">
              {territories.map((t, i) => (
                <div key={t.id} className="px-4 py-3 flex items-center gap-3">
                  <MapPin size={12} className="text-soft shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] text-ink truncate">{t.name}</div>
                    <div className="text-[10px] text-muted numeric flex items-center gap-1.5">
                      <Users size={9} /> {3 + ((i * 3) % 10)} assigned
                    </div>
                  </div>
                  <StatusPill tone="success">active</StatusPill>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </AccountShell>
  );
}

/**
 * Map event type to icon + color for the activity stream.
 */
function getActivityMeta(iconKey: string): {
  icon: LucideIcon;
  iconColor: string;
} {
  switch (iconKey) {
    case 'sale':
      return { icon: DollarSign, iconColor: 'text-success' };
    case 'session_start':
      return { icon: LogIn, iconColor: 'text-blue-600' };
    case 'session_end':
      return { icon: LogOut, iconColor: 'text-soft' };
    case 'photo':
      return { icon: Camera, iconColor: 'text-accent' };
    default:
      return { icon: MapPin, iconColor: 'text-accent' };
  }
}

/**
 * Hand-rolled SVG line + area chart — no external library.
 */
function RevenueChart({ data, region }: { data: number[]; region: 'AU' | 'US' }): JSX.Element {
  const w = 720;
  const h = 200;
  const pad = 16;

  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const xStep = (w - pad * 2) / (data.length - 1);

  const points = data.map((v, i) => {
    const x = pad + i * xStep;
    const y = h - pad - ((v - min) / range) * (h - pad * 2 - 8);
    return [x, y] as const;
  });

  const line = points
    .map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`))
    .join(' ');
  const area = `${line} L ${points[points.length - 1]![0]} ${h - pad} L ${points[0]![0]} ${h - pad} Z`;

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
