'use client';

import { useState, type FormEvent } from 'react';
import { CheckCircle2, AlertCircle, ArrowRight, Mail, ShieldCheck, MapPinned } from 'lucide-react';
import { Button } from '@d2d/ui-web';
import { SiteContainer, Eyebrow } from '@/components/site';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

const VERTICALS = [
  { value: '', label: 'Select a vertical' },
  { value: 'charity', label: 'Charity fundraising' },
  { value: 'commercial', label: 'Commercial field sales' },
  { value: 'both', label: 'Both' },
  { value: 'other', label: 'Something else' },
];

export default function ContactPage(): JSX.Element {
  const [state, setState] = useState<FormState>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setState('submitting');
    setError(null);

    const form = e.currentTarget;
    const data = new FormData(form);
    const payload = {
      name: String(data.get('name') ?? '').trim(),
      email: String(data.get('email') ?? '').trim(),
      organization: String(data.get('organization') ?? '').trim(),
      vertical: String(data.get('vertical') ?? '').trim(),
      message: String(data.get('message') ?? '').trim(),
      // Honeypot — bots fill this, humans never see it.
      website: String(data.get('website') ?? '').trim(),
    };

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const problem = (await res.json().catch(() => null)) as { detail?: string } | null;
        setError(problem?.detail ?? 'Something went wrong. Please try again or email us directly.');
        setState('error');
        return;
      }

      form.reset();
      setState('success');
    } catch {
      setError('We couldn’t reach the server. Please try again or email us directly.');
      setState('error');
    }
  }

  return (
    <>
      {/* Hero */}
      <section className="bg-hero">
        <SiteContainer className="py-14 sm:py-16">
          <Eyebrow tone="surface">Request access</Eyebrow>
          <h1 className="mt-4 max-w-2xl text-[30px] font-semibold leading-[1.1] tracking-tight text-surface sm:text-[40px]">
            Bring us a territory. We&apos;ll walk the platform end to end.
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-surface/75">
            Tell us about your program — the vertical, the markets, the scale — and we&apos;ll show
            you how the loop runs against it. We onboard partners hands-on, so a real person reads
            every one of these.
          </p>
        </SiteContainer>
      </section>

      {/* Form + sidebar */}
      <section className="bg-paper py-14 sm:py-16">
        <SiteContainer>
          <div className="grid gap-10 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="card card-pad">
              {state === 'success' ? (
                <div className="flex flex-col items-start gap-4 py-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accentSoft text-accent">
                    <CheckCircle2 size={22} />
                  </span>
                  <div>
                    <h2 className="text-[18px] font-semibold tracking-tight text-ink">
                      Thanks — that came through.
                    </h2>
                    <p className="mt-2 max-w-md text-[14px] leading-relaxed text-muted">
                      We&apos;ve recorded your request and a member of the team will be in touch. If
                      it&apos;s urgent, email{' '}
                      <a
                        href="mailto:hello@door2digital.io"
                        className="font-medium text-accent hover:underline"
                      >
                        hello@door2digital.io
                      </a>
                      .
                    </p>
                  </div>
                  <Button variant="secondary" onClick={() => setState('idle')}>
                    Send another
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Your name" htmlFor="name">
                      <input
                        id="name"
                        name="name"
                        type="text"
                        required
                        autoComplete="name"
                        className={inputCls}
                        placeholder="Jordan Rivera"
                      />
                    </Field>
                    <Field label="Work email" htmlFor="email">
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        className={inputCls}
                        placeholder="jordan@organization.org"
                      />
                    </Field>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Organization" htmlFor="organization" optional>
                      <input
                        id="organization"
                        name="organization"
                        type="text"
                        autoComplete="organization"
                        className={inputCls}
                        placeholder="Your charity or company"
                      />
                    </Field>
                    <Field label="Vertical" htmlFor="vertical" optional>
                      <select id="vertical" name="vertical" className={inputCls} defaultValue="">
                        {VERTICALS.map((v) => (
                          <option key={v.value} value={v.value}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <Field label="What are you trying to do?" htmlFor="message">
                    <textarea
                      id="message"
                      name="message"
                      required
                      rows={5}
                      className={`${inputCls} resize-y`}
                      placeholder="Markets, scale, timeline, and what door-to-door looks like for you today."
                    />
                  </Field>

                  {/* Honeypot — visually hidden, off-screen, not announced */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden"
                  >
                    <label htmlFor="website">Leave this field empty</label>
                    <input
                      id="website"
                      name="website"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                    />
                  </div>

                  {state === 'error' && error ? (
                    <div className="flex items-start gap-2.5 rounded-lg border border-line bg-paper px-4 py-3 text-[13px] text-ink2">
                      <AlertCircle size={16} className="mt-0.5 shrink-0 text-accent" />
                      <span>{error}</span>
                    </div>
                  ) : null}

                  <div className="flex items-center gap-4 pt-1">
                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      loading={state === 'submitting'}
                      rightIcon={<ArrowRight size={16} />}
                    >
                      Request access
                    </Button>
                    <p className="text-[12px] text-soft">
                      We&apos;ll only use this to reply. No lists, no resale.
                    </p>
                  </div>
                </form>
              )}
            </div>

            <aside className="space-y-4">
              <SideCard icon={<Mail size={18} />} title="Prefer email?">
                Write to{' '}
                <a
                  href="mailto:hello@door2digital.io"
                  className="font-medium text-accent hover:underline"
                >
                  hello@door2digital.io
                </a>{' '}
                and we&apos;ll route it to the right person.
              </SideCard>
              <SideCard icon={<ShieldCheck size={18} />} title="Security disclosure">
                Found a vulnerability? See our{' '}
                <a
                  href="/.well-known/security.txt"
                  className="font-medium text-accent hover:underline"
                >
                  security.txt
                </a>{' '}
                for the disclosure channel.
              </SideCard>
              <SideCard icon={<MapPinned size={18} />} title="Data residency">
                Your data is pinned to your region — US, AU or SG — at org creation and never
                replicated across.
              </SideCard>
            </aside>
          </div>
        </SiteContainer>
      </section>
    </>
  );
}

const inputCls =
  'w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder:text-soft outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accentSoft';

function Field({
  label,
  htmlFor,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  optional?: boolean;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 flex items-center gap-2 text-[12px] font-medium text-ink2"
      >
        {label}
        {optional ? <span className="font-mono text-[10px] text-soft">optional</span> : null}
      </label>
      {children}
    </div>
  );
}

function SideCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="card card-pad">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accentSoft text-accent">
          {icon}
        </span>
        <h3 className="text-[14px] font-semibold tracking-tight text-ink">{title}</h3>
      </div>
      <p className="mt-2.5 text-[13px] leading-relaxed text-muted">{children}</p>
    </div>
  );
}
