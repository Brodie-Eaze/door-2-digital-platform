'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, ChevronLeft, ChevronRight, Check, CheckCircle2, Loader2 } from 'lucide-react';
import { PublicShell } from '@/components/PublicShell';

type Plan = 'trial' | 'growth' | 'enterprise';
type Step = 1 | 2 | 3;

interface FormState {
  fullName: string;
  workEmail: string;
  companyName: string;
  companySize: string;
  region: 'US' | 'AU' | 'SG';
  plan: Plan;
  intent: 'self_serve' | 'demo';
}

const PLAN_OPTIONS: { key: Plan; name: string; price: string; sub: string }[] = [
  { key: 'trial', name: 'Trial', price: 'Free · 14 days', sub: 'Up to 5 knockers, basic CRM' },
  {
    key: 'growth',
    name: 'Growth',
    price: '$1,500 / mo + 8% rake',
    sub: 'Up to 25 knockers, full CRM',
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: '$2,500 / mo + per-bucket rake',
    sub: 'Unlimited, multi-region',
  },
];

const COMPANY_SIZES = ['Just me', '2-10', '11-50', '51-200', '201+'];

function StepDot({
  step,
  current,
  label,
}: {
  step: Step;
  current: Step;
  label: string;
}): JSX.Element {
  const done = step < current;
  const active = step === current;
  return (
    <div className="flex items-center gap-3">
      <div
        className={
          done
            ? 'inline-flex items-center justify-center h-7 w-7 rounded-full bg-accent text-surface text-[12px] font-semibold'
            : active
              ? 'inline-flex items-center justify-center h-7 w-7 rounded-full bg-ink text-surface text-[12px] font-semibold'
              : 'inline-flex items-center justify-center h-7 w-7 rounded-full bg-line2 text-muted text-[12px] font-semibold'
        }
      >
        {done ? <Check className="h-3.5 w-3.5" /> : step}
      </div>
      <span
        className={
          active
            ? 'text-[13px] font-semibold text-ink hidden sm:inline'
            : done
              ? 'text-[13px] font-medium text-muted hidden sm:inline'
              : 'text-[13px] text-muted hidden sm:inline'
        }
      >
        {label}
      </span>
    </div>
  );
}

