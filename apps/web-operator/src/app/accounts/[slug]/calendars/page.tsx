'use client';

import { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  Video,
  Phone,
  Home,
  MessageSquare,
  Filter,
  Clock,
  MapPin,
  X,
} from 'lucide-react';
import { Button, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { CalendarsEmpty, FirstRunBanner } from '@/components/AccountEmptyStates';
import { getAccount } from '@/lib/accounts';
import { firstRunSnapshot } from '@/lib/first-run';

type ApptType = 'consult' | 'install' | 'follow-up' | 'demo';

interface Appointment {
  id: string;
  dayIdx: number; // 0-6 (Mon-Sun)
  startHour: number; // e.g. 9.5 = 9:30
  durationHours: number;
  type: ApptType;
  contact: string;
  rep: string;
  repInitials: string;
  location: string;
  channel: 'video' | 'phone' | 'on-site';
  notes: string;
}

const TYPE_STYLES: Record<ApptType, { bg: string; border: string; label: string; dot: string }> = {
  consult: {
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    label: 'text-blue-800',
    dot: 'bg-blue-500',
  },
  install: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    label: 'text-emerald-800',
    dot: 'bg-emerald-500',
  },
  'follow-up': {
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    label: 'text-amber-800',
    dot: 'bg-amber-500',
  },
  demo: {
    bg: 'bg-violet-50',
    border: 'border-violet-300',
    label: 'text-violet-800',
    dot: 'bg-violet-500',
  },
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

function buildAppointments(slug: string): Appointment[] {
  // Vertical-flavored appointment titles
  const isCharity = slug === 'hope-forward' || slug === 'world-vision';
  const isHealth = slug === 'gold-coast-hospital';

  const charityContacts = [
    'Maria Santos · monthly giving',
    'Carter family · legacy gift',
    'Patel Foundation · matching grant',
    'Aisha Williams · child sponsorship',
    'Walker estate · planned giving',
    'David Chen · upgrade tier',
    'Sophia Patel · onboarding',
    'Marcus Brown · renewal',
    'Liam Nguyen · stewardship visit',
    'Eva Novak · major donor brief',
    'Olivia Park · monthly upgrade',
    'James Walker · gift acknowledgment',
  ];

  const commercialContacts = [
    'Riverside Mall · quarterly treatment',
    'Cypress Apartments · termite inspect',
    'Acme Warehouse · annual contract',
    'Sunset Plaza · rodent setup',
    'Bridgeport Office · re-quote',
    'Pine Valley HOA · 14-unit walk',
    'Northbrook Hotel · monthly service',
    'Greenway Restaurant · health audit',
    'Lakewood Storage · install',
    'Westridge Mall · service plan',
    'Maplewood School · termite renewal',
    'Linden Plaza · estimate',
  ];

  const healthcareContacts = [
    'Mrs Henderson · capital gift call',
    'Lockyer family · pledge follow-up',
    'Anderson estate · planned giving',
    'Dr Patel · physician circle',
    'Goldman Family Trust · brief',
    'Hospital Aux · committee call',
    'Mayor Walsh · campaign brief',
    'Rotary GC · partnership',
    'Tan Foundation · matching',
    'Browne family · ward naming',
    'Wong estate · bequest review',
    'O’Brien family · grand opening',
  ];

  const contacts = isCharity ? charityContacts : isHealth ? healthcareContacts : commercialContacts;

  const reps = [
    ['SH', 'Sarah Hopkins'],
    ['JD', 'Jordan Diaz'],
    ['AM', 'Asha Mehta'],
    ['TM', 'Tomás Mendez'],
    ['BR', 'Brodie R.'],
  ];

  const seeds: Array<[number, number, number, ApptType, 'video' | 'phone' | 'on-site']> = [
    [0, 9, 1, 'consult', 'phone'],
    [0, 11, 1.5, 'demo', 'video'],
    [0, 14, 1, 'follow-up', 'phone'],
    [1, 8.5, 1, 'consult', 'video'],
    [1, 10, 2, 'install', 'on-site'],
    [1, 14, 1, 'follow-up', 'phone'],
    [1, 16, 1.5, 'demo', 'video'],
    [2, 9, 1, 'consult', 'phone'],
    [2, 11, 1, 'demo', 'video'],
    [2, 13, 2, 'install', 'on-site'],
    [3, 10, 1, 'follow-up', 'phone'],
    [3, 14, 1.5, 'consult', 'video'],
    [3, 16, 1, 'demo', 'phone'],
    [4, 9, 1.5, 'install', 'on-site'],
    [4, 11.5, 1, 'follow-up', 'phone'],
    [4, 14, 1, 'consult', 'video'],
  ];

  return seeds.map((s, i) => {
    const [day, start, dur, type, channel] = s;
    const rep = reps[i % reps.length]!;
    return {
      id: `appt_${i}`,
      dayIdx: day,
      startHour: start,
      durationHours: dur,
      type,
      contact: contacts[i % contacts.length]!,
      rep: rep[1]!,
      repInitials: rep[0]!,
      location:
        channel === 'video'
          ? 'Google Meet'
          : channel === 'phone'
            ? 'Outbound dial'
            : isCharity
              ? 'Donor home'
              : isHealth
                ? 'Hospital boardroom'
                : 'Customer site',
      channel,
      notes:
        type === 'install'
          ? 'Bring full kit + safety pack'
          : type === 'consult'
            ? 'Open with discovery script v3.2'
            : type === 'demo'
              ? 'Share slide deck + pricing'
              : 'Confirm next step + log outcome',
    };
  });
}

export default function CalendarsPage({ params }: { params: { slug: string } }): JSX.Element {
  const account = getAccount(params.slug);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [typeFilter, setTypeFilter] = useState<ApptType | 'all'>('all');
  const [showNew, setShowNew] = useState(false);

  const firstRun = firstRunSnapshot(params.slug);
  if (!account || firstRun.isFirstRun) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Calendars">
        <div className="space-y-5 max-w-[1400px]">
          {firstRun.isFirstRun && (
            <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          )}
          <CalendarsEmpty slug={params.slug} accountName={firstRun.accountName} />
        </div>
      </AccountShell>
    );
  }

  const allAppts = buildAppointments(params.slug);
  const appts = typeFilter === 'all' ? allAppts : allAppts.filter((a) => a.type === typeFilter);

  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

  const weekDates = DAYS.map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const bookingsThisWeek = appts.length;
  const showRate = 86;
  const avgValue = account.vertical === 'commercial' ? '$1,840' : '$385';
  const openSlots = 7 * HOURS.length - allAppts.reduce((s, a) => s + a.durationHours, 0);

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Calendars">
      <div className="space-y-5 max-w-[1500px]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="Bookings this week"
            value={bookingsThisWeek}
            delta="+22%"
            deltaTone="positive"
            hint="vs last week"
          />
          <KpiCard
            label="Show rate"
            value={`${showRate}%`}
            delta="+4pp"
            deltaTone="positive"
            hint="last 30 days"
          />
          <KpiCard
            label="Avg booking value"
            value={avgValue}
            delta="+11%"
            deltaTone="positive"
            hint="net new revenue"
          />
          <KpiCard label="Open slots" value={Math.round(openSlots)} hint="bookable this week" />
        </div>

        <div className="card !p-0">
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-line2 flex-wrap">
            <div className="flex items-center gap-2">
              <button className="w-7 h-7 rounded hover:bg-paper flex items-center justify-center">
                <ChevronLeft size={14} className="text-soft" />
              </button>
              <div className="text-[13px] font-semibold text-ink">
                Week of {monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
              <button className="w-7 h-7 rounded hover:bg-paper flex items-center justify-center">
                <ChevronRight size={14} className="text-soft" />
              </button>
              <button className="ml-2 px-2 py-1 rounded text-[11px] font-medium bg-paper text-muted hover:bg-line2 hover:text-ink">
                Today
              </button>
            </div>
            <div className="h-6 w-px bg-line2" />
            <div className="flex items-center gap-1.5">
              <Filter size={12} className="text-soft" />
              {(['all', 'consult', 'demo', 'install', 'follow-up'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-2 py-1 rounded text-[11px] font-medium capitalize transition ${
                    typeFilter === t
                      ? 'bg-ink text-surface'
                      : 'bg-paper text-muted hover:bg-line2 hover:text-ink'
                  }`}
                >
                  {t === 'all' ? 'All' : t}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2 text-[11px] text-soft">
              {(['consult', 'demo', 'install', 'follow-up'] as const).map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${TYPE_STYLES[t].dot}`} />
                  <span className="capitalize">{t}</span>
                </span>
              ))}
            </div>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={12} />}
              onClick={() => setShowNew(true)}
            >
              New booking
            </Button>
          </div>

          {/* Week grid */}
          <div className="overflow-x-auto">
            <div className="grid grid-cols-[60px_repeat(7,minmax(140px,1fr))] min-w-[1100px]">
              {/* Header row */}
              <div className="border-b border-r border-line2 bg-paper/60 h-12" />
              {weekDates.map((d, i) => (
                <div
                  key={i}
                  className="border-b border-r border-line2 bg-paper/60 px-3 py-2 text-center"
                >
                  <div className="text-[10px] uppercase tracking-wider text-muted">{DAYS[i]}</div>
                  <div className="text-[14px] font-semibold text-ink numeric">{d.getDate()}</div>
                </div>
              ))}

              {/* Hour rows — use array spread to keep grid flat */}
              {HOURS.flatMap((h) => [
                <div
                  key={`hour-${h}`}
                  className="border-b border-r border-line2 px-2 py-1.5 text-right text-[10px] text-muted numeric h-16"
                >
                  {h > 12 ? `${h - 12}p` : h === 12 ? '12p' : `${h}a`}
                </div>,
                ...DAYS.map((_, dayIdx) => {
                  const cellAppts = appts.filter(
                    (a) => a.dayIdx === dayIdx && Math.floor(a.startHour) === h,
                  );
                  return (
                    <div
                      key={`cell-${h}-${dayIdx}`}
                      className="border-b border-r border-line2 h-16 relative hover:bg-paper/40 transition"
                    >
                      {cellAppts.map((a) => {
                        const offset = (a.startHour - Math.floor(a.startHour)) * 64;
                        const height = a.durationHours * 64 - 2;
                        const style = TYPE_STYLES[a.type];
                        return (
                          <button
                            key={a.id}
                            onClick={() => setSelected(a)}
                            className={`absolute left-0.5 right-0.5 rounded border-l-2 px-1.5 py-1 text-left ${style.bg} ${style.border} hover:shadow-md transition z-10 overflow-hidden`}
                            style={{ top: offset, height }}
                          >
                            <div
                              className={`text-[10px] font-semibold leading-tight truncate ${style.label}`}
                            >
                              {a.contact}
                            </div>
                            <div className="text-[9px] text-muted truncate mt-0.5">
                              {a.repInitials} ·{' '}
                              {a.startHour > 12
                                ? `${a.startHour - 12}p`
                                : a.startHour === 12
                                  ? '12p'
                                  : `${a.startHour}a`}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                }),
              ])}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <Section
              title="Upcoming appointments"
              subtitle={`${appts.length} bookings this week`}
              paddedBody={false}
            >
              <div className="divide-y divide-line2">
                {appts.slice(0, 8).map((a) => {
                  const style = TYPE_STYLES[a.type];
                  const Icon = a.channel === 'video' ? Video : a.channel === 'phone' ? Phone : Home;
                  return (
                    <button
                      key={a.id}
                      onClick={() => setSelected(a)}
                      className="w-full text-left px-5 py-3 hover:bg-paper transition flex items-start gap-3"
                    >
                      <div className={`w-1 self-stretch rounded-full ${style.dot}`} />
                      <span className="mono shrink-0">{a.repInitials}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-[13px] font-medium text-ink truncate">
                            {a.contact}
                          </div>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded ${style.bg} ${style.label} capitalize`}
                          >
                            {a.type}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted mt-0.5 flex items-center gap-2 numeric">
                          <Clock size={9} /> {DAYS[a.dayIdx]}{' '}
                          {a.startHour > 12
                            ? `${a.startHour - 12}p`
                            : a.startHour === 12
                              ? '12p'
                              : `${a.startHour}a`}{' '}
                          · {a.durationHours}h<span className="text-soft">·</span>
                          <Icon size={10} /> {a.location}
                        </div>
                      </div>
                      <StatusPill tone="info">{a.channel}</StatusPill>
                    </button>
                  );
                })}
              </div>
            </Section>
          </div>

          <div className="space-y-4">
            <Section title="Calendars connected" subtitle="Sync sources" paddedBody={false}>
              <div className="divide-y divide-line2">
                {[
                  {
                    name: 'Google Workspace',
                    acct: 'team@d2d',
                    status: 'success' as const,
                    sub: 'Active · 2-way',
                  },
                  {
                    name: 'Outlook 365',
                    acct: 'sarah.h@',
                    status: 'success' as const,
                    sub: 'Active · 2-way',
                  },
                  {
                    name: 'Calendly',
                    acct: 'd2d/booking',
                    status: 'info' as const,
                    sub: 'Inbound webhook',
                  },
                  {
                    name: 'iCal · field reps',
                    acct: '12 reps',
                    status: 'success' as const,
                    sub: 'Push only',
                  },
                ].map((c) => (
                  <div key={c.name} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-medium text-ink truncate">{c.name}</div>
                        <div className="text-[10px] text-muted truncate">{c.acct}</div>
                      </div>
                      <StatusPill tone={c.status}>{c.sub}</StatusPill>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Booking pages" subtitle="Shareable scheduling links">
              <div className="space-y-2">
                {[
                  { name: 'Discovery call (30m)', bookings: 84 },
                  { name: 'Donor visit (60m)', bookings: 32 },
                  { name: 'Recurring sync (15m)', bookings: 119 },
                ].map((b) => (
                  <div
                    key={b.name}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-paper border border-line2"
                  >
                    <div>
                      <div className="text-[12px] font-medium text-ink">{b.name}</div>
                      <div className="text-[10px] text-muted">{b.bookings} bookings · 30d</div>
                    </div>
                    <button className="text-[11px] text-accent font-medium hover:underline">
                      Share
                    </button>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-y-0 right-0 w-[440px] bg-surface border-l border-line2 shadow-2xl z-50 overflow-y-auto">
          <div className="sticky top-0 bg-surface border-b border-line2 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon size={14} className="text-accent" />
              <div className="text-[13px] font-semibold text-ink">Appointment detail</div>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="w-7 h-7 rounded hover:bg-paper flex items-center justify-center"
            >
              <X size={14} className="text-muted" />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <div className="text-[16px] font-semibold text-ink">{selected.contact}</div>
              <div className="text-[12px] text-muted mt-1 capitalize">
                {selected.type} · {selected.channel}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="card card-pad">
                <div className="text-[10px] uppercase tracking-wider text-muted">When</div>
                <div className="text-[13px] font-semibold text-ink mt-1 numeric">
                  {DAYS[selected.dayIdx]}{' '}
                  {selected.startHour > 12
                    ? `${selected.startHour - 12}:${(selected.startHour % 1) * 60 || '00'}p`
                    : `${selected.startHour}:${(selected.startHour % 1) * 60 || '00'}a`}
                </div>
                <div className="text-[10px] text-muted">{selected.durationHours}h block</div>
              </div>
              <div className="card card-pad">
                <div className="text-[10px] uppercase tracking-wider text-muted">Rep</div>
                <div className="text-[13px] font-semibold text-ink mt-1 flex items-center gap-2">
                  <span className="mono">{selected.repInitials}</span> {selected.rep}
                </div>
              </div>
            </div>
            <div className="card card-pad">
              <div className="text-[10px] uppercase tracking-wider text-muted">Location</div>
              <div className="text-[13px] text-ink mt-1 flex items-center gap-1.5">
                <MapPin size={11} className="text-soft" /> {selected.location}
              </div>
            </div>
            <div className="card card-pad">
              <div className="text-[10px] uppercase tracking-wider text-muted">Notes</div>
              <div className="text-[12.5px] text-ink mt-1">{selected.notes}</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="secondary" size="sm" leftIcon={<Phone size={12} />}>
                Call
              </Button>
              <Button variant="secondary" size="sm" leftIcon={<MessageSquare size={12} />}>
                SMS
              </Button>
              <Button variant="primary" size="sm">
                Join
              </Button>
            </div>
          </div>
        </div>
      )}

      {showNew && (
        <div
          className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-6"
          onClick={() => setShowNew(false)}
        >
          <div
            className="bg-surface rounded-2xl shadow-2xl w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[15px] font-semibold text-ink mb-4">New booking</div>
            <div className="space-y-2 mb-4">
              <input
                className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px]"
                placeholder="Contact name"
                autoFocus
              />
              <input
                className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px]"
                placeholder="Date & time"
              />
              <select className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px]">
                <option>Consult</option>
                <option>Demo</option>
                <option>Install</option>
                <option>Follow-up</option>
              </select>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowNew(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={() => setShowNew(false)}>
                Book it
              </Button>
            </div>
          </div>
        </div>
      )}
    </AccountShell>
  );
}
