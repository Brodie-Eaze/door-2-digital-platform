'use client';

import { useState } from 'react';
import {
  Globe,
  Plus,
  ExternalLink,
  Edit3,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Filter,
  Eye,
  MousePointer,
  Award,
} from 'lucide-react';
import { Button, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { SitesEmpty, FirstRunBanner } from '@/components/AccountEmptyStates';
import { getAccount } from '@/lib/accounts';
import { firstRunSnapshot } from '@/lib/first-run';

interface Site {
  id: string;
  name: string;
  slug: string;
  type: 'site' | 'funnel';
  visits30d: number;
  conversions30d: number;
  status: 'live' | 'draft' | 'paused';
  gradient: string;
  description: string;
  conversionRate: number;
  trend: number; // % change WoW
}

interface FunnelStep {
  name: string;
  count: number;
}

function buildSites(slug: string): Site[] {
  const isCharity = slug === 'hope-forward' || slug === 'world-vision';
  const isHealth = slug === 'gold-coast-hospital';

  if (isCharity) {
    return [
      {
        id: 's1',
        name: 'Donate now · main page',
        slug: '/give',
        type: 'site',
        visits30d: 48214,
        conversions30d: 4831,
        status: 'live',
        gradient: 'from-blue-500 to-indigo-600',
        description: 'Hero giving page · primary CTA',
        conversionRate: 10.0,
        trend: 12,
      },
      {
        id: 's2',
        name: 'Monthly giving funnel',
        slug: '/monthly',
        type: 'funnel',
        visits30d: 21804,
        conversions30d: 2104,
        status: 'live',
        gradient: 'from-emerald-500 to-teal-600',
        description: 'Landing → tier select → checkout → thank you',
        conversionRate: 9.6,
        trend: 18,
      },
      {
        id: 's3',
        name: 'Child sponsorship funnel',
        slug: '/sponsor',
        type: 'funnel',
        visits30d: 16429,
        conversions30d: 988,
        status: 'live',
        gradient: 'from-amber-500 to-orange-600',
        description: 'Story → child picker → commit → confirm',
        conversionRate: 6.0,
        trend: -3,
      },
      {
        id: 's4',
        name: 'Annual gala 2026',
        slug: '/gala-2026',
        type: 'site',
        visits30d: 8214,
        conversions30d: 184,
        status: 'live',
        gradient: 'from-violet-500 to-fuchsia-600',
        description: 'Event RSVP + sponsorship tiers',
        conversionRate: 2.2,
        trend: 42,
      },
      {
        id: 's5',
        name: 'Impact stories',
        slug: '/stories',
        type: 'site',
        visits30d: 22148,
        conversions30d: 412,
        status: 'live',
        gradient: 'from-rose-500 to-pink-600',
        description: 'Content hub · long-form testimonials',
        conversionRate: 1.9,
        trend: 8,
      },
      {
        id: 's6',
        name: 'Legacy giving',
        slug: '/legacy',
        type: 'site',
        visits30d: 1284,
        conversions30d: 22,
        status: 'live',
        gradient: 'from-slate-500 to-gray-700',
        description: 'Planned giving inquiry hub',
        conversionRate: 1.7,
        trend: 14,
      },
      {
        id: 's7',
        name: 'Volunteer hub',
        slug: '/volunteer',
        type: 'site',
        visits30d: 4128,
        conversions30d: 318,
        status: 'live',
        gradient: 'from-cyan-500 to-blue-600',
        description: 'Opportunity board + signup',
        conversionRate: 7.7,
        trend: -7,
      },
      {
        id: 's8',
        name: 'Holiday appeal (draft)',
        slug: '/give-thanks',
        type: 'funnel',
        visits30d: 0,
        conversions30d: 0,
        status: 'draft',
        gradient: 'from-zinc-400 to-stone-500',
        description: 'Seasonal campaign · Nov launch',
        conversionRate: 0,
        trend: 0,
      },
    ];
  }

  if (isHealth) {
    return [
      {
        id: 's1',
        name: 'New wing capital campaign',
        slug: '/new-wing',
        type: 'funnel',
        visits30d: 14820,
        conversions30d: 89,
        status: 'live',
        gradient: 'from-blue-500 to-indigo-700',
        description: 'Story → pledge tiers → commit → tour booking',
        conversionRate: 0.6,
        trend: 32,
      },
      {
        id: 's2',
        name: 'Donor portal',
        slug: '/donors',
        type: 'site',
        visits30d: 4204,
        conversions30d: 412,
        status: 'live',
        gradient: 'from-emerald-500 to-teal-600',
        description: 'Authenticated donor area',
        conversionRate: 9.8,
        trend: 4,
      },
      {
        id: 's3',
        name: 'Bequest landing',
        slug: '/bequest',
        type: 'site',
        visits30d: 1208,
        conversions30d: 18,
        status: 'live',
        gradient: 'from-amber-500 to-orange-600',
        description: 'Planned giving inquiry',
        conversionRate: 1.5,
        trend: 11,
      },
      {
        id: 's4',
        name: 'Patient family hub',
        slug: '/families',
        type: 'site',
        visits30d: 8214,
        conversions30d: 412,
        status: 'live',
        gradient: 'from-rose-500 to-pink-600',
        description: 'Family resources + donation prompt',
        conversionRate: 5.0,
        trend: 16,
      },
      {
        id: 's5',
        name: 'Hospital tour booking',
        slug: '/tour',
        type: 'site',
        visits30d: 942,
        conversions30d: 64,
        status: 'live',
        gradient: 'from-violet-500 to-fuchsia-600',
        description: 'Donor stewardship tours',
        conversionRate: 6.8,
        trend: 22,
      },
      {
        id: 's6',
        name: 'Naming rights (draft)',
        slug: '/naming',
        type: 'site',
        visits30d: 0,
        conversions30d: 0,
        status: 'draft',
        gradient: 'from-zinc-400 to-stone-500',
        description: 'High-touch · major-gift only',
        conversionRate: 0,
        trend: 0,
      },
    ];
  }

  // commercial / pestmax
  return [
    {
      id: 's1',
      name: 'Get a quote funnel',
      slug: '/quote',
      type: 'funnel',
      visits30d: 8420,
      conversions30d: 1208,
      status: 'live',
      gradient: 'from-blue-500 to-indigo-600',
      description: 'Lead form → callback → quote → close',
      conversionRate: 14.3,
      trend: 18,
    },
    {
      id: 's2',
      name: 'Service plans',
      slug: '/plans',
      type: 'site',
      visits30d: 4128,
      conversions30d: 312,
      status: 'live',
      gradient: 'from-emerald-500 to-teal-600',
      description: 'Recurring service tier comparison',
      conversionRate: 7.5,
      trend: 11,
    },
    {
      id: 's3',
      name: 'Commercial site',
      slug: '/commercial',
      type: 'site',
      visits30d: 1842,
      conversions30d: 64,
      status: 'live',
      gradient: 'from-amber-500 to-orange-600',
      description: 'B2B landing + RFP form',
      conversionRate: 3.5,
      trend: -4,
    },
    {
      id: 's4',
      name: 'Termite inspection',
      slug: '/termite',
      type: 'funnel',
      visits30d: 6204,
      conversions30d: 612,
      status: 'live',
      gradient: 'from-violet-500 to-fuchsia-600',
      description: 'Concern → inspection → quote',
      conversionRate: 9.9,
      trend: 24,
    },
    {
      id: 's5',
      name: 'Multi-site quote builder',
      slug: '/enterprise',
      type: 'site',
      visits30d: 412,
      conversions30d: 42,
      status: 'paused',
      gradient: 'from-rose-500 to-pink-600',
      description: 'Enterprise pricing tool',
      conversionRate: 10.2,
      trend: 0,
    },
    {
      id: 's6',
      name: 'Customer login portal',
      slug: '/portal',
      type: 'site',
      visits30d: 12480,
      conversions30d: 824,
      status: 'live',
      gradient: 'from-cyan-500 to-blue-600',
      description: 'Existing customer area',
      conversionRate: 6.6,
      trend: 2,
    },
  ];
}

function buildFunnelSteps(slug: string): FunnelStep[] {
  const isCharity = slug === 'hope-forward' || slug === 'world-vision';
  const isHealth = slug === 'gold-coast-hospital';
  if (isCharity)
    return [
      { name: 'Landing', count: 21804 },
      { name: 'Tier select', count: 8421 },
      { name: 'Personal info', count: 4218 },
      { name: 'Payment', count: 2480 },
      { name: 'Thank you', count: 2104 },
    ];
  if (isHealth)
    return [
      { name: 'Landing', count: 14820 },
      { name: 'Campaign story', count: 6204 },
      { name: 'Pledge tier', count: 824 },
      { name: 'Commit', count: 142 },
      { name: 'Tour booked', count: 89 },
    ];
  return [
    { name: 'Landing', count: 8420 },
    { name: 'Concern intake', count: 4218 },
    { name: 'Contact info', count: 2480 },
    { name: 'Quote sent', count: 1842 },
    { name: 'Closed deal', count: 1208 },
  ];
}

export default function SitesPage({ params }: { params: { slug: string } }): JSX.Element {
  const account = getAccount(params.slug);
  const [filter, setFilter] = useState<'all' | 'site' | 'funnel'>('all');

  const firstRun = firstRunSnapshot(params.slug);
  if (!account || firstRun.isFirstRun) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Sites & Funnels">
        <div className="space-y-5 max-w-[1400px]">
          {firstRun.isFirstRun && (
            <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          )}
          <SitesEmpty slug={params.slug} accountName={firstRun.accountName} />
        </div>
      </AccountShell>
    );
  }

  const allSites = buildSites(params.slug);
  const sites = filter === 'all' ? allSites : allSites.filter((s) => s.type === filter);

  const liveSites = allSites.filter((s) => s.status === 'live');
  const totalVisits = liveSites.reduce((s, x) => s + x.visits30d, 0);
  const totalConv = liveSites.reduce((s, x) => s + x.conversions30d, 0);
  const avgConv = totalVisits > 0 ? ((totalConv / totalVisits) * 100).toFixed(1) : '0';
  const topPerformer = [...liveSites].sort((a, b) => b.conversionRate - a.conversionRate)[0];

  const funnelSteps = buildFunnelSteps(params.slug);
  const funnelMax = funnelSteps[0]?.count ?? 1;

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Sites & Funnels">
      <div className="space-y-5 max-w-[1500px]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Live sites" value={liveSites.length} hint={`${allSites.length} total`} />
          <KpiCard
            label="Visits · 30d"
            value={totalVisits.toLocaleString()}
            delta="+18%"
            deltaTone="positive"
          />
          <KpiCard
            label="Avg conv rate"
            value={`${avgConv}%`}
            delta="+0.9pp"
            deltaTone="positive"
          />
          <KpiCard
            label="Top performer"
            value={topPerformer ? `${topPerformer.conversionRate}%` : '—'}
            hint={topPerformer?.name ?? ''}
          />
        </div>

        <div className="card !p-0">
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-line2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Filter size={12} className="text-soft" />
              {(['all', 'site', 'funnel'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`px-2 py-1 rounded text-[11px] font-medium capitalize transition ${
                    filter === s
                      ? 'bg-ink text-surface'
                      : 'bg-paper text-muted hover:bg-line2 hover:text-ink'
                  }`}
                >
                  {s === 'all' ? 'All' : `${s}s`}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" leftIcon={<Edit3 size={12} />}>
              Open editor
            </Button>
            <Button variant="primary" size="sm" leftIcon={<Plus size={12} />}>
              New site / funnel
            </Button>
          </div>

          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sites.map((s) => (
              <div
                key={s.id}
                className="card !shadow-none border border-line2 overflow-hidden hover:border-line hover:shadow-md transition"
              >
                <div className={`h-28 bg-gradient-to-br ${s.gradient} relative flex items-end p-3`}>
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    <StatusPill
                      tone={
                        s.status === 'live' ? 'success' : s.status === 'paused' ? 'warn' : 'muted'
                      }
                    >
                      {s.status}
                    </StatusPill>
                  </div>
                  <div className="text-surface text-[10px] uppercase tracking-wider opacity-80">
                    {s.type === 'funnel' ? 'Funnel' : 'Site'}
                  </div>
                </div>
                <div className="card-pad space-y-2.5">
                  <div>
                    <div className="text-[13px] font-semibold text-ink truncate">{s.name}</div>
                    <code className="text-[10px] text-muted">d2d.io{s.slug}</code>
                  </div>
                  <div className="text-[11px] text-muted">{s.description}</div>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-line2">
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-muted flex items-center gap-1">
                        <Eye size={9} /> Visits
                      </div>
                      <div className="text-[13px] font-semibold text-ink numeric">
                        {s.visits30d.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-muted flex items-center gap-1">
                        <MousePointer size={9} /> Conv
                      </div>
                      <div className="text-[13px] font-semibold text-ink numeric">
                        {s.conversions30d.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-muted">Rate</div>
                      <div className="text-[13px] font-semibold text-ink numeric">
                        {s.conversionRate}%
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-line2">
                    <span
                      className={`text-[10px] flex items-center gap-1 numeric ${s.trend >= 0 ? 'text-success' : 'text-rose-600'}`}
                    >
                      {s.trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}{' '}
                      {s.trend >= 0 ? '+' : ''}
                      {s.trend}% WoW
                    </span>
                    <div className="flex items-center gap-1">
                      <button className="w-6 h-6 rounded hover:bg-paper flex items-center justify-center text-soft hover:text-ink">
                        <Edit3 size={11} />
                      </button>
                      <button className="w-6 h-6 rounded hover:bg-paper flex items-center justify-center text-soft hover:text-ink">
                        <BarChart3 size={11} />
                      </button>
                      <button className="w-6 h-6 rounded hover:bg-paper flex items-center justify-center text-soft hover:text-ink">
                        <ExternalLink size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Section
              title="Funnel analytics"
              subtitle="Step-by-step conversion · top funnel · last 30d"
            >
              <div className="space-y-2.5">
                {funnelSteps.map((step, i) => {
                  const pct = (step.count / funnelMax) * 100;
                  const prev = funnelSteps[i - 1];
                  const stepConv = prev ? (step.count / prev.count) * 100 : 100;
                  const dropOff = prev ? prev.count - step.count : 0;
                  return (
                    <div key={step.name}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-soft numeric">#{i + 1}</span>
                          <span className="text-[12.5px] font-medium text-ink">{step.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px]">
                          <span className="text-muted">{step.count.toLocaleString()} sessions</span>
                          <span className="font-semibold text-ink numeric w-12 text-right">
                            {stepConv.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="relative h-8 bg-paper rounded overflow-hidden border border-line2">
                        <div
                          className="h-full bg-gradient-to-r from-accent to-blue-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                        <div className="absolute inset-0 flex items-center px-3">
                          <span className="text-[11px] font-medium text-ink numeric">
                            {step.count.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      {prev && dropOff > 0 && (
                        <div className="text-[10px] text-rose-600 mt-0.5 ml-4 numeric">
                          ↓ {dropOff.toLocaleString()} dropped off ({(100 - stepConv).toFixed(1)}%)
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-3 border-t border-line2 flex items-center gap-2">
                <Award size={14} className="text-accent" />
                <span className="text-[12px] text-muted">Overall conversion:</span>
                <span className="text-[14px] font-bold text-ink numeric">
                  {((funnelSteps[funnelSteps.length - 1]!.count / funnelMax) * 100).toFixed(1)}%
                </span>
                <span className="text-[11px] text-success ml-auto flex items-center gap-1">
                  <TrendingUp size={11} /> +1.2pp vs LM
                </span>
              </div>
            </Section>
          </div>

          <Section title="Domains" subtitle="Connected" paddedBody={false}>
            <div className="divide-y divide-line2">
              {[
                {
                  dom: `${account.shortName.toLowerCase().replace(/\s+/g, '')}.org`,
                  ssl: true,
                  primary: true,
                },
                {
                  dom: `give.${account.shortName.toLowerCase().replace(/\s+/g, '')}.org`,
                  ssl: true,
                  primary: false,
                },
                { dom: 'd2d.io', ssl: true, primary: false },
              ].map((d) => (
                <div key={d.dom} className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Globe size={11} className="text-soft" />
                    <code className="text-[12px] text-ink flex-1 truncate">{d.dom}</code>
                    {d.primary && <StatusPill tone="info">primary</StatusPill>}
                    {d.ssl && <StatusPill tone="success">SSL</StatusPill>}
                  </div>
                </div>
              ))}
              <div className="px-5 py-2.5">
                <button className="text-[11px] text-accent font-medium hover:underline">
                  + Add domain
                </button>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </AccountShell>
  );
}
