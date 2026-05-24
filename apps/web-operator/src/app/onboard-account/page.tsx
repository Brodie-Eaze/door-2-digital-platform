'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Palette,
  FileText,
  Users,
  CheckCircle2,
  Check,
  ChevronLeft,
  ChevronRight,
  Upload,
  Globe,
  Mail,
  Phone,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Banner, Button, Section } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';

type Region = 'US' | 'AU' | 'SG';
type Vertical = 'charity' | 'commercial' | 'healthcare';
type Plan = 'Enterprise' | 'Growth' | 'Trial';

interface FormState {
  // Step 1
  legalName: string;
  shortName: string;
  vertical: Vertical;
  region: Region;
  businessNumber: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  // Step 2
  displayName: string;
  avatarBg: string;
  avatarFg: string;
  logoFileName: string;
  customDomain: string;
  supportEmail: string;
  privacyUrl: string;
  termsUrl: string;
  // Step 3
  plan: Plan;
  platformFee: number;
  doorRake: number;
  insideRake: number;
  retargetingRake: number;
  billingDay: number;
  // Step 4
  knockerCount: number;
  insideRepCount: number;
  territoryCount: number;
  states: string[];
  bundleId: string;
}

const COLOUR_SWATCHES = [
  '#0F172A',
  '#1E293B',
  '#475569',
  '#3B82F6',
  '#0F766E',
  '#7C3AED',
  '#DC2626',
  '#EA580C',
  '#059669',
  '#0EA5E9',
];

const STATES_BY_REGION: Record<Region, string[]> = {
  US: ['TX', 'CA', 'NY', 'FL', 'AZ', 'GA', 'IL', 'NC'],
  AU: ['NSW', 'VIC', 'QLD', 'WA', 'SA'],
  SG: ['Singapore'],
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
}

