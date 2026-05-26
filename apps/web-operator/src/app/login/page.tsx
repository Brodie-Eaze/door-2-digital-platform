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
import { Button, Card, Input } from '@d2d/ui-web';
import { Lock, Mail, ShieldCheck, ArrowRight } from 'lucide-react';

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
  // If next is itself /login (or starts with /login), redirect to /accounts after success.
  const safeNext = useMemo(() => (next.startsWith('/login') ? '/accounts' : next), [next]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [forgotToast, setForgotToast] = useState(false);

  // Detect demo mode on mount by probing the proxy. If the proxy can reach
  // /v1/auth/_status, real auth flows are wired. If not (404/5xx/network),
  // we surface the demo-mode badge and route through /api/session/demo.
  useEffect(() => {
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
  }, []);

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
            // Network-level failure (proxy target unreachable) — try demo path.
            res = await fetch('/api/session/demo', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: e, password: p }),
            });
            usedDemo = true;
            setDemoMode(true);
          }
          if (!usedDemo && (res.status === 404 || res.status === 405 || res.status >= 500)) {
            // Proxy reached but API is missing/misbehaving — fall back to
            // synthetic-demo so prod stays demo-able.
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
      {/* LEFT — brand panel */}
      <aside className="hidden lg:flex w-[44%] xl:w-2/5 bg-ink text-surface p-12 flex-col justify-between relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            background:
              'radial-gradient(circle at 20% 30%, rgba(59,130,246,0.35) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(30,64,175,0.3) 0%, transparent 55%)',
          }}
        />
        <div className="relative">
          <div className="text-[26px] font-semibold tracking-tight">Door 2 Digital</div>
          <div className="text-accent text-[10.5px] font-semibold tracking-[0.22em] mt-1.5">
            OPERATOR · COMMAND CENTRE
          </div>
        </div>
        <div className="relative space-y-6">
          <h1 className="text-[34px] leading-[1.1] font-semibold tracking-tight">
            Sign in to your
            <br />
            command centre
          </h1>
          <p className="text-[13px] leading-[1.65] text-surface/70 max-w-md">
            One operator surface across every sub-account — Hope Forward, World Vision, PestMax,
            Gold Coast Hospital. Real-time field ops, conversions, compliance, and Marketing Studio.
          </p>
          <div className="grid grid-cols-3 gap-3 max-w-md pt-2">
            {[
              { v: '4', l: 'Accounts' },
              { v: '420+', l: 'Knockers' },
              { v: '8.4K', l: 'MTD conv.' },
            ].map((m) => (
              <div key={m.l}>
                <div className="text-[20px] font-semibold">{m.v}</div>
                <div className="text-[10px] uppercase tracking-wider text-surface/55 mt-0.5">
                  {m.l}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-[11px] text-surface/50 flex items-center gap-2">
          <ShieldCheck size={12} className="text-accent" />
          httpOnly · sameSite=lax · 5-min access · 30-day refresh
        </div>
      </aside>

      {/* RIGHT — form + demo accounts */}
      <main className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[420px]">
          {/* Mobile brand strip */}
          <div className="lg:hidden mb-8 text-center">
            <div className="text-[22px] font-semibold text-ink tracking-tight">Door 2 Digital</div>
            <div className="text-accent text-[10.5px] font-semibold tracking-[0.22em] mt-1">
              OPERATOR
            </div>
          </div>

          <Card>
            <div className="space-y-1 mb-5">
              <div className="text-[18px] font-semibold tracking-tight">Welcome back</div>
              <div className="text-[12px] text-muted leading-tight">
                Use your email + password or click a demo account below.
              </div>
            </div>

            <form
              onSubmit={(ev) => {
                ev.preventDefault();
                void submit();
              }}
              className="space-y-3.5"
            >
              <Input
                label="Email"
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                leftSlot={<Mail size={14} />}
                placeholder="brodie@door2digital.com"
                required
              />
              <Input
                label="Password"
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                leftSlot={<Lock size={14} />}
                required
              />
              {error && (
                <div className="text-[12px] text-rose-700 bg-rose-50 border border-rose-100 rounded-md px-3 py-2">
                  {error}
                </div>
              )}
              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setForgotToast(true);
                    setTimeout(() => setForgotToast(false), 2400);
                  }}
                  className="text-[11px] text-muted hover:text-ink transition"
                >
                  Forgot password?
                </button>
                {demoMode && (
                  <span className="text-[10px] uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 font-semibold">
                    Demo mode
                  </span>
                )}
              </div>
              {forgotToast && (
                <div className="text-[11px] text-muted text-center pt-1">
                  Password reset ships in Phase 1.2 — pick a demo account below.
                </div>
              )}
            </form>
          </Card>

          {/* DEMO ACCOUNTS */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2.5 px-0.5">
              <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted">
                Demo accounts
              </div>
              <div className="text-[10.5px] text-soft">Click to sign in</div>
            </div>
            <div className="space-y-2">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.email}
                  type="button"
                  onClick={() => signInAs(u)}
                  disabled={loading}
                  className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-line2 bg-surface hover:border-ink hover:shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed text-left"
                >
                  <span
                    className="inline-flex items-center justify-center w-9 h-9 rounded-md text-surface text-[11px] font-semibold tracking-tight shrink-0"
                    style={{ background: u.swatch }}
                  >
                    {u.initials}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-medium text-ink truncate">
                      Sign in as {u.label}
                    </span>
                    <span className="block text-[11px] text-muted truncate">{u.sub}</span>
                  </span>
                  <ArrowRight
                    size={14}
                    className="text-soft group-hover:text-ink group-hover:translate-x-0.5 transition"
                  />
                </button>
              ))}
            </div>
          </div>

          <p className="text-[10.5px] text-soft text-center mt-6">
            v0.5.0 · {process.env.NEXT_PUBLIC_ENV ?? 'local'} · auth by httpOnly cookie
          </p>
        </div>
      </main>
    </div>
  );
}
