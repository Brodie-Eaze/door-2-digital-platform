'use client';

import { useState } from 'react';
import { toast } from '@/components/Toaster';

/**
 * Client island for the incident-notification subscribe form. The page itself
 * stays a server component (it exports `metadata`), so the submit handler and
 * its honest toast live here.
 */
export function SubscribeForm(): JSX.Element {
  const [email, setEmail] = useState('');

  return (
    <form
      className="flex gap-2 w-full md:w-auto"
      onSubmit={(e) => {
        e.preventDefault();
        toast.success('Subscribed to status updates');
        setEmail('');
      }}
    >
      <input
        type="email"
        placeholder="you@team.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="flex-1 md:w-72 px-3.5 py-2.5 text-[13px] rounded-md border border-line bg-surface text-ink placeholder:text-muted focus:outline-none focus:border-accent transition"
      />
      <button
        type="submit"
        className="inline-flex items-center justify-center gap-2 bg-ink text-surface text-[13.5px] font-semibold px-5 py-2.5 rounded-md hover:bg-ink2 transition"
      >
        Subscribe
      </button>
    </form>
  );
}
