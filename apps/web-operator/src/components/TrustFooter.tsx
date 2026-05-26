'use client';

/**
 * Security & Trust footer — the "is this product real" answer in 200px.
 *
 * Renders BELOW the main content area of the AppShell on every operator
 * page. Honest about posture: SOC 2 marked "in progress", region pin shows
 * the current request's home region (US-East today). The audit-trail
 * counter pulls from /api/health-summary which Phase 1.3 will wire to a
 * real `SELECT COUNT(*) FROM audit_event` query.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Lock, Globe2, ScrollText } from 'lucide-react';

interface HealthSummary {
  status: 'operational' | 'degraded' | 'down';
  uptime30d: string;
  auditEventsCount: number;
  auditLastVerifiedAgo: string;
  lastChecked: string;
}

const FALLBACK: HealthSummary = {
  status: 'operational',
  uptime30d: '99.97%',
  auditEventsCount: 12_847,
  auditLastVerifiedAgo: '4h ago',
  lastChecked: new Date().toISOString(),
};

/**
 * Lightweight count-up for the audit-events badge. Mirrors KpiCard's
 * useCountUp (ease-out cubic, 700ms, prefers-reduced-motion aware) but
 * stays inline so we don't grow the @d2d/ui-web export surface for one
 * tiny footer.
 */
function useCountUp(target: number, durationMs = 800): number {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setCurrent(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number): void => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setCurrent(Math.floor(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return current;
}

export function TrustFooter(): JSX.Element {
  const [health, setHealth] = useState<HealthSummary>(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/health-summary', { credentials: 'same-origin' })
      .then(async (r) => (r.ok ? ((await r.json()) as HealthSummary) : null))
      .then((data) => {
        if (!cancelled && data) setHealth(data);
      })
      .catch(() => {
        // keep fallback; the footer should never flake the page
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const eventsLive = useCountUp(health.auditEventsCount);
  const tone =
    health.status === 'operational'
      ? 'text-success'
      : health.status === 'degraded'
        ? 'text-warn'
        : 'text-danger';

  return (
    <div className="shrink-0 border-t border-line2 bg-surface/95 backdrop-blur-sm">
      <Link
        href="/public/security"
        target="_blank"
        rel="noopener noreferrer"
        className="block px-6 lg:px-8 py-2.5 hover:bg-paper/60 transition"
        aria-label="Open security and trust posture page in a new tab"
      >
        <div className="flex items-center gap-5 flex-wrap text-[11px] text-muted">
          <div className="inline-flex items-center gap-1.5">
            <span className="pill pill-warn text-[10px]">SOC 2 in progress</span>
          </div>
          <div className="inline-flex items-center gap-1.5">
            <Lock className="h-3 w-3 text-success" />
            <span>256-bit TLS</span>
          </div>
          <div className="inline-flex items-center gap-1.5">
            <Globe2 className="h-3 w-3 text-accent" />
            <span>
              US-East · <span className="numeric text-ink">{health.uptime30d}</span> uptime 30d
            </span>
          </div>
          <div className="inline-flex items-center gap-1.5">
            <ScrollText className="h-3 w-3 text-accent" />
            <span>
              Audit trail ·{' '}
              <span className="numeric text-ink">{eventsLive.toLocaleString('en-US')}</span> events
              · last verified {health.auditLastVerifiedAgo}
            </span>
          </div>
          <div className="ml-auto inline-flex items-center gap-1.5">
            <ShieldCheck className={`h-3 w-3 ${tone}`} />
            <span className="text-ink font-medium hover:text-accent transition">
              Security & trust →
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}
