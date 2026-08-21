/*
 * ModuleMocks — a library of compact, on-brand product surfaces rendered in
 * pure HTML/SVG/CSS (no Leaflet, no screenshots, no client hooks). Each mock is
 * a faithful miniature of a real D2D surface a customer org receives, used by
 * the Platform tour and the home product showcase. Server-component safe; the
 * only motion is CSS classes from marketing.css (reduced-motion aware).
 *
 * All numbers are internally consistent with the attribution model the rest of
 * the site describes (door 15% / inside-sales 10% / retargeting 5%).
 */
import type { ReactNode } from 'react';
import {
  DoorOpen,
  Phone,
  Mail,
  CalendarCheck,
  CircleCheck,
  ShieldCheck,
  PhoneCall,
  Pause,
  SkipForward,
  TrendingUp,
  Users,
  Hash,
  Lock,
  Wallet,
  Image as ImageIcon,
  Building2,
  HeartHandshake,
} from 'lucide-react';
import { SatMap } from '@/components/SatMap';

/** macOS-style browser window chrome. */
export function Frame({ path, children }: { path: string; children: ReactNode }): JSX.Element {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_0_rgba(15,23,42,0.04),0_40px_80px_-44px_rgba(15,23,42,0.30)]">
      <div className="flex items-center gap-2 border-b border-line2 bg-paper px-4 py-2.5">
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
        </span>
        <span className="ml-2 truncate font-mono text-[11px] text-soft">{path}</span>
      </div>
      <div className="bg-paper p-4 sm:p-5">{children}</div>
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}): JSX.Element {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2.5">
      <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-soft">
        <span className="text-accent">{icon}</span>
        {label}
      </div>
      <div className="numeric mt-1 font-mono text-[17px] font-semibold tracking-tight text-ink">
        {value}
      </div>
    </div>
  );
}

