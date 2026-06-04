'use client';

import { useState } from 'react';
import { cn } from '@d2d/ui-web';
import { DoorOpen, Phone, CalendarCheck, CircleCheck, Sparkles } from 'lucide-react';

/**
 * "Show, don't tell" — three real product surfaces rendered in-browser inside a
 * macOS-style window chrome, switchable by tab. Pure CSS/SVG (no Leaflet, no
 * screenshots): a pipeline kanban, a client billing invoice with bucketed rake,
 * and the knocker iOS field app. All numbers are internally consistent with the
 * attribution model the rest of the page describes.
 */

type TabKey = 'pipeline' | 'billing' | 'mobile';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'billing', label: 'Client billing' },
  { key: 'mobile', label: 'Knocker app' },
];

export function ProductShowcase(): JSX.Element {
  const [tab, setTab] = useState<TabKey>('pipeline');

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={cn(
              'rounded-lg px-3.5 py-2 text-[13px] font-medium transition-colors',
              tab === t.key
                ? 'bg-ink text-surface'
                : 'border border-line bg-surface text-muted hover:text-ink hover:border-line2',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Window chrome */}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_0_rgba(15,23,42,0.04),0_40px_80px_-40px_rgba(15,23,42,0.28)]">
        <div className="flex items-center gap-2 border-b border-line2 bg-paper px-4 py-2.5">
          <span className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-line" />
            <span className="h-2.5 w-2.5 rounded-full bg-line" />
            <span className="h-2.5 w-2.5 rounded-full bg-line" />
          </span>
          <span className="ml-2 font-mono text-[11px] text-soft">
            app.door2digital.io<span className="text-line">/</span>
            {tab === 'pipeline' ? 'pipeline' : tab === 'billing' ? 'billing/INV-2026-05' : 'field'}
          </span>
        </div>
        <div className="bg-paper p-4 sm:p-6">
          {tab === 'pipeline' && <PipelineMock />}
          {tab === 'billing' && <BillingMock />}
          {tab === 'mobile' && <MobileMock />}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Pipeline ───────────────────────── */

const COLUMNS: {
  title: string;
  icon: React.ReactNode;
  total: string;
  cards: { name: string; sub: string; value: string; score: number; tag: string }[];
}[] = [
  {
    title: 'Door lead',
    icon: <DoorOpen size={13} />,
    total: '$42.1k',
    cards: [
      { name: 'M. Okeke', sub: '14 Carlisle Ave', value: '$480/yr', score: 82, tag: 'DOOR' },
      { name: 'P. Nguyen', sub: '9 Brooker St', value: '$1.2k', score: 64, tag: 'DOOR' },
    ],
  },
  {
    title: 'Contacted',
    icon: <Phone size={13} />,
    total: '$31.8k',
    cards: [
      { name: 'R. Castillo', sub: 'solar · 6.6kW', value: '$8.4k', score: 71, tag: 'IS' },
      { name: 'A. Bauer', sub: 'recurring gift', value: '$960/yr', score: 88, tag: 'IS' },
    ],
  },
  {
    title: 'Appointment',
    icon: <CalendarCheck size={13} />,
    total: '$19.5k',
    cards: [{ name: 'T. Ahmed', sub: 'install survey', value: '$11.0k', score: 76, tag: 'IS' }],
  },
  {
    title: 'Converted',
    icon: <CircleCheck size={13} />,
    total: '$58.2k',
    cards: [
      { name: 'J. Park', sub: 'donation · monthly', value: '$40/mo', score: 100, tag: 'DOOR' },
      { name: 'L. Moreau', sub: 'pest · annual', value: '$540', score: 100, tag: 'RT' },
    ],
  },
];

function PipelineMock(): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {COLUMNS.map((col) => (
        <div key={col.title} className="flex flex-col">
          <div className="mb-2 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold tracking-tight text-ink">
              <span className="text-accent">{col.icon}</span>
              {col.title}
            </span>
            <span className="numeric font-mono text-[10px] text-soft">{col.total}</span>
          </div>
          <div className="flex flex-col gap-2">
            {col.cards.map((c) => (
              <div key={c.name} className="rounded-lg border border-line bg-surface p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold tracking-tight text-ink">
                    {c.name}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-0.5 rounded px-1 font-mono text-[9px] font-semibold',
                      c.score >= 85 ? 'bg-accentSoft text-accent' : 'bg-line2 text-muted',
                    )}
                  >
                    <Sparkles size={8} />
                    {c.score}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-muted">{c.sub}</div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="numeric text-[11px] font-medium text-ink2">{c.value}</span>
                  <span className="rounded bg-line2 px-1 font-mono text-[8px] font-semibold tracking-[0.08em] text-soft">
                    {c.tag}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────── Billing ───────────────────────── */

const LINES: { label: string; detail: string; amount: string }[] = [
  { label: 'Platform fee', detail: 'Monthly · May 2026', amount: '$2,500.00' },
  {
    label: 'Door-closed rake',
    detail: '15% · 142 conversions · $123,000 vol',
    amount: '$18,450.00',
  },
  { label: 'Inside-sales rake', detail: '10% · 48 conversions · $72,000 vol', amount: '$7,200.00' },
  { label: 'Retargeting rake', detail: '5% · 31 conversions · $32,800 vol', amount: '$1,640.00' },
];

function BillingMock(): JSX.Element {
  return (
    <div className="mx-auto max-w-[640px] rounded-xl border border-line bg-surface p-5 sm:p-7">
      <div className="flex items-start justify-between border-b border-line2 pb-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-soft">Invoice</div>
          <div className="mt-1 text-[18px] font-semibold tracking-tight text-ink">INV-2026-05</div>
          <div className="mt-0.5 text-[12px] text-muted">Hope Forward International · US</div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-accentSoft px-2 py-1 text-[11px] font-medium text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Open
        </span>
      </div>

      <div className="divide-y divide-line2">
        {LINES.map((l) => (
          <div key={l.label} className="grid grid-cols-[1fr_auto] gap-3 py-3">
            <div>
              <div className="text-[13px] font-medium text-ink">{l.label}</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
                {l.detail}
              </div>
            </div>
            <div className="numeric self-center text-[13px] font-semibold text-ink">{l.amount}</div>
          </div>
        ))}
      </div>

      <div className="mt-1 flex items-center justify-between rounded-lg bg-paper px-4 py-3">
        <span className="text-[12px] font-medium uppercase tracking-[0.10em] text-muted">
          Total due
        </span>
        <span className="numeric text-[20px] font-semibold tracking-tight text-ink">
          $29,790.00
        </span>
      </div>
      <p className="mt-3 font-mono text-[10px] leading-relaxed text-soft">
        Every line reconciles to one attribution source on each conversion. The platform instructs
        payment — it never auto-debits.
      </p>
    </div>
  );
}

/* ───────────────────────── Mobile ───────────────────────── */

function MobileMock(): JSX.Element {
  const pins = [
    { x: 30, y: 30, t: '#3B82F6' },
    { x: 58, y: 24, t: '#93C5FD' },
    { x: 70, y: 52, t: '#3B82F6' },
    { x: 42, y: 60, t: '#64748B' },
    { x: 22, y: 54, t: '#93C5FD' },
  ];
  return (
    <div className="flex flex-col items-center gap-6 py-2 sm:flex-row sm:items-stretch sm:justify-center sm:gap-10">
      {/* phone */}
      <div className="relative w-[230px] shrink-0 rounded-[34px] border-[6px] border-ink bg-ink p-1.5 shadow-[0_30px_60px_-30px_rgba(15,23,42,0.5)]">
        <div className="absolute left-1/2 top-2 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-ink" />
        <div className="overflow-hidden rounded-[26px] bg-[#0B1220]">
          {/* map */}
          <div className="relative h-[300px] w-full">
            <div
              aria-hidden
              className="absolute inset-0 opacity-70"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(148,163,184,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,0.06) 1px,transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />
            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
              <polygon
                points="14,26 56,16 60,54 26,62"
                fill="rgba(59,130,246,0.12)"
                stroke="rgba(59,130,246,0.5)"
                strokeWidth="0.6"
              />
            </svg>
            {pins.map((p, i) => (
              <span
                key={i}
                className="absolute"
                style={{ left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%,-50%)' }}
              >
                <span
                  className="mk-pulse-ring absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{ background: p.t, animationDelay: `${i * 400}ms` }}
                />
                <span
                  className="relative block h-1.5 w-1.5 rounded-full ring-2 ring-[#0B1220]"
                  style={{ background: p.t }}
                />
              </span>
            ))}
            <div className="absolute left-3 top-3 font-mono text-[9px] uppercase tracking-[0.16em] text-surface/60">
              Territory NE-12
            </div>
          </div>
          {/* knock sheet */}
          <div className="border-t border-surface/10 bg-[#101a2e] p-3">
            <div className="text-[12px] font-semibold tracking-tight text-surface">
              14 Carlisle Ave
            </div>
            <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-surface/45">
              Knock · disposition
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-1.5">
              {['Sale', 'Lead', 'Not home', 'Callback', 'Refused', 'DNC'].map((d, i) => (
                <span
                  key={d}
                  className={cn(
                    'rounded-md px-1 py-1.5 text-center text-[9px] font-medium',
                    i === 1 ? 'bg-accent text-surface' : 'bg-surface/10 text-surface/70',
                  )}
                >
                  {d}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* annotations */}
      <ul className="flex max-w-[280px] flex-col justify-center gap-4">
        {[
          [
            'Offline-first',
            'Every knock carries GPS, photo, signature and a device-clock fraud signal — queued locally, reconciled idempotently on reconnect.',
          ],
          [
            'One-thumb capture',
            'Disposition in a single tap; a lead becomes a 3-field warm capture without leaving the door.',
          ],
          [
            'Compliant at the door',
            'Charity-signed authority letter and paid-solicitor ID ride on the badge screen — only cleared territories appear.',
          ],
        ].map(([h, b]) => (
          <li key={h}>
            <div className="text-[13px] font-semibold tracking-tight text-ink">{h}</div>
            <div className="mt-1 text-[12px] leading-relaxed text-muted">{b}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
