'use client';

import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  CheckSquare,
  Plus,
  Filter,
  LayoutGrid,
  TableProperties,
  Calendar,
  Flag,
  MoreVertical,
  Search,
  X,
  Clock,
  AlertCircle,
  Paperclip,
  MessageSquare,
} from 'lucide-react';
import { Button, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { TasksEmpty, FirstRunBanner } from '@/components/AccountEmptyStates';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { toast } from '@/components/Toaster';
import { getAccount } from '@/lib/accounts';
import { firstRunSnapshot } from '@/lib/first-run';

type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
type Priority = 'low' | 'medium' | 'high' | 'critical';

interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assignee: string;
  assigneeInitials: string;
  dueDate: string; // human-readable
  dueOffsetDays: number; // negative = overdue
  tag: string;
  attachments: number;
  comments: number;
}

const COLUMNS: { id: TaskStatus; label: string; tone: string }[] = [
  { id: 'todo', label: 'To do', tone: 'bg-slate-400' },
  { id: 'in_progress', label: 'In progress', tone: 'bg-blue-500' },
  { id: 'review', label: 'Review', tone: 'bg-amber-500' },
  { id: 'done', label: 'Done', tone: 'bg-emerald-500' },
];

const PRIORITY_STYLES: Record<Priority, { color: string; label: string; bg: string }> = {
  low: { color: 'text-soft', label: 'Low', bg: 'bg-slate-100' },
  medium: { color: 'text-accent', label: 'Med', bg: 'bg-blue-50' },
  high: { color: 'text-amber-700', label: 'High', bg: 'bg-amber-50' },
  critical: { color: 'text-rose-700', label: 'Crit', bg: 'bg-rose-50' },
};

