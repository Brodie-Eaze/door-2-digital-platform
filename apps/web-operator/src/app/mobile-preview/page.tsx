import {
  MapPin,
  Clock,
  Inbox,
  User,
  Plus,
  Wifi,
  BatteryFull,
  Camera,
  PenTool,
  Check,
} from 'lucide-react';
import { Banner } from '@d2d/ui-web';
import { PlatformShell as OperatorShell } from '@/components/PlatformShell';
import { NoctuaPhoneMap } from '@/components/NoctuaPhoneMap';

/**
 * iPhoneMock-sized mock of the knocker iOS app for demo purposes.
 * The real native app is built in Xcode (Swift/SwiftUI) per ADR-0003.
 */
export default function MobilePreviewPage(): JSX.Element {
  return (
    <OperatorShell pageTitle="Knocker iOS — preview">
      <div className="space-y-6 max-w-[1280px]">
        <Banner tone="info">
          <span className="text-[13px]">
            This is a web preview of the native iOS knocker app. Real app is built in Xcode (Swift /
            SwiftUI) per <code className="kbd">ADR-0003</code>. Distributed via TestFlight +
            Internal Testing under D2D&apos;s Apple Developer account.
          </span>
        </Banner>

        <div className="flex flex-wrap items-start gap-8 justify-center py-8">
          <PhoneMock variant="map" />
          <PhoneMock variant="sheet" />
          <PhoneMock variant="leaderboard" />
        </div>
      </div>
    </OperatorShell>
  );
}

function PhoneMock({ variant }: { variant: 'map' | 'sheet' | 'leaderboard' }) {
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
      {/* Dynamic island */}
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
        {/* Status bar */}
        <div className="flex items-center justify-between px-6 pt-2 pb-1 text-[11px] font-semibold text-ink">
          <span className="numeric">9:41</span>
          <div className="w-20" />
          <div className="flex items-center gap-1">
            <Wifi size={11} />
            <BatteryFull size={13} />
          </div>
        </div>

        {variant === 'map' && <MapScreen />}
        {variant === 'sheet' && <SheetScreen />}
        {variant === 'leaderboard' && <MeScreen />}

        {/* Tab bar */}
        <div
          className="absolute bottom-0 left-0 right-0 bg-surface border-t border-line2 px-6 py-3 flex items-center justify-between"
          style={{ paddingBottom: 22 }}
        >
          {[
            { icon: MapPin, label: 'Map', active: variant === 'map' || variant === 'sheet' },
            { icon: Clock, label: 'Schedule', active: false },
            { icon: Inbox, label: 'Inbox', active: false },
            { icon: User, label: 'Me', active: variant === 'leaderboard' },
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
      </div>
    </div>
  );
}

function MapScreen() {
  return (
    <div className="relative h-full" style={{ paddingBottom: 80 }}>
      {/* REAL satellite map (Esri World Imagery + boundaries overlay) */}
      <div className="relative h-full">
        <NoctuaPhoneMap />

        {/* Top status pill — floats above map */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-[1000] pointer-events-none">
          <div className="bg-surface/95 backdrop-blur px-3 py-1.5 rounded-full text-[11px] border border-line2 flex items-center gap-1.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-ink font-medium">Austin East · 8 / 248 knocks</span>
          </div>
          <div className="bg-surface/95 backdrop-blur px-2 py-1.5 rounded-full text-[10px] border border-line2 numeric text-ink shadow-sm">
            ±3m
          </div>
        </div>

        {/* Knock here FAB — floats above map */}
        <button
          className="absolute right-4 flex items-center gap-1.5 text-surface font-semibold text-[13px] shadow-lg z-[1000]"
          style={{
            bottom: 100,
            background: '#0F172A',
            padding: '12px 18px',
            borderRadius: 999,
          }}
        >
          <Plus size={16} />
          Knock here
        </button>
      </div>
    </div>
  );
}

function SheetScreen() {
  return (
    <div className="relative h-full bg-paper" style={{ paddingBottom: 80 }}>
      {/* Map dimmed in background */}
      <div className="absolute inset-0 bg-ink/40" />

      {/* Bottom sheet */}
      <div
        className="absolute left-0 right-0 bg-surface rounded-t-3xl shadow-lg"
        style={{ bottom: 0, paddingBottom: 80 }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3">
          <div className="w-10 h-1 rounded-full bg-line" />
        </div>

        {/* Address */}
        <div className="px-5 pt-3 pb-2">
          <div className="text-[12px] text-muted">4218 Lakeview Dr</div>
          <div className="text-[15px] font-semibold text-ink">Austin TX 78739</div>
        </div>

        {/* Disposition wheel */}
        <div className="px-5 py-3">
          <div className="text-[11px] uppercase tracking-wider text-muted mb-2">Disposition</div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'SALE', color: 'bg-success text-surface', big: true },
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

        {/* Quick lead form */}
        <div className="px-5 pt-2 pb-4 space-y-2">
          <input
            className="w-full px-3 py-2.5 rounded-xl border border-line2 bg-paper text-[13px]"
            placeholder="Name"
            defaultValue="Maria Santos"
          />
          <input
            className="w-full px-3 py-2.5 rounded-xl border border-line2 bg-paper text-[13px] numeric"
            placeholder="PhoneMock"
            defaultValue="(512) 555-0182"
          />
          <div className="flex items-center gap-2 pt-1">
            <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-line2 bg-surface text-[12px] text-ink">
              <Camera size={14} /> Photo
            </button>
            <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-line2 bg-surface text-[12px] text-ink">
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
