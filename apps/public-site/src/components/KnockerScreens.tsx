'use client';

import {
  MapPin,
  Inbox,
  User as UserIcon,
  Plus,
  Wifi,
  BatteryFull,
  Camera,
  PenTool,
  Check,
  ChevronRight,
  Fingerprint,
  ArrowLeft,
  Calendar,
  ShieldCheck,
  Bell,
  Trophy,
  X,
  BookOpen,
} from 'lucide-react';
import { KnockerPhoneMap } from '@/components/KnockerPhoneMap';

type VariantKey =
  | 'login'
  | 'map'
  | 'knock-sheet'
  | 'lead-form'
  | 'signature'
  | 'photo'
  | 'schedule'
  | 'inbox'
  | 'pitch-script'
  | 'me';

const SHOWN: Array<{ key: VariantKey; title: string; subtitle: string }> = [
  { key: 'map', title: 'Territory map', subtitle: 'Live satellite + knock pins' },
  { key: 'knock-sheet', title: 'Knock + disposition', subtitle: 'Sale · lead · callback · DNK' },
  { key: 'schedule', title: 'Schedule', subtitle: 'Callbacks + shift clock-in' },
  { key: 'me', title: 'Me · stats', subtitle: 'Leaderboard + commission' },
];

// Phone renders at a fixed 320×660; scale it down for the marketing showcase.
const SCALE = 0.74;

/**
 * The real Knocker iOS screens — ported verbatim from the operator app's
 * mobile-preview (the same Phone frame + screen components + satellite map) —
 * rendered as a scaled-down phone showcase for the marketing site. We render
 * natively rather than iframe because the operator app sends X-Frame-Options: DENY.
 */
