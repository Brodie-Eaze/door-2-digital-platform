import { MapPin } from 'lucide-react';
import { Banner, Section, StatusPill } from '@d2d/ui-web';
import { OrgShell } from '@/components/OrgShell';
import { apiFetch, type PageResponse, type TerritoryPublic } from '@/lib/api';

function shortId(id: string): string {
  return id.slice(-6).toUpperCase();
}

function statusTone(status: string): 'success' | 'warn' | 'muted' {
  if (status === 'active') return 'success';
  if (status === 'paused' || status === 'draft') return 'warn';
  return 'muted';
}

function formatCentroid(territory: TerritoryPublic): string {
  if (!territory.centroid) return '—';
  return `${territory.centroid.lat.toFixed(4)}, ${territory.centroid.lng.toFixed(4)}`;
}

function mapPosition(index: number): { left: string; top: string } {
  const positions = [
    { left: '12%', top: '22%' },
    { left: '32%', top: '16%' },
    { left: '54%', top: '31%' },
    { left: '22%', top: '58%' },
    { left: '72%', top: '21%' },
    { left: '75%', top: '60%' },
    { left: '45%', top: '64%' },
    { left: '8%', top: '66%' },
  ];
  return positions[index % positions.length] ?? { left: '50%', top: '50%' };
}

export default async function TerritoriesPage(): Promise<JSX.Element> {
  const territoryPage = await apiFetch<PageResponse<TerritoryPublic>>('/territories');
  const territories = territoryPage.data;
  const active = territories.filter((territory) => territory.status === 'active').length;
  const nonActive = territories.length - active;

  return (
    <OrgShell pageTitle="Territories">
      <div className="space-y-6 max-w-[1400px]">
        {nonActive > 0 && (
          <Banner tone="warn">
            <span className="text-[13px]">
              {nonActive} territory{nonActive === 1 ? ' is' : 'ies are'} not active.
            </span>
          </Banner>
        )}

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
            {territories.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-[12px] text-muted">
                No territories yet — create them in the operator console.
              </div>
            ) : (
              territories.slice(0, 8).map((territory, index) => {
                const position = mapPosition(index);
                return (
                  <div
                    key={territory.id}
                    style={{
                      position: 'absolute',
                      left: position.left,
                      top: position.top,
                      width: 132,
                      minHeight: 74,
                      background:
                        territory.status === 'active'
                          ? 'rgba(59,130,246,0.18)'
                          : 'rgba(15,23,42,0.12)',
                      border: `1.5px solid ${territory.status === 'active' ? '#1D4ED8' : '#0F172A'}`,
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 600,
                      color: territory.status === 'active' ? '#1D4ED8' : '#0F172A',
                      textAlign: 'center',
                      padding: 6,
                    }}
                  >
                    {territory.name}
                  </div>
                );
              })
            )}
            <div
              style={{ position: 'absolute', bottom: 12, left: 12 }}
              className="text-[10px] text-soft bg-surface/90 px-2 py-1 rounded border border-line2"
            >
              Live territory list · polygons from API
            </div>
          </div>
        </div>

        <Section
          title="All territories"
          subtitle={`${active} active · ${nonActive} not active`}
          paddedBody={false}
        >
          {territories.length === 0 ? (
            <div className="text-[12px] text-muted p-5">
              No territories yet — create them in the operator console.
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Territory</th>
                  <th>Vertical</th>
                  <th>Campaign</th>
                  <th>Centroid</th>
                  <th>S2 cells</th>
                  <th>Created</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {territories.map((territory) => (
                  <tr key={territory.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-soft shrink-0" />
                        <span className="text-[13px] text-ink">{territory.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="tag">{territory.vertical}</span>
                    </td>
                    <td>
                      {territory.campaignId ? (
                        <span className="mono !w-auto px-2 !h-5 !text-[10px]">
                          {shortId(territory.campaignId)}
                        </span>
                      ) : (
                        <span className="text-soft">—</span>
                      )}
                    </td>
                    <td className="numeric text-[12px] text-muted">{formatCentroid(territory)}</td>
                    <td className="numeric text-[13px]">{territory.s2CellIds.length}</td>
                    <td className="numeric text-[12px] text-muted">
                      {new Date(territory.createdAt).toISOString().slice(0, 10)}
                    </td>
                    <td>
                      <StatusPill tone={statusTone(territory.status)}>
                        {territory.status}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {territoryPage.nextCursor && (
          <div className="text-[11px] text-muted">
            More territories are available after this first page.
          </div>
        )}
      </div>
    </OrgShell>
  );
}
