'use client';

import { useState } from 'react';
import {
  Heart,
  TrendingUp,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  Crown,
  Star,
  Award,
  Gift,
  Filter,
  Plus,
  Mail,
} from 'lucide-react';
import { KpiCard, Money, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { getAccount } from '@/lib/accounts';

interface Tier {
  id: string;
  name: string;
  icon: typeof Heart;
  priceCents: bigint;
  cadence: 'mo' | 'yr';
  members: number;
  growth: number; // % WoW
  benefits: string[];
  color: string;
  highlight?: boolean;
}

interface MemberActivity {
  id: string;
  member: string;
  action: 'joined' | 'upgraded' | 'churned' | 'renewed' | 'downgraded';
  tier: string;
  fromTier?: string;
  when: string;
  valueCents?: bigint;
}

interface TopMember {
  id: string;
  name: string;
  tier: string;
  joined: string;
  ltvCents: bigint;
  lastInteraction: string;
  status: 'active' | 'at-risk' | 'champion';
}

function buildTiers(slug: string): Tier[] {
  const isCharity = slug === 'hope-forward' || slug === 'world-vision';
  const isHealth = slug === 'gold-coast-hospital';

  if (isCharity) {
    return [
      {
        id: 't1',
        name: 'Friend',
        icon: Heart,
        priceCents: 15_00n,
        cadence: 'mo',
        members: 8420,
        growth: 12,
        benefits: ['Monthly impact email', 'Donor portal access', 'Annual report'],
        color: 'from-sky-500 to-blue-500',
      },
      {
        id: 't2',
        name: 'Advocate',
        icon: Star,
        priceCents: 50_00n,
        cadence: 'mo',
        members: 2104,
        growth: 22,
        benefits: [
          'Friend benefits',
          'Quarterly impact call',
          'Field-trip invites',
          'Branded gear',
        ],
        color: 'from-emerald-500 to-teal-600',
        highlight: true,
      },
      {
        id: 't3',
        name: 'Champion',
        icon: Award,
        priceCents: 200_00n,
        cadence: 'mo',
        members: 412,
        growth: 8,
        benefits: [
          'Advocate benefits',
          'Direct line to program lead',
          'Named on annual wall',
          'Gala access',
        ],
        color: 'from-amber-500 to-orange-600',
      },
      {
        id: 't4',
        name: 'Legacy circle',
        icon: Crown,
        priceCents: 1000_00n,
        cadence: 'mo',
        members: 64,
        growth: 3,
        benefits: [
          'All benefits',
          'CEO quarterly call',
          'Custom impact reporting',
          'Site visit each year',
        ],
        color: 'from-violet-500 to-fuchsia-600',
      },
    ];
  }

  if (isHealth) {
    return [
      {
        id: 't1',
        name: 'Hospital friend',
        icon: Heart,
        priceCents: 25_00n,
        cadence: 'mo',
        members: 412,
        growth: 8,
        benefits: ['Newsletter', 'Year-end report', 'Hospital tours (quarterly)'],
        color: 'from-sky-500 to-blue-500',
      },
      {
        id: 't2',
        name: 'Family circle',
        icon: Star,
        priceCents: 100_00n,
        cadence: 'mo',
        members: 89,
        growth: 14,
        benefits: ['Friend benefits', 'Ward visits', 'Foundation events'],
        color: 'from-emerald-500 to-teal-600',
        highlight: true,
      },
      {
        id: 't3',
        name: "Founder's society",
        icon: Award,
        priceCents: 500_00n,
        cadence: 'mo',
        members: 18,
        growth: 6,
        benefits: ['Family benefits', 'CEO quarterly brief', 'Naming opportunities'],
        color: 'from-violet-500 to-fuchsia-600',
      },
    ];
  }

  return [
    {
      id: 't1',
      name: 'Basic plan',
      icon: Heart,
      priceCents: 49_00n,
      cadence: 'mo',
      members: 248,
      growth: 4,
      benefits: ['Quarterly inspection', 'Re-treat guarantee', 'Email reports'],
      color: 'from-sky-500 to-blue-500',
    },
    {
      id: 't2',
      name: 'Pro plan',
      icon: Star,
      priceCents: 99_00n,
      cadence: 'mo',
      members: 124,
      growth: 18,
      benefits: ['Basic benefits', 'Monthly visit', 'Priority dispatch', 'Termite cover'],
      color: 'from-emerald-500 to-teal-600',
      highlight: true,
    },
    {
      id: 't3',
      name: 'Commercial',
      icon: Award,
      priceCents: 399_00n,
      cadence: 'mo',
      members: 32,
      growth: 12,
      benefits: ['Pro benefits', 'On-call response', 'Compliance reporting', 'Dedicated tech'],
      color: 'from-amber-500 to-orange-600',
    },
    {
      id: 't4',
      name: 'Enterprise',
      icon: Crown,
      priceCents: 1499_00n,
      cadence: 'mo',
      members: 8,
      growth: 2,
      benefits: ['Commercial benefits', 'Multi-site coverage', 'SLA reporting', 'Account manager'],
      color: 'from-violet-500 to-fuchsia-600',
    },
  ];
}

function buildActivity(slug: string): MemberActivity[] {
  const isCharity = slug === 'hope-forward' || slug === 'world-vision';
  const isHealth = slug === 'gold-coast-hospital';
  const names = [
    'Maria Santos',
    'David Chen',
    'Aisha Williams',
    'Robert Kim',
    'Sophia Patel',
    'James Walker',
    'Olivia Park',
    'Liam Nguyen',
    'Eva Novak',
    'Marcus Brown',
  ];
  const tiers = isCharity
    ? ['Friend', 'Advocate', 'Champion', 'Legacy circle']
    : isHealth
      ? ['Hospital friend', 'Family circle', "Founder's society"]
      : ['Basic plan', 'Pro plan', 'Commercial', 'Enterprise'];
  const actions: MemberActivity['action'][] = [
    'joined',
    'upgraded',
    'renewed',
    'upgraded',
    'churned',
    'joined',
    'renewed',
    'downgraded',
    'joined',
    'upgraded',
  ];
  return names.map((n, i) => ({
    id: `act_${i}`,
    member: n,
    action: actions[i]!,
    tier: tiers[i % tiers.length]!,
    fromTier:
      actions[i] === 'upgraded' || actions[i] === 'downgraded'
        ? tiers[(i + 1) % tiers.length]
        : undefined,
    when: `${i * 11 + 4}m ago`,
    valueCents:
      actions[i] === 'churned' || actions[i] === 'downgraded'
        ? undefined
        : BigInt((50 + i * 25) * 100),
  }));
}

function buildTopMembers(slug: string): TopMember[] {
  const isCharity = slug === 'hope-forward' || slug === 'world-vision';
  const isHealth = slug === 'gold-coast-hospital';
  const tierName = isCharity ? 'Legacy circle' : isHealth ? "Founder's society" : 'Enterprise';
  const champTier = isCharity ? 'Champion' : isHealth ? 'Family circle' : 'Commercial';
  return [
    {
      id: 'm1',
      name: 'Walker Estate',
      tier: tierName,
      joined: '4 years ago',
      ltvCents: 84_240_00n,
      lastInteraction: '2d ago',
      status: 'champion',
    },
    {
      id: 'm2',
      name: 'Patel Foundation',
      tier: tierName,
      joined: '2 years ago',
      ltvCents: 52_180_00n,
      lastInteraction: '1w ago',
      status: 'active',
    },
    {
      id: 'm3',
      name: 'Carter Family Trust',
      tier: champTier,
      joined: '6 years ago',
      ltvCents: 38_420_00n,
      lastInteraction: '14d ago',
      status: 'at-risk',
    },
    {
      id: 'm4',
      name: 'Goldman Family',
      tier: champTier,
      joined: '3 years ago',
      ltvCents: 28_140_00n,
      lastInteraction: '4d ago',
      status: 'champion',
    },
    {
      id: 'm5',
      name: 'Anderson Group',
      tier: champTier,
      joined: '1 year ago',
      ltvCents: 14_820_00n,
      lastInteraction: '1d ago',
      status: 'active',
    },
    {
      id: 'm6',
      name: 'Browne Foundation',
      tier: tierName,
      joined: '8 months ago',
      ltvCents: 24_000_00n,
      lastInteraction: '5h ago',
      status: 'active',
    },
  ];
}

const ACTION_STYLES: Record<
  MemberActivity['action'],
  { icon: typeof Heart; color: string; label: string }
> = {
  joined: { icon: Plus, color: 'text-success bg-successSoft', label: 'Joined' },
  upgraded: { icon: ArrowUp, color: 'text-accent bg-accentSoft', label: 'Upgraded' },
  downgraded: { icon: ArrowDown, color: 'text-warn bg-amber-50', label: 'Downgraded' },
  churned: { icon: TrendingDown, color: 'text-rose-700 bg-rose-50', label: 'Churned' },
  renewed: { icon: TrendingUp, color: 'text-emerald-700 bg-emerald-50', label: 'Renewed' },
};

export default function MembershipsPage({ params }: { params: { slug: string } }): JSX.Element {
  const account = getAccount(params.slug);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'at-risk' | 'champion'>(
    'all',
  );

  if (!account) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Not found">
        <div>Account not found</div>
      </AccountShell>
    );
  }

  const region = account.region === 'AU' ? 'AU' : 'US';
  const tiers = buildTiers(params.slug);
  const activity = buildActivity(params.slug);
  const topMembers = buildTopMembers(params.slug);

  const totalMembers = tiers.reduce((s, t) => s + t.members, 0);
  const mrrCents = tiers.reduce((s, t) => s + t.priceCents * BigInt(t.members), 0n);
  const churn30d = 2.4;
  const avgLtvCents = mrrCents / BigInt(Math.max(totalMembers, 1));
  const avgLtvAnnualCents = avgLtvCents * 36n;

  const filteredMembers = topMembers.filter((m) =>
    statusFilter === 'all' ? true : m.status === statusFilter,
  );

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Memberships">
      <div className="space-y-5 max-w-[1500px]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="Active members"
            value={totalMembers.toLocaleString()}
            delta="+12%"
            deltaTone="positive"
            hint="across all tiers"
          />
          <KpiCard
            label="MRR"
            value={<Money cents={mrrCents} region={region} />}
            delta="+18%"
            deltaTone="positive"
            hint="recurring revenue"
          />
          <KpiCard
            label="Churn · 30d"
            value={`${churn30d}%`}
            delta="-0.4pp"
            deltaTone="positive"
            hint="below target"
          />
          <KpiCard
            label="Avg LTV (3yr)"
            value={<Money cents={avgLtvAnnualCents} region={region} />}
            hint="36mo expected"
          />
        </div>

        <Section title="Tiers" subtitle="Membership plans + benefits">
          <div
            className={`grid grid-cols-1 md:grid-cols-2 ${tiers.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3`}
          >
            {tiers.map((t) => {
              const Icon = t.icon;
              const tierMrr = t.priceCents * BigInt(t.members);
              return (
                <div
                  key={t.id}
                  className={`card !shadow-none border-2 overflow-hidden ${
                    t.highlight ? 'border-accent shadow-lg' : 'border-line2'
                  }`}
                >
                  <div className={`h-2 bg-gradient-to-r ${t.color}`} />
                  <div className="card-pad space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <Icon size={14} className="text-ink" />
                          <div className="text-[14px] font-semibold text-ink">{t.name}</div>
                        </div>
                        {t.highlight && (
                          <div className="text-[10px] text-accent font-medium mt-0.5">
                            Most popular
                          </div>
                        )}
                      </div>
                      <span
                        className={`text-[10px] flex items-center gap-0.5 font-medium ${t.growth > 10 ? 'text-success' : 'text-muted'}`}
                      >
                        <TrendingUp size={10} /> +{t.growth}%
                      </span>
                    </div>
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[22px] font-bold text-ink numeric">
                          <Money cents={t.priceCents} region={region} />
                        </span>
                        <span className="text-[11px] text-muted">/ {t.cadence}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {t.benefits.map((b) => (
                        <div key={b} className="text-[11px] text-muted flex items-start gap-1.5">
                          <span className="text-success mt-0.5">·</span>
                          <span>{b}</span>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-line2">
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-muted">
                          Members
                        </div>
                        <div className="text-[14px] font-semibold text-ink numeric">
                          {t.members.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-muted">MRR</div>
                        <div className="text-[14px] font-semibold text-ink numeric">
                          <Money cents={tierMrr} region={region} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Section
            title="Recent activity"
            subtitle="Joins · upgrades · renewals · churn"
            paddedBody={false}
          >
            <div className="divide-y divide-line2">
              {activity.map((a) => {
                const style = ACTION_STYLES[a.action];
                const Icon = style.icon;
                return (
                  <div key={a.id} className="px-5 py-3 flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${style.color}`}
                    >
                      <Icon size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] text-ink truncate">
                        <span className="font-medium">{a.member}</span>{' '}
                        <span className="text-muted">{style.label.toLowerCase()}</span>{' '}
                        {a.fromTier && (
                          <span className="text-muted">
                            from <span className="text-ink">{a.fromTier}</span> →
                          </span>
                        )}{' '}
                        <span className="text-ink font-medium">{a.tier}</span>
                      </div>
                      <div className="text-[10px] text-muted numeric">{a.when}</div>
                    </div>
                    {a.valueCents && (
                      <div className="text-[12px] font-semibold text-ink numeric">
                        <Money cents={a.valueCents} region={region} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title="MRR trend" subtitle="Last 12 weeks · weekly snapshot">
            <div className="px-2">
              <MrrChart slug={params.slug} />
            </div>
            <div className="mt-4 pt-3 border-t border-line2 grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted">Net adds</div>
                <div className="text-[16px] font-semibold text-success numeric mt-0.5">+248</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted">Upgrades</div>
                <div className="text-[16px] font-semibold text-accent numeric mt-0.5">+112</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted">Churn</div>
                <div className="text-[16px] font-semibold text-rose-600 numeric mt-0.5">-42</div>
              </div>
            </div>
          </Section>
        </div>

        <Section
          title="Top members"
          subtitle={`${filteredMembers.length} ${statusFilter === 'all' ? 'high-value' : statusFilter}`}
          paddedBody={false}
          action={
            <div className="flex items-center gap-1.5">
              <Filter size={12} className="text-soft" />
              {(['all', 'champion', 'active', 'at-risk'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2 py-1 rounded text-[11px] font-medium capitalize transition ${
                    statusFilter === s
                      ? 'bg-ink text-surface'
                      : 'bg-paper text-muted hover:bg-line2 hover:text-ink'
                  }`}
                >
                  {s.replace('-', ' ')}
                </button>
              ))}
            </div>
          }
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Member</th>
                <th>Tier</th>
                <th>Status</th>
                <th>LTV</th>
                <th>Joined</th>
                <th>Last interaction</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <Gift size={11} className="text-soft" />
                      <span className="text-[13px] font-medium text-ink">{m.name}</span>
                    </div>
                  </td>
                  <td>
                    <span className="tag">{m.tier}</span>
                  </td>
                  <td>
                    <StatusPill
                      tone={
                        m.status === 'champion'
                          ? 'success'
                          : m.status === 'at-risk'
                            ? 'warn'
                            : 'info'
                      }
                    >
                      {m.status.replace('-', ' ')}
                    </StatusPill>
                  </td>
                  <td className="numeric text-[13px] font-semibold">
                    <Money cents={m.ltvCents} region={region} />
                  </td>
                  <td className="text-[12px] text-muted">{m.joined}</td>
                  <td className="text-[12px] text-muted">{m.lastInteraction}</td>
                  <td>
                    <button className="text-[11px] text-accent font-medium hover:underline flex items-center gap-1">
                      <Mail size={10} /> Reach out
                    </button>
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

function MrrChart({ slug }: { slug: string }): JSX.Element {
  // Build 12 weekly data points — varied per slug
  const seed =
    slug === 'hope-forward' ? 100 : slug === 'world-vision' ? 75 : slug === 'pestmax' ? 18 : 6;
  const data = Array.from({ length: 12 }, (_, i) => {
    const base = seed * (1 + i * 0.06);
    const wobble = Math.sin(i * 1.3) * seed * 0.04;
    return Math.max(seed * 0.8, base + wobble);
  });
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const w = 420;
  const h = 140;
  const pad = 8;
  const xStep = (w - pad * 2) / (data.length - 1);

  const points = data.map((v, i) => {
    const x = pad + i * xStep;
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return [x, y] as const;
  });

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
  const area = `${line} L ${points[points.length - 1]![0]} ${h - pad} L ${points[0]![0]} ${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`grad-${slug}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#grad-${slug})`} />
      <path d={line} fill="none" stroke="#3b82f6" strokeWidth="2" />
      {points.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill="#3b82f6" />
      ))}
    </svg>
  );
}
