'use client';

/**
 * Tiny "All systems operational" pill that lives at the bottom of the
 * sidebar in both PlatformShell + AccountShell. Pulses gentle green when
 * healthy. Clicking opens /public/status in a new tab — for an operator
 * who wonders "is something off, or is it just me?", that's the first
 * thing they want to check.
 *
 * Reads /api/health-summary which today returns hardcoded operational.
 * Phase 1.3 wires real probes; until then this is presentation-only +
 * the response shape is the contract.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';

type SystemStatus = 'operational' | 'degraded' | 'down';

interface HealthSummary {
  status: SystemStatus;
  uptime30d: string;
}

const FALLBACK: HealthSummary = { status: 'operational', uptime30d: '99.97%' };

const LABEL: Record<SystemStatus, string> = {
  operational: 'All systems operational',
  degraded: 'Some systems degraded',
  down: 'Outage in progress',
};

export function OperationalIndicator(): JSX.Element {
  const [health, setHealth] = useState<HealthSummary>(FALLBACK);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/health-summary', { credentials: 'same-origin' })
      .then(async (r) => (r.ok ? ((await r.json()) as HealthSummary) : null))
      .then((data) => {
        if (!cancelled && data) setHealth(data);
      })
      .catch(() => {
        // keep fallback
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dotColor =
    health.status === 'operational'
      ? 'bg-success text-success'
      : health.status === 'degraded'
        ? 'bg-warn text-warn'
        : 'bg-danger text-danger';

  return (
    <Link
      href="/public/status"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-2 py-1.5 -mx-1 rounded-md hover:bg-paper transition group"
      aria-label="Open public status page in a new tab"
    >
      <span
        className={`relative inline-block h-2 w-2 rounded-full ${dotColor.split(' ')[0]} d2d-status-pulse-halo`}
        style={{ color: 'currentColor' }}
      />
      <span className="text-[10.5px] font-medium text-ink2 group-hover:text-ink transition truncate">
        {LABEL[health.status]}
      </span>
    </Link>
  );
}
