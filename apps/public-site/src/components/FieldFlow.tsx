/*
 * FieldFlow — the macro story Brodie tells: market an area FIRST, then send the
 * field team into the warmed neighborhood, then everything flows into the
 * platform (call centre → retarget → convert → commission → data that trains
 * the next area). Three phases — Digital, Field, Platform — with real satellite
 * visuals and connecting arrows. Server component.
 */
import {
  Megaphone,
  DoorOpen,
  Headset,
  Target,
  CircleDollarSign,
  ArrowRight,
  ArrowDown,
  Check,
} from 'lucide-react';
import { SatMap } from '@/components/SatMap';

function PhaseCard({
  index,
  kicker,
  title,
  blurb,
  points,
  visual,
}: {
  index: string;
  kicker: string;
  title: string;
  blurb: string;
  points: string[];
  visual: React.ReactNode;
}): JSX.Element {
  return (
    <div className="card card-pad flex h-full flex-col">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink font-mono text-[11px] font-semibold text-surface">
          {index}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
          {kicker}
        </span>
      </div>
      <h3 className="mt-3 text-[18px] font-semibold tracking-tight text-ink">{title}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{blurb}</p>
      <div className="mt-4">{visual}</div>
      <ul className="mt-4 space-y-2">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accentSoft text-accent">
              <Check size={10} strokeWidth={3} />
            </span>
            <span className="text-[12px] leading-relaxed text-ink2">{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FieldFlow(): JSX.Element {
  return (
    <div className="grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
      {/* Phase 1 — Digital */}
      <PhaseCard
        index="1"
        kicker="Digital — warm the area"
        title="Market the neighborhood first"
        blurb="Before a single door is knocked, we geo-target the territory with ads — so the field team arrives to a warm, aware audience, not a cold street."
        points={[
          'Geo + lookalike audiences across Meta, Google, TikTok',
          'Brand-safe creative generated in the Marketing Studio',
          'See which blocks respond before deploying anyone',
        ]}
        visual={
          <SatMap
            area="scottsdale"
            radius
            aspect="aspect-[1.7/1]"
            label="Ad reach · NE-12"
            badge={
              <span className="inline-flex items-center gap-1 rounded-md bg-black/45 px-2 py-1 font-mono text-[9px] text-white/85 backdrop-blur-sm">
                <Megaphone size={10} /> warming
              </span>
            }
          />
        }
      />

      <FlowArrow />

      {/* Phase 2 — Field */}
      <PhaseCard
        index="2"
        kicker="Field — work the doors"
        title="Send the team in warm"
        blurb="The field team deploys into the warmed territory. Every doorstep is captured live on the app — GPS, signature, disposition — and tracked in the Command Centre."
        points={[
          'Knockers routed to the highest-propensity blocks',
          'Offline-first capture; live rep tracking on satellite',
          'Charity-signed authority + cleared-state gating at the door',
        ]}
        visual={
          <SatMap
            area="phoenix"
            territory
            route
            aspect="aspect-[1.7/1]"
            label="Live · Crew 4"
            pins={[
              { x: 30, y: 34, t: 'sale' },
              { x: 52, y: 26, t: 'lead' },
              { x: 68, y: 42, t: 'sale' },
              { x: 44, y: 54, t: 'idle' },
              { x: 24, y: 48, t: 'lead' },
            ]}
            badge={
              <span className="inline-flex items-center gap-1 rounded-md bg-black/45 px-2 py-1 font-mono text-[9px] text-white/85 backdrop-blur-sm">
                <DoorOpen size={10} /> 84 doors
              </span>
            }
          />
        }
      />

      <FlowArrow />

      {/* Phase 3 — Platform */}
      <PhaseCard
        index="3"
        kicker="Platform — close the loop"
        title="Everything flows into D2D"
        blurb="The doorstep becomes a record in the platform. Interested leads route to the call centre, the rest get retargeted, conversions pay commission — and the data trains the next area."
        points={[
          'Call centre closes with full doorstep context attached',
          'Knocked-not-converted return as a tagged retargeting lead',
          'Convert → commission → attribution feeds the next campaign',
        ]}
        visual={<PlatformStack />}
      />
    </div>
  );
}

function FlowArrow(): JSX.Element {
  return (
    <div className="flex items-center justify-center lg:px-1">
      <ArrowRight className="hidden text-soft lg:block" size={20} aria-hidden />
      <ArrowDown className="text-soft lg:hidden" size={18} aria-hidden />
    </div>
  );
}

/* A compact "flows into the platform" stack for phase 3's visual. */
function PlatformStack(): JSX.Element {
  const rows: { icon: React.ReactNode; t: string; s: string }[] = [
    { icon: <Headset size={14} />, t: 'Call centre', s: 'Inside sales · qualifies + closes' },
    { icon: <Target size={14} />, t: 'Retarget', s: 'Hashed audience · re-engage' },
    {
      icon: <CircleDollarSign size={14} />,
      t: 'Convert + commission',
      s: 'Donation | sale · rep paid',
    },
  ];
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-[#0B1220] p-3">
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.t}>
            <div className="flex items-center gap-2.5 rounded-lg border border-surface/10 bg-surface/[0.04] px-3 py-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-[#93C5FD]">
                {r.icon}
              </span>
              <div>
                <div className="text-[12px] font-semibold tracking-tight text-surface">{r.t}</div>
                <div className="font-mono text-[9px] text-surface/50">{r.s}</div>
              </div>
            </div>
            {i < rows.length - 1 ? (
              <div className="flex justify-center py-0.5">
                <ArrowDown size={12} className="text-surface/40" />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
