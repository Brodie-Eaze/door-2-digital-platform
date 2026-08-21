/*
 * CallCentreFlow — the exact handoff Brodie described: at the door the rep tags
 * the outcome (sale / lead / callback / not-home / refused / DNK); a lead flows
 * straight into the D2D pipeline with full doorstep context; and the call centre
 * gets a prioritised 7-day call queue so inside sales works it while it's warm.
 * Server component; light section.
 */
import { DoorOpen, ArrowRight, ArrowDown, GitBranch, Headset, Phone, Check } from 'lucide-react';

const DISPOSITIONS = ['Sale', 'Lead', 'Callback', 'Not home', 'Refused', 'DNK'] as const;

// 7-day inside-sales call queue seeded from door dispositions.
const WEEK: { day: string; date: string; today?: boolean; n: number; names: string[] }[] = [
  {
    day: 'Mon',
    date: 'May 25',
    today: true,
    n: 9,
    names: ['M. Okeke · donation', 'R. Castillo · solar'],
  },
  { day: 'Tue', date: 'May 26', n: 7, names: ['A. Bauer · recurring', 'T. Ahmed · survey'] },
  { day: 'Wed', date: 'May 27', n: 6, names: ['J. Park · pest', 'L. Moreau · energy'] },
  { day: 'Thu', date: 'May 28', n: 5, names: ['S. Patel · solar'] },
  { day: 'Fri', date: 'May 29', n: 6, names: ['D. Chen · donation', 'K. Adeyemi · alarm'] },
  { day: 'Sat', date: 'May 30', n: 4, names: ['N. Rivera · broadband'] },
  { day: 'Sun', date: 'May 31', n: 4, names: ['Follow-ups · warm only'] },
];

function StepCard({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="card card-pad flex h-full flex-col">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">{kicker}</div>
      <h3 className="mt-1.5 text-[16px] font-semibold tracking-tight text-ink">{title}</h3>
      <div className="mt-4 flex-1">{children}</div>
    </div>
  );
}

function Arrow(): JSX.Element {
  return (
    <div className="flex items-center justify-center lg:px-1">
      <ArrowRight className="hidden text-soft lg:block" size={20} aria-hidden />
      <ArrowDown className="text-soft lg:hidden" size={18} aria-hidden />
    </div>
  );
}

export function CallCentreFlow(): JSX.Element {
  const max = Math.max(...WEEK.map((w) => w.n));
  return (
    <div className="grid items-stretch gap-3 lg:grid-cols-[0.9fr_auto_0.9fr_auto_1.4fr]">
      {/* 1 — at the door */}
      <StepCard kicker="At the door" title="Tag the outcome">
        <div className="grid grid-cols-3 gap-1.5">
          {DISPOSITIONS.map((d, i) => (
            <span
              key={d}
              className={`rounded-md px-1 py-2 text-center text-[10px] font-medium ${
                i === 1 ? 'bg-accent text-surface' : 'border border-line bg-paper text-muted'
              }`}
            >
              {d}
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-line2 bg-paper px-2.5 py-2">
          <DoorOpen size={13} className="text-accent" />
          <span className="text-[11px] text-ink2">
            <span className="font-semibold text-ink">Lead</span> · 14 Carlisle Ave · 2:14pm
          </span>
        </div>
      </StepCard>

      <Arrow />

      {/* 2 — into the pipeline */}
      <StepCard kicker="Into the platform" title="Becomes a pipeline lead">
        <div className="rounded-lg border border-line bg-surface p-3">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold tracking-tight text-ink">M. Okeke</span>
            <span className="inline-flex items-center gap-1 rounded bg-accentSoft px-1.5 font-mono text-[9px] font-semibold text-accent">
              <GitBranch size={9} /> NEW
            </span>
          </div>
          <div className="mt-2 space-y-1.5 font-mono text-[10px] text-soft">
            <div className="flex items-center gap-1.5">
              <Check size={10} className="text-accent" /> Door context attached
            </div>
            <div className="flex items-center gap-1.5">
              <Check size={10} className="text-accent" /> Consent + GPS captured
            </div>
            <div className="flex items-center gap-1.5">
              <Check size={10} className="text-accent" /> Attribution: door · 15%
            </div>
          </div>
          <div className="mt-2.5 rounded bg-paper px-2 py-1.5 text-[10px] text-muted">
            Auto-routed to inside sales →{' '}
            <span className="font-medium text-ink2">call within 7 days</span>
          </div>
        </div>
      </StepCard>

      <Arrow />

      {/* 3 — call centre 7-day queue */}
      <StepCard kicker="Call centre" title="A prioritised 7-day call queue">
        <div className="space-y-1.5">
          {WEEK.map((w) => (
            <div
              key={w.day}
              className={`flex items-center gap-3 rounded-lg border px-2.5 py-1.5 ${
                w.today ? 'border-accentSoft bg-accentSoft/40' : 'border-line2 bg-surface'
              }`}
            >
              <div className="w-16 shrink-0">
                <div className="text-[11px] font-semibold tracking-tight text-ink">
                  {w.day}{' '}
                  {w.today ? <span className="font-mono text-[8px] text-accent">TODAY</span> : null}
                </div>
                <div className="font-mono text-[8px] text-soft">{w.date}</div>
              </div>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line2">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${(w.n / max) * 100}%` }}
                />
              </div>
              <span className="numeric w-6 shrink-0 text-right font-mono text-[11px] font-semibold text-ink2">
                {w.n}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2.5 flex items-center justify-between rounded-lg bg-ink px-3 py-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-surface">
            <Headset size={13} /> Inside sales · this week
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-surface/80">
            <Phone size={11} /> 41 to call
          </span>
        </div>
      </StepCard>
    </div>
  );
}
