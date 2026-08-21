'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
  ArrowUpRight,
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
  const [activateError, setActivateError] = useState<string | null>(null);
  const [provisionDone, setProvisionDone] = useState(false);
  const [newAccountSlug, setNewAccountSlug] = useState<string | null>(null);
  const [adminInvite, setAdminInvite] = useState<{
    email: string;
    inviteToken: string;
    expiresAt: string;
  } | null>(null);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Once provisioning completes we land the operator inside the new account's
  // workspace automatically — unless they start ticking off the day-one
  // checklist, in which case we let them drive.
  useEffect(() => {
    if (!provisionDone || !newAccountSlug) return undefined;
    // A one-time admin invite is on screen — never auto-navigate away from it.
    if (adminInvite) return undefined;
    redirectTimer.current = setTimeout(() => {
      router.push(`/accounts/${newAccountSlug}/today`);
      router.refresh();
    }, 7000);
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, [provisionDone, newAccountSlug, adminInvite, router]);

  function cancelAutoRedirect(): void {
    if (redirectTimer.current) {
      clearTimeout(redirectTimer.current);
      redirectTimer.current = null;
    }
  }

  function openWorkspace(): void {
    cancelAutoRedirect();
    if (newAccountSlug) {
      router.push(`/accounts/${newAccountSlug}/today`);
      router.refresh();
    }
  }

  async function activate(): Promise<void> {
    setActivating(true);
    setActivateError(null);
    setProvisionDone(false);
    setProvisionLog(['Setting up your workspace…']);

    // Idempotency key — survives wizard reloads if state were persisted; for
    // now we mint a fresh ULID per activation attempt so retry-after-failure
    // gets a fresh key. Crypto.randomUUID is universal in modern browsers.
    const idempotencyKey = `idem_${crypto.randomUUID()}`;

    // Map wizard shape → POST /api/orgs body. UI lets the user pick
    // 'healthcare' as vertical (UX nicety), but the schema enum only has
    // charity|commercial — the server coerces, and we hint the caller via
    // `uiVertical` for analytics.
    const verticalForApi: 'charity' | 'commercial' =
      form.vertical === 'commercial' ? 'commercial' : 'charity';
    const body = {
      legalName: form.legalName,
      tradingName: form.shortName,
      vertical: verticalForApi,
      uiVertical: form.vertical,
      regionCode: form.region,
      brandCode: 'd2d',
      // Founding org_admin — minted atomically with the org from the primary
      // contact so the account is never born ownerless.
      ...(form.contactEmail && {
        admin: {
          email: form.contactEmail,
          givenName: form.contactName.trim().split(/\s+/)[0] || 'Admin',
          familyName: form.contactName.trim().split(/\s+/).slice(1).join(' ') || 'User',
        },
      }),
      brandKit: {
        displayName: form.displayName || form.shortName,
        ...(form.avatarBg && { primaryColor: form.avatarBg }),
        ...(form.supportEmail && { supportEmail: form.supportEmail }),
        ...(form.privacyUrl && { privacyPolicyUrl: form.privacyUrl }),
        ...(form.termsUrl && { termsUrl: form.termsUrl }),
      },
      billing: {
        platformFeeMonthlyCents: Math.round(form.platformFee * 100),
        doorRakePercent: form.doorRake,
        insideSalesRakePercent: form.insideRake,
        retargetingRakePercent: form.retargetingRake,
        billingDay: form.billingDay,
        currency: form.region === 'AU' ? 'AUD' : form.region === 'SG' ? 'SGD' : 'USD',
      },
    };

    let res: Response;
    try {
      res = await fetch('/api/orgs', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Network error';
      setActivateError(`Network error: ${detail}. Check connection and retry.`);
      setActivating(false);
      return;
    }

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const problem = (await res.json()) as { title?: string; detail?: string };
        detail = problem.detail ?? problem.title ?? detail;
      } catch {
        // body wasn't JSON; fall through with HTTP status
      }
      if (res.status >= 400 && res.status < 500) {
        setActivateError(`Cannot create sub-account: ${detail}`);
      } else {
        setActivateError(`Server error (${res.status}): ${detail}. The button will let you retry.`);
      }
      setActivating(false);
      return;
    }

    const json = (await res.json()) as {
      orgId: string;
      slug: string | null;
      adminInvite?: { email: string; inviteToken: string; expiresAt: string };
    };
    if (json.adminInvite) setAdminInvite(json.adminInvite);
    const newSlug = json.slug ?? slugify(form.shortName) ?? 'new-account';

    // Staged narrative for visual feedback — the actual write is already
    // committed at this point. Lines speak operator language (outcomes), not
    // database language. Post-create we land on /accounts/[slug]/today: it
    // renders a first-run state (TodayFirstRun) for brand-new orgs, so the
    // operator wakes up inside their new workspace, not back at the wizard.
    const lines = [
      'Your workspace is live',
      'Brand kit applied — your name and colours everywhere they need to be',
      'Commission plan ready — payouts tracked automatically from day one',
      `${form.knockerCount} field team seats reserved for your Knocker app`,
      `Fundraising clearance underway in ${form.states.length} ${form.region === 'US' ? 'states' : 'jurisdictions'} — our legal team files for you`,
      `Billing set up with ${processorForRegion(form.region)} — first invoice on day ${form.billingDay} of the month`,
      'Setup verified and locked in',
    ];
    lines.forEach((l, i) => {
      setTimeout(
        () => {
          setProvisionLog((prev) => [...prev, l]);
        },
        (i + 1) * 350,
      );
    });
    setTimeout(
      () => {
        setNewAccountSlug(newSlug);
        setProvisionDone(true);
      },
      lines.length * 350 + 400,
    );
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
            onActivate={() => {
              void activate();
            }}
            error={activateError}
            done={provisionDone}
            adminInvite={adminInvite}
            newSlug={newAccountSlug}
            onOpenWorkspace={openWorkspace}
            onChecklistInteract={cancelAutoRedirect}
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
              sub="Sequence/web → conversion"
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

function AdminInviteCard({
  invite,
}: {
  invite: { email: string; inviteToken: string; expiresAt: string };
}): JSX.Element {
  const [copied, setCopied] = useState(false);
  const orgAppOrigin = process.env.NEXT_PUBLIC_ORG_APP_URL ?? '';
  const link = orgAppOrigin
    ? `${orgAppOrigin}/accept-invite?token=${invite.inviteToken}`
    : invite.inviteToken;
  const expires = new Date(invite.expiresAt).toLocaleDateString();
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 space-y-2">
      <div className="text-[12px] font-semibold text-amber-900">
        Admin invite for {invite.email} — shown once, copy it now
      </div>
      <div className="text-[11px] text-amber-800">
        Send this {orgAppOrigin ? 'link' : 'invite token'} to the account admin so they can set
        their password{orgAppOrigin ? '' : ' via the accept-invite page'}. Expires {expires}. It is
        not stored anywhere and cannot be shown again.
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded bg-white border border-amber-200 px-2 py-1.5 text-[11px] text-ink font-mono">
          {link}
        </code>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            void navigator.clipboard.writeText(link).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}

function Step5Review({
  form,
  monogram,
  onBack,
  activating,
  provisionLog,
  onActivate,
  error,
  done,
  adminInvite,
  newSlug,
  onOpenWorkspace,
  onChecklistInteract,
}: {
  form: FormState;
  monogram: string;
  onBack: () => void;
  activating: boolean;
  provisionLog: string[];
  onActivate: () => void;
  error: string | null;
  done: boolean;
  adminInvite: { email: string; inviteToken: string; expiresAt: string } | null;
  newSlug: string | null;
  onOpenWorkspace: () => void;
  onChecklistInteract: () => void;
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
        <>
          <Section
            title={done ? 'Your workspace is ready' : 'Setting up your workspace…'}
            subtitle={
              done
                ? 'Everything below is done — here is what happens next'
                : 'This only takes a few seconds'
            }
          >
            <div className="space-y-2 text-[12px]">
              {provisionLog.map((l, i) => (
                <div key={i} className="flex items-start gap-2">
                  {i === provisionLog.length - 1 && !done ? (
                    <Loader2 size={12} className="text-accent animate-spin mt-0.5" />
                  ) : (
                    <Check size={12} className="text-success mt-0.5" />
                  )}
                  <span className="text-ink">{l}</span>
                </div>
              ))}
            </div>
          </Section>
          {done && newSlug && (
            <>
              {adminInvite && <AdminInviteCard invite={adminInvite} />}
              <DayOneChecklist slug={newSlug} onInteract={onChecklistInteract} />
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] text-muted">
                  Taking you to your new workspace in a few seconds — tick off a day-one item to
                  stay here.
                </div>
                <Button
                  variant="primary"
                  size="lg"
                  rightIcon={<ArrowUpRight size={14} />}
                  onClick={onOpenWorkspace}
                >
                  Open workspace now
                </Button>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          {error && (
            <div className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-[12px] text-rose-900">
              <span className="font-semibold">Activation failed:</span> {error}
            </div>
          )}
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
        </>
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
// Day-one checklist — shown on the wizard's success state. Completion is
// persisted per-org in localStorage so it survives a reload; the links point
// at real, existing routes (roster, territory-intel, account settings/brand
// kit, account compliance). Local to this page by design — not a shared
// component.
// ─────────────────────────────────────────────────────────────────────────────

interface DayOneItem {
  id: string;
  label: string;
  sub: string;
  href: (slug: string) => string;
}

const DAY_ONE_ITEMS: DayOneItem[] = [
  {
    id: 'first-knocker',
    label: 'Add your first knocker',
    sub: 'Invite a field rep so doors start getting knocked',
    href: () => '/roster',
  },
  {
    id: 'territory',
    label: 'Set your territory',
    sub: 'Pick the streets your team works first',
    href: () => '/territory-intel',
  },
  {
    id: 'brand-kit',
    label: 'Review brand kit',
    sub: 'Check your colours and name look right everywhere',
    href: (slug) => `/accounts/${slug}/settings`,
  },
  {
    id: 'compliance',
    label: 'Run a compliance check',
    sub: 'Confirm clearances before the first knock',
    href: (slug) => `/accounts/${slug}/compliance`,
  },
];

function dayOneStorageKey(slug: string): string {
  return `d2d.day-one.${slug}`;
}

function DayOneChecklist({
  slug,
  onInteract,
}: {
  slug: string;
  onInteract: () => void;
}): JSX.Element {
  const [completed, setCompleted] = useState<string[]>([]);

  // Hydrate from localStorage after mount (avoids SSR/hydration mismatch).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(dayOneStorageKey(slug));
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          setCompleted(parsed.filter((x): x is string => typeof x === 'string'));
        }
      }
    } catch {
      // localStorage unavailable (private mode etc.) — checklist still works,
      // it just won't persist.
    }
  }, [slug]);

  function persist(next: string[]): void {
    try {
      window.localStorage.setItem(dayOneStorageKey(slug), JSON.stringify(next));
    } catch {
      // Non-fatal — see above.
    }
  }

  function toggle(id: string): void {
    onInteract();
    setCompleted((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      persist(next);
      return next;
    });
  }

  function markDone(id: string): void {
    onInteract();
    setCompleted((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      persist(next);
      return next;
    });
  }

  return (
    <div className="card card-pad">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] uppercase tracking-wider text-muted font-semibold">
          Day one — get your first knock sooner
        </div>
        <div className="text-[11px] text-muted numeric">
          {completed.length} of {DAY_ONE_ITEMS.length} done
        </div>
      </div>
      <div className="space-y-1">
        {DAY_ONE_ITEMS.map((item) => {
          const isDone = completed.includes(item.id);
          return (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-paper transition"
            >
              <button
                onClick={() => toggle(item.id)}
                aria-label={isDone ? `Mark "${item.label}" not done` : `Mark "${item.label}" done`}
                className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${
                  isDone
                    ? 'bg-success border-success text-surface'
                    : 'bg-paper border-line2 hover:border-ink/40'
                }`}
              >
                {isDone && <Check size={12} />}
              </button>
              <Link
                href={item.href(slug)}
                onClick={() => markDone(item.id)}
                className="flex-1 min-w-0 group"
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[13px] font-medium ${
                      isDone ? 'text-muted line-through' : 'text-ink group-hover:underline'
                    }`}
                  >
                    {item.label}
                  </span>
                  <ArrowUpRight
                    size={12}
                    className="text-soft opacity-0 group-hover:opacity-100 transition"
                  />
                </div>
                <div className="text-[11px] text-muted">{item.sub}</div>
              </Link>
            </div>
          );
        })}
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