function SignupFlow(): JSX.Element {
  const router = useRouter();
  const search = useSearchParams();
  const initialPlan = (search.get('plan') as Plan) || 'trial';
  const initialIntent = (search.get('intent') as 'demo' | null) === 'demo' ? 'demo' : 'self_serve';

  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>({
    fullName: '',
    workEmail: '',
    companyName: '',
    companySize: '11-50',
    region: 'US',
    plan: ['trial', 'growth', 'enterprise'].includes(initialPlan) ? initialPlan : 'trial',
    intent: initialIntent,
  });

  function update<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function canAdvanceFrom(s: Step): boolean {
    if (s === 1) {
      return Boolean(
        form.fullName.trim() &&
        form.workEmail.trim() &&
        form.workEmail.includes('@') &&
        form.companyName.trim(),
      );
    }
    if (s === 2) {
      return Boolean(form.plan);
    }
    return true;
  }

  function next(): void {
    if (step === 1 && canAdvanceFrom(1)) setStep(2);
    else if (step === 2 && canAdvanceFrom(2)) setStep(3);
  }

  function back(): void {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  }

  function submit(): void {
    setSubmitting(true);
    // Simulate quick handoff then redirect to operator-grade onboarding wizard
    setTimeout(() => {
      router.push('/onboard-account');
    }, 1100);
  }

  return (
    <PublicShell activeNav="home">
      <div className="max-w-3xl mx-auto px-6 lg:px-10 py-14 lg:py-20">
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-semibold text-ink tracking-tight leading-tight">
            {form.intent === 'demo' ? 'Book a demo' : 'Start your free trial'}
          </h1>
          <p className="mt-3 text-[15px] text-muted max-w-xl leading-relaxed">
            {form.intent === 'demo'
              ? 'Three quick questions and a 30-minute demo on the calendar.'
              : 'Three steps. No credit card. You can switch to a paid plan from inside the console at any time.'}
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between mb-8 px-1">
          <StepDot step={1} current={step} label="Account info" />
          <div className="flex-1 h-px bg-line2 mx-3"></div>
          <StepDot step={2} current={step} label="Plan" />
          <div className="flex-1 h-px bg-line2 mx-3"></div>
          <StepDot step={3} current={step} label="Confirm" />
        </div>

        <div className="card card-pad p-8 lg:p-10">
          {/* STEP 1 — Account info */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-[18px] font-semibold text-ink tracking-tight">
                Tell us about you
              </h2>

              <div>
                <label className="text-[12px] uppercase tracking-[0.10em] text-muted font-medium block mb-1.5">
                  Full name
                </label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => update('fullName', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-md border border-line bg-surface text-[14px] text-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition"
                  placeholder="Brodie Mitchell"
                />
              </div>

              <div>
                <label className="text-[12px] uppercase tracking-[0.10em] text-muted font-medium block mb-1.5">
                  Work email
                </label>
                <input
                  type="email"
                  value={form.workEmail}
                  onChange={(e) => update('workEmail', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-md border border-line bg-surface text-[14px] text-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition"
                  placeholder="you@company.com"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] uppercase tracking-[0.10em] text-muted font-medium block mb-1.5">
                    Company name
                  </label>
                  <input
                    type="text"
                    value={form.companyName}
                    onChange={(e) => update('companyName', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-md border border-line bg-surface text-[14px] text-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition"
                    placeholder="Acme Field Ops"
                  />
                </div>
                <div>
                  <label className="text-[12px] uppercase tracking-[0.10em] text-muted font-medium block mb-1.5">
                    Company size
                  </label>
                  <select
                    value={form.companySize}
                    onChange={(e) => update('companySize', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-md border border-line bg-surface text-[14px] text-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition"
                  >
                    {COMPANY_SIZES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[12px] uppercase tracking-[0.10em] text-muted font-medium block mb-2">
                  Region
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['US', 'AU', 'SG'] as const).map((r) => {
                    const active = form.region === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => update('region', r)}
                        className={
                          active
                            ? 'px-4 py-3 rounded-md border-2 border-accent bg-accentSoft text-ink text-[13px] font-semibold transition'
                            : 'px-4 py-3 rounded-md border border-line bg-surface text-muted text-[13px] font-medium hover:border-line2 transition'
                        }
                      >
                        {r === 'US' ? 'United States' : r === 'AU' ? 'Australia' : 'Singapore'}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 — Plan */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-[18px] font-semibold text-ink tracking-tight">Pick a plan</h2>
              <p className="text-[13px] text-muted">You can change this later from your account.</p>

              <div className="space-y-3">
                {PLAN_OPTIONS.map((p) => {
                  const active = form.plan === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => update('plan', p.key)}
                      className={
                        active
                          ? 'w-full text-left flex items-center justify-between gap-4 px-5 py-4 rounded-lg border-2 border-accent bg-accentSoft/30 transition'
                          : 'w-full text-left flex items-center justify-between gap-4 px-5 py-4 rounded-lg border border-line bg-surface hover:border-line2 transition'
                      }
                    >
                      <div>
                        <div className="text-[15px] font-semibold text-ink tracking-tight">
                          {p.name}
                        </div>
                        <div className="text-[12.5px] text-muted mt-0.5">{p.sub}</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-[13px] font-medium text-ink text-right">{p.price}</div>
                        <div
                          className={
                            active
                              ? 'h-5 w-5 rounded-full bg-accent inline-flex items-center justify-center'
                              : 'h-5 w-5 rounded-full border border-line2'
                          }
                        >
                          {active && <Check className="h-3 w-3 text-surface" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <Link
                href="/public/pricing"
                className="inline-block text-[12.5px] text-accent hover:underline mt-2"
              >
                Compare plans in detail
              </Link>
            </div>
          )}

          {/* STEP 3 — Confirm */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-[18px] font-semibold text-ink tracking-tight">
                Confirm and continue
              </h2>
              <p className="text-[13px] text-muted">
                We&apos;ll provision your workspace and walk you through the operator-grade
                onboarding wizard next — branding, processors, knockers, territories.
              </p>

              <div className="card card-pad p-5 bg-paper border border-line2">
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-[13.5px]">
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.10em] text-muted font-medium">
                      Name
                    </dt>
                    <dd className="text-ink mt-0.5">{form.fullName || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.10em] text-muted font-medium">
                      Work email
                    </dt>
                    <dd className="text-ink mt-0.5">{form.workEmail || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.10em] text-muted font-medium">
                      Company
                    </dt>
                    <dd className="text-ink mt-0.5">{form.companyName || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.10em] text-muted font-medium">
                      Size
                    </dt>
                    <dd className="text-ink mt-0.5">{form.companySize}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.10em] text-muted font-medium">
                      Region
                    </dt>
                    <dd className="text-ink mt-0.5">{form.region}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.10em] text-muted font-medium">
                      Plan
                    </dt>
                    <dd className="text-ink mt-0.5 capitalize">{form.plan}</dd>
                  </div>
                </dl>
              </div>

              <ul className="space-y-2 text-[13px] text-muted">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" /> No credit card
                  required for Trial
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" /> Data resides in
                  your selected region
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" /> You can invite
                  teammates after the wizard
                </li>
              </ul>

              <p className="text-[11.5px] text-muted">
                By continuing you agree to our{' '}
                <Link href="/public/security" className="underline hover:text-ink">
                  terms
                </Link>{' '}
                and{' '}
                <Link href="/public/security" className="underline hover:text-ink">
                  privacy policy
                </Link>
                .
              </p>
            </div>
          )}

          {/* Footer nav */}
          <div className="mt-8 pt-6 border-t border-line2 flex items-center justify-between">
            <button
              type="button"
              onClick={back}
              disabled={step === 1}
              className={
                step === 1
                  ? 'inline-flex items-center gap-1.5 text-[13px] text-soft font-medium px-4 py-2 rounded-md cursor-not-allowed'
                  : 'inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink font-medium px-4 py-2 rounded-md transition'
              }
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Back
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={next}
                disabled={!canAdvanceFrom(step)}
                className={
                  canAdvanceFrom(step)
                    ? 'inline-flex items-center gap-1.5 bg-ink text-surface text-[13.5px] font-semibold px-5 py-2.5 rounded-md hover:bg-ink2 transition'
                    : 'inline-flex items-center gap-1.5 bg-line2 text-soft text-[13.5px] font-semibold px-5 py-2.5 rounded-md cursor-not-allowed'
                }
              >
                Continue <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className={
                  submitting
                    ? 'inline-flex items-center gap-2 bg-ink2 text-surface text-[13.5px] font-semibold px-5 py-2.5 rounded-md cursor-wait'
                    : 'inline-flex items-center gap-2 bg-ink text-surface text-[13.5px] font-semibold px-5 py-2.5 rounded-md hover:bg-ink2 transition'
                }
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Provisioning
                  </>
                ) : (
                  <>
                    {form.intent === 'demo' ? 'Submit & schedule' : 'Start trial'}{' '}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-[12.5px] text-muted">
          Already have an account?{' '}
          <Link href="/login" className="text-accent hover:underline font-medium">
            Log in
          </Link>
        </p>
      </div>
    </PublicShell>
  );
}

function SignupFallback(): JSX.Element {
  return (
    <PublicShell activeNav="home">
      <div className="max-w-3xl mx-auto px-6 lg:px-10 py-14 lg:py-20">
        <div className="card card-pad p-10 flex items-center justify-center text-muted text-[14px] gap-3">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading sign-up flow
        </div>
      </div>
    </PublicShell>
  );
}

export default function PublicSignupPage(): JSX.Element {
  return (
    <Suspense fallback={<SignupFallback />}>
      <SignupFlow />
    </Suspense>
  );
}