/* ───────────────────────── Command Centre ───────────────────────── */
export function CommandCentreMock(): JSX.Element {
  return (
    <div className="grid gap-3 lg:grid-cols-[1.55fr_1fr]">
      <SatMap
        area="mesa"
        territory
        label="Live field · 7 crews active"
        aspect="aspect-[1.6/1]"
        pins={[
          { x: 24, y: 32, t: 'sale' },
          { x: 50, y: 22, t: 'lead' },
          { x: 70, y: 40, t: 'sale' },
          { x: 38, y: 56, t: 'idle' },
          { x: 62, y: 64, t: 'lead' },
          { x: 84, y: 30, t: 'idle' },
          { x: 18, y: 60, t: 'lead' },
        ]}
      />
      <div className="flex flex-col gap-2.5">
        <div className="grid grid-cols-2 gap-2.5">
          <Tile icon={<DoorOpen size={12} />} label="Knocks today" value="2,841" />
          <Tile icon={<TrendingUp size={12} />} label="Conv. rate" value="11.2%" />
        </div>
        <div className="rounded-lg border border-line bg-surface p-3">
          <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-soft">
            Roster · on shift
          </div>
          <div className="mt-2 space-y-1.5">
            {[
              ['Crew 4 · NE-12', 'live', '84'],
              ['Crew 2 · S-07', 'live', '61'],
              ['D. Rivera', 'break', '40'],
            ].map((r) => (
              <div key={r[0]} className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 text-ink2">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${r[1] === 'live' ? 'bg-accent mk-blink' : 'bg-soft'}`}
                  />
                  {r[0]}
                </span>
                <span className="numeric font-mono text-[10px] text-soft">{r[2]} doors</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-accentSoft bg-accentSoft/40 p-2.5">
          <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-accent">
            Anomaly
          </div>
          <div className="mt-0.5 text-[11px] leading-snug text-ink2">
            NE-12 conversion 2.4× site median — push 2 crews next shift.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Territory heatmap ───────────────────────── */
export function TerritoryMock(): JSX.Element {
  const cells = Array.from({ length: 48 }, (_, i) => {
    const v = (Math.sin(i * 1.7) + Math.cos(i * 0.9) + 2) / 4; // deterministic 0..1
    return v;
  });
  return (
    <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
      <div className="relative overflow-hidden rounded-xl border border-line bg-[#0B1220] p-2">
        <div className="grid grid-cols-8 gap-1">
          {cells.map((v, i) => (
            <div
              key={i}
              className="aspect-square rounded-sm"
              style={{ background: `rgba(59,130,246,${(0.12 + v * 0.6).toFixed(2)})` }}
            />
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between font-mono text-[8px] uppercase tracking-[0.12em] text-surface/45">
          <span>Propensity · ACS + SEIFA</span>
          <span className="flex items-center gap-1">
            low
            <span
              className="h-2 w-12 rounded-full"
              style={{
                background: 'linear-gradient(90deg,rgba(59,130,246,0.12),rgba(59,130,246,0.85))',
              }}
            />
            high
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        <div className="rounded-lg border border-line bg-surface p-3">
          <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-soft">
            Draw tools
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {['Polygon', 'Snap-to-street', 'Split', 'Assign crew'].map((t) => (
              <span
                key={t}
                className="rounded-md border border-line bg-paper px-2 py-1 font-mono text-[10px] text-muted"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-line bg-surface p-3 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-muted">Territory NE-12</span>
            <span className="numeric font-mono text-ink2">1,420 doors</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-muted">Median income</span>
            <span className="numeric font-mono text-ink2">$84,200</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-muted">Predicted conv.</span>
            <span className="numeric font-mono text-accent">12.8%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Inside-sales dialer ───────────────────────── */
export function DialerMock(): JSX.Element {
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accentSoft font-mono text-[13px] font-semibold text-accent">
            RC
          </span>
          <div>
            <div className="text-[13px] font-semibold tracking-tight text-ink">R. Castillo</div>
            <div className="font-mono text-[10px] text-soft">solar · door lead · NE-12</div>
          </div>
        </div>
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-accentSoft px-2 py-1 font-mono text-[11px] text-accent">
          <PhoneCall size={11} /> 02:14 · connected
        </div>
        <div className="mt-3 flex gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-surface">
            <Pause size={13} />
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted">
            <SkipForward size={13} />
          </span>
          <span className="flex flex-1 items-center justify-center rounded-lg border border-line text-[11px] font-medium text-muted">
            Log + disposition
          </span>
        </div>
      </div>
      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-soft">
          Pitch script · solar
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-ink2">
          &ldquo;Hi Ricardo — following up on the visit to Carlisle Ave. You flagged interest in the
          6.6kW system…&rdquo;
        </p>
        <div className="mt-3 border-t border-line2 pt-2.5">
          <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-soft">
            Queue · 14 waiting
          </div>
          <div className="mt-1.5 space-y-1 text-[11px] text-muted">
            <div className="flex justify-between">
              <span>A. Bauer · recurring gift</span>
              <span className="font-mono text-[10px] text-accent">88</span>
            </div>
            <div className="flex justify-between">
              <span>T. Ahmed · install survey</span>
              <span className="font-mono text-[10px] text-soft">76</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Lead journey ───────────────────────── */
export function LeadJourneyMock(): JSX.Element {
  const steps: { icon: ReactNode; t: string; s: string; tag: string }[] = [
    {
      icon: <DoorOpen size={13} />,
      t: 'Knocked — interested',
      s: 'Crew 4 · 14 Carlisle Ave · GPS + signature',
      tag: 'DOOR',
    },
    {
      icon: <Phone size={13} />,
      t: 'Inside-sales call',
      s: '2m14s · qualified · callback booked',
      tag: 'CRM',
    },
    {
      icon: <Mail size={13} />,
      t: 'Sequence step 2',
      s: 'Donation impact email · opened',
      tag: 'CRM',
    },
    {
      icon: <CalendarCheck size={13} />,
      t: 'Appointment set',
      s: 'Install survey · Thu 2pm',
      tag: 'IS',
    },
    {
      icon: <CircleCheck size={13} />,
      t: 'Converted — recurring',
      s: '$40/mo · receipt issued · door attribution',
      tag: 'WON',
    },
  ];
  return (
    <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex items-center justify-between border-b border-line2 pb-3">
        <div className="text-[13px] font-semibold tracking-tight text-ink">
          M. Okeke · lead timeline
        </div>
        <span className="rounded bg-accentSoft px-1.5 font-mono text-[10px] font-semibold text-accent">
          CONVERTED
        </span>
      </div>
      <ol className="mt-3 space-y-3">
        {steps.map((st, i) => (
          <li key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accentSoft text-accent">
                {st.icon}
              </span>
              {i < steps.length - 1 ? <span className="mt-1 w-px flex-1 bg-line" /> : null}
            </div>
            <div className="pb-1">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold tracking-tight text-ink">{st.t}</span>
                <span className="rounded bg-line2 px-1 font-mono text-[8px] font-semibold tracking-[0.08em] text-soft">
                  {st.tag}
                </span>
              </div>
              <div className="font-mono text-[10px] text-soft">{st.s}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ───────────────────────── Marketing Studio ───────────────────────── */
export function MarketingMock(): JSX.Element {
  return (
    <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-soft">
          AI creative · solar · variant matrix
        </div>
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          {[
            '1509391366360-2e959784a276',
            '1532629345422-7515f3d16bb6',
            '1560518883-ce09059eeffa',
            '1473341304170-971dccb5ac1e',
            '1593113598332-cd288d649433',
            '1570129477492-45c003edd2be',
          ].map((id, i) => (
            <div key={id} className="overflow-hidden rounded-lg border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://images.unsplash.com/photo-${id}?w=240&q=60&auto=format&fit=crop`}
                alt="ad creative"
                loading="lazy"
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="px-1.5 py-1 font-mono text-[8px] text-soft">
                v{i + 1} · {i % 2 ? 'C2PA' : 'safe'}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        <div className="rounded-lg border border-line bg-surface p-3">
          <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-soft">
            Retargeting audience
          </div>
          <div className="numeric mt-1 font-mono text-[16px] font-semibold text-ink">
            1,204 <span className="text-[11px] font-normal text-soft">matched</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {['Meta', 'Google', 'TikTok'].map((p) => (
              <span key={p} className="rounded bg-line2 px-1.5 font-mono text-[9px] text-muted">
                {p}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-line bg-surface p-3 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-muted">ROAS · 30d</span>
            <span className="numeric font-mono text-accent">4.1×</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-muted">Knock→retarget→won</span>
            <span className="numeric font-mono text-ink2">31</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-muted">Brand-safety holds</span>
            <span className="numeric font-mono text-ink2">2</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Conversions ───────────────────────── */
export function ConversionsMock(): JSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[
        {
          icon: <HeartHandshake size={15} />,
          h: 'Donation — recurring',
          rows: [
            ['Donor', 'J. Park'],
            ['Amount', '$40 / mo'],
            ['Receipt', '501(c)(3) · issued'],
            ['Attribution', 'door · 15%'],
          ],
        },
        {
          icon: <Building2 size={15} />,
          h: 'Sale — commercial',
          rows: [
            ['Product', 'Solar 6.6kW'],
            ['Amount', '$8,400'],
            ['Install', 'scheduled Thu'],
            ['Attribution', 'inside-sales · 10%'],
          ],
        },
      ].map((c) => (
        <div key={c.h} className="rounded-xl border border-line bg-surface p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accentSoft text-accent">
              {c.icon}
            </span>
            <span className="text-[13px] font-semibold tracking-tight text-ink">{c.h}</span>
          </div>
          <dl className="mt-3 space-y-1.5">
            {c.rows.map((r) => (
              <div key={r[0]} className="flex items-center justify-between text-[11px]">
                <dt className="text-muted">{r[0]}</dt>
                <dd className="numeric font-mono text-ink2">{r[1]}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────── Commissions ───────────────────────── */
export function CommissionsMock(): JSX.Element {
  const rows = [
    { who: 'D. Rivera', role: 'Knocker', door: '$1,840', is: '—', rt: '—', total: '$1,840' },
    { who: 'A. Bauer', role: 'Closer', door: '—', is: '$960', rt: '$120', total: '$1,080' },
    { who: 'Crew 4', role: 'Override', door: '$420', is: '$180', rt: '—', total: '$600' },
  ];
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line2 px-4 py-2.5">
        <span className="text-[12px] font-semibold tracking-tight text-ink">
          Commission run · period May 2026
        </span>
        <span className="rounded bg-line2 px-1.5 font-mono text-[10px] text-muted">
          daily accrual
        </span>
      </div>
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-line2 font-mono text-[9px] uppercase tracking-[0.10em] text-soft">
            <th className="px-4 py-2 text-left font-medium">Rep</th>
            <th className="px-2 py-2 text-right font-medium">Door 15%</th>
            <th className="px-2 py-2 text-right font-medium">IS 10%</th>
            <th className="px-2 py-2 text-right font-medium">RT 5%</th>
            <th className="px-4 py-2 text-right font-medium">Accrued</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.who} className="border-b border-line2 last:border-0">
              <td className="px-4 py-2.5">
                <span className="font-medium text-ink">{r.who}</span>{' '}
                <span className="font-mono text-[9px] text-soft">{r.role}</span>
              </td>
              <td className="numeric px-2 py-2.5 text-right font-mono text-ink2">{r.door}</td>
              <td className="numeric px-2 py-2.5 text-right font-mono text-ink2">{r.is}</td>
              <td className="numeric px-2 py-2.5 text-right font-mono text-ink2">{r.rt}</td>
              <td className="numeric px-4 py-2.5 text-right font-mono font-semibold text-ink">
                {r.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────────────────── Payouts ───────────────────────── */
export function PayoutsMock(): JSX.Element {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-soft">
            Payout batch
          </div>
          <div className="mt-0.5 text-[15px] font-semibold tracking-tight text-ink">
            May · fortnight 2
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-paper px-2 py-1 font-mono text-[10px] text-muted">
          <Lock size={11} /> ready to instruct
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        <Tile icon={<Users size={12} />} label="Reps" value="46" />
        <Tile icon={<Wallet size={12} />} label="Total" value="$28.4k" />
        <Tile icon={<CircleCheck size={12} />} label="File" value="NACHA" />
      </div>
      <div className="mt-3 rounded-lg border border-line2 bg-paper px-3 py-2.5 font-mono text-[10px] leading-relaxed text-soft">
        The platform generates the instruction file (NACHA / CSV). It never auto-debits — a human
        approves and sends. <span className="text-muted">ADR-0019</span>
      </div>
    </div>
  );
}

/* ───────────────────────── Compliance / state clearance ───────────────────────── */
export function ComplianceMock(): JSX.Element {
  const states: { s: string; status: 'cleared' | 'pending' | 'blocked' }[] = [
    { s: 'CA', status: 'cleared' },
    { s: 'TX', status: 'cleared' },
    { s: 'FL', status: 'cleared' },
    { s: 'NY', status: 'pending' },
    { s: 'IL', status: 'cleared' },
    { s: 'PA', status: 'pending' },
    { s: 'OH', status: 'cleared' },
    { s: 'GA', status: 'cleared' },
    { s: 'NC', status: 'blocked' },
    { s: 'MI', status: 'pending' },
    { s: 'NJ', status: 'blocked' },
    { s: 'VA', status: 'cleared' },
  ];
  const tone = {
    cleared: 'bg-accentSoft text-accent border-accentSoft',
    pending: 'bg-paper text-muted border-line',
    blocked: 'bg-line2 text-soft border-line line-through',
  } as const;
  return (
    <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-soft">
          Paid-solicitor state clearance
        </div>
        <div className="mt-2.5 grid grid-cols-6 gap-1.5">
          {states.map((st) => (
            <span
              key={st.s}
              className={`flex h-9 items-center justify-center rounded-md border font-mono text-[11px] font-semibold ${tone[st.status]}`}
            >
              {st.s}
            </span>
          ))}
        </div>
        <div className="mt-2.5 flex flex-wrap gap-3 font-mono text-[8px] uppercase tracking-[0.10em] text-soft">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-accent" /> cleared — delivering
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm border border-line bg-paper" /> filed
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-line" /> blocked
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {[
          ['Cooling-off timer', '3-day FTC · payout held'],
          ['DNC / DNK scrub', 'FTC + FCC + state · nightly'],
          ['Consent capture', 'TCPA written · timestamped'],
        ].map((r) => (
          <div
            key={r[0]}
            className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2.5"
          >
            <ShieldCheck size={15} className="text-accent" />
            <div>
              <div className="text-[12px] font-semibold tracking-tight text-ink">{r[0]}</div>
              <div className="font-mono text-[9px] text-soft">{r[1]}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── Audit trail ───────────────────────── */
export function AuditMock(): JSX.Element {
  const rows = [
    ['pii.unmask', 'Lead/ld_8f2', 'dual-control · 30m grant'],
    ['conversion.finalize', 'Conv/cv_41a', 'idempotent · door'],
    ['payout.instruct', 'Batch/pb_07', 'webauthn · approved'],
    ['campaign.deliver', 'Camp/cp_3', 'TX cleared'],
  ];
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line2 px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold tracking-tight text-ink">
          <Hash size={13} className="text-accent" /> Audit chain
        </span>
        <span className="rounded bg-accentSoft px-1.5 font-mono text-[10px] font-semibold text-accent">
          Merkle ✓ verified
        </span>
      </div>
      <div className="divide-y divide-line2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-2.5">
            <div>
              <div className="font-mono text-[11px] font-medium text-ink">{r[0]}</div>
              <div className="font-mono text-[9px] text-soft">
                {r[1]} · {r[2]}
              </div>
            </div>
            <div className="font-mono text-[9px] text-soft">
              prevHash <span className="text-accent">0x{(9173 + i * 41).toString(16)}…</span>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-line2 px-4 py-2 font-mono text-[9px] text-soft">
        7-year S3 Object-Lock retention · per-region chain
      </div>
    </div>
  );
}

/* ───────────────────────── Reports / analytics ───────────────────────── */
export function ReportsMock(): JSX.Element {
  const bars = [40, 62, 48, 78, 90, 70, 84];
  const funnel = [
    ['Knocks', '24,180', 100],
    ['Leads', '6,420', 62],
    ['Appointments', '1,910', 32],
    ['Conversions', '2,711', 18],
  ] as const;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-soft">
            Conversions · 7 days
          </span>
          <span className="numeric font-mono text-[11px] font-semibold text-accent">+14%</span>
        </div>
        <div className="mt-3 flex h-24 items-end gap-1.5">
          {bars.map((b, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-accent"
              style={{ height: `${b}%`, opacity: 0.45 + (i / bars.length) * 0.55 }}
            />
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-soft">
          Funnel · MTD
        </div>
        <div className="mt-2.5 space-y-2">
          {funnel.map((f) => (
            <div key={f[0]}>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted">{f[0]}</span>
                <span className="numeric font-mono text-ink2">{f[1]}</span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-line2">
                <div className="h-full rounded-full bg-accent" style={{ width: `${f[2]}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Partner portal ───────────────────────── */
export function PartnerPortalMock(): JSX.Element {
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-soft">
          Your invoices
        </div>
        <div className="mt-2 space-y-1.5">
          {[
            ['INV-2026-05', '$29,790', 'open'],
            ['INV-2026-04', '$26,140', 'paid'],
            ['INV-2026-03', '$24,910', 'paid'],
          ].map((r) => (
            <div
              key={r[0]}
              className="flex items-center justify-between rounded-lg border border-line2 px-2.5 py-1.5 text-[11px]"
            >
              <span className="font-mono text-ink2">{r[0]}</span>
              <span className="numeric font-mono text-ink">{r[1]}</span>
              <span
                className={`rounded px-1 font-mono text-[9px] ${r[2] === 'open' ? 'bg-accentSoft text-accent' : 'bg-line2 text-soft'}`}
              >
                {r[2]}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        <div className="grid grid-cols-2 gap-2.5">
          <Tile icon={<TrendingUp size={12} />} label="Conv. MTD" value="221" />
          <Tile icon={<Wallet size={12} />} label="Raised" value="$227k" />
        </div>
        <div className="rounded-lg border border-line bg-surface p-3 text-[11px]">
          <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-soft">
            State clearance
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-muted">Delivering</span>
            <span className="font-mono text-accent">14 states</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-muted">Filed</span>
            <span className="font-mono text-ink2">6 pending</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Settings (enterprise) ───────────────────────── */
export function SettingsMock(): JSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-line bg-surface p-4">
        <Lock size={15} className="text-accent" />
        <div className="mt-2 text-[12px] font-semibold tracking-tight text-ink">SSO / SAML</div>
        <div className="mt-1 font-mono text-[10px] text-soft">Okta · configured</div>
        <div className="mt-2 space-y-1 font-mono text-[9px] text-muted">
          <div>JIT provisioning · on</div>
          <div>group → role map</div>
        </div>
      </div>
      <div className="rounded-xl border border-line bg-surface p-4">
        <ImageIcon size={15} className="text-accent" />
        <div className="mt-2 text-[12px] font-semibold tracking-tight text-ink">White-label</div>
        <div className="mt-1 font-mono text-[10px] text-soft">Your brand on the apps</div>
        <div className="mt-2 flex gap-1.5">
          <span className="h-5 w-5 rounded" style={{ background: '#0F3D6E' }} />
          <span className="h-5 w-5 rounded" style={{ background: '#2E9E7B' }} />
          <span className="flex h-5 items-center rounded bg-line2 px-1.5 font-mono text-[8px] text-soft">
            logo
          </span>
        </div>
      </div>
      <div className="rounded-xl border border-line bg-surface p-4">
        <Users size={15} className="text-accent" />
        <div className="mt-2 text-[12px] font-semibold tracking-tight text-ink">Roles · RBAC</div>
        <div className="mt-1 font-mono text-[10px] text-soft">8 platform roles</div>
        <div className="mt-2 flex flex-wrap gap-1">
          {['admin', 'manager', 'knocker', 'sales', 'auditor'].map((r) => (
            <span key={r} className="rounded bg-line2 px-1 font-mono text-[8px] text-muted">
              {r}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Knocker phone — exported for reuse on the platform tour. */
export function KnockerPhoneMock(): JSX.Element {
  const pins: { x: number; y: number; t: 'sale' | 'lead' | 'idle' }[] = [
    { x: 30, y: 30, t: 'sale' },
    { x: 58, y: 24, t: 'lead' },
    { x: 70, y: 52, t: 'sale' },
    { x: 42, y: 60, t: 'idle' },
    { x: 22, y: 54, t: 'lead' },
  ];
  return (
    <div className="relative mx-auto w-[210px] rounded-[32px] border-[6px] border-ink bg-ink p-1.5 shadow-[0_30px_60px_-30px_rgba(15,23,42,0.5)]">
      <div className="absolute left-1/2 top-2 z-10 h-3.5 w-16 -translate-x-1/2 rounded-full bg-ink" />
      <div className="overflow-hidden rounded-[24px] bg-[#0B1220]">
        <SatMap
          area="phoenix"
          territory
          pins={pins}
          label="Offline · 3 queued"
          aspect="aspect-[3/4]"
        />
        <div className="border-t border-surface/10 bg-[#101a2e] p-3">
          <div className="text-[12px] font-semibold tracking-tight text-surface">
            14 Carlisle Ave
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-surface/45">
            disposition
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {['Sale', 'Lead', 'Not home', 'Callback', 'Refused', 'DNC'].map((d, i) => (
              <span
                key={d}
                className={`rounded-md px-1 py-1.5 text-center text-[9px] font-medium ${i === 1 ? 'bg-accent text-surface' : 'bg-surface/10 text-surface/70'}`}
              >
                {d}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
