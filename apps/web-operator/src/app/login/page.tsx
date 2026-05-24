'use client';

import { useState } from 'react';
import { Button, Card, Input } from '@d2d/ui-web';
import { Lock } from 'lucide-react';

export default function LoginPage(): JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    // Phase 1.1: POST /v1/auth/login → MFA challenge → /overview
    // For Phase 0 scaffold, just navigate.
    window.location.href = '/overview';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-[22px] font-semibold text-ink tracking-tight">Door 2 Digital</div>
          <div className="text-accent text-[11px] font-semibold tracking-[0.18em] mt-1">
            OPERATOR
          </div>
        </div>
        <Card>
          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftSlot={<Lock size={14} />}
              required
            />
            <Button type="submit" variant="primary" size="md" className="w-full">
              Sign in
            </Button>
            <p className="text-[11px] text-muted text-center pt-2">
              Phase 0 scaffold — auth lands Phase 1.1.
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
