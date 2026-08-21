'use client';

/**
 * Sign-in surface for the Door 2 Digital Command Centre.
 *
 * Behaviour:
 *   - POST /proxy/api/auth/login when NEXT_PUBLIC_API_URL is set and the
 *     API responds. Cookies (d2d_at + d2d_rt) come back set by the API.
 *   - Synthetic fallback: POST /api/session/demo (a same-origin Next route
 *     handler that issues a SHAPE-VALID d2d_at cookie with signature
 *     "demo"). This keeps the deployed demo working without an API.
 *
 * The demo-account chips below the form auto-fill + submit so Brodie can
 * one-click into any of the 5 seeded sessions.
 */
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Input } from '@d2d/ui-web';
import { ShieldCheck, ArrowRight } from 'lucide-react';

interface DemoUser {
  email: string;
  password: string;
  label: string;
  sub: string;
  initials: string;
  swatch: string; // hex for the avatar background
}

const DEMO_USERS: DemoUser[] = [
  {
    email: 'brodie@door2digital.com',
    password: 'D2D-Demo-2026!',
    label: 'Brodie',
    sub: 'super_admin · platform',
    initials: 'BR',
    swatch: '#0F172A',
  },
  {
    email: 'manager@hope-forward.com',
    password: 'Hope-Demo-2026!',
    label: 'Hope Forward',
    sub: 'org_admin · US charity',
    initials: 'HF',
    swatch: '#1E40AF',
  },
  {
    email: 'manager@world-vision.org.au',
    password: 'WV-Demo-2026!',
    label: 'World Vision',
    sub: 'org_admin · AU charity',
    initials: 'WV',
    swatch: '#1E293B',
  },
  {
    email: 'manager@pestmax.com',
    password: 'Pest-Demo-2026!',
    label: 'PestMax',
    sub: 'org_admin · US commercial',
    initials: 'PE',
    swatch: '#475569',
  },
  {
    email: 'manager@goldcoasthospital.org.au',
    password: 'GCH-Demo-2026!',
    label: 'Gold Coast Hospital',
    sub: 'org_admin · AU healthcare',
    initials: 'GC',
    swatch: '#3B82F6',
  },
];

