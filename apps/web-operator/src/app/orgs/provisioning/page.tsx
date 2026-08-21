'use client';

import { useRouter } from 'next/navigation';
import { Plus, ArrowRight, RefreshCw } from 'lucide-react';
import { Button, KpiCard, RegionBadge, Section, StatusPill } from '@d2d/ui-web';
import type { RegionCode, Tone } from '@d2d/ui-web';
import { OperatorShell } from '@/components/OperatorShell';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { toast } from '@/components/Toaster';

// Provisioning vocabulary mirrors the onboard-account wizard's step set:
// workspace → brand kit → commission plan → field-team seats → state clearance → billing → verify.
const STEPS = [
  'Workspace',
  'Brand kit',
  'Commission plan',
  'Field-team seats',
  'State clearance',
  'Billing',
  'Verify',
] as const;

type Phase = 'queued' | 'in_progress' | 'done' | 'blocked';

interface ProvisionRow {
  id: string;
  org: string;
  slug: string | null;
  region: RegionCode;
  phase: Phase;
  stepsDone: number;
  startedAt: string;
  note: string;
}

const QUEUE: ProvisionRow[] = [
  {
    id: 'prov_hopeforward',
    org: 'Hope Forward International',
    slug: 'hope-forward',
    region: 'US',
    phase: 'done',
    stepsDone: STEPS.length,
    startedAt: '2026-04-12',
    note: 'Live · 7/7 steps',
  },
  {
    id: 'prov_pestmax',
    org: 'PestMax Services',
    slug: 'pestmax',
    region: 'US',
    phase: 'done',
    stepsDone: STEPS.length,
    startedAt: '2026-05-02',
    note: 'Live · 7/7 steps',
  },
  {
    id: 'prov_pilotcharlie',
    org: 'Pilot Charlie (Greenline Energy)',
    slug: 'pilot-charlie',
    region: 'US',
    phase: 'in_progress',
    stepsDone: 4,
    startedAt: '2026-06-10',
    note: 'State clearance filing — CA + NY in flight',
  },
  {
    id: 'prov_worldvision',
    org: 'World Vision Australia',
    slug: null,
    region: 'AU',
    phase: 'in_progress',
    stepsDone: 2,
    startedAt: '2026-06-12',
    note: 'Brand kit applied — awaiting Stripe AU billing handshake',
  },
  {
    id: 'prov_goldcoast',
    org: 'Gold Coast Hospital Foundation',
    slug: null,
    region: 'AU',
    phase: 'queued',
    stepsDone: 0,
    startedAt: '2026-06-13',
    note: 'Queued behind ACNC verification',
  },
  {
    id: 'prov_meridian',
    org: 'Meridian Roofing Co.',
    slug: null,
    region: 'US',
    phase: 'blocked',
    stepsDone: 1,
    startedAt: '2026-06-09',
    note: 'Blocked — MiCamp KYB documents outstanding',
  },
];

function phaseTone(p: Phase): Tone {
  if (p === 'done') return 'success';
  if (p === 'in_progress') return 'info';
  if (p === 'blocked') return 'danger';
  return 'muted';
}

function phaseLabel(p: Phase): string {
  if (p === 'done') return 'Provisioned';
  if (p === 'in_progress') return 'In progress';
  if (p === 'blocked') return 'Blocked';
  return 'Queued';
}

export default function ProvisioningPage(): JSX.Element {
  const router = useRouter();

  const inProgress = QUEUE.filter((r) => r.phase === 'in_progress').length;
  const queued = QUEUE.filter((r) => r.phase === 'queued').length;
  const blocked = QUEUE.filter((r) => r.phase === 'blocked').length;
  const done = QUEUE.filter((r) => r.phase === 'done').length;

  function view(row: ProvisionRow): void {
    if (row.phase === 'done' && row.slug) {
      router.push(`/accounts/${row.slug}/today`);
      return;
    }
    if (row.slug) {
      router.push(`/orgs/${row.slug}`);
      return;
    }
    toast.info(`${row.org} — workspace not yet provisioned; detail opens once the slug is minted.`);
  }

  return (
    <OperatorShell pageTitle="Orgs · Provisioning queue">
      <div className="space-y-6 max-w-[1280px]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="In progress"
            value={inProgress}
            delta={blocked > 0 ? `${blocked} blocked` : undefined}
            deltaTone={blocked > 0 ? 'negative' : 'neutral'}
          />
          <KpiCard label="Queued" value={queued} hint="awaiting prerequisites" />
          <KpiCard label="Blocked" value={blocked} hint="needs operator action" />
          <KpiCard label="Provisioned" value={done} hint="live accounts" />
        </div>

        <Section
          title="Tenant provisioning"
          subtitle="Each new sub-account runs the 7-step provisioning pipeline. Demo data — live status streaming lands in Phase 1.2."
          paddedBody={false}
          action={
            <div className="flex items-center gap-2">
              <DataSourceBadge source="fixture" />
              <Button
                leftIcon={<RefreshCw size={14} />}
                variant="ghost"
                size="sm"
                onClick={() => toast.info('Refresh queue — live provisioning stream lands in Phase 1.2.')}
              >
                Refresh
              </Button>
              <Button
                leftIcon={<Plus size={14} />}
                variant="primary"
                size="sm"
                onClick={() => router.push('/onboard-account')}
              >
                New account
              </Button>
            </div>
          }
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Org</th>
                <th>Region</th>
                <th>Phase</th>
                <th>Steps</th>
                <th>Started</th>
                <th>Note</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {QUEUE.map((row) => (
                <tr key={row.id}>
                  <td className="text-[13px] text-ink font-medium max-w-[220px] truncate">
                    {row.org}
                  </td>
                  <td>
                    <RegionBadge region={row.region} />
                  </td>
                  <td>
                    <StatusPill tone={phaseTone(row.phase)}>{phaseLabel(row.phase)}</StatusPill>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 rounded-full bg-line2 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            row.phase === 'blocked' ? 'bg-danger' : 'bg-accent'
                          }`}
                          style={{ width: `${(row.stepsDone / STEPS.length) * 100}%` }}
                        />
                      </div>
                      <span className="numeric text-[12px] text-muted">
                        {row.stepsDone}/{STEPS.length}
                      </span>
                    </div>
                  </td>
                  <td className="text-[12px] text-muted">{row.startedAt}</td>
                  <td className="text-[12px] text-muted max-w-[280px] truncate">{row.note}</td>
                  <td>
                    <button
                      className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline"
                      onClick={() => view(row)}
                    >
                      View <ArrowRight size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Provisioning steps" subtitle="The pipeline every new tenant runs through">
          <div className="flex flex-wrap items-center gap-2">
            {STEPS.map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line2 px-2.5 py-1 text-[12px] text-ink">
                  <span className="numeric text-[10px] text-muted">{i + 1}</span>
                  {step}
                </span>
                {i < STEPS.length - 1 && <ArrowRight size={12} className="text-soft" />}
              </div>
            ))}
          </div>
        </Section>
      </div>
    </OperatorShell>
  );
}
