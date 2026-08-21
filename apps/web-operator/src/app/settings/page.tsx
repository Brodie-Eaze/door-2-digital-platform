'use client';

import {
  Building2,
  Globe,
  Users,
  Palette,
  CreditCard,
  Database,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { Section, StatusPill, KpiCard, Banner } from '@d2d/ui-web';
import type { Tone } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { toast } from '@/components/Toaster';

interface Field {
  label: string;
  value: string;
  pill?: { text: string; tone: Tone };
}

const ORG_PROFILE: Field[] = [
  { label: 'Legal entity', value: 'Door 2 Digital, Inc.' },
  { label: 'Operator console', value: 'd2d-operator (HQ)' },
  { label: 'Primary region', value: 'United States' },
  { label: 'Base currency', value: 'USD' },
  { label: 'Support contact', value: 'ops@door2digital.io' },
  {
    label: 'Environment',
    value: 'production',
    pill: { text: 'live', tone: 'success' },
  },
];

const REGIONS: { code: string; name: string; status: string; tone: Tone }[] = [
  { code: 'US', name: 'United States', status: 'enabled', tone: 'success' },
  { code: 'CA', name: 'Canada', status: 'planned · Phase 2', tone: 'muted' },
  { code: 'AU', name: 'Australia', status: 'planned · Phase 2', tone: 'muted' },
  { code: 'UK', name: 'United Kingdom', status: 'not enabled', tone: 'muted' },
];

const USERS: { role: string; count: number; note: string }[] = [
  { role: 'super_admin', count: 2, note: 'full cross-tenant access' },
  { role: 'ops_admin', count: 4, note: 'provisioning + billing' },
  { role: 'support', count: 6, note: 'read + acknowledge alerts' },
  { role: 'read_only', count: 3, note: 'dashboards only' },
];

const BRANDING: Field[] = [
  { label: 'Product name', value: 'Door 2 Digital' },
  { label: 'Tagline', value: 'Intelligence OS for door-to-door' },
  { label: 'Primary colour', value: '#0F172A (navy)' },
  { label: 'Accent colour', value: '#3B82F6 (light blue)' },
  { label: 'Typeface', value: 'Inter' },
];

const BILLING: Field[] = [
  { label: 'Billing model', value: 'Per-seat + usage (conversions)' },
  { label: 'Processor', value: 'MiCamp Gateway' },
  {
    label: 'Active subscriptions',
    value: '3 accounts',
    pill: { text: '1 trial', tone: 'warn' },
  },
  { label: 'Next invoice run', value: '2026-07-01' },
];

const DATA_PRIVACY: Field[] = [
  { label: 'PII classification', value: 'Enforced at write (pii-first)' },
  { label: 'Encryption at rest', value: 'AES-256 · per-tenant keys' },
  { label: 'Data residency', value: 'US (us-east-1)' },
  { label: 'Audit retention', value: '7 years (append-only)' },
  { label: 'RTBF / erasure', value: 'Self-serve request flow' },
  { label: 'Sub-processors', value: 'MiCamp, Mapbox, AWS' },
];

function FieldGrid({ fields }: { fields: Field[] }): JSX.Element {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3.5">
      {fields.map((f) => (
        <div
          key={f.label}
          className="flex items-center justify-between gap-3 border-b border-line2 pb-2.5"
        >
          <dt className="text-[12px] text-muted">{f.label}</dt>
          <dd className="text-[13px] font-medium text-ink text-right flex items-center gap-2">
            {f.value}
            {f.pill && <StatusPill tone={f.pill.tone}>{f.pill.text}</StatusPill>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function SaveButton({ scope }: { scope: string }): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => toast.info(`Editing ${scope} lands in Phase 1.x`)}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 h-7 text-[12px] font-medium bg-surface text-ink border border-line hover:bg-paper transition-colors"
    >
      Edit
    </button>
  );
}

export default function SettingsPage(): JSX.Element {
  return (
    <PlatformShell pageTitle="Settings">
      <div className="space-y-6 max-w-[1280px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Building2 size={14} />
            HQ organisation settings. Fields are read-only in this build —{' '}
            <span className="text-muted">
              edit lands in Phase 1.x once the settings API is wired.
            </span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Regions enabled" value="1 / 4" hint="US live" />
          <KpiCard
            label="Operator users"
            value={USERS.reduce((s, u) => s + u.count, 0)}
            hint="4 roles"
          />
          <KpiCard label="Billed accounts" value="3" delta="1 trial" deltaTone="neutral" />
          <KpiCard label="Audit retention" value="7 yr" hint="append-only" />
        </div>

        <Section
          title="Organisation profile"
          subtitle="Legal entity, region, and contact"
          action={
            <div className="flex items-center gap-2">
              <DataSourceBadge source="fixture" />
              <SaveButton scope="organisation profile" />
            </div>
          }
        >
          <FieldGrid fields={ORG_PROFILE} />
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section
            title="Regions"
            subtitle="Where D2D operates"
            paddedBody={false}
            action={
              <div className="flex items-center gap-2">
                <Globe size={13} className="text-muted" />
                <SaveButton scope="regions" />
              </div>
            }
          >
            <ul className="divide-y divide-line2">
              {REGIONS.map((r) => (
                <li key={r.code} className="px-5 py-3 flex items-center justify-between">
                  <span className="flex items-center gap-2.5">
                    <span className="mono text-[11px] font-semibold text-ink2 w-7">{r.code}</span>
                    <span className="text-[13px] text-ink">{r.name}</span>
                  </span>
                  <StatusPill tone={r.tone}>{r.status}</StatusPill>
                </li>
              ))}
            </ul>
          </Section>

          <Section
            title="Users & roles"
            subtitle="Operator console RBAC summary"
            paddedBody={false}
            action={
              <div className="flex items-center gap-2">
                <Users size={13} className="text-muted" />
                <button
                  type="button"
                  onClick={() => toast.info('Manage users lands in Phase 1.x')}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 h-7 text-[12px] font-medium bg-surface text-ink border border-line hover:bg-paper transition-colors"
                >
                  Manage
                </button>
              </div>
            }
          >
            <ul className="divide-y divide-line2">
              {USERS.map((u) => (
                <li key={u.role} className="px-5 py-3 flex items-center justify-between">
                  <span className="flex flex-col">
                    <span className="mono text-[12px] font-medium text-ink">{u.role}</span>
                    <span className="text-[11px] text-soft">{u.note}</span>
                  </span>
                  <span className="numeric text-[15px] font-semibold text-ink">{u.count}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section
            title="Branding"
            subtitle="House style — applied across all surfaces"
            action={
              <div className="flex items-center gap-2">
                <Palette size={13} className="text-muted" />
                <SaveButton scope="branding" />
              </div>
            }
          >
            <FieldGrid fields={BRANDING} />
          </Section>

          <Section
            title="Billing"
            subtitle="Plans, processor, and invoicing"
            action={
              <div className="flex items-center gap-2">
                <CreditCard size={13} className="text-muted" />
                <button
                  type="button"
                  onClick={() => toast.info('Opening billing workspace')}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 h-7 text-[12px] font-medium bg-surface text-ink border border-line hover:bg-paper transition-colors"
                >
                  <ExternalLink size={12} />
                  Billing
                </button>
              </div>
            }
          >
            <FieldGrid fields={BILLING} />
          </Section>
        </div>

        <Section
          title="Data & privacy"
          subtitle="PII handling, residency, retention, and erasure"
          action={
            <div className="flex items-center gap-2">
              <Database size={13} className="text-muted" />
              <DataSourceBadge source="fixture" />
            </div>
          }
        >
          <FieldGrid fields={DATA_PRIVACY} />
          <div className="mt-5 flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() =>
                toast.info('Erasure requests require dual-control approval — not faked in demo')
              }
              className="inline-flex items-center gap-1.5 rounded-lg px-3 h-8 text-[12.5px] font-medium bg-surface text-ink border border-line hover:bg-paper transition-colors"
            >
              <Lock size={13} />
              Request erasure (RTBF)
            </button>
            <button
              type="button"
              onClick={() => toast.info('Export sub-processor list lands in Phase 1.x')}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 h-8 text-[12.5px] font-medium bg-surface text-ink border border-line hover:bg-paper transition-colors"
            >
              Export sub-processor list
            </button>
          </div>
        </Section>
      </div>
    </PlatformShell>
  );
}
