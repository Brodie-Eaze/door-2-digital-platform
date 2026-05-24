import {
  CalendarClock,
  Coffee,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { Banner, Button, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';

// 7-day calendar with shifts per rep
const REPS = [
  {
    initials: 'JM',
    name: 'Jordan Mosley',
    account: 'Hope Forward',
    shifts: [
      { d: 0, s: '09:00', e: '17:00', t: 'Austin East', lunch: '12:00-12:45' },
      { d: 1, s: '09:00', e: '17:00', t: 'Austin East', lunch: '12:00-12:45' },
      { d: 2, s: '09:00', e: '17:00', t: 'Austin East' },
      { d: 3, s: '09:00', e: '17:00', t: 'Austin East' },
      { d: 4, s: '09:00', e: '17:00', t: 'Austin East' },
    ],
  },
  {
    initials: 'JD',
    name: 'Jada Davis',
    account: 'Hope Forward',
    shifts: [
      { d: 0, s: '09:00', e: '17:00', t: 'Austin East' },
      { d: 1, s: '09:00', e: '17:00', t: 'Austin East' },
      { d: 2, s: '09:00', e: '17:00', t: 'Austin North' },
      { d: 3, s: '09:00', e: '17:00', t: 'Austin North' },
      { d: 5, s: '10:00', e: '16:00', t: 'Austin East' },
    ],
  },
  {
    initials: 'AR',
    name: 'Aaliyah Reed',
    account: 'Hope Forward',
    shifts: [
      { d: 0, s: '09:00', e: '17:00', t: 'Austin North' },
      { d: 1, s: '09:00', e: '17:00', t: 'Austin North' },
      { d: 3, s: '09:00', e: '17:00', t: 'Austin North' },
      { d: 4, s: '09:00', e: '17:00', t: 'Austin North' },
    ],
  },
  {
    initials: 'TM',
    name: 'Tomás Mendez',
    account: 'Hope Forward',
    shifts: [
      { d: 0, s: '09:00', e: '17:00', t: 'Austin East', lunch: '12:48-CURRENT' },
      { d: 1, s: '09:00', e: '17:00', t: 'Austin East' },
      { d: 2, s: '09:00', e: '17:00', t: 'Austin East' },
      { d: 4, s: '09:00', e: '17:00', t: 'Austin East' },
    ],
  },
  {
    initials: 'AM',
    name: 'Asha Mehta',
    account: 'Hope Forward',
    shifts: [
      { d: 0, s: '09:30', e: '17:30', t: 'Dallas Metro' },
      { d: 1, s: '09:30', e: '17:30', t: 'Dallas Metro' },
      { d: 2, s: '09:30', e: '17:30', t: 'Dallas Metro' },
      { d: 3, s: '09:30', e: '17:30', t: 'Dallas Metro' },
    ],
  },
  {
    initials: 'BC',
    name: 'Bianca Costa',
    account: 'PestMax',
    shifts: [
      { d: 0, s: '08:00', e: '16:00', t: 'Dallas North' },
      { d: 1, s: '08:00', e: '16:00', t: 'Dallas North' },
      { d: 2, s: '08:00', e: '16:00', t: 'Dallas North' },
    ],
  },
  {
    initials: 'HK',
    name: 'Hiroshi Kato',
    account: 'PestMax',
    shifts: [
      { d: 0, s: '08:00', e: '16:00', t: 'Dallas North' },
      { d: 2, s: '08:00', e: '16:00', t: 'Dallas North' },
      { d: 4, s: '08:00', e: '16:00', t: 'Dallas North' },
    ],
  },
  {
    initials: 'KP',
    name: 'Kim Park',
    account: 'Hope Forward',
    shifts: [
      { d: 0, s: '09:00', e: '17:00', t: 'Houston SE' },
      { d: 1, s: '09:00', e: '17:00', t: 'Houston SE' },
      { d: 3, s: '09:00', e: '17:00', t: 'Houston SE' },
      { d: 4, s: '09:00', e: '17:00', t: 'Houston SE' },
    ],
  },
  {
    initials: 'DR',
    name: 'Devon Russell',
    account: 'Hope Forward',
    shifts: [
      { d: 0, s: '09:00', e: '17:00', t: 'Houston SE', missing: true },
      { d: 2, s: '09:00', e: '17:00', t: 'Houston SE' },
      { d: 4, s: '09:00', e: '17:00', t: 'Houston SE' },
    ],
  },
  {
    initials: 'ML',
    name: 'Marcus Lee',
    account: 'Hope Forward',
    shifts: [
      { d: 0, s: '09:00', e: '17:00', t: 'Houston SE' },
      { d: 1, s: '09:00', e: '17:00', t: 'Houston SE' },
      { d: 2, s: '09:00', e: '17:00', t: 'Houston SE' },
      { d: 3, s: '09:00', e: '17:00', t: 'Houston SE' },
      { d: 4, s: '09:00', e: '17:00', t: 'Houston SE' },
    ],
  },
];

const DAYS = ['Mon 19', 'Tue 20', 'Wed 21', 'Thu 22', 'Fri 23', 'Sat 24', 'Sun 25'];

export default function RosterPage(): JSX.Element {
  const todayHrs = REPS.reduce((s, r) => s + (r.shifts.find((sh) => sh.d === 0) ? 8 : 0), 0);

  return (
    <PlatformShell pageTitle="Roster & shifts">
      <div className="space-y-5 max-w-[1700px]">
        <Banner tone="info">
          <span className="text-[13px]">
            Full rostering for every Knocker iOS user. Hours auto-logged from app clock-in. Lunch
            breaks tracked. Drag-drop to reassign shifts. Pushes changes instantly to the rep&apos;s
            iPad.
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard
            label="Scheduled today"
            value={REPS.filter((r) => r.shifts.some((s) => s.d === 0)).length}
            hint={`of ${REPS.length} total`}
          />
          <KpiCard
            label="Hours today"
            value={`${todayHrs}h`}
            hint={`${todayHrs * 8} expected knocks`}
          />
          <KpiCard label="On lunch now" value="1" hint="Tomás · 38m" />
          <KpiCard label="Missed shifts" value="1" hint="Devon · auto-SMS sent" />
          <KpiCard label="Overtime risk" value="0" hint="all within 40h cap" />
        </div>

        {/* Week selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button className="w-8 h-8 rounded-lg border border-line2 hover:bg-paper flex items-center justify-center">
              <ChevronLeft size={14} className="text-soft" />
            </button>
            <div className="text-[15px] font-semibold text-ink">Week of May 19, 2026</div>
            <button className="w-8 h-8 rounded-lg border border-line2 hover:bg-paper flex items-center justify-center">
              <ChevronRight size={14} className="text-soft" />
            </button>
            <button className="ml-2 text-[12px] text-accent font-medium">This week</button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              Day view
            </Button>
            <Button variant="ghost" size="sm">
              Month view
            </Button>
            <Button variant="primary" size="sm" leftIcon={<Plus size={13} />}>
              Add shift
            </Button>
          </div>
        </div>

        {/* Roster calendar */}
        <Section title="Week schedule" subtitle="All accounts · all Knockers" paddedBody={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr>
                  <th
                    className="text-left px-4 py-3 border-b border-line2 text-[11px] uppercase tracking-wider text-muted font-medium"
                    style={{ minWidth: 180 }}
                  >
                    Knocker
                  </th>
                  {DAYS.map((d, i) => (
                    <th
                      key={d}
                      className={`text-left px-3 py-3 border-b border-line2 text-[11px] uppercase tracking-wider font-medium ${i === 0 ? 'text-accent bg-accentSoft/30' : 'text-muted'}`}
                      style={{ minWidth: 130 }}
                    >
                      {d} {i === 0 && <span className="text-[9px] text-accent">· TODAY</span>}
                    </th>
                  ))}
                  <th className="text-right px-4 py-3 border-b border-line2 text-[11px] uppercase tracking-wider text-muted font-medium">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {REPS.map((r) => {
                  const totalHrs = r.shifts.reduce((s, sh) => s + 8, 0);
                  return (
                    <tr key={r.initials} className="hover:bg-paper/40">
                      <td className="px-4 py-3 border-b border-line2">
                        <div className="flex items-center gap-2">
                          <span className="mono">{r.initials}</span>
                          <div>
                            <div className="text-[13px] font-medium text-ink">{r.name}</div>
                            <div className="text-[10px] text-muted">{r.account}</div>
                          </div>
                        </div>
                      </td>
                      {DAYS.map((_, di) => {
                        const shift = r.shifts.find((s) => s.d === di);
                        if (!shift)
                          return (
                            <td key={di} className="px-3 py-3 border-b border-line2">
                              <div className="h-12 bg-paper/40 border border-dashed border-line2 rounded-md flex items-center justify-center text-[10px] text-soft">
                                Off
                              </div>
                            </td>
                          );
                        const sh = shift as {
                          d: number;
                          s: string;
                          e: string;
                          t: string;
                          lunch?: string;
                          missing?: boolean;
                        };
                        const missing = sh.missing === true;
                        const onLunch = !!sh.lunch && sh.lunch.includes('CURRENT');
                        return (
                          <td key={di} className="px-3 py-3 border-b border-line2">
                            <div
                              className={`p-2 rounded-md border ${
                                missing
                                  ? 'bg-rose-50 border-rose-300'
                                  : onLunch
                                    ? 'bg-amber-50 border-amber-300'
                                    : di === 0
                                      ? 'bg-accentSoft border-accent/30'
                                      : 'bg-paper border-line2'
                              } cursor-grab hover:shadow-sm transition`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="text-[11px] font-semibold text-ink numeric">
                                  {sh.s}–{sh.e}
                                </div>
                                {missing && <AlertCircle size={11} className="text-rose-500" />}
                                {onLunch && <Coffee size={11} className="text-amber-600" />}
                              </div>
                              <div className="text-[10px] text-muted truncate mt-0.5">{sh.t}</div>
                              {sh.lunch && (
                                <div
                                  className={`text-[9px] mt-1 font-medium ${onLunch ? 'text-amber-700' : 'text-soft'}`}
                                >
                                  🍽 {sh.lunch}
                                </div>
                              )}
                              {missing && (
                                <div className="text-[9px] mt-1 font-medium text-rose-700">
                                  No clock-in · SMS sent
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 border-b border-line2 text-right">
                        <div className="text-[13px] font-semibold text-ink numeric">
                          {totalHrs}h
                        </div>
                        <div className="text-[10px] text-soft">{r.shifts.length} shifts</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Time tracking detail */}
        <Section
          title="Today · live time tracking"
          subtitle="Clock-in / out + lunch breaks · auto-captured from Knocker iOS"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                who: 'Tomás Mendez',
                initials: 'TM',
                clockIn: '09:00',
                lunchStart: '12:48',
                lunchDuration: '38m',
                status: 'On lunch',
                tone: 'warn',
              },
              {
                who: 'Devon Russell',
                initials: 'DR',
                clockIn: 'Missed',
                lunchStart: '—',
                lunchDuration: '—',
                status: 'No clock-in',
                tone: 'danger',
              },
              {
                who: 'Jordan Mosley',
                initials: 'JM',
                clockIn: '09:00',
                lunchStart: 'Pending',
                lunchDuration: '—',
                status: 'Active · 4h 12m',
                tone: 'success',
              },
            ].map((t, i) => (
              <div key={i} className="card card-pad">
                <div className="flex items-center gap-2 mb-3">
                  <span className="mono">{t.initials}</span>
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold text-ink">{t.who}</div>
                    <StatusPill tone={t.tone as 'success' | 'warn' | 'danger'}>
                      {t.status}
                    </StatusPill>
                  </div>
                </div>
                <div className="space-y-1.5 text-[12px]">
                  <div className="flex justify-between">
                    <span className="text-muted flex items-center gap-1">
                      <Clock size={11} /> Clock-in
                    </span>
                    <span className="text-ink numeric font-medium">{t.clockIn}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted flex items-center gap-1">
                      <Coffee size={11} /> Lunch start
                    </span>
                    <span className="text-ink numeric font-medium">{t.lunchStart}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Lunch duration</span>
                    <span className="text-ink numeric font-medium">{t.lunchDuration}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </PlatformShell>
  );
}
