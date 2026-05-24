'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button, Card, Input } from '@d2d/ui-web';

export default function LoginPage(): JSX.Element {
  const [email, setEmail] = useState('sarah@hopeforward.org');
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-[22px] font-semibold text-ink tracking-tight">Hope Forward</div>
          <div className="text-accent text-[11px] font-semibold tracking-[0.18em] mt-1">
            FIELD OPS
          </div>
        </div>
        <Card>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              window.location.href = '/today';
            }}
            className="space-y-4"
          >
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" variant="primary" size="md" className="w-full">
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
              onClick={() => (window.location.href = '/today')}
            >
              Sign in with Okta SSO
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
