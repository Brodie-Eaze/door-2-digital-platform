import { Sparkles, MapPin, Eye, Plus, Filter } from 'lucide-react';
import { Banner, Button, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';

const ZONES = [
  {
    name: 'Austin South · 78704',
    propensity: 0.81,
    medianIncome: '$94k',
    density: 'High',
    saturation: 0,
    estLift: '+14pp',
    knockable: 4280,
    status: 'AI suggested',
    tone: 'success',
  },
  {
    name: 'Plano · 75024',
    propensity: 0.78,
    medianIncome: '$118k',
    density: 'Medium',
    saturation: 0,
    estLift: '+11pp',
    knockable: 3140,
    status: 'AI suggested',
    tone: 'success',
  },
  {
    name: 'Sugar Land · 77479',
    propensity: 0.74,
    medianIncome: '$112k',
    density: 'Medium',
    saturation: 8,
    estLift: '+9pp',
    knockable: 2890,
    status: 'AI suggested',
    tone: 'success',
  },
  {
    name: 'Austin East · 78702',
    propensity: 0.62,
    medianIncome: '$58k',
    density: 'High',
    saturation: 42,
    estLift: '—',
    knockable: 3240,
    status: 'Active',
    tone: 'info',
  },
  {
    name: 'Dallas Metro · 75201',
    propensity: 0.59,
    medianIncome: '$71k',
    density: 'High',
    saturation: 38,
    estLift: '—',
    knockable: 5140,
    status: 'Active',
    tone: 'info',
  },
  {
    name: 'Houston SE · 77033',
    propensity: 0.48,
    medianIncome: '$48k',
    density: 'Medium',
    saturation: 64,
    estLift: '—',
    knockable: 4120,
    status: 'Active',
    tone: 'info',
  },
  {
    name: 'Highland Park · 75205',
    propensity: 0.42,
    medianIncome: '$214k',
    density: 'Low',
    saturation: 12,
    estLift: '—',
    knockable: 1240,
    status: 'Low-yield',
    tone: 'muted',
  },
  {
    name: 'LA West · 90049',
    propensity: 0.71,
    medianIncome: '$142k',
    density: 'Medium',
    saturation: 0,
    estLift: '+12pp',
    knockable: 3520,
    status: 'Blocked (CA reg pending)',
    tone: 'danger',
  },
];

export default function TerritoryIntelPage(): JSX.Element {
  return (
    <PlatformShell pageTitle="Territory intelligence">
      <div className="space-y-5 max-w-[1700px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Sparkles size={13} className="text-accent" />
            <span>
              Propensity scores blend <span className="font-semibold">external data</span> (ACS
              census income, density, charity-giving index, ESRI Tapestry segments) with internal
              data (your historical conversion rates per profile). AI ranks zones, manager assigns
              reps.
            </span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard label="Zones tracked" value={ZONES.length} hint="across US Phase 1" />
          <KpiCard
            label="AI-suggested"
            value={ZONES.filter((z) => z.status === 'AI suggested').length}
            delta="+1 today"
            deltaTone="positive"
          />
          <KpiCard
            label="Active"
            value={ZONES.filter((z) => z.status === 'Active').length}
            hint="reps deployed"
          />
          <KpiCard
            label="Avg propensity"
            value="0.64"
            delta="+0.03"
            deltaTone="positive"
            hint="vs LM"
          />
          <KpiCard label="Knockable doors" value="27,580" hint="across US zones" />
        </div>

        {/* Heatmap mock */}
        <Section
          title="Propensity heatmap · Texas"
          subtitle="Census tract level · click any cell to drill in"
        >
          <div className="bg-ink rounded-xl overflow-hidden relative" style={{ height: 360 }}>
            {/* Faux heatmap grid */}
            <div
              className="absolute inset-0 grid"
              style={{
                gridTemplateColumns: 'repeat(20, 1fr)',
                gridTemplateRows: 'repeat(12, 1fr)',
                gap: 1,
              }}
            >
              {Array.from({ length: 240 }).map((_, i) => {
                const r = Math.sin(i * 0.7 + 1) * Math.cos(i * 0.3);
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
            {/* City labels */}
            {[
              { x: 18, y: 70, label: 'Austin' },
              { x: 40, y: 25, label: 'Dallas' },
              { x: 68, y: 78, label: 'Houston' },
              { x: 12, y: 35, label: 'Fort Worth' },
            ].map((c) => (
              <div
                key={c.label}
                className="absolute text-surface text-[11px] font-semibold drop-shadow-md pointer-events-none"
                style={{ left: `${c.x}%`, top: `${c.y}%`, transform: 'translate(-50%, -50%)' }}
              >
                {c.label}
              </div>
            ))}
            {/* Legend */}
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
          </div>
        </Section>

        {/* Zone table */}
        <Section
          title="All zones · ranked by AI propensity"
          subtitle="Hover for ACS detail · click 'Send rep' to assign"
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
                <th>Knockable</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ZONES.map((z) => (
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
                  <td className="text-[12px] text-ink numeric">{z.knockable.toLocaleString()}</td>
                  <td>
                    <StatusPill tone={z.tone as 'success' | 'info' | 'muted' | 'danger'}>
                      {z.status}
                    </StatusPill>
                  </td>
                  <td>
                    {z.status === 'AI suggested' ? (
                      <button className="text-[11px] font-semibold text-accent hover:underline">
                        Send rep →
                      </button>
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

        {/* External data sources */}
        <Section
          title="External data feeding propensity model"
          subtitle="Updated nightly · attribution preserved"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                name: 'ACS / US Census',
                detail: 'Income · age · density · housing tenure',
                region: 'US',
                status: 'connected',
              },
              {
                name: 'ESRI Tapestry',
                detail: '67 lifestyle segments by tract',
                region: 'US',
                status: 'connected',
              },
              {
                name: 'Mapbox Boundaries',
                detail: 'Postal + admin polygons',
                region: 'Global',
                status: 'connected',
              },
              {
                name: 'OpenAddresses',
                detail: 'Door-level address corpus',
                region: 'Global',
                status: 'connected',
              },
              {
                name: 'ABS SEIFA',
                detail: 'AU socio-economic indexes',
                region: 'AU',
                status: 'phase 2',
              },
              {
                name: 'CoreLogic AU',
                detail: 'AU property values + rents',
                region: 'AU',
                status: 'phase 2',
              },
              {
                name: 'SingStat',
                detail: 'SG demographics + planning area',
                region: 'SG',
                status: 'phase 3',
              },
              {
                name: 'Internal cohorts',
                detail: 'Your last 30k conversions',
                region: 'D2D',
                status: 'connected',
              },
            ].map((s) => (
              <div key={s.name} className="card card-pad">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-semibold text-ink truncate">{s.name}</div>
                    <div className="text-[10.5px] text-muted mt-0.5">{s.detail}</div>
                  </div>
                  <span className="tag !text-[9px]">{s.region}</span>
                </div>
                <div className="mt-2">
                  <StatusPill tone={s.status === 'connected' ? 'success' : 'muted'}>
                    {s.status}
                  </StatusPill>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </PlatformShell>
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