export function KnockerAppShowcase(): JSX.Element {
  return (
    <div className="flex justify-center gap-4 overflow-x-auto px-1 pb-2 sm:gap-5">
      {SHOWN.map((v) => (
        <div key={v.key} className="flex shrink-0 flex-col items-center gap-3">
          <div style={{ width: 320 * SCALE, height: 660 * SCALE }}>
            <div style={{ transform: `scale(${SCALE})`, transformOrigin: 'top left' }}>
              <Phone variant={v.key} />
            </div>
          </div>
          <div className="text-center">
            <div className="text-[12px] font-semibold tracking-tight text-ink">{v.title}</div>
            <div className="font-mono text-[10px] text-soft">{v.subtitle}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Phone({ variant }: { variant: VariantKey }): JSX.Element {
  return (
    <div
      className="relative"
      style={{
        width: 320,
        height: 660,
        borderRadius: 44,
        background: '#0F172A',
        padding: 10,
        boxShadow: '0 16px 48px rgba(15,23,42,0.18), 0 4px 12px rgba(15,23,42,0.1)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 14,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 90,
          height: 28,
          background: '#000',
          borderRadius: 22,
          zIndex: 10,
        }}
      />
      <div
        style={{
          background: '#F7F8FA',
          borderRadius: 36,
          height: '100%',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div className="flex items-center justify-between px-6 pt-2 pb-1 text-[11px] font-semibold text-ink">
          <span className="numeric">9:41</span>
          <div className="w-20" />
          <div className="flex items-center gap-1">
            <Wifi size={11} />
            <BatteryFull size={13} />
          </div>
        </div>

        {variant === 'login' && <LoginScreen />}
        {variant === 'map' && <MapScreen />}
        {variant === 'knock-sheet' && <KnockSheetScreen />}
        {variant === 'lead-form' && <LeadFormScreen />}
        {variant === 'signature' && <SignatureScreen />}
        {variant === 'photo' && <PhotoScreen />}
        {variant === 'schedule' && <ScheduleScreen />}
        {variant === 'inbox' && <InboxScreen />}
        {variant === 'pitch-script' && <PitchScriptScreen />}
        {variant === 'me' && <MeScreen />}

        {variant !== 'login' && variant !== 'photo' && (
          <div
            className="absolute bottom-0 left-0 right-0 bg-surface border-t border-line2 px-6 py-3 flex items-center justify-between"
            style={{ paddingBottom: 22 }}
          >
            {[
              {
                icon: MapPin,
                label: 'Map',
                active: ['map', 'knock-sheet', 'lead-form', 'signature', 'photo'].includes(variant),
              },
              {
                icon: Calendar,
                label: 'Schedule',
                active: ['schedule', 'pitch-script'].includes(variant),
              },
              { icon: Inbox, label: 'Inbox', active: variant === 'inbox' },
              { icon: UserIcon, label: 'Me', active: variant === 'me' },
            ].map((t) => (
              <div key={t.label} className="flex flex-col items-center gap-0.5">
                <t.icon
                  size={20}
                  className={t.active ? 'text-ink' : 'text-soft'}
                  strokeWidth={t.active ? 2 : 1.5}
                />
                <span className={`text-[10px] ${t.active ? 'text-ink font-medium' : 'text-soft'}`}>
                  {t.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LoginScreen() {
  return (
    <div className="h-full flex flex-col items-center justify-between px-6 pt-12 pb-10 bg-gradient-to-b from-paper to-surface">
      <div className="flex-1 flex flex-col items-center justify-center w-full">
        <div className="w-16 h-16 rounded-2xl bg-ink text-surface flex items-center justify-center text-2xl font-bold">
          K
        </div>
        <div className="text-[20px] font-bold text-ink mt-4">Knocker iOS</div>
        <div className="text-accent text-[10px] font-semibold tracking-[0.18em] mt-1">
          FIELD APP
        </div>
        <div className="text-[12px] text-muted mt-6 text-center">Sign in to start your shift</div>
        <button className="mt-8 w-20 h-20 rounded-full bg-ink text-surface flex items-center justify-center shadow-lg">
          <Fingerprint size={36} strokeWidth={1.5} />
        </button>
        <div className="text-[11px] text-muted mt-3">Face ID to continue</div>
        <button className="mt-6 text-[12px] text-accent font-medium">
          Sign in with Okta SSO →
        </button>
      </div>
      <div className="text-[10px] text-soft">
        v1.0.4 · 531 Knockers live · 43 territories cleared
      </div>
    </div>
  );
}

function MapScreen() {
  return (
    <div className="relative h-full" style={{ paddingBottom: 80 }}>
      <div className="relative h-full">
        <KnockerPhoneMap />
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-[1000] pointer-events-none">
          <div className="bg-surface/95 backdrop-blur px-3 py-1.5 rounded-full text-[11px] border border-line2 flex items-center gap-1.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-ink font-medium">Austin East · 8 / 248</span>
          </div>
          <div className="bg-surface/95 backdrop-blur px-2 py-1.5 rounded-full text-[10px] border border-line2 numeric text-ink shadow-sm">
            ±3m
          </div>
        </div>
        <button
          className="absolute right-4 flex items-center gap-1.5 text-surface font-semibold text-[13px] shadow-lg z-[1000]"
          style={{ bottom: 100, background: '#0F172A', padding: '12px 18px', borderRadius: 999 }}
        >
          <Plus size={16} /> Knock here
        </button>
      </div>
    </div>
  );
}

function KnockSheetScreen() {
  return (
    <div className="relative h-full bg-paper" style={{ paddingBottom: 80 }}>
      <div className="absolute inset-0 bg-ink/40" />
      <div
        className="absolute left-0 right-0 bg-surface rounded-t-3xl shadow-lg"
        style={{ bottom: 0, paddingBottom: 80 }}
      >
        <div className="flex justify-center pt-3">
          <div className="w-10 h-1 rounded-full bg-line" />
        </div>
        <div className="px-5 pt-3 pb-2">
          <div className="text-[12px] text-muted">4218 Lakeview Dr</div>
          <div className="text-[15px] font-semibold text-ink">Austin TX 78739</div>
        </div>
        <div className="px-5 py-3">
          <div className="text-[11px] uppercase tracking-wider text-muted mb-2">Disposition</div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'SALE', color: 'bg-success text-surface' },
              { label: 'LEAD', color: 'bg-accent text-surface' },
              { label: 'NOT\nHOME', color: 'bg-warn text-surface' },
              { label: 'CALLBACK', color: 'bg-ink text-surface' },
              { label: 'REFUSED', color: 'bg-line2 text-muted' },
              { label: 'DNC', color: 'bg-danger text-surface' },
            ].map((d, i) => (
              <button
                key={i}
                className={`${d.color} rounded-2xl py-4 text-[12px] font-bold whitespace-pre-line`}
                style={{ minHeight: 60 }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <div className="px-5 pt-2 pb-4 space-y-2">
          <input
            className="w-full px-3 py-2.5 rounded-xl border border-line2 bg-paper text-[13px]"
            defaultValue="Maria Santos"
          />
          <input
            className="w-full px-3 py-2.5 rounded-xl border border-line2 bg-paper text-[13px] numeric"
            defaultValue="(512) 555-0182"
          />
          <div className="flex items-center gap-2 pt-1">
            <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-line2 bg-surface text-[12px]">
              <Camera size={14} /> Photo
            </button>
            <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-line2 bg-surface text-[12px]">
              <PenTool size={14} /> Sign
            </button>
          </div>
          <button className="w-full mt-2 py-3 rounded-xl bg-ink text-surface font-semibold text-[13px] flex items-center justify-center gap-2">
            <Check size={16} /> Save knock
          </button>
        </div>
      </div>
    </div>
  );
}

function LeadFormScreen() {
  return (
    <div className="h-full bg-surface" style={{ paddingBottom: 80, overflow: 'hidden' }}>
      <div className="flex items-center gap-3 px-5 py-3 border-b border-line2">
        <ArrowLeft size={18} className="text-soft" />
        <div className="flex-1 text-[14px] font-semibold text-ink">Capture lead</div>
        <button className="text-[12px] text-accent font-medium">Save</button>
      </div>
      <div className="p-5 space-y-3 overflow-y-auto" style={{ height: 'calc(100% - 130px)' }}>
        <Field label="First name" value="Maria" />
        <Field label="Last name" value="Santos" />
        <Field label="Phone" value="(512) 555-0182" mono />
        <Field label="Email" value="maria.santos@gmail.com" />
        <Field label="Best time to call" value="Tue 4pm onwards" />
        <Field label="Interest" value="Clean-water programme · $24/mo" />
        <div>
          <div className="text-[10px] text-muted uppercase tracking-wider mb-1.5">Tier</div>
          <div className="grid grid-cols-3 gap-2">
            {['High', 'Medium', 'Low'].map((t) => (
              <button
                key={t}
                className={`py-2 rounded-lg text-[12px] font-medium border ${t === 'High' ? 'bg-success text-surface border-success' : 'bg-paper border-line2 text-muted'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-paper border border-line2 rounded-xl p-3 flex items-center gap-2.5">
          <ShieldCheck size={14} className="text-success shrink-0" />
          <div className="text-[11px] text-muted">
            TCPA consent captured · address not on DNK list · TX cleared
          </div>
        </div>
      </div>
    </div>
  );
}

function SignatureScreen() {
  return (
    <div className="h-full bg-surface" style={{ paddingBottom: 80 }}>
      <div className="flex items-center gap-3 px-5 py-3 border-b border-line2">
        <ArrowLeft size={18} className="text-soft" />
        <div className="flex-1 text-[14px] font-semibold text-ink">Sign consent</div>
      </div>
      <div className="p-5 space-y-3">
        <div className="text-[11px] text-muted">
          By signing, you consent to Hope Forward contacting you about clean-water programs via SMS,
          email, and phone. You can opt out anytime.
        </div>
        <div
          className="bg-paper border-2 border-dashed border-line2 rounded-xl flex items-center justify-center relative overflow-hidden"
          style={{ height: 240 }}
        >
          <svg viewBox="0 0 240 160" className="w-full h-full">
            <path
              d="M 30 90 Q 50 50, 70 80 T 110 75 Q 130 110, 150 80 T 200 85"
              stroke="#0F172A"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute bottom-2 left-3 text-[10px] text-soft">
            M. Santos · 2026-05-24 14:55
          </div>
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted">
          <button className="text-muted">Clear</button>
          <span>Signed with finger · pressure-aware</span>
        </div>
        <button className="w-full py-3 rounded-xl bg-ink text-surface font-semibold text-[13px] flex items-center justify-center gap-2">
          <Check size={16} /> Confirm signature
        </button>
      </div>
    </div>
  );
}

function PhotoScreen() {
  return (
    <div className="h-full bg-ink relative" style={{ overflow: 'hidden' }}>
      <div className="h-full relative">
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, #1E293B 0%, #475569 50%, #94A3B8 100%)' }}
        />
        <svg viewBox="0 0 300 500" className="absolute inset-0 w-full h-full opacity-60">
          <path
            d="M 30 350 L 30 250 L 150 150 L 270 250 L 270 350 Z"
            fill="#0F172A"
            opacity="0.55"
          />
          <rect x="80" y="290" width="50" height="60" fill="#000" opacity="0.55" />
          <rect x="170" y="280" width="40" height="40" fill="#000" opacity="0.55" />
        </svg>
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <X size={20} className="text-surface" />
          <div className="text-surface text-[11px] font-medium px-2 py-1 rounded bg-black/40">
            4218 Lakeview Dr
          </div>
        </div>
        <div className="absolute bottom-20 left-0 right-0 flex items-center justify-center gap-8">
          <div className="w-10 h-10 rounded-lg bg-surface/20 border border-surface/30" />
          <button className="w-16 h-16 rounded-full bg-surface border-4 border-surface/40" />
          <button className="text-surface text-[11px] font-medium">Skip</button>
        </div>
        <div className="absolute bottom-8 left-0 right-0 text-center text-[10px] text-surface/70">
          Encrypted with per-blob DEK until sync
        </div>
      </div>
    </div>
  );
}

function ScheduleScreen() {
  return (
    <div className="h-full bg-paper" style={{ paddingBottom: 80, overflow: 'hidden' }}>
      <div className="px-5 pt-4 pb-3">
        <div className="text-[18px] font-bold text-ink">Tuesday, May 25</div>
        <div className="text-[12px] text-muted">Active shift · 4h 12m</div>
      </div>
      <div className="px-5 mb-3">
        <div className="bg-success/10 border border-success/30 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-success uppercase tracking-wider font-semibold">
              On shift
            </div>
            <div className="text-[14px] font-semibold text-ink">Austin East · 09–17:00</div>
          </div>
          <button className="text-[12px] font-semibold text-success">Clock out</button>
        </div>
      </div>
      <div className="px-5 pt-2">
        <div className="text-[10px] uppercase tracking-wider text-muted mb-2">Callbacks · 7</div>
        <div className="bg-surface border border-line2 rounded-2xl divide-y divide-line2">
          {[
            { time: '11:00', name: 'Aisha Williams', addr: '1502 Cedar St', urgent: true },
            { time: '14:00', name: 'Robert Kim', addr: '3098 Birch Ln' },
            { time: '15:30', name: 'David Chen', addr: '887 Maple Ave' },
            { time: '16:45', name: 'Sophia Patel', addr: '4502 Walnut Cir' },
          ].map((c, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div
                className={`w-10 text-center text-[11px] font-semibold ${c.urgent ? 'text-rose-600' : 'text-muted'}`}
              >
                {c.time}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-ink truncate">{c.name}</div>
                <div className="text-[10px] text-muted truncate">{c.addr}</div>
              </div>
              <ChevronRight size={14} className="text-soft" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InboxScreen() {
  return (
    <div className="h-full bg-paper" style={{ paddingBottom: 80, overflow: 'hidden' }}>
      <div className="px-5 pt-4 pb-3 flex items-center justify-between">
        <div className="text-[18px] font-bold text-ink">Inbox</div>
        <Bell size={18} className="text-soft" />
      </div>
      <div className="px-5 space-y-2">
        {[
          {
            from: 'Sarah (Manager)',
            msg: 'Strong shift Jordan — 31 conv already.',
            time: '12m',
            unread: true,
          },
          {
            from: 'Knocker iOS',
            msg: 'Day-1 SMS to Maria Santos delivered + read',
            time: '2h',
            system: true,
          },
          {
            from: 'Sarah (Manager)',
            msg: 'Heads up — LA West is blocked, swap to Atlanta',
            time: '4h',
          },
          {
            from: 'Knocker iOS',
            msg: 'New territory cleared: Phoenix West (AZ)',
            time: 'Yest',
            system: true,
          },
          { from: 'Sarah (Manager)', msg: 'Q3 pitch script update — review by EOD', time: 'Yest' },
        ].map((m, i) => (
          <div
            key={i}
            className={`bg-surface border border-line2 rounded-xl px-4 py-3 flex items-start gap-3 ${m.unread ? 'border-l-2 border-l-accent' : ''}`}
          >
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[12px] font-bold ${m.system ? 'bg-accentSoft text-accent' : 'bg-ink text-surface'}`}
            >
              {m.system ? 'N' : 'S'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[13px] font-semibold text-ink truncate">{m.from}</div>
                <div className="text-[10px] text-soft shrink-0">{m.time}</div>
              </div>
              <div className="text-[12px] text-muted line-clamp-2">{m.msg}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PitchScriptScreen() {
  return (
    <div className="h-full bg-paper" style={{ paddingBottom: 80, overflow: 'hidden' }}>
      <div className="flex items-center gap-3 px-5 py-3 border-b border-line2 bg-surface">
        <ArrowLeft size={18} className="text-soft" />
        <div className="flex-1">
          <div className="text-[14px] font-semibold text-ink">Hope Forward · Q3 2026</div>
          <div className="text-[10px] text-muted">Clean-water pitch · v3.2</div>
        </div>
        <BookOpen size={16} className="text-soft" />
      </div>
      <div className="p-5 space-y-3 overflow-y-auto" style={{ height: 'calc(100% - 130px)' }}>
        <div className="bg-surface border border-line2 rounded-xl p-3">
          <div className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-1">
            Opener
          </div>
          <div className="text-[13px] text-ink leading-relaxed">
            &ldquo;Hi, I&apos;m Jordan with Hope Forward. We&apos;re building clean-water wells in
            East Africa. Do you have 60 seconds?&rdquo;
          </div>
        </div>
        <div className="bg-surface border border-line2 rounded-xl p-3">
          <div className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-1">
            If interested
          </div>
          <div className="text-[13px] text-ink leading-relaxed">
            &ldquo;Just $24/mo gives a family clean water for a year. Our last audit showed 87¢ of
            every dollar goes directly to wells.&rdquo;
          </div>
        </div>
        <div className="bg-paper border border-line2 rounded-xl p-3">
          <div className="text-[10px] uppercase tracking-wider text-warn font-semibold mb-1.5">
            Common objection
          </div>
          <div className="text-[12px] text-ink font-medium mb-1">
            &ldquo;I already give to several charities.&rdquo;
          </div>
          <div className="text-[11px] text-muted">
            → Acknowledge. Mention impact compounding: small monthly &gt; large one-off. Offer
            SMS-link checkout.
          </div>
        </div>
        <button className="w-full py-3 rounded-xl bg-ink text-surface font-semibold text-[13px] flex items-center justify-center gap-2">
          <Check size={14} aria-hidden /> Mark as read
        </button>
      </div>
    </div>
  );
}

function MeScreen() {
  return (
    <div className="h-full bg-paper" style={{ paddingBottom: 80, overflow: 'hidden' }}>
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-ink text-surface flex items-center justify-center text-[16px] font-semibold">
            JM
          </div>
          <div>
            <div className="text-[15px] font-semibold text-ink">Jordan Mosley</div>
            <div className="text-[12px] text-muted">Austin East · Active shift 4h 12m</div>
          </div>
        </div>
      </div>
      <div className="px-5 grid grid-cols-2 gap-2">
        {[
          { label: 'Knocks today', value: '84', sub: '+12 vs yest.' },
          { label: 'Conversions', value: '31', sub: '36.9% rate' },
          { label: 'Revenue today', value: '$8,940', sub: 'donor GMV' },
          { label: 'Commission accrued', value: '$248', sub: 'pre-payout' },
        ].map((s) => (
          <div key={s.label} className="bg-surface border border-line2 rounded-2xl p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted">{s.label}</div>
            <div className="text-[18px] font-bold text-ink mt-1 numeric">{s.value}</div>
            <div className="text-[10px] text-muted mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>
      <div className="px-5 pt-4">
        <div className="text-[11px] uppercase tracking-wider text-muted mb-2">
          Leaderboard · Today
        </div>
        <div className="bg-surface border border-line2 rounded-2xl divide-y divide-line2">
          {[
            { rank: 1, name: 'You', initials: 'JM', knocks: 84, conv: 31, you: true },
            { rank: 2, name: 'Jada D.', initials: 'JD', knocks: 91, conv: 22 },
            { rank: 3, name: 'Aaliyah R.', initials: 'AR', knocks: 78, conv: 18 },
            { rank: 4, name: 'Tomás M.', initials: 'TM', knocks: 72, conv: 14 },
          ].map((r) => (
            <div
              key={r.rank}
              className={`flex items-center gap-3 px-4 py-2.5 ${r.you ? 'bg-accentSoft/50' : ''}`}
            >
              <div className="w-5 text-[11px] font-semibold text-soft text-center">{r.rank}</div>
              {r.rank === 1 && <Trophy size={11} className="text-success" />}
              <div className="w-7 h-7 rounded-lg bg-ink text-surface flex items-center justify-center text-[10px] font-semibold">
                {r.initials}
              </div>
              <div className="flex-1 text-[12px] text-ink font-medium">{r.name}</div>
              <div className="text-[11px] text-muted numeric">
                {r.knocks} · <span className="text-ink font-semibold">{r.conv}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}): JSX.Element {
  return (
    <div>
      <div className="text-[10px] text-muted uppercase tracking-wider mb-1">{label}</div>
      <input
        defaultValue={value}
        className={`w-full px-3 py-2.5 rounded-xl border border-line2 bg-paper text-[13px] ${mono ? 'numeric' : ''}`}
      />
    </div>
  );
}
