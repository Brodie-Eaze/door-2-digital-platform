import { MapPin } from 'lucide-react';
import { Banner, Section, StatusPill } from '@d2d/ui-web';
import { OrgShell } from '@/components/OrgShell';
import { TERRITORIES } from '@/lib/fixtures';

export default function TerritoriesPage(): JSX.Element {
  return (
    <OrgShell pageTitle="Territories">
      <div className="space-y-6 max-w-[1400px]">
        <Banner tone="warn">
          <span className="text-[13px]">
            LA West territory is <span className="font-semibold">blocked</span> — paid-solicitor
            registration for CA is pending. Knockers will be reassigned once cleared.
          </span>
        </Banner>

        {/* Pseudo-map */}
        <div className="card" style={{ height: 360, position: 'relative', overflow: 'hidden' }}>
          <div
            style={{
              backgroundImage:
                'linear-gradient(135deg, #F7F8FA 25%, transparent 25%), linear-gradient(225deg, #F7F8FA 25%, transparent 25%), linear-gradient(45deg, #F7F8FA 25%, transparent 25%), linear-gradient(315deg, #F7F8FA 25%, #EEF1F5 25%)',
              backgroundPosition: '24px 0, 24px 0, 0 0, 0 0',
              backgroundSize: '48px 48px',
              backgroundColor: '#FFFFFF',
              height: '100%',
            }}
            className="relative"
          >
            {/* Territory polygon stand-ins */}
            {[
              {
                left: '18%',
                top: '30%',
                label: 'Austin East',
                w: 120,
                h: 90,
                color: 'rgba(59,130,246,0.18)',
                stroke: '#1D4ED8',
              },
              {
                left: '36%',
                top: '18%',
                label: 'Austin North',
                w: 100,
                h: 70,
                color: 'rgba(59,130,246,0.18)',
                stroke: '#1D4ED8',
              },
              {
                left: '52%',
                top: '38%',
                label: 'Dallas Metro',
                w: 140,
                h: 100,
                color: 'rgba(59,130,246,0.18)',
                stroke: '#1D4ED8',
              },
              {
                left: '24%',
                top: '60%',
                label: 'Houston SE',
                w: 130,
                h: 80,
                color: 'rgba(59,130,246,0.18)',
                stroke: '#1D4ED8',
              },
              {
                left: '72%',
                top: '25%',
                label: 'Phoenix West',
                w: 110,
                h: 80,
                color: 'rgba(59,130,246,0.18)',
                stroke: '#1D4ED8',
              },
              {
                left: '78%',
                top: '60%',
                label: 'Atlanta N',
                w: 120,
                h: 90,
                color: 'rgba(59,130,246,0.18)',
                stroke: '#1D4ED8',
              },
              {
                left: '4%',
                top: '15%',
                label: 'LA West (BLOCKED)',
                w: 140,
                h: 100,
                color: 'rgba(15,23,42,0.12)',
                stroke: '#0F172A',
                hatch: true,
              },
            ].map((p, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: p.left,
                  top: p.top,
                  width: p.w,
                  height: p.h,
                  background: p.color,
                  border: `1.5px solid ${p.stroke}`,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 600,
                  color: p.stroke,
                  textAlign: 'center',
                  padding: 4,
                  ...(p.hatch && {
                    backgroundImage:
                      'repeating-linear-gradient(45deg, rgba(15,23,42,0.18), rgba(15,23,42,0.18) 6px, transparent 6px, transparent 12px)',
                  }),
                }}
              >
                {p.label}
              </div>
            ))}
            <div
              style={{ position: 'absolute', bottom: 12, left: 12 }}
              className="text-[10px] text-soft bg-surface/90 px-2 py-1 rounded border border-line2"
            >
              Mapbox vector tile placeholder · territory polygons via GeoJSON
            </div>
          </div>
        </div>

        <Section
          title="All territories"
          subtitle={`${TERRITORIES.filter((t) => t.cleared).length} cleared · ${TERRITORIES.filter((t) => !t.cleared).length} blocked`}
          paddedBody={false}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Territory</th>
                <th>State</th>
                <th>Knockers</th>
                <th>Doors covered</th>
                <th>Coverage</th>
                <th>Conv. rate</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {TERRITORIES.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-soft shrink-0" />
                      <span className="text-[13px] text-ink">{t.name}</span>
                    </div>
                  </td>
                  <td>
                    <span className="mono !w-7 !h-5 !text-[10px]">{t.state}</span>
                  </td>
                  <td className="numeric text-[13px]">{t.knockers}</td>
                  <td className="numeric text-[13px]">
                    {t.doorsKnocked.toLocaleString()} / {t.doorsTotal.toLocaleString()}
                  </td>
                  <td>
                    <div className="bar-track w-32">
                      <div
                        className="bar-fill"
                        style={{ width: `${Math.round((t.doorsKnocked / t.doorsTotal) * 100)}%` }}
                      />
                    </div>
                  </td>
                  <td>
                    <StatusPill
                      tone={
                        t.conversionRate > 8 ? 'success' : t.conversionRate > 0 ? 'warn' : 'muted'
                      }
                    >
                      {t.conversionRate}%
                    </StatusPill>
                  </td>
                  <td>
                    {t.cleared ? (
                      <StatusPill tone="success">Cleared</StatusPill>
                    ) : (
                      <StatusPill tone="danger">Blocked</StatusPill>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
    </OrgShell>
  );
}