function buildTasks(slug: string): Task[] {
  const isCharity = slug === 'hope-forward' || slug === 'world-vision';
  const isHealth = slug === 'gold-coast-hospital';

  const reps = [
    ['SH', 'Sarah Hopkins'],
    ['JD', 'Jordan Diaz'],
    ['AM', 'Asha Mehta'],
    ['TM', 'Tomás Mendez'],
    ['BR', 'Brodie R.'],
    ['MK', 'Maya Kim'],
    ['DR', 'Devon Russell'],
  ];

  let titles: { title: string; desc: string; tag: string }[];
  if (isCharity) {
    titles = [
      {
        title: 'Follow up on Walker estate gift',
        desc: 'Confirm matching cap by Friday',
        tag: 'Major gifts',
      },
      {
        title: 'Update donor portal copy',
        desc: 'New impact-story block in hero',
        tag: 'Marketing',
      },
      {
        title: 'Reconcile Stripe payouts · Wk 21',
        desc: 'Match Stripe → bank → Ledger',
        tag: 'Finance',
      },
      {
        title: 'Schedule field-trip for top 12 donors',
        desc: 'Coordinate transport + lunch',
        tag: 'Stewardship',
      },
      { title: 'Draft gala 2026 sponsorship deck', desc: '10-slide tiered package', tag: 'Events' },
      {
        title: 'A/B test monthly upgrade flow',
        desc: 'Test variant: anchor on annual',
        tag: 'CRO',
      },
      {
        title: 'Approve script v3.3 for door reps',
        desc: 'New compliance disclaimer',
        tag: 'Field ops',
      },
      {
        title: 'Review Q2 program impact metrics',
        desc: '12 KPIs across 4 programs',
        tag: 'Impact',
      },
      {
        title: 'Call Patel Foundation re: grant cycle',
        desc: 'Confirm Aug deadline',
        tag: 'Grants',
      },
      { title: 'Refresh donor receipts copy', desc: 'IRS letter language v2', tag: 'Compliance' },
      {
        title: 'Tag legacy circle members in CRM',
        desc: 'Build segment for Dec mailing',
        tag: 'CRM',
      },
      { title: 'Plan Jan ambassador retreat', desc: '24-person 3-day offsite', tag: 'Stewardship' },
      { title: 'Audit form submissions · last 7d', desc: '12 forms · funnel review', tag: 'CRO' },
      { title: 'Coordinate appeals print run', desc: '48k pieces · 4 versions', tag: 'Marketing' },
      { title: 'Brief new board members', desc: '2hr onboarding + tour', tag: 'Board' },
      { title: 'Refresh thank-you video', desc: '60s · sponsor highlight', tag: 'Marketing' },
      { title: 'Verify ACNC return data', desc: 'FY26 figures by end of week', tag: 'Compliance' },
      { title: 'Launch SMS campaign · Dec', desc: 'Cohort: lapsed >12mo', tag: 'Marketing' },
    ];
  } else if (isHealth) {
    titles = [
      {
        title: 'Confirm Mrs Henderson capital gift',
        desc: '$2M pledge over 5yrs',
        tag: 'Major gifts',
      },
      { title: 'Tour booking · Premier visit', desc: 'Block 3hrs + boardroom', tag: 'Stewardship' },
      {
        title: 'New wing renderings · sign-off',
        desc: 'Architect package due Fri',
        tag: 'Project',
      },
      { title: 'Patient family resource kit', desc: 'Print + digital · 200 copies', tag: 'Care' },
      {
        title: 'Physician circle quarterly call',
        desc: '8 doctors · agenda + prep',
        tag: 'Engagement',
      },
      {
        title: 'Update bequest declaration form',
        desc: 'Solicitor reviewed v3',
        tag: 'Compliance',
      },
      { title: 'Reconcile foundation Stripe payouts', desc: 'Wk 21 close', tag: 'Finance' },
      { title: 'Brief board on capital trajectory', desc: 'Q-end deck · 12 slides', tag: 'Board' },
      {
        title: 'Approve naming-rights brochure',
        desc: '4 levels · pricing locked',
        tag: 'Marketing',
      },
      { title: 'Volunteer credential renewals', desc: '24 vols · police checks', tag: 'Volunteer' },
      { title: 'Q-end donor wall update', desc: '11 new names · plaque order', tag: 'Stewardship' },
      { title: 'Refresh patient story copy', desc: '3 features · video + print', tag: 'Marketing' },
      {
        title: 'Coordinate ambassador lunch',
        desc: '18 attendees · catering brief',
        tag: 'Events',
      },
      { title: 'Set up Salesforce sync v2', desc: 'Map fields · resolve dupes', tag: 'CRM' },
      { title: 'GOPM audit prep', desc: 'Pull 7yr donor records', tag: 'Compliance' },
    ];
  } else {
    titles = [
      {
        title: 'Quote Riverside Mall · multi-site',
        desc: '8 locations · annual rate',
        tag: 'Sales',
      },
      { title: 'Termite re-treat · Maple Ave', desc: 'Customer reported activity', tag: 'Service' },
      { title: 'Tech route optimization · Wk 21', desc: 'Reduce drive time 12%', tag: 'Ops' },
      { title: 'Annual renewal · Acme Warehouse', desc: 'Re-quote at +6%', tag: 'Retention' },
      {
        title: 'Hire 2 more techs for Phoenix',
        desc: 'Drop 1.4d avg response time',
        tag: 'Hiring',
      },
      { title: 'Update door-knock script', desc: 'New seasonal hook · termite', tag: 'Field ops' },
      { title: 'Audit Stripe payouts · Wk 21', desc: 'Reconcile bank vs charges', tag: 'Finance' },
      { title: 'Customer NPS review · Q2', desc: '184 responses · top complaints', tag: 'CX' },
      { title: 'Refresh service plan landing page', desc: 'A/B test tier framing', tag: 'CRO' },
      { title: 'Train techs on new chemical', desc: '2hr cert · all 32 staff', tag: 'Compliance' },
      {
        title: 'Customer winback · 90d lapsed',
        desc: 'SMS + email blast cohort',
        tag: 'Retention',
      },
      { title: 'Q-end commission run', desc: 'Calculate + payout 32 reps', tag: 'Finance' },
      { title: 'Wholesale chemical order · Aug', desc: 'Bulk order · price-locked', tag: 'Ops' },
      { title: 'Schedule annual fleet service', desc: '14 vehicles · stagger 2wks', tag: 'Ops' },
    ];
  }

  const statuses: TaskStatus[] = [
    'todo',
    'todo',
    'todo',
    'todo',
    'in_progress',
    'in_progress',
    'in_progress',
    'review',
    'review',
    'done',
    'done',
    'done',
    'todo',
    'in_progress',
    'review',
    'todo',
    'done',
    'in_progress',
  ];
  const priorities: Priority[] = [
    'high',
    'critical',
    'medium',
    'low',
    'high',
    'medium',
    'critical',
    'medium',
    'low',
    'high',
    'medium',
    'low',
    'critical',
    'high',
    'medium',
    'high',
    'low',
    'medium',
  ];
  const dueDays = [-2, 0, 1, 3, 0, 2, -1, 1, 4, -5, 7, 2, -3, 1, 5, 0, -8, 3];

  return titles.map((t, i) => {
    const rep = reps[i % reps.length]!;
    const due = dueDays[i % dueDays.length]!;
    return {
      id: `task_${i}`,
      title: t.title,
      description: t.desc,
      status: statuses[i % statuses.length]!,
      priority: priorities[i % priorities.length]!,
      assignee: rep[1]!,
      assigneeInitials: rep[0]!,
      dueDate:
        due === 0
          ? 'Today'
          : due < 0
            ? `${Math.abs(due)}d overdue`
            : due === 1
              ? 'Tomorrow'
              : `in ${due}d`,
      dueOffsetDays: due,
      tag: t.tag,
      attachments: i % 3,
      comments: i % 4,
    };
  });
}

