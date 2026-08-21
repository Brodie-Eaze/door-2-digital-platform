'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { Button, Card, Input } from '@d2d/ui-web';

interface ProblemDetails {
  title?: unknown;
  detail?: unknown;
}

export default function LoginPage(): JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      if (!response.ok) {
        let detail = 'Invalid email or password';
        try {
          const problem = (await response.json()) as ProblemDetails;
          const apiDetail = typeof problem.detail === 'string' ? problem.detail : null;
          const apiTitle = typeof problem.title === 'string' ? problem.title : null;
          detail = apiDetail ?? apiTitle ?? detail;
        } catch {
          // Keep the generic auth failure.
        }
        setError(detail);
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-[22px] font-semibold text-ink tracking-tight">
            D2D Partner Portal
          </div>
          <div className="text-accent text-[11px] font-semibold tracking-[0.18em] mt-1">
            BILLING · COMPLIANCE · PERFORMANCE
          </div>
        </div>
        <Card>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="space-y-4"
          >
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            {error && (
              <div className="text-[12px] text-ink px-3 py-2 rounded-lg bg-paper border border-line2">
                {error}
              </div>
            )}
            <Button type="submit" variant="primary" size="md" className="w-full" loading={loading}>
              Sign in with email
            </Button>
            <div className="flex items-center gap-2 my-3">
              <div className="flex-1 h-px bg-line2" />
              <span className="text-[10px] text-soft uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-line2" />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="w-full"
              leftIcon={<ShieldCheck size={14} />}
              disabled
            >
              Sign in with SSO
            </Button>
            <p className="text-[11px] text-muted text-center pt-2">
              powered by Door 2 Digital · SOC 2 Type I in progress
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