export default function LoginPage(): JSX.Element {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner(): JSX.Element {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') ?? '/accounts';
  // Only same-origin paths are honoured. Anything else (absolute URLs,
  // protocol-relative //evil.com, backslash tricks, /login loops) falls back
  // to /accounts — closes the open-redirect vector on ?next=.
  const safeNext = useMemo(() => {
    if (!next.startsWith('/')) return '/accounts';
    if (next.startsWith('//') || next.startsWith('/\\')) return '/accounts';
    if (next.startsWith('/login')) return '/accounts';
    return next;
  }, [next]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [forgotToast, setForgotToast] = useState(false);

  // Mode is a BUILD-TIME fact, not a runtime probe. When NEXT_PUBLIC_API_URL
  // is baked into the bundle a real API is wired: real auth only, no demo
  // fallback ever (F-010 — the old /_status probe broke when hardening made
  // that endpoint auth-required: 401 -> probe "failed" -> demo 404 -> the
  // login form showed "Not Found" against a perfectly healthy API).
  const realApiWired = Boolean(process.env.NEXT_PUBLIC_API_URL);
  useEffect(() => {
    if (realApiWired) {
      setDemoMode(false);
      return;
    }
    let cancelled = false;
    fetch('/proxy/api/auth/_status', { method: 'GET' })
      .then((r) => {
        if (cancelled) return;
        setDemoMode(!r.ok);
      })
      .catch(() => {
        if (!cancelled) setDemoMode(true);
      });
    return () => {
      cancelled = true;
    };
  }, [realApiWired]);

  const submit = useCallback(
    async (overrideEmail?: string, overridePassword?: string): Promise<void> => {
      const e = overrideEmail ?? email;
      const p = overridePassword ?? password;
      if (!e || !p) {
        setError('Enter your email + password');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        // Try the real API first via /proxy/api/auth/login (same-origin
        // rewrite to NEXT_PUBLIC_API_URL or http://localhost:3010 by default).
        // If the proxy errors at the gateway level, fall back to the
        // synthetic-demo cookie issuer so prod stays demo-able without API.
        let res: Response;
        let usedDemo = false;
        if (demoMode) {
          res = await fetch('/api/session/demo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: e, password: p }),
          });
          usedDemo = true;
        } else {
          try {
            res = await fetch('/proxy/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: e, password: p }),
              credentials: 'include',
            });
          } catch (networkErr) {
            if (realApiWired) throw networkErr;
            // Network-level failure (proxy target unreachable) — try demo path.
            res = await fetch('/api/session/demo', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: e, password: p }),
            });
            usedDemo = true;
            setDemoMode(true);
          }
          if (
            !realApiWired &&
            !usedDemo &&
            (res.status === 404 || res.status === 405 || res.status >= 500)
          ) {
            // Proxy reached but API is missing/misbehaving — fall back to
            // synthetic-demo so LOCAL demo builds stay usable. Never when a
            // real API is wired: surface the real error instead.
            res = await fetch('/api/session/demo', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: e, password: p }),
            });
            setDemoMode(true);
          }
        }
        if (!res.ok) {
          let detail = 'Invalid email or password';
          try {
            const problem = (await res.json()) as { detail?: string; title?: string };
            detail = problem.detail ?? problem.title ?? detail;
          } catch {
            // ignore
          }
          throw new Error(detail);
        }
        router.push(safeNext);
        // refresh forces server components to re-read the cookie.
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Login failed');
      } finally {
        setLoading(false);
      }
    },
    [email, password, router, safeNext],
  );

  function signInAs(u: DemoUser): void {
    setEmail(u.email);
    setPassword(u.password);
    void submit(u.email, u.password);
  }

  return (
    <div className="min-h-screen flex bg-paper text-ink">
      {/* ─── LEFT — brand panel ─── */}
      <aside className="hidden lg:flex w-[46%] xl:w-[44%] bg-ink text-surface flex-col justify-center px-14 py-16 relative overflow-hidden">
        {/* Depth gradient */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 20% 40%, rgba(59,130,246,0.22) 0%, transparent 55%), radial-gradient(ellipse at 85% 90%, rgba(30,64,175,0.18) 0%, transparent 50%)',
          }}
        />
        {/* Dot-grid texture */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Logo — absolute top-left, never affects vertical centering */}
        <div className="absolute top-14 left-14 flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'rgba(59,130,246,0.18)',
              border: '1px solid rgba(59,130,246,0.28)',
            }}
          >
            <span className="text-accent text-[12px] font-bold tracking-tight">D2</span>
          </div>
          <div>
            <span className="text-[17px] font-semibold tracking-tight leading-tight">
              Door 2 Digital
            </span>
            <span className="ml-2 text-accent text-[9px] font-semibold tracking-[0.2em]">OS</span>
          </div>
        </div>

        {/* Hero + stats — centered in panel, slight downward bias */}
        <div className="relative mt-10">
          <h1 className="text-[42px] leading-[1.04] font-semibold tracking-tight mb-5">
            The OS for
            <br />
            door-to-door.
          </h1>
          <p className="text-[13.5px] leading-[1.75] text-surface/50 max-w-[340px] mb-12">
            Field capture → CRM → conversion attribution → AI retargeting → compliance — one
            operator surface, fully audited.
          </p>

          {/* Capability strip — true-source law: no fabricated figures on a
              login page (real numbers live behind auth). Capabilities only. */}
          <div className="flex items-start gap-10">
            {[
              { v: 'Field', l: 'capture' },
              { v: 'CRM', l: 'pipeline' },
              { v: 'Audited', l: 'end to end' },
            ].map((m, i) => (
              <div key={m.l} className="flex items-start gap-10">
                {i > 0 && <div className="w-px h-9 bg-surface/10 self-start mt-0.5 -ml-10" />}
                <div>
                  <div className="text-[28px] font-semibold tracking-tight leading-none">{m.v}</div>
                  <div className="text-[10px] uppercase tracking-wider text-surface/40 mt-2">
                    {m.l}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ─── RIGHT — form panel ─── */}
      <main className="flex-1 flex items-center justify-center px-10 sm:px-16 py-12 relative">
        {/* Subtle background wash */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 65% 5%, rgba(59,130,246,0.06) 0%, transparent 48%)',
          }}
        />

        <div className="relative w-full max-w-[400px] pb-12">
          {/* Mobile brand strip */}
          <div className="lg:hidden mb-10 flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: '#0F172A' }}
            >
              <span className="text-accent text-[10px] font-bold">D2</span>
            </div>
            <div className="text-[18px] font-semibold text-ink tracking-tight">Door 2 Digital</div>
          </div>

          {/* Heading */}
          <h2 className="text-[28px] font-semibold tracking-tight text-ink mb-1.5">Sign in</h2>
          <p className="text-[13px] text-muted mb-8">Continue to the D2D Command Centre.</p>

          {/* Form */}
          <form
            onSubmit={(ev) => {
              ev.preventDefault();
              void submit();
            }}
            className="space-y-4"
          >
            {/* Email */}
            <div>
              <label
                htmlFor="email-field"
                className="block text-[12.5px] font-medium text-ink mb-2"
              >
                Email
              </label>
              <Input
                id="email-field"
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                placeholder="brodie@door2digital.com"
                className="h-11"
                required
              />
            </div>

            {/* Password — Forgot? inline with label */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password-field" className="text-[12.5px] font-medium text-ink">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotToast(true);
                    setTimeout(() => setForgotToast(false), 2400);
                  }}
                  className="text-[11.5px] text-muted hover:text-ink transition-colors"
                >
                  Forgot?
                </button>
              </div>
              <Input
                id="password-field"
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                className="h-11"
                required
              />
            </div>

            {forgotToast && (
              <p className="text-[11.5px] text-muted">
                Password reset ships in Phase 1.2 — use a demo account below.
              </p>
            )}

            {error && (
              <div
                className="text-[12px] text-ink px-3.5 py-3 rounded-lg"
                style={{
                  background: 'rgba(15,23,42,0.04)',
                  border: '1px solid rgba(15,23,42,0.1)',
                  borderLeft: '2px solid #0F172A',
                }}
              >
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full h-11"
              disabled={loading}
            >
              {loading ? (
                'Signing in…'
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Sign in <ArrowRight size={15} />
                </span>
              )}
            </Button>
          </form>

          {/* ── Demo accounts — Quick switch (never rendered when a real
              API is wired: the synthetic-demo route hard-404s there, so the
              panel would advertise logins that cannot work) ── */}
          {realApiWired ? null : (
            <div className="mt-8 pt-7" style={{ borderTop: '1px solid rgba(15,23,42,0.07)' }}>
              <div className="flex items-center justify-between mb-3.5">
                <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-soft/60">
                  Quick switch · demo
                </span>
                <span className="text-[10px] text-soft/40">password preserved</span>
              </div>

              <div className="space-y-2">
                {/* First user (super_admin) — full-width dark tile */}
                {DEMO_USERS.slice(0, 1).map((u) => (
                  <button
                    key={u.email}
                    type="button"
                    onClick={() => signInAs(u)}
                    disabled={loading}
                    className="w-full px-4 py-3.5 rounded-xl text-left disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                    style={{ background: '#0F172A' }}
                  >
                    <div className="text-[13.5px] font-semibold text-surface leading-tight">
                      {u.label}
                    </div>
                    <div
                      className="text-[11px] mt-0.5 leading-tight font-normal"
                      style={{ color: 'rgba(248,250,252,0.45)' }}
                    >
                      {u.sub}
                    </div>
                  </button>
                ))}

                {/* Remaining users — 2-column grid */}
                <div className="grid grid-cols-2 gap-2">
                  {DEMO_USERS.slice(1).map((u) => (
                    <button
                      key={u.email}
                      type="button"
                      onClick={() => signInAs(u)}
                      disabled={loading}
                      className="px-3.5 py-3 rounded-xl text-left disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid rgba(15,23,42,0.11)',
                        boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor =
                          'rgba(15,23,42,0.22)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor =
                          'rgba(15,23,42,0.11)';
                      }}
                    >
                      <div className="text-[12.5px] font-semibold text-ink truncate leading-tight">
                        {u.label}
                      </div>
                      <div className="text-[10.5px] text-muted mt-0.5 leading-tight truncate font-normal">
                        {u.sub}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-2 mt-6 text-[10.5px] text-soft">
            <ShieldCheck size={11} className="text-soft/60" />
            <span>httpOnly cookie · {process.env.NEXT_PUBLIC_ENV ?? 'local'}</span>
          </div>
        </div>
      </main>
    </div>
  );
}
