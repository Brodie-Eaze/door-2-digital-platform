/**
 * Per-account planning fixtures — TeamPlan + WeekForecast + MonthRecommendation
 * data scoped per business. Drives the `<PlanningSurface>` on every sub-account.
 *
 * Each business gets its own currency, geography, AI rationale style, and
 * iPad fleet size for "Push to field" broadcast scope.
 */

import type {
  Period,
  TeamPlan,
  WeekForecastDay,
  MonthRecommendation,
} from '@/components/PlanningSurface';

export interface AccountPlanning {
  plans: Record<Period, TeamPlan[]>;
  weekForecast: WeekForecastDay[];
  monthRecos: MonthRecommendation[];
  iPadCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — build large-period plans by tiling a base set
// ─────────────────────────────────────────────────────────────────────────────

function tile(base: TeamPlan[], count: number, prefix: string): TeamPlan[] {
  const out: TeamPlan[] = [];
  for (let i = 0; i < count; i++) {
    const seed = base[i % base.length]!;
    out.push({
      ...seed,
      id: `${prefix}-${i}`,
      teamName:
        i < base.length
          ? seed.teamName
          : `${seed.teamName.split(' ')[0]} crew ${Math.floor(i / base.length) + 1}`,
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// HQ planning (Texas region — for the unscoped /planning page)
// ─────────────────────────────────────────────────────────────────────────────

const HQ_TODAY: TeamPlan[] = [
  {
    id: 'hq-today-austin',
    teamName: 'Austin team',
    priorityTone: 'high',
    locationLabel: 'Austin East + Austin South (NEW)',
    hoursLabel: '09:00–17:00',
    betweenZonesLabel: '12min between zones',
    forecastConv: 32,
    forecastGmvCents: 980000,
    currency: 'USD',
    repInitials: ['JM', 'JD', 'AR', 'TM'],
    aiSuggestion:
      'AI: Push 2 reps from Austin East (saturation 42%) to Austin South (propensity 0.81). +14pp lift expected.',
  },
  {
    id: 'hq-today-dallas',
    teamName: 'Dallas team',
    priorityTone: 'high',
    locationLabel: 'Dallas Metro + Plano (NEW)',
    hoursLabel: '08:00–17:30',
    betweenZonesLabel: '18min Dallas→Plano',
    forecastConv: 24,
    forecastGmvCents: 720000,
    currency: 'USD',
    repInitials: ['AM', 'BC', 'HK'],
    aiSuggestion:
      'AI: Plano is a lookalike to top Highland Park cohort. Move HK who is idle today.',
  },
  {
    id: 'hq-today-houston',
    teamName: 'Houston team',
    priorityTone: 'medium',
    locationLabel: 'Houston SE',
    hoursLabel: '09:00–17:00',
    betweenZonesLabel: 'In-zone only',
    forecastConv: 14,
    forecastGmvCents: 420000,
    currency: 'USD',
    repInitials: ['KP', 'ML'],
    aiSuggestion:
      'DR offline today — KP + ML cover. Saturation at 64% — start considering Sugar Land for next week.',
  },
];

const HQ_WEEK_FORECAST: WeekForecastDay[] = [
  {
    day: 'Mon',
    conv: 78,
    delta: 13,
    breakdown: [
      { label: 'Austin', value: 32 },
      { label: 'Dallas', value: 24 },
      { label: 'Houston', value: 14 },
      { label: 'Outliers', value: 8 },
    ],
  },
  {
    day: 'Tue',
    conv: 82,
    delta: 11,
    breakdown: [
      { label: 'Austin', value: 34 },
      { label: 'Dallas', value: 26 },
      { label: 'Houston', value: 16 },
      { label: 'Outliers', value: 6 },
    ],
  },
  {
    day: 'Wed',
    conv: 76,
    delta: 8,
    breakdown: [
      { label: 'Austin', value: 30 },
      { label: 'Dallas', value: 24 },
      { label: 'Houston', value: 14 },
      { label: 'Outliers', value: 8 },
    ],
  },
  {
    day: 'Thu',
    conv: 84,
    delta: 10,
    breakdown: [
      { label: 'Austin', value: 36 },
      { label: 'Dallas', value: 26 },
      { label: 'Houston', value: 16 },
      { label: 'Outliers', value: 6 },
    ],
  },
  {
    day: 'Fri',
    conv: 91,
    delta: 12,
    breakdown: [
      { label: 'Austin', value: 38 },
      { label: 'Dallas', value: 28 },
      { label: 'Houston', value: 18 },
      { label: 'Outliers', value: 7 },
    ],
  },
  {
    day: 'Sat',
    conv: 42,
    delta: 4,
    breakdown: [
      { label: 'Austin', value: 18 },
      { label: 'Dallas', value: 12 },
      { label: 'Houston', value: 8 },
      { label: 'Outliers', value: 4 },
    ],
  },
];

const HQ_MONTH_RECOS: MonthRecommendation[] = [
  {
    id: 'hq-r1',
    title: 'Bring AZ region online',
    detail: 'CA reg pending, AZ cleared. Pre-position 8 reps in Phoenix West (propensity 0.76).',
  },
  {
    id: 'hq-r2',
    title: 'Recruit 12 Knockers in Dallas',
    detail: 'Dallas demand exceeds capacity. Funnel can absorb 12 new hires in 30d.',
  },
  {
    id: 'hq-r3',
    title: 'Push retargeting harder',
    detail:
      'Smart list "Knocked-not-converted 7d" has 142 hot leads. Spend $4k on Meta this month.',
  },
  {
    id: 'hq-r4',
    title: 'Sunset Highland Park',
    detail: 'Propensity 0.42, conv. rate 4.1%. Pull 1 rep, reassign to Plano.',
  },
];

export const HQ_PLANNING: AccountPlanning = {
  plans: {
    today: HQ_TODAY,
    week: tile(HQ_TODAY, 8, 'hq-week'),
    month: tile(HQ_TODAY, 24, 'hq-month'),
    quarter: tile(HQ_TODAY, 78, 'hq-quarter'),
  },
  weekForecast: HQ_WEEK_FORECAST,
  monthRecos: HQ_MONTH_RECOS,
  iPadCount: 420,
};

// ─────────────────────────────────────────────────────────────────────────────
// Hope Forward · Texas charity · USD
// ─────────────────────────────────────────────────────────────────────────────

const HF_TODAY: TeamPlan[] = [
  {
    id: 'hf-today-austin',
    teamName: 'Austin team',
    priorityTone: 'high',
    locationLabel: 'Austin East + Austin South (NEW)',
    hoursLabel: '09:00–17:00',
    betweenZonesLabel: '12min between zones',
    forecastConv: 28,
    forecastGmvCents: 840000,
    currency: 'USD',
    repInitials: ['JM', 'JD', 'AR', 'TM'],
    aiSuggestion:
      'AI: Push 2 reps to Austin South for charity giving lookalikes (propensity 0.83). +14pp sponsor lift.',
  },
  {
    id: 'hf-today-dallas',
    teamName: 'Dallas team',
    priorityTone: 'high',
    locationLabel: 'Dallas Metro + Plano',
    hoursLabel: '09:30–18:00',
    betweenZonesLabel: '18min Dallas→Plano',
    forecastConv: 22,
    forecastGmvCents: 660000,
    currency: 'USD',
    repInitials: ['AM', 'CS', 'RV', 'EB'],
    aiSuggestion:
      'AI: Plano households mirror top Highland Park sponsors. Run capital-campaign script v3.2.',
  },
  {
    id: 'hf-today-houston',
    teamName: 'Houston team',
    priorityTone: 'medium',
    locationLabel: 'Houston Central + Houston SE',
    hoursLabel: '09:00–17:00',
    betweenZonesLabel: '14min between zones',
    forecastConv: 18,
    forecastGmvCents: 540000,
    currency: 'USD',
    repInitials: ['KP', 'DR', 'ML'],
    aiSuggestion:
      'AI: NK offline today — KP/DR/ML cover. Houston SE saturation 64% — Sugar Land next week.',
  },
];

const HF_WEEK_FORECAST: WeekForecastDay[] = [
  {
    day: 'Mon',
    conv: 68,
    delta: 11,
    breakdown: [
      { label: 'Austin', value: 28 },
      { label: 'Dallas', value: 22 },
      { label: 'Houston', value: 18 },
    ],
  },
  {
    day: 'Tue',
    conv: 72,
    delta: 9,
    breakdown: [
      { label: 'Austin', value: 30 },
      { label: 'Dallas', value: 24 },
      { label: 'Houston', value: 18 },
    ],
  },
  {
    day: 'Wed',
    conv: 65,
    delta: 6,
    breakdown: [
      { label: 'Austin', value: 26 },
      { label: 'Dallas', value: 22 },
      { label: 'Houston', value: 17 },
    ],
  },
  {
    day: 'Thu',
    conv: 78,
    delta: 12,
    breakdown: [
      { label: 'Austin', value: 32 },
      { label: 'Dallas', value: 26 },
      { label: 'Houston', value: 20 },
    ],
  },
  {
    day: 'Fri',
    conv: 84,
    delta: 14,
    breakdown: [
      { label: 'Austin', value: 34 },
      { label: 'Dallas', value: 28 },
      { label: 'Houston', value: 22 },
    ],
  },
  {
    day: 'Sat',
    conv: 38,
    delta: 5,
    breakdown: [
      { label: 'Austin', value: 16 },
      { label: 'Dallas', value: 12 },
      { label: 'Houston', value: 10 },
    ],
  },
];

const HF_MONTH_RECOS: MonthRecommendation[] = [
  {
    id: 'hf-r1',
    title: 'Launch capital campaign in Plano',
    detail: 'Plano lookalike index to Highland Park = 0.91. 14k catchment doors, propensity 0.78.',
  },
  {
    id: 'hf-r2',
    title: 'Recruit 6 Knockers in Houston',
    detail: 'Houston demand outpacing supply. Funnel has 32 candidates, NK shift uncovered.',
  },
  {
    id: 'hf-r3',
    title: 'Re-engage 142 lapsed donors',
    detail: 'Smart list "Knocked-not-pledged 7d" — script v4.1 lifted conversion 9pp in May.',
  },
  {
    id: 'hf-r4',
    title: 'Sunset Austin Central',
    detail: 'Saturation 78%, pledge rate down to 6.1%. Reassign JD to Austin South.',
  },
];

export const HF_PLANNING: AccountPlanning = {
  plans: {
    today: HF_TODAY,
    week: tile(HF_TODAY, 8, 'hf-week'),
    month: tile(HF_TODAY, 22, 'hf-month'),
    quarter: tile(HF_TODAY, 68, 'hf-quarter'),
  },
  weekForecast: HF_WEEK_FORECAST,
  monthRecos: HF_MONTH_RECOS,
  iPadCount: 218,
};

// ─────────────────────────────────────────────────────────────────────────────
// World Vision · AU charity · AUD · Syd/Mel/Bne
// ─────────────────────────────────────────────────────────────────────────────

const WV_TODAY: TeamPlan[] = [
  {
    id: 'wv-today-syd',
    teamName: 'Sydney team',
    priorityTone: 'high',
    locationLabel: 'Sydney CBD + Sydney East',
    hoursLabel: '10:00–18:00',
    betweenZonesLabel: '22min between zones',
    forecastConv: 30,
    forecastGmvCents: 1500000,
    currency: 'AUD',
    repInitials: ['AC', 'LO', 'ZH', 'JW'],
    aiSuggestion:
      'AI: Sponsor uplift script v4.1 + push AC into Parramatta tomorrow (SEIFA decile 9, propensity 0.79).',
  },
  {
    id: 'wv-today-mel',
    teamName: 'Melbourne team',
    priorityTone: 'high',
    locationLabel: 'Melbourne CBD + Brunswick',
    hoursLabel: '09:30–17:30',
    betweenZonesLabel: '16min CBD→Brunswick',
    forecastConv: 34,
    forecastGmvCents: 1700000,
    currency: 'AUD',
    repInitials: ['IN', 'HK', 'GO', 'NR'],
    aiSuggestion:
      'AI: Brunswick supporter density top quintile · 17pp uplift in May. Move IN/HK there post-lunch.',
  },
  {
    id: 'wv-today-bne',
    teamName: 'Brisbane team',
    priorityTone: 'medium',
    locationLabel: 'Brisbane CBD + Brisbane North',
    hoursLabel: '08:30–17:00',
    betweenZonesLabel: '11min between zones',
    forecastConv: 26,
    forecastGmvCents: 1300000,
    currency: 'AUD',
    repInitials: ['EM', 'AS', 'MT'],
    aiSuggestion:
      'AI: BC offline · EM/AS/MT cover. Chermside lookalike ready for next week (catchment 11k doors).',
  },
];

const WV_WEEK_FORECAST: WeekForecastDay[] = [
  {
    day: 'Mon',
    conv: 90,
    delta: 14,
    breakdown: [
      { label: 'Sydney', value: 30 },
      { label: 'Melbourne', value: 34 },
      { label: 'Brisbane', value: 26 },
    ],
  },
  {
    day: 'Tue',
    conv: 94,
    delta: 12,
    breakdown: [
      { label: 'Sydney', value: 32 },
      { label: 'Melbourne', value: 36 },
      { label: 'Brisbane', value: 26 },
    ],
  },
  {
    day: 'Wed',
    conv: 88,
    delta: 9,
    breakdown: [
      { label: 'Sydney', value: 28 },
      { label: 'Melbourne', value: 34 },
      { label: 'Brisbane', value: 26 },
    ],
  },
  {
    day: 'Thu',
    conv: 96,
    delta: 15,
    breakdown: [
      { label: 'Sydney', value: 32 },
      { label: 'Melbourne', value: 36 },
      { label: 'Brisbane', value: 28 },
    ],
  },
  {
    day: 'Fri',
    conv: 88,
    delta: 13,
    breakdown: [
      { label: 'Sydney', value: 30 },
      { label: 'Melbourne', value: 32 },
      { label: 'Brisbane', value: 26 },
    ],
  },
  {
    day: 'Sat',
    conv: 44,
    delta: 6,
    breakdown: [
      { label: 'Sydney', value: 16 },
      { label: 'Melbourne', value: 16 },
      { label: 'Brisbane', value: 12 },
    ],
  },
];

const WV_MONTH_RECOS: MonthRecommendation[] = [
  {
    id: 'wv-r1',
    title: 'Open Chermside zone (Brisbane)',
    detail: 'CoreLogic AU growth corridor · 11k catchment doors · propensity 0.76. Send 2 reps.',
  },
  {
    id: 'wv-r2',
    title: 'Run sponsor-conversion script v5',
    detail: 'A/B test Brunswick + Parramatta. Forecasted +18pp child sponsorship lift.',
  },
  {
    id: 'wv-r3',
    title: 'Recruit 8 Knockers in Sydney',
    detail: 'Parramatta + Inner West expansion needs supply. 24 candidates in funnel.',
  },
  {
    id: 'wv-r4',
    title: 'Sunset Melbourne West',
    detail: 'Saturation 81%, sponsor rate dropped 9pp. Reassign NR to Brunswick.',
  },
];

export const WV_PLANNING: AccountPlanning = {
  plans: {
    today: WV_TODAY,
    week: tile(WV_TODAY, 7, 'wv-week'),
    month: tile(WV_TODAY, 20, 'wv-month'),
    quarter: tile(WV_TODAY, 60, 'wv-quarter'),
  },
  weekForecast: WV_WEEK_FORECAST,
  monthRecos: WV_MONTH_RECOS,
  iPadCount: 162,
};

// ─────────────────────────────────────────────────────────────────────────────
// PestMax · US commercial pest · USD · Dallas/Phoenix/Houston
// ─────────────────────────────────────────────────────────────────────────────

const PM_TODAY: TeamPlan[] = [
  {
    id: 'pm-today-dallas',
    teamName: 'Dallas team',
    priorityTone: 'high',
    locationLabel: 'Dallas Metro + Dallas South',
    hoursLabel: '08:00–17:00',
    betweenZonesLabel: '14min between zones',
    forecastConv: 16,
    forecastGmvCents: 1840000,
    currency: 'USD',
    repInitials: ['BC', 'HK', 'RG', 'SK'],
    aiSuggestion:
      'AI: Re-treat warranty renewals in Garland this week (38 contracts up for renewal · 91% retention prior period).',
  },
  {
    id: 'pm-today-phx',
    teamName: 'Phoenix team',
    priorityTone: 'high',
    locationLabel: 'Phoenix Metro + Scottsdale (NEW)',
    hoursLabel: '07:30–16:30',
    betweenZonesLabel: '20min Metro→Scottsdale',
    forecastConv: 12,
    forecastGmvCents: 1620000,
    currency: 'USD',
    repInitials: ['TN', 'JL'],
    aiSuggestion:
      'AI: Scottsdale premium tier (avg ticket $145) · low cannibalisation w/ Phoenix West. Run termite scope upsell.',
  },
  {
    id: 'pm-today-htx',
    teamName: 'Houston team',
    priorityTone: 'medium',
    locationLabel: 'Houston SE',
    hoursLabel: '08:00–17:00',
    betweenZonesLabel: 'In-zone only',
    forecastConv: 9,
    forecastGmvCents: 990000,
    currency: 'USD',
    repInitials: ['AT'],
    aiSuggestion:
      'AI: DG offline today · AT solo. Watch Aiden — no completed calls in 2hr alarm. Check via call.',
  },
];

const PM_WEEK_FORECAST: WeekForecastDay[] = [
  {
    day: 'Mon',
    conv: 37,
    delta: 6,
    breakdown: [
      { label: 'Dallas', value: 16 },
      { label: 'Phoenix', value: 12 },
      { label: 'Houston', value: 9 },
    ],
  },
  {
    day: 'Tue',
    conv: 41,
    delta: 8,
    breakdown: [
      { label: 'Dallas', value: 18 },
      { label: 'Phoenix', value: 14 },
      { label: 'Houston', value: 9 },
    ],
  },
  {
    day: 'Wed',
    conv: 39,
    delta: 5,
    breakdown: [
      { label: 'Dallas', value: 17 },
      { label: 'Phoenix', value: 13 },
      { label: 'Houston', value: 9 },
    ],
  },
  {
    day: 'Thu',
    conv: 44,
    delta: 9,
    breakdown: [
      { label: 'Dallas', value: 19 },
      { label: 'Phoenix', value: 14 },
      { label: 'Houston', value: 11 },
    ],
  },
  {
    day: 'Fri',
    conv: 48,
    delta: 11,
    breakdown: [
      { label: 'Dallas', value: 20 },
      { label: 'Phoenix', value: 16 },
      { label: 'Houston', value: 12 },
    ],
  },
  {
    day: 'Sat',
    conv: 18,
    delta: 2,
    breakdown: [
      { label: 'Dallas', value: 8 },
      { label: 'Phoenix', value: 6 },
      { label: 'Houston', value: 4 },
    ],
  },
];

const PM_MONTH_RECOS: MonthRecommendation[] = [
  {
    id: 'pm-r1',
    title: 'Launch Scottsdale zone (Phoenix)',
    detail: 'Premium service tier · propensity 0.74 · HOA-permitted · $145 avg ticket.',
  },
  {
    id: 'pm-r2',
    title: 'Warranty renewal blitz',
    detail: '38 contracts expiring in Garland · 27 in Plano. 91% historical retention.',
  },
  {
    id: 'pm-r3',
    title: 'Cypress new-build campaign',
    detail: 'Cypress · 77433 — new-build subdivision, termite scope opportunity. 6k doors.',
  },
  {
    id: 'pm-r4',
    title: 'Hire 2 installers in Dallas',
    detail: 'Installer no-show on 3 pending appts this week. Backlog risk if not resolved.',
  },
];

export const PM_PLANNING: AccountPlanning = {
  plans: {
    today: PM_TODAY,
    week: tile(PM_TODAY, 6, 'pm-week'),
    month: tile(PM_TODAY, 16, 'pm-month'),
    quarter: tile(PM_TODAY, 48, 'pm-quarter'),
  },
  weekForecast: PM_WEEK_FORECAST,
  monthRecos: PM_MONTH_RECOS,
  iPadCount: 32,
};

// ─────────────────────────────────────────────────────────────────────────────
// Gold Coast Hospital · AU healthcare · AUD · Gold Coast suburbs
// ─────────────────────────────────────────────────────────────────────────────

const GC_TODAY: TeamPlan[] = [
  {
    id: 'gc-today-surfers',
    teamName: 'Surfers Paradise team',
    priorityTone: 'high',
    locationLabel: 'Surfers Paradise + Broadbeach',
    hoursLabel: '09:00–17:00',
    betweenZonesLabel: '8min between zones',
    forecastConv: 12,
    forecastGmvCents: 360000,
    currency: 'AUD',
    repInitials: ['CO', 'JK', 'EH', 'OP'],
    aiSuggestion:
      'AI: Capital campaign uplift script · CO offline (auto-SMS sent). Reassign JK to cover Surfers East.',
  },
  {
    id: 'gc-today-burleigh',
    teamName: 'Burleigh + Robina team',
    priorityTone: 'high',
    locationLabel: 'Burleigh Heads + Robina + Mermaid Waters (NEW)',
    hoursLabel: '09:00–17:00',
    betweenZonesLabel: '15min Burleigh→Mermaid',
    forecastConv: 14,
    forecastGmvCents: 420000,
    currency: 'AUD',
    repInitials: ['MC', 'SR', 'LD'],
    aiSuggestion:
      'AI: Mermaid Waters SEIFA decile 9 · capital campaign lookalike (4.6k doors, retiree-skew). +12pp pledge lift.',
  },
  {
    id: 'gc-today-southport',
    teamName: 'Southport team',
    priorityTone: 'medium',
    locationLabel: 'Southport',
    hoursLabel: '—',
    betweenZonesLabel: 'PA not clocked in',
    forecastConv: 0,
    forecastGmvCents: 0,
    currency: 'AUD',
    repInitials: ['PA'],
    aiSuggestion:
      'AI: Southport route uncovered. Reassign to Surfers team OR escalate to ops manager for backup.',
  },
];

const GC_WEEK_FORECAST: WeekForecastDay[] = [
  {
    day: 'Mon',
    conv: 26,
    delta: 4,
    breakdown: [
      { label: 'Surfers', value: 12 },
      { label: 'Burleigh', value: 14 },
    ],
  },
  {
    day: 'Tue',
    conv: 30,
    delta: 6,
    breakdown: [
      { label: 'Surfers', value: 14 },
      { label: 'Burleigh', value: 16 },
    ],
  },
  {
    day: 'Wed',
    conv: 28,
    delta: 3,
    breakdown: [
      { label: 'Surfers', value: 12 },
      { label: 'Burleigh', value: 16 },
    ],
  },
  {
    day: 'Thu',
    conv: 32,
    delta: 7,
    breakdown: [
      { label: 'Surfers', value: 14 },
      { label: 'Burleigh', value: 18 },
    ],
  },
  {
    day: 'Fri',
    conv: 34,
    delta: 8,
    breakdown: [
      { label: 'Surfers', value: 14 },
      { label: 'Burleigh', value: 20 },
    ],
  },
  {
    day: 'Sat',
    conv: 14,
    delta: 2,
    breakdown: [
      { label: 'Surfers', value: 6 },
      { label: 'Burleigh', value: 8 },
    ],
  },
];

const GC_MONTH_RECOS: MonthRecommendation[] = [
  {
    id: 'gc-r1',
    title: 'Open Mermaid Waters zone',
    detail: 'SEIFA decile 9 · capital campaign lookalike · 4.6k doors retiree-skew. Send 2 reps.',
  },
  {
    id: 'gc-r2',
    title: 'Cross-border Tweed Heads pilot',
    detail: 'NSW catchment overlaps hospital service area · older demographic · low saturation 1%.',
  },
  {
    id: 'gc-r3',
    title: 'Re-script Robina for GP referral overlap',
    detail: 'Lachlan D pledge rate dropped 7pp. Run "GP-referral" script v2, +6pp lift in pilot.',
  },
  {
    id: 'gc-r4',
    title: 'Recruit 2 Knockers in Surfers',
    detail: 'Charlotte O offline this week · PA not clocked. Funnel has 7 candidates.',
  },
];

export const GC_PLANNING: AccountPlanning = {
  plans: {
    today: GC_TODAY,
    week: tile(GC_TODAY, 6, 'gc-week'),
    month: tile(GC_TODAY, 16, 'gc-month'),
    quarter: tile(GC_TODAY, 42, 'gc-quarter'),
  },
  weekForecast: GC_WEEK_FORECAST,
  monthRecos: GC_MONTH_RECOS,
  iPadCount: 8,
};

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

export const ACCOUNT_PLANNING: Record<string, AccountPlanning> = {
  'hope-forward': HF_PLANNING,
  'world-vision': WV_PLANNING,
  pestmax: PM_PLANNING,
  'gold-coast-hospital': GC_PLANNING,
};

export function getAccountPlanning(slug: string): AccountPlanning {
  return ACCOUNT_PLANNING[slug] ?? HF_PLANNING;
}
