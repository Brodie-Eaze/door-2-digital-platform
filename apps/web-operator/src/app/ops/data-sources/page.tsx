'use client';

import { useState } from 'react';
import { RefreshCw, ExternalLink, Plug } from 'lucide-react';
import { Button, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import type { Tone } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { toast } from '@/components/Toaster';

type Health = 'operational' | 'degraded' | 'down';

interface Source {
  id: string;
  name: string;
  category: string;
  purpose: string;
  health: Health;
  lastSync: string;
  latencyMs: number | null;
  errorRate: string;
}

const SOURCES: Source[] = [
  {
    id: 'mapbox',
    name: 'Mapbox',
    category: 'Geospatial',
    purpose: 'Territory tiles · geocoding · routing',
    health: 'operational',
    lastSync: '38s ago',
    latencyMs: 84,
    errorRate: '0.01%',
  },
  {
    id: 'acs',
    name: 'ACS Census',
    category: 'Enrichment',
    purpose: 'Household ontology · block-group demographics',
    health: 'operational',
    lastSync: '6h ago',
    latencyMs: 412,
    errorRate: '0.00%',
  },
  {
    id: 'micamp',
    name: 'MiCamp',
    category: 'Payments',
    purpose: 'US card processing · ISO residuals feed',
    health: 'operational',
    lastSync: '2m ago',
    latencyMs: 196,
    errorRate: '0.04%',
  },
  {
    id: 'twilio',
    name: 'Twilio',
    category: 'Messaging',
    purpose: 'SMS dispositions · knocker OTP · A2P 10DLC',
    health: 'degraded',
    lastSync: '4m ago',
    latencyMs: 1280,
    errorRate: '2.10%',
  },
  {
    id: 'resend',
    name: 'Resend',
    category: 'Email',
    purpose: 'Transactional email · receipts · digests',
    health: 'operational',
    lastSync: '1m ago',
    latencyMs: 142,
    errorRate: '0.12%',
  },
  {
    id: 'meta',
    name: 'Meta Ads',
    category: 'Marketing',
    purpose: 'Retargeting audiences · conversion API',
    health: 'down',
    lastSync: '3h ago',
    latencyMs: null,
    errorRate: '—',
  },
  {
    id: 'google',
    name: 'Google Ads',
    category: 'Marketing',
    purpose: 'Search/PMax spend · offline conversions',
    health: 'operational',
    lastSync: '12m ago',
    latencyMs: 308,
    errorRate: '0.30%',
  },
];

function healthTone(h: Health): Tone {
  if (h === 'operational') return 'success';
  if (h === 'degraded') return 'warn';
  return 'danger';
}

function healthLabel(h: Health): string {
  if (h === 'operational') return 'Operational';
  if (h === 'degraded') return 'Degraded';
  return 'Down';
}

export default function DataSourcesPage(): JSX.Element {
  const [refreshing, setRefreshing] = useState(false);

  const operational = SOURCES.filter((s) => s.health === 'operational').length;
  const degraded = SOURCES.filter((s) => s.health === 'degraded').length;
  const down = SOURCES.filter((s) => s.health === 'down').length;
  const latencies = SOURCES.map((s) => s.latencyMs).filter((l): l is number => l !== null);
  const p95 = latencies.length
    ? Math.round([...latencies].sort((a, b) => a - b)[Math.floor(latencies.length * 0.95) - 1] ?? 0)
    : 0;

  function refreshAll(): void {
    setRefreshing(true);
    toast.info('Refreshing connector health — live polling of each provider lands in Phase 1.3.');
    setTimeout(() => setRefreshing(false), 900);
  }

  return (
    <PlatformShell pageTitle="Ops · Data sources">
      <div className="space-y-6 max-w-[1280px]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Connectors" value={SOURCES.length} hint="configured sources" />
          <KpiCard
            label="Operational"
            value={`${operational} / ${SOURCES.length}`}
            delta={down > 0 ? `${down} down` : undefined}
            deltaTone={down > 0 ? 'negative' : 'positive'}
          />
          <KpiCard
            label="Degraded / down"
            value={degraded + down}
            hint={`${degraded} degraded · ${down} down`}
          />
          <KpiCard label="p95 latency" value={`${p95} ms`} hint="across healthy sources" />
        </div>

        <Section
          title="Connector health"
          subtitle="Per-source status, last successful sync, latency and error rate. Demo data — live polling lands in Phase 1.3."
          paddedBody={false}
          action={
            <div className="flex items-center gap-2">
              <DataSourceBadge source="fixture" />
              <Button
                leftIcon={<RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />}
                variant="ghost"
                size="sm"
                onClick={refreshAll}
                disabled={refreshing}
              >
                Refresh
              </Button>
            </div>
          }
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Source</th>
                <th>Category</th>
                <th>Purpose</th>
                <th>Status</th>
                <th>Last sync</th>
                <th>Latency</th>
                <th>Error rate</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {SOURCES.map((s) => (
                <tr key={s.id}>
                  <td className="text-[13px] text-ink font-medium">{s.name}</td>
                  <td className="text-[12px] text-muted">{s.category}</td>
                  <td className="text-[12px] text-muted max-w-[260px] truncate">{s.purpose}</td>
                  <td>
                    <StatusPill tone={healthTone(s.health)}>{healthLabel(s.health)}</StatusPill>
                  </td>
                  <td className="text-[12px] text-muted">{s.lastSync}</td>
                  <td className="numeric text-[13px] text-ink">
                    {s.latencyMs === null ? (
                      <span className="text-soft">—</span>
                    ) : (
                      `${s.latencyMs} ms`
                    )}
                  </td>
                  <td className="numeric text-[13px] text-muted">{s.errorRate}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button
                        className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline"
                        onClick={() =>
                          toast.info(
                            `Re-sync ${s.name} — requires a live provider connection; queued, not faked.`,
                          )
                        }
                      >
                        <RefreshCw size={12} /> Sync
                      </button>
                      <button
                        className="inline-flex items-center gap-1 text-[12px] text-soft hover:text-ink"
                        onClick={() =>
                          toast.info(
                            `Open ${s.name} provider console — link wiring lands in Phase 1.3.`,
                          )
                        }
                      >
                        <ExternalLink size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section
          title="Add a data source"
          subtitle="New connectors require provider credentials stored under dual-control"
        >
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-muted max-w-[640px]">
              Adding a connector provisions credentials in the secrets vault and registers webhooks.
              Credential entry is gated behind dual-control — never stored from this surface.
            </p>
            <Button
              leftIcon={<Plug size={14} />}
              variant="secondary"
              size="sm"
              onClick={() =>
                toast.info(
                  'Add connector — provider credentials require dual-control approval; never entered here.',
                )
              }
            >
              Add connector
            </Button>
          </div>
        </Section>
      </div>
    </PlatformShell>
  );
}