function deriveShort(name: string): string {
  if (!name) return '';
  // Strip common corporate suffixes
  return name
    .replace(
      /\b(international|inc|llc|ltd|limited|corp|corporation|services|foundation|pty|gmbh)\.?\b/gi,
      '',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function regionLabel(r: Region): string {
  if (r === 'US') return 'United States';
  if (r === 'AU') return 'Australia';
  return 'Singapore';
}

function processorForRegion(r: Region): string {
  return r === 'US' ? 'MiCamp' : 'Stripe';
}

function businessNumberLabel(r: Region): string {
  if (r === 'US') return 'EIN';
  if (r === 'AU') return 'ABN';
  return 'UEN';
}

function businessNumberPlaceholder(r: Region): string {
  if (r === 'US') return '12-3456789';
  if (r === 'AU') return '11 222 333 444';
  return '202012345A';
}

const STEPS = [
  { id: 1, label: 'Business profile', icon: Building2 },
  { id: 2, label: 'Brand kit', icon: Palette },
  { id: 3, label: 'Contract terms', icon: FileText },
  { id: 4, label: 'Field team seed', icon: Users },
  { id: 5, label: 'Review & activate', icon: CheckCircle2 },
] as const;

export default function OnboardAccountPage(): JSX.Element {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [activating, setActivating] = useState(false);
  const [provisionLog, setProvisionLog] = useState<string[]>([]);
  const [form, setForm] = useState<FormState>({
    legalName: '',
    shortName: '',
    vertical: 'charity',
    region: 'US',
    businessNumber: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    displayName: '',
    avatarBg: '#0F172A',
    avatarFg: '#FFFFFF',
    logoFileName: '',
    customDomain: '',
    supportEmail: '',
    privacyUrl: '',
    termsUrl: '',
    plan: 'Enterprise',
    platformFee: 2500,
    doorRake: 15,
    insideRake: 10,
    retargetingRake: 5,
    billingDay: 1,
    knockerCount: 50,
    insideRepCount: 5,
    territoryCount: 5,
    states: [],
    bundleId: 'io.d2d.knocker.new-account',
  });

  function update<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => {
      const next: FormState = { ...prev, [key]: value };
      // Derived fields
      if (key === 'legalName') {
        if (!prev.shortName || prev.shortName === deriveShort(prev.legalName)) {
          next.shortName = deriveShort(value as string);
        }
        if (!prev.displayName || prev.displayName === deriveShort(prev.legalName)) {
          next.displayName = deriveShort(value as string);
        }
        const sl = slugify(deriveShort(value as string));
        if (sl) next.bundleId = `io.d2d.knocker.${sl}`;
      }
      if (key === 'shortName') {
        const sl = slugify(value as string);
        if (sl) next.bundleId = `io.d2d.knocker.${sl}`;
        if (!prev.displayName) next.displayName = value as string;
      }
      if (key === 'region') {
        // Reset states list
        next.states = [];
      }
      return next;
    });
  }

  function toggleState(s: string): void {
    setForm((prev) => ({
      ...prev,
      states: prev.states.includes(s) ? prev.states.filter((x) => x !== s) : [...prev.states, s],
    }));
  }

  const stepValid = useMemo<boolean>(() => {
    if (step === 1) {
      return Boolean(
        form.legalName.trim() &&
        form.shortName.trim() &&
        form.businessNumber.trim() &&
        form.contactName.trim() &&
        form.contactEmail.trim() &&
        form.contactPhone.trim(),
      );
    }
    if (step === 2) {
      return Boolean(form.displayName.trim() && form.avatarBg && form.supportEmail.trim());
    }
    if (step === 3) {
      return form.platformFee > 0 && form.billingDay >= 1 && form.billingDay <= 28;
    }
    if (step === 4) {
      return form.knockerCount > 0 && form.territoryCount > 0 && form.states.length > 0;
    }
    return true;
  }, [step, form]);

  function activate(): void {
    setActivating(true);
    setProvisionLog(['Account provisioned — generating workspace…']);
    const lines = [
      `Created org record · slug ${slugify(form.shortName) || 'new-account'}`,
      `Provisioned ${form.knockerCount} Knocker iOS seats · bundle ${form.bundleId}`,
      `Queued paid-solicitor filings for ${form.states.length} ${form.region === 'US' ? 'states' : 'jurisdictions'}`,
      `Wired ${processorForRegion(form.region)} billing · day ${form.billingDay} of month`,
      `Workspace ready — redirecting to portfolio…`,
    ];
    lines.forEach((l, i) => {
      setTimeout(
        () => {
          setProvisionLog((prev) => [...prev, l]);
        },
        (i + 1) * 600,
      );
    });
    setTimeout(() => {
      router.push('/accounts');
    }, 3500);
  }

  const monogram = useMemo(() => {
    const parts = form.displayName.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
    return (parts[0]?.slice(0, 2) ?? '??').toUpperCase();
  }, [form.displayName]);

  return (
    <PlatformShell pageTitle="Onboard new business">
      <div className="space-y-5 max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Sparkles size={13} className="text-accent" />
            <span>
              Each new sub-account gets its own provisioned workspace, white-labelled Knocker iOS
              build, dedicated knocker team, paid-solicitor registrations queued, and isolated
              billing — onboard once, live in 14 days.
            </span>
          </span>
        </Banner>

        {/* Stepper */}
        <div className="card card-pad">
          <div className="flex items-center justify-between gap-2">
            {STEPS.map((s, i) => {
              const completed = step > s.id;
              const current = step === s.id;
              return (
                <div key={s.id} className="flex items-center flex-1 last:flex-none">
                  <button
                    onClick={() => {
                      if (s.id < step) setStep(s.id);
                    }}
                    className="flex items-center gap-2.5 group"
                    disabled={s.id > step}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold transition ${
                        completed
                          ? 'bg-success text-surface'
                          : current
                            ? 'bg-ink text-surface'
                            : 'bg-paper border border-line2 text-soft'
                      }`}
                    >
                      {completed ? <Check size={14} /> : s.id}
                    </div>
                    <div className="hidden md:block text-left">
                      <div
                        className={`text-[12px] font-semibold tracking-tight ${
                          current ? 'text-ink' : completed ? 'text-success' : 'text-soft'
                        }`}
                      >
                        {s.label}
                      </div>
                      <div className="text-[10px] text-muted">Step {s.id} of 5</div>
                    </div>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-px mx-3 ${completed ? 'bg-success/40' : 'bg-line2'}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step content */}
        {step === 1 && <Step1Profile form={form} update={update} />}
        {step === 2 && <Step2Brand form={form} update={update} monogram={monogram} />}
        {step === 3 && <Step3Contract form={form} update={update} />}
        {step === 4 && <Step4Team form={form} update={update} toggleState={toggleState} />}
        {step === 5 && (
          <Step5Review
            form={form}
            monogram={monogram}
            onBack={() => setStep(4)}
            activating={activating}
            provisionLog={provisionLog}
            onActivate={activate}
          />
        )}

        {/* Footer nav */}
        {step < 5 && (
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              leftIcon={<ChevronLeft size={14} />}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
            >
              Back
            </Button>
            <div className="text-[11px] text-muted">
              Step {step} of {STEPS.length}
            </div>
            <Button
              variant="primary"
              rightIcon={<ChevronRight size={14} />}
              disabled={!stepValid}
              onClick={() => setStep((s) => Math.min(5, s + 1))}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </PlatformShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Business profile
// ─────────────────────────────────────────────────────────────────────────────

function Step1Profile({
  form,
  update,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}): JSX.Element {
  return (
    <Section
      title="Business profile"
      subtitle="Legal entity, vertical, region, primary contact. Used for billing + paid-solicitor filings."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Legal name" required>
          <input
            value={form.legalName}
            onChange={(e) => update('legalName', e.target.value)}
            placeholder="e.g. Save the Children Australia Ltd"
            className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px]"
          />
        </Field>
        <Field label="Trading / short name" required hint="Auto-derived; editable">
          <input
            value={form.shortName}
            onChange={(e) => update('shortName', e.target.value)}
            placeholder="e.g. Save the Children"
            className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px]"
          />
        </Field>

        <Field label="Vertical" required>
          <div className="flex items-center gap-2 flex-wrap">
            {(['charity', 'commercial', 'healthcare'] as const).map((v) => (
              <button
                key={v}
                onClick={() => update('vertical', v)}
                className={`px-3 h-9 rounded-lg text-[12px] font-medium border capitalize transition ${
                  form.vertical === v
                    ? 'bg-ink text-surface border-ink'
                    : 'bg-paper text-muted border-line2 hover:text-ink'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Region" required>
          <div className="flex items-center gap-2 flex-wrap">
            {(['US', 'AU', 'SG'] as const).map((r) => (
              <button
                key={r}
                onClick={() => update('region', r)}
                className={`px-3 h-9 rounded-lg text-[12px] font-medium border transition ${
                  form.region === r
                    ? 'bg-ink text-surface border-ink'
                    : 'bg-paper text-muted border-line2 hover:text-ink'
                }`}
              >
                {regionLabel(r)} ({r})
              </button>
            ))}
          </div>
        </Field>

        <Field
          label={`${businessNumberLabel(form.region)} (${form.region === 'US' ? 'tax ID' : 'business number'})`}
          required
        >
          <input
            value={form.businessNumber}
            onChange={(e) => update('businessNumber', e.target.value)}
            placeholder={businessNumberPlaceholder(form.region)}
            className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px] numeric"
          />
        </Field>
        <div />

        <Field label="Primary contact name" required>
          <input
            value={form.contactName}
            onChange={(e) => update('contactName', e.target.value)}
            placeholder="e.g. Sarah Johnson, Director of Fundraising"
            className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px]"
          />
        </Field>
        <Field label="Contact email" required icon={<Mail size={12} />}>
          <input
            type="email"
            value={form.contactEmail}
            onChange={(e) => update('contactEmail', e.target.value)}
            placeholder="sarah@charityname.org"
            className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px]"
          />
        </Field>
        <Field label="Contact phone" required icon={<Phone size={12} />}>
          <input
            type="tel"
            value={form.contactPhone}
            onChange={(e) => update('contactPhone', e.target.value)}
            placeholder={form.region === 'US' ? '(512) 555-0142' : '+61 412 345 678'}
            className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px] numeric"
          />
        </Field>
      </div>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Brand kit
// ─────────────────────────────────────────────────────────────────────────────

function Step2Brand({
  form,
  update,
  monogram,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  monogram: string;
}): JSX.Element {
  return (
    <Section
      title="Brand kit (white-label)"
      subtitle="Colours, logo, custom domain — applied across the operator UI + Knocker iOS build."
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <Field label="Display name (override of short name)" required>
            <input
              value={form.displayName}
              onChange={(e) => update('displayName', e.target.value)}
              placeholder="e.g. Save the Children"
              className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px]"
            />
          </Field>

          <Field label="Avatar background colour" required>
            <div className="flex items-center gap-2 flex-wrap">
              {COLOUR_SWATCHES.map((c) => (
                <button
                  key={c}
                  onClick={() => update('avatarBg', c)}
                  className={`w-9 h-9 rounded-lg border-2 transition ${
                    form.avatarBg === c
                      ? 'border-accent ring-2 ring-accent/30'
                      : 'border-line2 hover:border-ink/30'
                  }`}
                  style={{ background: c }}
                  title={c}
                />
              ))}
              <input
                type="color"
                value={form.avatarBg}
                onChange={(e) => update('avatarBg', e.target.value)}
                className="w-9 h-9 rounded-lg border-2 border-line2 cursor-pointer"
                title="Custom"
              />
            </div>
          </Field>

          <Field label="Logo upload (PNG/SVG, square, 512×512+)">
            <label className="flex items-center gap-2 px-3 h-9 bg-paper border border-dashed border-line2 rounded-lg text-[12px] text-muted cursor-pointer hover:text-ink hover:border-accent/40">
              <Upload size={13} />
              <span className="truncate">
                {form.logoFileName || 'Click to upload — accepted: PNG, SVG (≤2MB)'}
              </span>
              <input
                type="file"
                accept="image/png,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) update('logoFileName', f.name);
                }}
              />
            </label>
          </Field>

          <Field label="Custom domain" icon={<Globe size={12} />} hint="CNAME → ingress.d2d.io">
            <input
              value={form.customDomain}
              onChange={(e) => update('customDomain', e.target.value)}
              placeholder="app.charityname.org"
              className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px]"
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Support email" required>
              <input
                type="email"
                value={form.supportEmail}
                onChange={(e) => update('supportEmail', e.target.value)}
                placeholder="support@charityname.org"
                className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px]"
              />
            </Field>
            <Field label="Privacy policy URL">
              <input
                value={form.privacyUrl}
                onChange={(e) => update('privacyUrl', e.target.value)}
                placeholder="https://charityname.org/privacy"
                className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px]"
              />
            </Field>
            <Field label="Terms of service URL">
              <input
                value={form.termsUrl}
                onChange={(e) => update('termsUrl', e.target.value)}
                placeholder="https://charityname.org/terms"
                className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px]"
              />
            </Field>
          </div>
        </div>

        {/* Live preview */}
        <div className="space-y-4">
          <div className="text-[10px] uppercase tracking-wider text-muted font-medium">
            Live preview
          </div>
          <div className="card card-pad">
            <div className="flex items-center gap-3 pb-4 border-b border-line2">
              <span
                className="inline-flex items-center justify-center rounded-xl font-semibold tracking-tight shrink-0"
                style={{
                  width: 56,
                  height: 56,
                  background: form.avatarBg,
                  color: form.avatarFg,
                  fontSize: 20,
                }}
              >
                {monogram || '??'}
              </span>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-ink truncate">
                  {form.displayName || form.shortName || 'New account'}
                </div>
                <div className="text-[11px] text-muted">SUB-ACCOUNT · {form.region}</div>
              </div>
            </div>
            <div className="pt-4 space-y-2 text-[11px]">
              <PreviewRow
                label="Custom domain"
                value={
                  form.customDomain || 'app.d2d.io/' + (slugify(form.shortName) || 'new-account')
                }
              />
              <PreviewRow label="Support email" value={form.supportEmail || 'support@d2d.io'} />
              <PreviewRow label="Vertical" value={form.vertical} capitalize />
            </div>
          </div>

          {/* iOS splash mock */}
          <div className="card overflow-hidden">
            <div className="text-[10px] uppercase tracking-wider text-muted font-medium px-4 pt-4">
              Knocker iOS splash
            </div>
            <div
              className="m-4 rounded-2xl flex flex-col items-center justify-center"
              style={{ background: form.avatarBg, color: form.avatarFg, height: 180 }}
            >
              <span
                className="text-[42px] font-bold tracking-tight"
                style={{ color: form.avatarFg }}
              >
                {monogram || '??'}
              </span>
              <div className="text-[11px] uppercase tracking-widest opacity-80 mt-2">Knocker</div>
              <div className="text-[10px] opacity-60 mt-0.5">
                {form.displayName || form.shortName}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