export default function TasksPage({ params }: { params: { slug: string } }): JSX.Element {
  const account = getAccount(params.slug);
  const initial = useMemo(() => buildTasks(params.slug), [params.slug]);
  const [tasks, setTasks] = useState<Task[]>(initial);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all');
  const [query, setQuery] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [hoverCol, setHoverCol] = useState<TaskStatus | null>(null);
  const [selected, setSelected] = useState<Task | null>(null);
  const justDraggedRef = useRef(false);

  const filtered = tasks
    .filter((t) => (priorityFilter === 'all' ? true : t.priority === priorityFilter))
    .filter((t) => t.title.toLowerCase().includes(query.toLowerCase()));

  // Escape-key closes detail drawer — declared before any conditional return
  // so hook order is stable across renders (rules-of-hooks).
  useEffect(() => {
    function k(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelected(null);
    }
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, []);

  const firstRun = firstRunSnapshot(params.slug);
  if (!account || firstRun.isFirstRun) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Tasks">
        <div className="space-y-5 max-w-[1400px]">
          {firstRun.isFirstRun && (
            <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          )}
          <TasksEmpty slug={params.slug} accountName={firstRun.accountName} />
        </div>
      </AccountShell>
    );
  }

  const openTasks = tasks.filter((t) => t.status !== 'done').length;
  const dueToday = tasks.filter((t) => t.dueOffsetDays === 0 && t.status !== 'done').length;
  const overdue = tasks.filter((t) => t.dueOffsetDays < 0 && t.status !== 'done').length;
  const completedThisWeek = tasks.filter((t) => t.status === 'done').length;

  function onDragStart(id: string) {
    return (e: DragEvent<HTMLDivElement>) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
      setDragId(id);
      justDraggedRef.current = true;
    };
  }
  function onDragEnd() {
    setDragId(null);
    setHoverCol(null);
    setTimeout(() => {
      justDraggedRef.current = false;
    }, 50);
  }
  function onDragOver(col: TaskStatus) {
    return (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setHoverCol(col);
    };
  }
  function onDrop(col: TaskStatus) {
    return (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const id = e.dataTransfer.getData('text/plain') || dragId;
      if (id) {
        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: col } : t)));
      }
      setDragId(null);
      setHoverCol(null);
    };
  }
  function onCardClick(t: Task) {
    return () => {
      if (justDraggedRef.current) return;
      setSelected(t);
    };
  }

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Tasks">
      <div className="space-y-4 max-w-[1500px]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Open tasks" value={openTasks} hint={`${tasks.length} total`} />
          <KpiCard
            label="Due today"
            value={dueToday}
            deltaTone={dueToday > 0 ? 'negative' : 'positive'}
            delta={dueToday > 0 ? 'attention' : 'on track'}
          />
          <KpiCard
            label="Overdue"
            value={overdue}
            deltaTone={overdue > 0 ? 'negative' : 'positive'}
            delta={overdue > 0 ? 'past SLA' : 'clear'}
          />
          <KpiCard
            label="Completed · this week"
            value={completedThisWeek}
            delta="+18%"
            deltaTone="positive"
          />
        </div>

        <div className="card !p-0">
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-line2 flex-wrap">
            <div className="flex items-center bg-paper rounded-lg p-0.5 border border-line2">
              {[
                { v: 'kanban' as const, icon: LayoutGrid, label: 'Kanban' },
                { v: 'list' as const, icon: TableProperties, label: 'List' },
              ].map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setView(opt.v)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition ${
                    view === opt.v ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
                  }`}
                >
                  <opt.icon size={13} />
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="h-6 w-px bg-line2" />
            <div className="flex items-center gap-1.5">
              <Filter size={12} className="text-soft" />
              {(['all', 'critical', 'high', 'medium', 'low'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriorityFilter(p)}
                  className={`px-2 py-1 rounded text-[11px] font-medium capitalize transition ${
                    priorityFilter === p
                      ? 'bg-ink text-surface'
                      : 'bg-paper text-muted hover:bg-line2 hover:text-ink'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="h-6 w-px bg-line2" />
            <div className="flex items-center gap-2 flex-1 min-w-[160px] max-w-xs">
              <Search size={12} className="text-soft" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="flex-1 bg-transparent text-[12px] text-ink placeholder:text-soft outline-none"
              />
            </div>
            <div className="flex-1" />
            <DataSourceBadge source="fixture" />
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={12} />}
              onClick={() => toast.info('New task — composer lands in Phase 1.2')}
            >
              New task
            </Button>
          </div>
        </div>

        {view === 'kanban' && (
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3"
            style={{ minHeight: 540 }}
          >
            {COLUMNS.map((col) => {
              const colTasks = filtered.filter((t) => t.status === col.id);
              const isHover = hoverCol === col.id;
              return (
                <div
                  key={col.id}
                  onDragOver={onDragOver(col.id)}
                  onDragLeave={(e) => {
                    const rt = e.relatedTarget as Node | null;
                    if (!rt || !(e.currentTarget as Node).contains(rt)) setHoverCol(null);
                  }}
                  onDrop={onDrop(col.id)}
                  className={`flex flex-col rounded-xl border-2 transition ${
                    isHover ? 'border-accent shadow-lg bg-accentSoft/40' : 'border-line2 bg-surface'
                  }`}
                >
                  <div className="px-3 py-3 border-b border-line2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${col.tone}`} />
                      <div className="text-[13px] font-semibold text-ink tracking-tight">
                        {col.label}
                      </div>
                      <span className="mono !w-5 !h-5 !text-[10px]">{colTasks.length}</span>
                    </div>
                    <button
                      onClick={() =>
                        toast.info(`"${col.label}" column actions — menu lands in Phase 1.2`)
                      }
                      className="w-6 h-6 rounded hover:bg-paper flex items-center justify-center"
                    >
                      <MoreVertical size={13} className="text-soft" />
                    </button>
                  </div>
                  <div className="flex-1 p-2 space-y-2 overflow-y-auto bg-paper/30">
                    {colTasks.map((t) => {
                      const isDragging = dragId === t.id;
                      const ps = PRIORITY_STYLES[t.priority];
                      const dueColor =
                        t.dueOffsetDays < 0
                          ? 'text-rose-600'
                          : t.dueOffsetDays === 0
                            ? 'text-amber-600'
                            : 'text-muted';
                      return (
                        <div
                          key={t.id}
                          draggable
                          onDragStart={onDragStart(t.id)}
                          onDragEnd={onDragEnd}
                          onClick={onCardClick(t)}
                          className={`bg-surface border border-line2 rounded-lg transition cursor-grab active:cursor-grabbing hover:shadow-md hover:border-line ${
                            isDragging ? 'opacity-30 scale-95 rotate-1' : ''
                          }`}
                        >
                          <div className="p-3 space-y-2">
                            <div className="flex items-start gap-2">
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${ps.color} ${ps.bg}`}
                              >
                                {ps.label}
                              </span>
                              <span className="text-[10px] text-muted">{t.tag}</span>
                            </div>
                            <div className="text-[12.5px] font-semibold text-ink leading-tight">
                              {t.title}
                            </div>
                            <div className="text-[11px] text-muted leading-snug line-clamp-2">
                              {t.description}
                            </div>
                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-line2">
                              <div className="flex items-center gap-1.5 text-[10px] text-soft">
                                {t.attachments > 0 && (
                                  <span className="flex items-center gap-0.5">
                                    <Paperclip size={9} /> {t.attachments}
                                  </span>
                                )}
                                {t.comments > 0 && (
                                  <span className="flex items-center gap-0.5">
                                    <MessageSquare size={9} /> {t.comments}
                                  </span>
                                )}
                                <span className={`flex items-center gap-0.5 numeric ${dueColor}`}>
                                  <Clock size={9} /> {t.dueDate}
                                </span>
                              </div>
                              <span className="mono !w-5 !h-5 !text-[9px]">
                                {t.assigneeInitials}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {colTasks.length === 0 && (
                      <div
                        className={`text-[11px] text-center py-12 border-2 border-dashed rounded-lg transition ${
                          isHover
                            ? 'border-accent bg-accentSoft/50 text-accent font-semibold'
                            : 'border-line2 text-soft'
                        }`}
                      >
                        {isHover ? 'Drop here' : 'No tasks'}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      toast.info(`Add task to "${col.label}" — composer lands in Phase 1.2`)
                    }
                    className="px-3 py-2 border-t border-line2 text-[11px] text-soft hover:text-ink hover:bg-paper transition flex items-center gap-1.5 justify-center"
                  >
                    <Plus size={12} /> Add task
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {view === 'list' && (
          <Section
            title={`${filtered.length} tasks`}
            subtitle="Sortable list view"
            paddedBody={false}
          >
            <table className="tbl">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Assignee</th>
                  <th>Due</th>
                  <th>Tag</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const ps = PRIORITY_STYLES[t.priority];
                  return (
                    <tr key={t.id} onClick={() => setSelected(t)} className="cursor-pointer">
                      <td>
                        <div className="text-[13px] font-medium text-ink">{t.title}</div>
                        <div className="text-[10px] text-muted">{t.description}</div>
                      </td>
                      <td>
                        <StatusPill
                          tone={
                            t.status === 'done'
                              ? 'success'
                              : t.status === 'review'
                                ? 'warn'
                                : t.status === 'in_progress'
                                  ? 'info'
                                  : 'muted'
                          }
                        >
                          {t.status.replace('_', ' ')}
                        </StatusPill>
                      </td>
                      <td>
                        <span className={`text-[11px] font-semibold ${ps.color}`}>
                          <Flag size={10} className="inline" /> {ps.label}
                        </span>
                      </td>
                      <td>
                        <span className="mono">{t.assigneeInitials}</span>
                      </td>
                      <td
                        className={`text-[12px] numeric ${t.dueOffsetDays < 0 ? 'text-rose-600' : 'text-muted'}`}
                      >
                        {t.dueDate}
                      </td>
                      <td>
                        <span className="tag">{t.tag}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Section>
        )}

        <div className="text-[11px] text-muted px-2">
          Drag any card across columns — drop zones glow blue when ready. Click a card for detail.
        </div>
      </div>

      {selected && (
        <div className="fixed inset-y-0 right-0 w-[440px] bg-surface border-l border-line2 shadow-2xl z-50 overflow-y-auto">
          <div className="sticky top-0 bg-surface border-b border-line2 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckSquare size={14} className="text-accent" />
              <div className="text-[13px] font-semibold text-ink">Task detail</div>
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
              <span className="tag mb-2 inline-block">{selected.tag}</span>
              <div className="text-[16px] font-semibold text-ink">{selected.title}</div>
              <div className="text-[12.5px] text-muted mt-2">{selected.description}</div>
            </div>
            {selected.dueOffsetDays < 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 flex items-center gap-2">
                <AlertCircle size={13} className="text-rose-600 shrink-0" />
                <span className="text-[12px] text-rose-700 font-medium">
                  {Math.abs(selected.dueOffsetDays)}d overdue
                </span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="card card-pad">
                <div className="text-[10px] uppercase tracking-wider text-muted">Status</div>
                <div className="text-[13px] font-semibold text-ink mt-1 capitalize">
                  {selected.status.replace('_', ' ')}
                </div>
              </div>
              <div className="card card-pad">
                <div className="text-[10px] uppercase tracking-wider text-muted">Priority</div>
                <div
                  className={`text-[13px] font-semibold mt-1 ${PRIORITY_STYLES[selected.priority].color}`}
                >
                  {PRIORITY_STYLES[selected.priority].label}
                </div>
              </div>
              <div className="card card-pad">
                <div className="text-[10px] uppercase tracking-wider text-muted">Assignee</div>
                <div className="text-[13px] font-semibold text-ink mt-1 flex items-center gap-2">
                  <span className="mono">{selected.assigneeInitials}</span> {selected.assignee}
                </div>
              </div>
              <div className="card card-pad">
                <div className="text-[10px] uppercase tracking-wider text-muted flex items-center gap-1">
                  <Calendar size={9} /> Due
                </div>
                <div
                  className={`text-[13px] font-semibold mt-1 ${selected.dueOffsetDays < 0 ? 'text-rose-600' : 'text-ink'}`}
                >
                  {selected.dueDate}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-section">Move to column</div>
              <div className="flex flex-wrap gap-1.5">
                {COLUMNS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setTasks((prev) =>
                        prev.map((t) => (t.id === selected.id ? { ...t, status: c.id } : t)),
                      );
                      setSelected({ ...selected, status: c.id });
                    }}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                      selected.status === c.id
                        ? 'bg-ink text-surface'
                        : 'bg-paper text-muted hover:bg-line2 hover:text-ink'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </AccountShell>
  );
}
