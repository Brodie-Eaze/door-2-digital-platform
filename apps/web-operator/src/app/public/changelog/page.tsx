import Link from 'next/link';
import { Rss, GitCommit, Sparkles, Shield, ArrowUpRight, Zap } from 'lucide-react';
import { PublicShell } from '@/components/PublicShell';

export const metadata = {
  title: 'Changelog — Door 2 Digital',
  description: "What's new in Door 2 Digital — feature drops, security work, perf.",
};

type Severity = 'feature' | 'improvement' | 'security' | 'breaking';

interface ChangelogEntry {
  /** ISO date the change shipped. */
  date: string;
  /** Short headline. */
  title: string;
  /** One-line user-facing description. */
  description: string;
  severity: Severity;
  /** Optional commit SHA for the deep-link. */
  sha?: string;
}

/**
 * Curated user-facing change notes pulled from real git history.
 * Each entry maps 1:1 to a commit; descriptions are written from the
 * operator's POV ("you can now...") rather than dev-speak ("refactored
 * the foo to use bar").
 *
 * Phase 1.4: replace this hardcoded array with a generator that reads
 * `git log --no-merges --since=...` + a curated severity-tag map (likely
 * a comment trailer convention `Changelog-severity: feature`). Until
 * then this list is the source of truth — keep it ≤ 15 entries and
 * promote the most recent 4-5 into "What's new this month".
 */
const ENTRIES: ChangelogEntry[] = [
  {
    date: '2026-05-27',
    title: 'Motion system landed',
    description:
      'First 5 seconds of every screen now do something — sidebar slide-in, KPI count-up, route loader, sub-account accent stripe. Decorative, not gratuitous; everything respects prefers-reduced-motion.',
    severity: 'feature',
    sha: 'a4c76f3',
  },
  {
    date: '2026-05-26',
    title: '7 audit findings closed',
    description:
      'Tightened input validation in the lead inbox, hardened the demo-fallback rate limits, and removed a stray verbose log. Bounded findings from the SECURITY-REVIEW.md sweep now zero.',
    severity: 'security',
    sha: '8b3e210',
  },
  {
    date: '2026-05-26',
    title: 'Per-account accent stripe + KPI count-up',
    description:
      'Each sub-account now paints a 2-pixel accent stripe in its brand colour across the top of every screen — Hope Forward red, World Vision blue, PestMax green. KPI numbers ease-in instead of popping. Tiny moves, big "this feels alive" hit.',
    severity: 'improvement',
    sha: 'd1391ee',
  },
  {
    date: '2026-05-26',
    title: 'Three demo journeys wired to the real database',
    description:
      'The /accounts list, the lead inbox, and the onboarding wizard now hit Postgres instead of fixtures. You can create a new business and it sticks.',
    severity: 'feature',
    sha: '49f2e5d',
  },
  {
    date: '2026-05-26',
    title: 'Login: proxy 404/405/5xx fallback',
    description:
      'When the backend is mid-deploy or unreachable, the demo-user login path now gracefully falls back so the operator console never strands you at a blank login screen.',
    severity: 'improvement',
    sha: '8ef6153',
  },
  {
    date: '2026-05-26',
    title: 'Auth wall: real /login + cookie session + middleware',
    description:
      'Replaced the placeholder login with a real cookie-session-backed auth wall. Seeded demo users for instant exploration; the rest of the operator console now gates every route through middleware.',
    severity: 'feature',
    sha: 'cdfeee9',
  },
  {
    date: '2026-05-25',
    title: 'Per-account Marketing Studio',
    description:
      'Each sub-account now gets its own vertically-scoped Marketing Studio — charity-safe creatives for World Vision, commercial pest creatives for PestMax, religious creatives for Hope Forward. Brand safety lives per region.',
    severity: 'feature',
    sha: 'b2939b0',
  },
  {
    date: '2026-05-25',
    title: 'Per-account propensity heatmap',
    description:
      'Territory Intel renders a real Leaflet propensity heatmap scoped to each sub-account — see the streets that convert before you assign a knocker.',
    severity: 'feature',
    sha: '99aa46c',
  },
  {
    date: '2026-05-25',
    title: 'Planning surface goes live',
    description:
      'Every interaction on the Planning page now writes back to the real planning store — territory assignment, shift planning, capacity model. Per-account scoping throughout.',
    severity: 'feature',
    sha: '4d77bec',
  },
  {
    date: '2026-05-25',
    title: 'Per-account live field map',
    description:
      'Live AI zones, anomaly detection, activity feed, and push-to-field — all scoped per sub-account. Watch your team in real time per business unit.',
    severity: 'feature',
    sha: '768a2bb',
  },
];

const SEVERITY_META: Record<Severity, { label: string; tone: string; icon: typeof Sparkles }> = {
  feature: { label: 'Feature', tone: 'pill pill-info', icon: Sparkles },
  improvement: { label: 'Improvement', tone: 'pill pill-success', icon: Zap },
  security: { label: 'Security', tone: 'pill pill-warn', icon: Shield },
  breaking: { label: 'Breaking', tone: 'pill pill-danger', icon: ArrowUpRight },
};

