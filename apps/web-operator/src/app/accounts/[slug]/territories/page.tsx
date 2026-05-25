import { Sparkles, MapPin, Eye, Plus, Filter, Send } from 'lucide-react';
import { Banner, Button, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { AccountLiveMap } from '@/components/AccountLiveMap';
import { getAccount, type Account } from '@/lib/accounts';

type ZoneStatus = 'AI suggested' | 'Active' | 'Low-yield' | 'Blocked';

interface Zone {
  name: string;
  propensity: number;
  medianIncome: string;
  density: 'High' | 'Medium' | 'Low';
  saturation: number;
  estLift: string;
  knockable: number;
  status: ZoneStatus;
  tone: 'success' | 'info' | 'muted' | 'danger';
  knockers: number;
}

function buildZones(account: Account): Zone[] {
  if (account.region === 'AU') {
    // 12 AU zones for World Vision (Enterprise), trim for others
    const all: Zone[] = [
      {
        name: 'Melbourne North · 3056',
        propensity: 0.82,
        medianIncome: '$108k',
        density: 'High',
        saturation: 18,
        estLift: '+15pp',
        knockable: 4820,
        status: 'Active',
        tone: 'info',
        knockers: 22,
      },
      {
        name: 'Sydney West · 2150',
        propensity: 0.79,
        medianIncome: '$94k',
        density: 'High',
        saturation: 24,
        estLift: '+13pp',
        knockable: 5680,
        status: 'Active',
        tone: 'info',
        knockers: 28,
      },
      {
        name: 'Brisbane Central · 4000',
        propensity: 0.77,
        medianIncome: '$98k',
        density: 'High',
        saturation: 12,
        estLift: '+12pp',
        knockable: 3940,
        status: 'Active',
        tone: 'info',
        knockers: 18,
      },
      {
        name: 'Perth East · 6004',
        propensity: 0.74,
        medianIncome: '$112k',
        density: 'Medium',
        saturation: 8,
        estLift: '+11pp',
        knockable: 2810,
        status: 'Active',
        tone: 'info',
        knockers: 14,
      },
      {
        name: 'Adelaide South · 5008',
        propensity: 0.71,
        medianIncome: '$86k',
        density: 'Medium',
        saturation: 6,
        estLift: '+10pp',
        knockable: 2240,
        status: 'Active',
        tone: 'info',
        knockers: 12,
      },
      {
        name: 'Gold Coast · 4217',
        propensity: 0.68,
        medianIncome: '$92k',
        density: 'Medium',
        saturation: 0,
        estLift: '+9pp',
        knockable: 2980,
        status: 'AI suggested',
        tone: 'success',
        knockers: 0,
      },
      {
        name: 'Hobart North · 7008',
        propensity: 0.66,
        medianIncome: '$78k',
        density: 'Medium',
        saturation: 4,
        estLift: '+8pp',
        knockable: 1620,
        status: 'Active',
        tone: 'info',
        knockers: 8,
      },
      {
        name: 'Canberra · 2601',
        propensity: 0.64,
        medianIncome: '$124k',
        density: 'Medium',
        saturation: 0,
        estLift: '+8pp',
        knockable: 2140,
        status: 'AI suggested',
        tone: 'success',
        knockers: 0,
      },
      {
        name: 'Newcastle · 2300',
        propensity: 0.61,
        medianIncome: '$84k',
        density: 'High',
        saturation: 30,
        estLift: '—',
        knockable: 3220,
        status: 'Active',
        tone: 'info',
        knockers: 16,
      },
      {
        name: 'Geelong · 3220',
        propensity: 0.58,
        medianIncome: '$82k',
        density: 'Medium',
        saturation: 22,
        estLift: '—',
        knockable: 2680,
        status: 'Active',
        tone: 'info',
        knockers: 10,
      },
      {
        name: 'Wollongong · 2500',
        propensity: 0.55,
        medianIncome: '$78k',
        density: 'Medium',
        saturation: 18,
        estLift: '—',
        knockable: 2410,
        status: 'Active',
        tone: 'info',
        knockers: 8,
      },
      {
        name: 'Darwin · 0800',
        propensity: 0.48,
        medianIncome: '$92k',
        density: 'Low',
        saturation: 0,
        estLift: '—',
        knockable: 980,
        status: 'Low-yield',
        tone: 'muted',
        knockers: 0,
      },
    ];
    return all.slice(0, account.territoriesActive);
  }

  if (account.vertical === 'commercial' || account.slug === 'pestmax') {
    // PestMax — 4 commercial pest zones
    const all: Zone[] = [
      {
        name: 'Dallas Metro · 75201',
        propensity: 0.72,
        medianIncome: '$71k',
        density: 'High',
        saturation: 42,
        estLift: '+6pp',
        knockable: 4380,
        status: 'Active',
        tone: 'info',
        knockers: 12,
      },
      {
        name: 'Houston SE · 77033',
        propensity: 0.68,
        medianIncome: '$58k',
        density: 'High',
        saturation: 38,
        estLift: '+5pp',
        knockable: 3920,
        status: 'Active',
        tone: 'info',
        knockers: 10,
      },
      {
        name: 'Phoenix West · 85037',
        propensity: 0.64,
        medianIncome: '$62k',
        density: 'Medium',
        saturation: 14,
        estLift: '+8pp',
        knockable: 2480,
        status: 'Active',
        tone: 'info',
        knockers: 6,
      },
      {
        name: 'Austin South · 78745',
        propensity: 0.61,
        medianIncome: '$78k',
        density: 'Medium',
        saturation: 22,
        estLift: '—',
        knockable: 2140,
        status: 'Active',
        tone: 'info',
        knockers: 4,
      },
    ];
    return all.slice(0, account.territoriesActive);
  }

  if (account.slug === 'gold-coast-hospital') {
    // 3 QLD zones
    return [
      {
        name: 'Surfers Paradise · 4217',
        propensity: 0.78,
        medianIncome: '$96k',
        density: 'High',
        saturation: 8,
        estLift: '+12pp',
        knockable: 2840,
        status: 'Active',
        tone: 'info',
        knockers: 3,
      },
      {
        name: 'Robina · 4226',
        propensity: 0.74,
        medianIncome: '$108k',
        density: 'Medium',
        saturation: 4,
        estLift: '+10pp',
        knockable: 2120,
        status: 'Active',
        tone: 'info',
        knockers: 3,
      },
      {
        name: 'Broadbeach · 4218',
        propensity: 0.71,
        medianIncome: '$92k',
        density: 'High',
        saturation: 6,
        estLift: '+9pp',
        knockable: 1980,
        status: 'Active',
        tone: 'info',
        knockers: 2,
      },
    ];
  }

  // Default US charity (Hope Forward) — 7 US zones
  const all: Zone[] = [
    {
      name: 'Austin South · 78704',
      propensity: 0.85,
      medianIncome: '$94k',
      density: 'High',
      saturation: 24,
      estLift: '+16pp',
      knockable: 4280,
      status: 'Active',
      tone: 'info',
      knockers: 36,
    },
    {
      name: 'Dallas Metro · 75201',
      propensity: 0.81,
      medianIncome: '$71k',
      density: 'High',
      saturation: 38,
      estLift: '+13pp',
      knockable: 5140,
      status: 'Active',
      tone: 'info',
      knockers: 42,
    },
    {
      name: 'Houston SE · 77033',
      propensity: 0.78,
      medianIncome: '$58k',
      density: 'High',
      saturation: 42,
      estLift: '+11pp',
      knockable: 4120,
      status: 'Active',
      tone: 'info',
      knockers: 34,
    },
    {
      name: 'Plano · 75024',
      propensity: 0.76,
      medianIncome: '$118k',
      density: 'Medium',
      saturation: 0,
      estLift: '+10pp',
      knockable: 3140,
      status: 'AI suggested',
      tone: 'success',
      knockers: 0,
    },
    {
      name: 'Atlanta North · 30327',
      propensity: 0.74,
      medianIncome: '$102k',
      density: 'Medium',
      saturation: 18,
      estLift: '+9pp',
      knockable: 3580,
      status: 'Active',
      tone: 'info',
      knockers: 22,
    },
    {
      name: 'Phoenix West · 85037',
      propensity: 0.69,
      medianIncome: '$62k',
      density: 'Medium',
      saturation: 28,
      estLift: '—',
      knockable: 2980,
      status: 'Active',
      tone: 'info',
      knockers: 18,
    },
    {
      name: 'LA West · 90049',
      propensity: 0.72,
      medianIncome: '$142k',
      density: 'Medium',
      saturation: 0,
      estLift: '+12pp',
      knockable: 3520,
      status: 'Blocked',
      tone: 'danger',
      knockers: 0,
    },
  ];
  return all.slice(0, account.territoriesActive);
}

function regionLabel(region: 'AU' | 'US' | 'SG'): string {
  if (region === 'AU') return 'Australia';
  if (region === 'US') return 'United States';
  return 'Singapore';
}

function heatmapCities(region: 'AU' | 'US' | 'SG'): { x: number; y: number; label: string }[] {
  if (region === 'AU') {
    return [
      { x: 78, y: 38, label: 'Sydney' },
      { x: 60, y: 70, label: 'Melbourne' },
      { x: 86, y: 22, label: 'Brisbane' },
      { x: 18, y: 48, label: 'Perth' },
      { x: 52, y: 62, label: 'Adelaide' },
    ];
  }
  if (region === 'SG') {
    return [{ x: 50, y: 50, label: 'Singapore' }];
  }
  return [
    { x: 18, y: 70, label: 'Austin' },
    { x: 40, y: 25, label: 'Dallas' },
    { x: 68, y: 78, label: 'Houston' },
    { x: 80, y: 30, label: 'Atlanta' },
    { x: 12, y: 35, label: 'Fort Worth' },
  ];
}

export default function AccountTerritoriesPage({
  params,
}: {
  params: { slug: string };
}): JSX.Element {
  const account = getAccount(params.slug);
  if (!account) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Territories">
        <Banner tone="danger">Account not found.</Banner>
      </AccountShell>
    );
  }

  const zones = buildZones(account);
  const knockersDeployed = zones.reduce((s, z) => s + z.knockers, 0);
  const avgPropensity =
    zones.length > 0 ? zones.reduce((s, z) => s + z.propensity, 0) / zones.length : 0;
  const aiSuggested = zones.filter((z) => z.status === 'AI suggested').length;
  const totalKnockable = zones.reduce((s, z) => s + z.knockable, 0);
  const cities = heatmapCities(account.region);

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Territories">
      <div className="space-y-5 max-w-[1700px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Sparkles size={13} className="text-accent" />
            <span>
              Propensity scores for <span className="font-semibold">{account.shortName}</span> blend
              external data (
              {account.region === 'AU'
                ? 'ABS SEIFA, CoreLogic AU'
                : account.region === 'SG'
                  ? 'SingStat planning area'
                  : 'ACS census income, ESRI Tapestry'}
              ) with your last {account.conversionsMTD.toLocaleString()} conversions to rank zones.
            </span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard
            label="Territories assigned"
            value={account.territoriesActive}
            hint={`${zones.length} zones tracked`}
          />
          <KpiCard
            label="Knockers deployed"
            value={knockersDeployed}
            hint={`of ${account.knockers} total`}
          />
          <KpiCard
            label="Avg propensity"
            value={avgPropensity.toFixed(2)}
            delta="+0.04"
            deltaTone="positive"
            hint="vs LM"
          />
          <KpiCard
            label="Est. lift available"
            value={`${aiSuggested * 11}pp`}
            hint={aiSuggested > 0 ? `${aiSuggested} new zones` : 'all assigned'}
          />
          <KpiCard
            label="Knockable doors"
            value={totalKnockable.toLocaleString()}
            hint={`across ${account.region}`}
          />
        </div>

        <Section
          title={`Live territory map · ${account.shortName}`}
          subtitle="Real reps on real ground · AI zones flagged with blue halos · toggle Satellite ↔ Streets top-right"
        >
          <AccountLiveMap accountSlug={params.slug} />
        </Section>

        <Section
          title={`Propensity heatmap · ${regionLabel(account.region)}`}
          subtitle="Census tract level · click any cell to drill in"
        >
          <div className="bg-ink rounded-xl overflow-hidden relative" style={{ height: 360 }}>
            <div
              className="absolute inset-0 grid"
              style={{
                gridTemplateColumns: 'repeat(20, 1fr)',
                gridTemplateRows: 'repeat(12, 1fr)',
                gap: 1,
              }}
            >
              {Array.from({ length: 240 }).map((_, i) => {
                // Use slug as seed so each account gets a different heatmap pattern
                const seed = (account.slug.charCodeAt(0) || 1) * 0.13;
                const r = Math.sin(i * 0.7 + seed) * Math.cos(i * 0.3 + seed * 1.7);
                const intensity = (r + 1) / 2;
                let bg = 'transparent';
                if (intensity > 0.75) bg = 'rgba(34,197,94,0.65)';
                else if (intensity > 0.55) bg = 'rgba(59,130,246,0.55)';
                else if (intensity > 0.35) bg = 'rgba(245,158,11,0.45)';
                else if (intensity > 0.15) bg = 'rgba(239,68,68,0.35)';
                return (
                  <div
                    key={i}
                    style={{ background: bg }}
                    className="hover:ring-2 hover:ring-white/40 cursor-pointer transition"
                  />
                );
              })}
            </div>
            {cities.map((c) => (
              <div
                key={c.label}
                className="absolute text-surface text-[11px] font-semibold drop-shadow-md pointer-events-none"
                style={{ left: `${c.x}%`, top: `${c.y}%`, transform: 'translate(-50%, -50%)' }}
              >
                {c.label}
              </div>
            ))}
            <div className="absolute bottom-3 left-3 bg-surface/95 backdrop-blur rounded-lg px-3 py-2 border border-line2 shadow-sm">
              <div className="text-[10px] uppercase tracking-wider text-muted mb-1.5 font-semibold">
                Propensity
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-rose-500/50" /> 0–0.2
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-amber-500/60" /> 0.2–0.5
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-accent/60" /> 0.5–0.75
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-green-500/70" /> 0.75+
                </span>
              </div>
            </div>
            <div className="absolute top-3 right-3 bg-surface/95 backdrop-blur rounded-lg px-3 py-2 border border-line2 shadow-sm">
              <div className="text-[10px] uppercase tracking-wider text-muted">Account</div>
              <div className="text-[11px] font-semibold text-ink">{account.shortName}</div>
            </div>
          </div>
        </Section>

        <Section
          title={`${account.shortName} zones · ranked by AI propensity`}
          subtitle="Click 'Send Knockers' to deploy a team to AI-suggested zones"
          paddedBody={false}
          action={
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" leftIcon={<Filter size={13} />}>
                Filter
              </Button>
              <Button variant="primary" size="sm" leftIcon={<Plus size={13} />}>
                New zone
              </Button>
            </div>
          }
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Zone</th>
                <th>Propensity</th>
                <th>Est. lift</th>
                <th>Median income</th>
                <th>Density</th>
                <th>Saturation</th>
                <th>Knockers</th>
                <th>Knockable</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.name}>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <MapPin size={11} className="text-soft shrink-0" />
                      <span className="text-[13px] font-medium text-ink">{z.name}</span>
                    </div>
                  </td>
                  <td>
                    <PropensityBar score={z.propensity} />
                  </td>
                  <td
                    className={`text-[12px] font-medium ${z.estLift !== '—' ? 'text-success' : 'text-soft'}`}
                  >
                    {z.estLift}
                  </td>
                  <td className="text-[12px] text-ink numeric">{z.medianIncome}</td>
                  <td className="text-[12px] text-muted">{z.density}</td>
                  <td className="text-[12px] text-muted numeric">{z.saturation}%</td>
                  <td className="text-[12px] text-ink numeric">{z.knockers}</td>
                  <td className="text-[12px] text-ink numeric">{z.knockable.toLocaleString()}</td>
                  <td>
                    <StatusPill tone={z.tone}>{z.status}</StatusPill>
                  </td>
                  <td>
                    {z.status === 'AI suggested' ? (
                      <button className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline">
                        <Send size={11} /> Send Knockers
                      </button>
                    ) : z.status === 'Blocked' ? (
                      <span className="text-[10px] text-rose-600">CA reg pending</span>
                    ) : (
                      <button className="w-7 h-7 rounded hover:bg-paper flex items-center justify-center">
                        <Eye size={12} className="text-soft" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section
          title="External data feeding propensity model"
          subtitle={`Region-specific sources for ${account.region} · attribution preserved`}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(account.region === 'AU'
              ? [
                  {
                    name: 'ABS SEIFA',
                    detail: 'AU socio-economic indexes by SA1',
                    status: 'connected',
                  },
                  {
                    name: 'CoreLogic AU',
                    detail: 'AU property values + rents',
                    status: 'connected',
                  },
                  {
                    name: 'ACNC donor data',
                    detail: 'Charity giving propensity',
                    status: 'connected',
                  },
                  { name: 'Mapbox AU', detail: 'Postal + LGA polygons', status: 'connected' },
                  {
                    name: `${account.shortName} cohorts`,
                    detail: `Your last ${account.conversionsMTD.toLocaleString()} conversions`,
                    status: 'connected',
                  },
                  { name: 'AusPost addresses', detail: 'Door-level corpus', status: 'connected' },
                ]
              : account.region === 'SG'
                ? [
                    {
                      name: 'SingStat',
                      detail: 'SG demographics + planning area',
                      status: 'connected',
                    },
                    { name: 'OneMap', detail: 'SG addresses + polygons', status: 'connected' },
                    {
                      name: `${account.shortName} cohorts`,
                      detail: 'Your historical conversions',
                      status: 'connected',
                    },
                  ]
                : [
                    {
                      name: 'ACS / US Census',
                      detail: 'Income · age · density · housing',
                      status: 'connected',
                    },
                    {
                      name: 'ESRI Tapestry',
                      detail: '67 lifestyle segments by tract',
                      status: 'connected',
                    },
                    {
                      name: 'Mapbox Boundaries',
                      detail: 'Postal + admin polygons',
                      status: 'connected',
                    },
                    { name: 'OpenAddresses', detail: 'Door-level corpus', status: 'connected' },
                    {
                      name: `${account.shortName} cohorts`,
                      detail: `Your last ${account.conversionsMTD.toLocaleString()} conversions`,
                      status: 'connected',
                    },
                    {
                      name:
                        account.vertical === 'commercial'
                          ? 'Pest infestation index'
                          : account.vertical === 'healthcare'
                            ? 'CDC public health'
                            : 'Charity Navigator',
                      detail: 'Vertical-specific signal',
                      status: 'connected',
                    },
                  ]
            ).map((s) => (
              <div key={s.name} className="card card-pad">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-semibold text-ink truncate">{s.name}</div>
                    <div className="text-[10.5px] text-muted mt-0.5">{s.detail}</div>
                  </div>
                  <span className="tag !text-[9px]">{account.region}</span>
                </div>
                <div className="mt-2">
                  <StatusPill tone="success">{s.status}</StatusPill>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </AccountShell>
  );
}

function PropensityBar({ score }: { score: number }): JSX.Element {
  const pct = Math.round(score * 100);
  const color =
    score >= 0.75
      ? 'bg-green-500'
      : score >= 0.5
        ? 'bg-accent'
        : score >= 0.25
          ? 'bg-amber-500'
          : 'bg-rose-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-line2 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[12px] font-semibold text-ink numeric w-8">{score.toFixed(2)}</span>
    </div>
  );
}
