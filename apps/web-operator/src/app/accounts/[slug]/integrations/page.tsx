'use client';

import { use, useState } from 'react';
import {
  Zap,
  Cloud,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Activity,
  Info,
} from 'lucide-react';
import { Banner, Section } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { toast } from '@/components/Toaster';

interface CrmState {
  webhookUrl: string;
  signingSecret: string;
  accessToken: string;
  portalId: string;
  instanceUrl: string;
  oauthToken: string;
}

interface ConnectedState {
  zapier: boolean;
  hubspot: boolean;
  salesforce: boolean;
}

const INITIAL_STATE: CrmState = {
  webhookUrl: '',
  signingSecret: '',
  accessToken: '',
  portalId: '',
  instanceUrl: '',
  oauthToken: '',
};

const MOCK_CONNECTED: ConnectedState = {
  zapier: true,
  hubspot: false,
  salesforce: false,
};

const MOCK_STATS = {
  zapier: { leads: 247, lastSync: '2 minutes ago' },
  hubspot: { leads: 0, lastSync: '—' },
  salesforce: { leads: 0, lastSync: '—' },
};

export default function CrmIntegrationsPage({
  params: paramsPromise,
}: {
  params: Promise<{ slug: string }>;
}): JSX.Element {
  const params = use(paramsPromise);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [connected, setConnected] = useState<ConnectedState>(MOCK_CONNECTED);
  const [fields, setFields] = useState<CrmState>(INITIAL_STATE);
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  function toggle(key: string): void {
    setExpanded((prev) => (prev === key ? null : key));
  }

  function setField(key: keyof CrmState, value: string): void {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(provider: keyof ConnectedState): Promise<void> {
    setSaving(provider);
    await new Promise((r) => setTimeout(r, 800));
    // Mock POST to /api/crm/integrations
    try {
      // Real: await fetch(`/api/crm/integrations`, { method: 'POST', body: JSON.stringify({ provider, ...fields }) });
      setConnected((prev) => ({ ...prev, [provider]: true }));
      setExpanded(null);
      toast.success(
        `${provider.charAt(0).toUpperCase() + provider.slice(1)} connected successfully.`,
      );
    } finally {
      setSaving(null);
    }
  }

  async function handleTest(provider: string): Promise<void> {
    setTesting(provider);
    await new Promise((r) => setTimeout(r, 700));
    setTesting(null);
    toast.success('Connection successful!');
  }

  async function handleRemove(provider: keyof ConnectedState): Promise<void> {
    setConnected((prev) => ({ ...prev, [provider]: false }));
    toast.info(`${provider.charAt(0).toUpperCase() + provider.slice(1)} disconnected.`);
  }

  return (
    <AccountShell accountSlug={params.slug} pageTitle="CRM Integrations">
      <div className="space-y-5 max-w-[1100px]">
        {/* Header */}
        <div>
          <h1 className="text-[20px] font-semibold text-ink tracking-tight">CRM Integrations</h1>
          <p className="text-[13px] text-muted mt-0.5">
            Connect D2D to your sales CRM to sync leads and conversions automatically.
          </p>
        </div>

        {/* Event trigger banner */}
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Info size={14} className="text-accent shrink-0" />
            <span>
              <span className="font-semibold">D2D sends data when:</span> a lead is captured · a
              conversion is recorded · a rep status changes
            </span>
          </span>
        </Banner>

        {/* Cards */}
        <div className="grid grid-cols-1 gap-4">
          {/* Zapier */}
          <IntegrationCard
            id="zapier"
            icon={<Zap size={20} className="text-[#FF4A00]" />}
            iconBg="bg-orange-50 border-orange-100"
            name="Zapier"
            description="Connect to 6,000+ apps — Salesforce, Pipedrive, Airtable, and more via Zapier webhooks."
            isConnected={connected.zapier}
            stats={connected.zapier ? MOCK_STATS.zapier : null}
            expanded={expanded === 'zapier'}
            onToggle={() => toggle('zapier')}
            onTest={() => handleTest('zapier')}
            onRemove={() => handleRemove('zapier')}
            onSave={() => handleSave('zapier')}
            saving={saving === 'zapier'}
            testing={testing === 'zapier'}
          >
            <FieldRow
              label="Webhook URL"
              placeholder="https://hooks.zapier.com/hooks/catch/..."
              value={fields.webhookUrl}
              onChange={(v) => setField('webhookUrl', v)}
              type="url"
            />
            <FieldRow
              label="Signing Secret"
              placeholder="Optional — used to verify payloads"
              value={fields.signingSecret}
              onChange={(v) => setField('signingSecret', v)}
              type="password"
              optional
            />
          </IntegrationCard>

          {/* HubSpot */}
          <IntegrationCard
            id="hubspot"
            icon={
              <span className="w-[20px] h-[20px] rounded-full bg-[#FF7A59] flex items-center justify-center text-white font-bold text-[12px]">
                H
              </span>
            }
            iconBg="bg-orange-50 border-orange-100"
            name="HubSpot CRM"
            description="Push leads as Contacts and conversions as Deals directly into HubSpot."
            isConnected={connected.hubspot}
            stats={connected.hubspot ? MOCK_STATS.hubspot : null}
            expanded={expanded === 'hubspot'}
            onToggle={() => toggle('hubspot')}
            onTest={() => handleTest('hubspot')}
            onRemove={() => handleRemove('hubspot')}
            onSave={() => handleSave('hubspot')}
            saving={saving === 'hubspot'}
            testing={testing === 'hubspot'}
          >
            <FieldRow
              label="Access Token"
              placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={fields.accessToken}
              onChange={(v) => setField('accessToken', v)}
              type="password"
            />
            <FieldRow
              label="Portal ID"
              placeholder="e.g. 12345678"
              value={fields.portalId}
              onChange={(v) => setField('portalId', v)}
              type="text"
            />
          </IntegrationCard>

          {/* Salesforce */}
          <IntegrationCard
            id="salesforce"
            icon={<Cloud size={20} style={{ color: '#00A1E0' }} />}
            iconBg="bg-sky-50 border-sky-100"
            name="Salesforce"
            description="Push leads as Salesforce Leads and conversions as Opportunities."
            isConnected={connected.salesforce}
            stats={connected.salesforce ? MOCK_STATS.salesforce : null}
            expanded={expanded === 'salesforce'}
            onToggle={() => toggle('salesforce')}
            onTest={() => handleTest('salesforce')}
            onRemove={() => handleRemove('salesforce')}
            onSave={() => handleSave('salesforce')}
            saving={saving === 'salesforce'}
            testing={testing === 'salesforce'}
          >
            <FieldRow
              label="Instance URL"
              placeholder="https://yourorg.salesforce.com"
              value={fields.instanceUrl}
              onChange={(v) => setField('instanceUrl', v)}
              type="url"
            />
            <FieldRow
              label="OAuth Access Token"
              placeholder="00Dxx0000001gER!..."
              value={fields.oauthToken}
              onChange={(v) => setField('oauthToken', v)}
              type="password"
            />
          </IntegrationCard>
        </div>

        {/* Footer */}
        <p className="text-[12px] text-muted text-center pt-2">
          Need help?{' '}
          <a href="mailto:support@d2d.io" className="text-accent hover:underline">
            Contact support
          </a>
        </p>
      </div>
    </AccountShell>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function IntegrationCard({
  id,
  icon,
  iconBg,
  name,
  description,
  isConnected,
  stats,
  expanded,
  onToggle,
  onTest,
  onRemove,
  onSave,
  saving,
  testing,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  iconBg: string;
  name: string;
  description: string;
  isConnected: boolean;
  stats: { leads: number; lastSync: string } | null;
  expanded: boolean;
  onToggle: () => void;
  onTest: () => void;
  onRemove: () => void;
  onSave: () => void;
  saving: boolean;
  testing: boolean;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="border border-line2 rounded-xl bg-white overflow-hidden">
      {/* Card header */}
      <div className="px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${iconBg}`}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-semibold text-ink">{name}</span>
              {isConnected ? (
                <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-soft bg-line2 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-soft inline-block" />
                  Not connected
                </span>
              )}
            </div>
            <p className="text-[12px] text-muted mt-0.5 leading-snug">{description}</p>
            {isConnected && stats && stats.leads > 0 && (
              <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted">
                <Activity size={11} className="text-success" />
                <span>
                  Leads pushed: <span className="font-semibold text-ink">{stats.leads}</span> · Last
                  sync: <span className="font-semibold text-ink">{stats.lastSync}</span>
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isConnected && (
            <>
              <button
                type="button"
                onClick={onTest}
                disabled={testing}
                className="text-[11.5px] font-medium px-3 py-1.5 rounded-md border border-line2 text-muted hover:text-ink hover:border-ink/30 transition disabled:opacity-50"
              >
                {testing ? 'Testing…' : 'Test Connection'}
              </button>
              <button
                type="button"
                onClick={onRemove}
                className="text-[11.5px] font-medium px-3 py-1.5 rounded-md border border-line2 text-danger hover:bg-danger/5 transition"
              >
                Remove
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center gap-1.5 text-[11.5px] font-semibold px-3 py-1.5 rounded-md bg-ink text-surface hover:bg-ink/90 transition"
          >
            {isConnected ? 'Update' : 'Configure'}
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Expandable form */}
      {expanded && (
        <div className="border-t border-line2 px-5 py-4 bg-[#F8FAFC] space-y-3">
          {children}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-4 py-2 rounded-md bg-accent text-white hover:bg-accent/90 transition disabled:opacity-60"
            >
              <CheckCircle2 size={13} />
              {saving ? 'Saving…' : isConnected ? 'Update Connection' : 'Connect'}
            </button>
            <button
              type="button"
              onClick={() => onTest()}
              disabled={testing}
              className="text-[12px] font-medium px-4 py-2 rounded-md border border-line2 text-muted hover:text-ink transition disabled:opacity-50"
            >
              {testing ? 'Testing…' : 'Test Connection'}
            </button>
            {isConnected && (
              <button
                type="button"
                onClick={onRemove}
                className="ml-auto flex items-center gap-1 text-[11.5px] text-danger hover:underline"
              >
                <XCircle size={12} /> Disconnect
              </button>
            )}
          </div>
          <p className="text-[10.5px] text-muted">
            Credentials are encrypted at rest in the D2D PII vault — never stored in plaintext.
          </p>
        </div>
      )}
    </div>
  );
}

function FieldRow({
  label,
  placeholder,
  value,
  onChange,
  type,
  optional,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type: 'text' | 'url' | 'password';
  optional?: boolean;
}): JSX.Element {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-ink uppercase tracking-wider mb-1">
        {label}
        {optional && (
          <span className="ml-1 font-normal text-muted normal-case tracking-normal">
            (optional)
          </span>
        )}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-[12.5px] px-3 py-2 rounded-md border border-line2 bg-white text-ink placeholder:text-soft focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition font-mono"
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}