function PreviewRow({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted">{label}</span>
      <span className={`text-ink truncate max-w-[180px] ${capitalize ? 'capitalize' : ''}`}>
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Contract terms
// ─────────────────────────────────────────────────────────────────────────────

function Step3Contract({
  form,
  update,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}): JSX.Element {
  return (
    <Section
      title="Contract terms"
      subtitle="Plan, platform fee, rake percentages, processor + billing cycle."
    >
      <div className="space-y-5">
        <Field label="Plan" required>
          <div className="grid grid-cols-3 gap-2">
            {(['Enterprise', 'Growth', 'Trial'] as const).map((p) => (
              <button
                key={p}
                onClick={() => update('plan', p)}
                className={`px-4 py-3 rounded-lg border text-left transition ${
                  form.plan === p
                    ? 'bg-ink text-surface border-ink'
                    : 'bg-paper text-muted border-line2 hover:text-ink'
                }`}
              >
                <div className="text-[13px] font-semibold">{p}</div>
                <div className="text-[10px] mt-0.5 opacity-80">
                  {p === 'Enterprise'
                    ? '100+ knockers · multi-territory'
                    : p === 'Growth'
                      ? '20–100 knockers · 4–8 territories'
                      : '14-day trial · 8 knockers max'}
                </div>
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Platform fee (monthly)" required hint="USD or local equivalent">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-soft text-[13px]">
                $
              </span>
              <input
                type="number"
                value={form.platformFee}
                onChange={(e) => update('platformFee', Number(e.target.value))}
                className="w-full pl-7 pr-3 h-9 bg-paper border border-line2 rounded-lg text-[13px] numeric"
                min={0}
              />
            </div>
          </Field>
          <Field label="Billing day of month" required hint="1–28">
            <input
              type="number"
              value={form.billingDay}
              onChange={(e) => update('billingDay', Number(e.target.value))}
              min={1}
              max={28}
              className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px] numeric"
            />
          </Field>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2">
            Rake percentages
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <RakeField
              label="Door conversions"
              value={form.doorRake}
              onChange={(v) => update('doorRake', v)}
              tone="success"
              sub="In-person knock → conversion"
            />
            <RakeField
              label="Inside-sales conversions"
              value={form.insideRake}
              onChange={(v) => update('insideRake', v)}
              tone="info"
              sub="Phone call → conversion"
            />
            <RakeField
              label="Retargeting conversions"
              value={form.retargetingRake}
              onChange={(v) => update('retargetingRake', v)}
              tone="warn"
              sub="Drip/web → conversion"
            />
          </div>
        </div>

        <Field
          label="Payment processor"
          hint={`Auto-selected from region — ${processorForRegion(form.region)} (${form.region === 'US' ? 'card + ACH' : 'card + bank debit'}). Locked.`}
        >
          <div className="flex items-center justify-between px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px] opacity-70">
            <span className="text-ink font-medium">{processorForRegion(form.region)}</span>
            <span className="text-[10px] text-muted uppercase tracking-wider">Locked</span>
          </div>
        </Field>
      </div>
    </Section>
  );
}

function RakeField({
  label,
  value,
  onChange,
  tone,
  sub,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  tone: 'success' | 'info' | 'warn';
  sub: string;
}): JSX.Element {
  const toneBg =
    tone === 'success'
      ? 'border-success/40 bg-successSoft/30'
      : tone === 'info'
        ? 'border-accent/40 bg-accentSoft/30'
        : 'border-warn/40 bg-warnSoft/30';
  return (
    <div className={`rounded-lg border p-3 ${toneBg}`}>
      <div className="text-[11px] text-muted uppercase tracking-wider font-medium">{label}</div>
      <div className="flex items-baseline gap-1 mt-1">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={0}
          max={100}
          step={0.5}
          className="w-16 bg-transparent border-b border-line2 text-[24px] font-bold text-ink numeric focus:outline-none focus:border-ink"
        />
        <span className="text-[16px] text-soft font-semibold">%</span>
      </div>
      <div className="text-[10px] text-muted mt-1">{sub}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 — Field team seed
// ─────────────────────────────────────────────────────────────────────────────

function Step4Team({
  form,
  update,
  toggleState,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  toggleState: (s: string) => void;
}): JSX.Element {
  const stateOpts = STATES_BY_REGION[form.region];
  return (
    <Section
      title="Field team seed"
      subtitle="Initial provisioning — Knockers, inside-sales, territories, paid-solicitor filings."
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NumberCard
            label="Knockers to provision"
            value={form.knockerCount}
            onChange={(v) => update('knockerCount', v)}
            hint="iPad seats · TestFlight"
          />
          <NumberCard
            label="Inside-sales reps"
            value={form.insideRepCount}
            onChange={(v) => update('insideRepCount', v)}
            hint="phone + dialler"
          />
          <NumberCard
            label="Territories to set up"
            value={form.territoryCount}
            onChange={(v) => update('territoryCount', v)}
            hint="postal/polygon"
          />
        </div>

        <Field
          label={`${form.region === 'US' ? 'States' : form.region === 'AU' ? 'States/Territories' : 'Jurisdictions'} to pursue clearance for`}
          required
          hint={
            form.region === 'US'
              ? 'Paid-solicitor registration filed by D2D legal team'
              : form.region === 'AU'
                ? 'ACNC + state fundraising regulator filings'
                : 'COC fundraising permit'
          }
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            {stateOpts.map((s) => (
              <button
                key={s}
                onClick={() => toggleState(s)}
                className={`px-3 h-8 rounded-full text-[11px] font-semibold border transition ${
                  form.states.includes(s)
                    ? 'bg-ink text-surface border-ink'
                    : 'bg-paper text-muted border-line2 hover:text-ink'
                }`}
              >
                {form.states.includes(s) && <Check size={11} className="inline mr-1" />}
                {s}
              </button>
            ))}
          </div>
          {form.states.length > 0 && (
            <div className="text-[10px] text-muted mt-2">
              {form.states.length} selected · ~{form.states.length * 14} days to clearance
            </div>
          )}
        </Field>

        <Field label="Knocker iOS bundle ID" hint="Auto-generated from short name">
          <input
            value={form.bundleId}
            onChange={(e) => update('bundleId', e.target.value)}
            className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px] mono"
          />
        </Field>
      </div>
    </Section>
  );
}

function NumberCard({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint: string;
}): JSX.Element {
  return (
    <div className="rounded-lg border border-line2 bg-paper p-3">
      <div className="text-[10px] text-muted uppercase tracking-wider font-medium">{label}</div>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={0}
        className="w-full bg-transparent text-[28px] font-bold text-ink numeric focus:outline-none mt-1"
      />
      <div className="text-[10px] text-muted">{hint}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 5 — Review & activate
// ─────────────────────────────────────────────────────────────────────────────

function Step5Review({
  form,
  monogram,
  onBack,
  activating,
  provisionLog,
  onActivate,
}: {
  form: FormState;
  monogram: string;
  onBack: () => void;
  activating: boolean;
  provisionLog: string[];
  onActivate: () => void;
}): JSX.Element {
  return (
    <div className="space-y-5">
      <Section title="Review & activate" subtitle="Confirm details before provisioning workspace">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <ReviewBlock title="Business profile">
              <ReviewRow label="Legal name" value={form.legalName} />
              <ReviewRow label="Short name" value={form.shortName} />
              <ReviewRow label="Vertical" value={form.vertical} capitalize />
              <ReviewRow label="Region" value={`${regionLabel(form.region)} (${form.region})`} />
              <ReviewRow
                label={businessNumberLabel(form.region)}
                value={form.businessNumber}
                mono
              />
              <ReviewRow label="Primary contact" value={form.contactName} />
              <ReviewRow label="Contact email" value={form.contactEmail} />
              <ReviewRow label="Contact phone" value={form.contactPhone} mono />
            </ReviewBlock>

            <ReviewBlock title="Brand kit">
              <ReviewRow label="Display name" value={form.displayName} />
              <ReviewRow label="Avatar background" value={form.avatarBg} mono />
              <ReviewRow label="Logo" value={form.logoFileName || '— not uploaded'} />
              <ReviewRow
                label="Custom domain"
                value={form.customDomain || '— (using default app.d2d.io subdomain)'}
              />
              <ReviewRow label="Support email" value={form.supportEmail} />
              <ReviewRow label="Privacy URL" value={form.privacyUrl || '—'} />
              <ReviewRow label="Terms URL" value={form.termsUrl || '—'} />
            </ReviewBlock>

            <ReviewBlock title="Contract terms">
              <ReviewRow label="Plan" value={form.plan} />
              <ReviewRow
                label="Platform fee"
                value={`$${form.platformFee.toLocaleString()}/mo`}
                mono
              />
              <ReviewRow label="Door rake" value={`${form.doorRake}%`} mono />
              <ReviewRow label="Inside-sales rake" value={`${form.insideRake}%`} mono />
              <ReviewRow label="Retargeting rake" value={`${form.retargetingRake}%`} mono />
              <ReviewRow label="Processor" value={processorForRegion(form.region)} />
              <ReviewRow label="Billing day" value={`day ${form.billingDay} of each month`} />
            </ReviewBlock>

            <ReviewBlock title="Field team seed">
              <ReviewRow label="Knockers" value={form.knockerCount.toString()} mono />
              <ReviewRow label="Inside-sales reps" value={form.insideRepCount.toString()} mono />
              <ReviewRow label="Territories" value={form.territoryCount.toString()} mono />
              <ReviewRow
                label={form.region === 'US' ? 'States' : 'Jurisdictions'}
                value={form.states.join(', ') || '—'}
              />
              <ReviewRow label="Knocker iOS bundle ID" value={form.bundleId} mono />
            </ReviewBlock>
          </div>

          <div className="space-y-3">
            <div className="card card-pad">
              <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-3">
                Workspace card preview
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="inline-flex items-center justify-center rounded-xl font-semibold tracking-tight shrink-0"
                  style={{
                    width: 56,
                    height: 56,
                    background: form.avatarBg,
                    color: form.avatarFg,
                    fontSize: 20,
                  }}
                >
                  {monogram}
                </span>
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-ink truncate">
                    {form.legalName || 'New account'}
                  </div>
                  <div className="text-[11px] text-muted">{form.shortName}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-line2 text-[11px]">
                <SummaryStat label="Plan" value={form.plan} />
                <SummaryStat label="Region" value={form.region} />
                <SummaryStat label="Knockers" value={form.knockerCount.toString()} />
                <SummaryStat label="States" value={form.states.length.toString()} />
              </div>
            </div>

            <div className="card card-pad">
              <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-3">
                Activation timeline
              </div>
              <div className="space-y-2 text-[11px]">
                <TimelineRow day="Day 0" label="Workspace provisioned" status="now" />
                <TimelineRow day="Day 1–3" label="Bundle signed + TestFlight build" status="next" />
                <TimelineRow day="Day 3–14" label="State clearances submitted" status="next" />
                <TimelineRow day="Day 14" label="Live · campaigns can launch" status="next" />
              </div>
            </div>
          </div>
        </div>
      </Section>

      {activating ? (
        <Section title="Provisioning workspace…" subtitle="Live activity log">
          <div className="space-y-2 font-mono text-[11px]">
            {provisionLog.map((l, i) => (
              <div key={i} className="flex items-start gap-2">
                {i === provisionLog.length - 1 && provisionLog.length < 5 ? (
                  <Loader2 size={12} className="text-accent animate-spin mt-0.5" />
                ) : (
                  <Check size={12} className="text-success mt-0.5" />
                )}
                <span className="text-ink">{l}</span>
              </div>
            ))}
          </div>
        </Section>
      ) : (
        <div className="flex items-center justify-between">
          <Button variant="ghost" leftIcon={<ChevronLeft size={14} />} onClick={onBack}>
            Back
          </Button>
          <Button
            variant="primary"
            size="lg"
            leftIcon={<Sparkles size={14} />}
            onClick={onActivate}
          >
            Activate sub-account
          </Button>
        </div>
      )}
    </div>
  );
}

function ReviewBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="card card-pad">
      <div className="text-[11px] uppercase tracking-wider text-muted font-semibold mb-3">
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function ReviewRow({
  label,
  value,
  mono,
  capitalize,
}: {
  label: string;
  value: string;
  mono?: boolean;
  capitalize?: boolean;
}): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-3 text-[12px]">
      <span className="text-muted shrink-0">{label}</span>
      <span
        className={`text-ink text-right truncate max-w-[60%] ${mono ? 'numeric' : ''} ${capitalize ? 'capitalize' : ''}`}
      >
        {value || '—'}
      </span>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <div className="text-[9px] text-muted uppercase tracking-wider">{label}</div>
      <div className="text-[13px] font-semibold text-ink mt-0.5">{value}</div>
    </div>
  );
}

function TimelineRow({
  day,
  label,
  status,
}: {
  day: string;
  label: string;
  status: 'now' | 'next';
}): JSX.Element {
  return (
    <div className="flex items-start gap-2">
      <span
        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
          status === 'now' ? 'bg-accent ring-2 ring-accent/30' : 'bg-line2'
        }`}
      />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted">{day}</div>
        <div className="text-[12px] text-ink font-medium">{label}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Field helper
// ─────────────────────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  hint,
  icon,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-soft">{icon}</span>}
        <span className="text-[11px] uppercase tracking-wider text-muted font-medium">
          {label}
          {required && <span className="text-rose-600 ml-1">*</span>}
        </span>
      </div>
      {children}
      {hint && <div className="text-[10.5px] text-soft">{hint}</div>}
    </div>
  );
}
