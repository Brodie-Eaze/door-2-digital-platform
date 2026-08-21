'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { Button, Card, Input } from '@d2d/ui-web';

interface ProblemDetails {
  title?: unknown;
  detail?: unknown;
}

/**
 * Invite redemption — the missing end of the credential chain. An org admin or
 * knocker receives a one-time invite link (minted at onboarding or from the
 * Team screen), lands here, sets a password, and is signed in. The token is
 * verified server-side by POST /v1/users/accept-invite (single-use, expiring,
 * SHA-256 at rest); we then log in with the fresh credentials.
 */
function AcceptInviteForm(): JSX.Element {
  const router = useRouter();
  const params = useSearchParams();
  const [token, setToken] = useState(params.get('token') ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/proxy/api/users/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteToken: token.trim(), password }),
      });
      if (!res.ok) {
        let detail = 'Invite token invalid or expired';
        try {
          const problem = (await res.json()) as ProblemDetails;
          const apiDetail = typeof problem.detail === 'string' ? problem.detail : null;
          detail = apiDetail ?? detail;
        } catch {
          // keep default
        }
        setError(detail);
        return;
      }
      // Account is active — sign straight in with the new credentials.
      const login = await fetch('/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });
      if (!login.ok) {
        // Account was activated but auto-login failed (e.g. email typo) —
        // send them to the login page rather than stranding them.
        router.push('/login');
        return;
      }
      router.push('/today');
      router.refresh();
    } catch {
      setError('Network error — check your connection and retry');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-[17px] font-semibold text-ink">Activate your account</div>
          <div className="text-[11px] tracking-[0.14em] uppercase text-accent mt-1">
            Set your password
          </div>
        </div>
        <Card className="p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="space-y-4"
          >
            {!params.get('token') && (
              <Input
                label="Invite token"
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
              />
            )}
            <Input
              label="Your email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <Input
              label="New password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            <Input
              label="Confirm password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
            {error && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-900">
                {error}
              </div>
            )}
            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
              {loading ? 'Activating…' : 'Activate & sign in'}
            </Button>
          </form>
          <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted">
            <ShieldCheck size={12} />
            <span>Single-use invite · expires 7 days after issue</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function AcceptInvitePage(): JSX.Element {
  return (
    <Suspense>
      <AcceptInviteForm />
    </Suspense>
  );
}