function SeverityPill({ severity }: { severity: Severity }): JSX.Element {
  const meta = SEVERITY_META[severity];
  const Icon = meta.icon;
  return (
    <span className={meta.tone}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

function formatMonth(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function formatDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function PublicChangelogPage(): JSX.Element {
  // "What's new this month" = the top 4-5 entries (most recent).
  const recent = ENTRIES.slice(0, 5);
  const older = ENTRIES.slice(5);

  // Group older entries by month for the accordion.
  const olderByMonth = older.reduce<Record<string, ChangelogEntry[]>>((acc, e) => {
    const k = formatMonth(e.date);
    const bucket = acc[k] ?? [];
    bucket.push(e);
    acc[k] = bucket;
    return acc;
  }, {});

  return (
    <PublicShell activeNav="home">
      {/* HERO */}
      <section className="border-b border-line2 bg-gradient-to-b from-surface to-paper">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16 lg:py-20">
          <div className="max-w-3xl flex items-start justify-between gap-6 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accentSoft text-accent text-[11px] uppercase tracking-[0.12em] font-medium mb-6">
                <GitCommit className="h-3 w-3" />
                Changelog
              </div>
              <h1 className="text-4xl sm:text-5xl font-semibold text-ink tracking-tight leading-[1.05]">
                What&apos;s shipping.
              </h1>
              <p className="mt-5 text-lg text-muted max-w-2xl leading-relaxed">
                Every meaningful change — feature drops, security work, perf. Pulled from real
                commits; the descriptions are written for operators, not engineers.
              </p>
            </div>
            <a
              href="https://d2d-production-1fab.up.railway.app/changelog.rss"
              className="inline-flex items-center gap-2 text-[13px] font-medium text-ink px-4 py-2 rounded-md border border-line bg-surface hover:bg-paper transition"
            >
              <Rss className="h-3.5 w-3.5" />
              RSS feed
            </a>
            {/* Phase 1.4: the RSS endpoint above is generated by a small */}
            {/* serverless feed-builder that reads this changelog list and  */}
            {/* outputs an Atom/RSS file. Returns 404 today — that's       */}
            {/* expected; the link is here so it's discoverable.            */}
          </div>
        </div>
      </section>

      {/* WHAT'S NEW THIS MONTH */}
      <section className="max-w-5xl mx-auto px-6 lg:px-10 py-12 lg:py-16">
        <div className="mb-8">
          <h2 className="text-[11px] uppercase tracking-[0.12em] text-muted font-medium mb-3">
            What&apos;s new
          </h2>
          <h3 className="text-2xl font-semibold text-ink tracking-tight">
            {formatMonth(recent[0]?.date ?? new Date().toISOString().slice(0, 10))}
          </h3>
        </div>

        <div className="space-y-4">
          {recent.map((e) => (
            <article
              key={`${e.date}-${e.sha ?? e.title}`}
              className="card card-pad p-7 flex flex-col gap-3"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[12px] text-muted font-mono">{formatDay(e.date)}</span>
                <SeverityPill severity={e.severity} />
                {e.sha && (
                  <code className="text-[10.5px] text-muted bg-line2/70 px-1.5 py-0.5 rounded font-mono">
                    {e.sha.slice(0, 7)}
                  </code>
                )}
              </div>
              <h4 className="text-[17px] font-semibold text-ink tracking-tight">{e.title}</h4>
              <p className="text-[13.5px] text-muted leading-relaxed">{e.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* FULL HISTORY */}
      {Object.keys(olderByMonth).length > 0 && (
        <section className="max-w-5xl mx-auto px-6 lg:px-10 py-12">
          <div className="mb-6">
            <h2 className="text-[11px] uppercase tracking-[0.12em] text-muted font-medium mb-3">
              Earlier
            </h2>
            <h3 className="text-2xl font-semibold text-ink tracking-tight">Full history</h3>
          </div>
          <div className="space-y-4">
            {Object.entries(olderByMonth).map(([month, entries]) => (
              <details key={month} className="card card-pad p-0 overflow-hidden group">
                <summary className="px-7 py-5 cursor-pointer flex items-center justify-between hover:bg-paper/50 transition list-none">
                  <span className="text-[15px] font-semibold text-ink tracking-tight">{month}</span>
                  <span className="text-[12px] text-muted">
                    {entries.length} {entries.length === 1 ? 'change' : 'changes'}
                  </span>
                </summary>
                <div className="border-t border-line2 divide-y divide-line2">
                  {entries.map((e) => (
                    <div key={`${e.date}-${e.sha ?? e.title}`} className="px-7 py-5">
                      <div className="flex items-center gap-3 flex-wrap mb-2">
                        <span className="text-[12px] text-muted font-mono">
                          {formatDay(e.date)}
                        </span>
                        <SeverityPill severity={e.severity} />
                        {e.sha && (
                          <code className="text-[10.5px] text-muted bg-line2/70 px-1.5 py-0.5 rounded font-mono">
                            {e.sha.slice(0, 7)}
                          </code>
                        )}
                      </div>
                      <h4 className="text-[15px] font-semibold text-ink tracking-tight mb-1">
                        {e.title}
                      </h4>
                      <p className="text-[13px] text-muted leading-relaxed">{e.description}</p>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* FOOTER */}
      <section className="border-t border-line2 bg-paper">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-muted">
            <span>
              Want to know what we&apos;re building next?{' '}
              <Link href="/public/product" className="text-ink hover:text-accent transition">
                See the product roadmap
              </Link>
            </span>
            <Link href="/public/status" className="text-ink hover:text-accent transition">
              Status →
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
