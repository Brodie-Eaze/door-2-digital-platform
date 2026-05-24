'use client';

/**
 * Team conversation panel for a pipeline lead — chat thread, team poll,
 * multi-user presence. Built for the side detail panel.
 *
 * In production this is wired to:
 *   - Ably channel `org:<id>:lead:<id>` for live messages
 *   - GET /v1/leads/:id/conversation for thread history
 *   - POST /v1/leads/:id/conversation/messages
 *   - POST /v1/leads/:id/conversation/polls
 */
import { useState } from 'react';
import { Send, Smile, Paperclip, BarChart3, Check, MessageCircle, Eye } from 'lucide-react';

interface Message {
  id: string;
  authorInitials: string;
  authorName: string;
  authorColor: string;
  body: string;
  ts: string;
  reactions?: Array<{ emoji: string; count: number; mine?: boolean }>;
  system?: boolean;
}

interface Poll {
  question: string;
  options: Array<{ id: string; label: string; votes: number; voters: string[] }>;
  closesAt: string;
}

const PRESENCE: Array<{ initials: string; name: string; color: string; viewing: boolean }> = [
  { initials: 'SH', name: 'Sarah Harris', color: '#0F172A', viewing: true },
  { initials: 'BR', name: 'Brodie', color: '#3B82F6', viewing: true },
  { initials: 'JD', name: 'Jada Davis (Noctua)', color: '#1D4ED8', viewing: false },
  { initials: 'TM', name: 'Tomás Mendez', color: '#475569', viewing: false },
];

const SEED_MESSAGES: Message[] = [
  {
    id: 'm1',
    authorInitials: 'SY',
    authorName: 'NoctuaOS',
    authorColor: '#475569',
    body: 'Lead Maria Santos created from door knock by Jada Davis (Austin East).',
    ts: '2026-05-23 14:55',
    system: true,
  },
  {
    id: 'm2',
    authorInitials: 'JD',
    authorName: 'Jada Davis',
    authorColor: '#1D4ED8',
    body: 'High interest. Wants $24/mo monthly — has two kids in college so prefers card auto-debit on the 5th.',
    ts: '2026-05-23 14:58',
    reactions: [{ emoji: '👍', count: 2 }],
  },
  {
    id: 'm3',
    authorInitials: 'SH',
    authorName: 'Sarah Harris',
    authorColor: '#0F172A',
    body: "Nice catch Jada. I'll take the callback. Day-1 SMS already queued.",
    ts: '2026-05-23 15:02',
  },
  {
    id: 'm4',
    authorInitials: 'SY',
    authorName: 'NoctuaOS',
    authorColor: '#475569',
    body: 'Outbound call attempted at 14:30 — no answer, voicemail left.',
    ts: '2026-05-24 14:30',
    system: true,
  },
  {
    id: 'm5',
    authorInitials: 'BR',
    authorName: 'Brodie',
    authorColor: '#3B82F6',
    body: 'Heads up team — push the impact story angle harder. Last cohort uplifted 11pp when reps mentioned ACFR audit numbers.',
    ts: '2026-05-24 15:12',
    reactions: [{ emoji: '🎯', count: 3, mine: true }],
  },
  {
    id: 'm6',
    authorInitials: 'SH',
    authorName: 'Sarah Harris',
    authorColor: '#0F172A',
    body: 'Got the callback, $24/mo recurring signed. Receipt sent.',
    ts: '2026-05-24 16:46',
    reactions: [
      { emoji: '🎉', count: 4 },
      { emoji: '💪', count: 2 },
    ],
  },
];

const SEED_POLL: Poll = {
  question: 'Day-2 SMS — what tone hits hardest for this profile?',
  options: [
    {
      id: 'p1',
      label: '"Impact stat" — quote 87¢/dollar to wells',
      votes: 6,
      voters: ['SH', 'JD', 'TM', 'BR', 'AR', 'AM'],
    },
    { id: 'p2', label: '"Soft check-in" — light, no number', votes: 2, voters: ['KP', 'DR'] },
    { id: 'p3', label: '"Urgency" — limited matching grant ends Friday', votes: 1, voters: ['JM'] },
  ],
  closesAt: 'in 3h',
};

export function PipelineLeadConversation(): JSX.Element {
  const [messages, setMessages] = useState<Message[]>(SEED_MESSAGES);
  const [draft, setDraft] = useState('');
  const [pollVote, setPollVote] = useState<string | null>('p1');

  function send() {
    if (!draft.trim()) return;
    const newMsg: Message = {
      id: `m${messages.length + 1}`,
      authorInitials: 'BR',
      authorName: 'Brodie',
      authorColor: '#3B82F6',
      body: draft.trim(),
      ts: 'just now',
    };
    setMessages((m) => [...m, newMsg]);
    setDraft('');
  }

  const totalVotes = SEED_POLL.options.reduce((s, o) => s + o.votes, 0);

  return (
    <div className="space-y-4">
      {/* Presence */}
      <div className="flex items-center justify-between">
        <div className="h-section flex items-center gap-2">
          <MessageCircle size={12} className="text-accent" />
          Team conversation
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted flex items-center gap-1">
            <Eye size={10} /> {PRESENCE.filter((p) => p.viewing).length} viewing
          </span>
          <div className="flex -space-x-1.5">
            {PRESENCE.slice(0, 4).map((p) => (
              <span
                key={p.initials}
                className={`inline-flex items-center justify-center w-6 h-6 rounded-full border-2 border-surface text-[9px] font-semibold relative ${
                  !p.viewing ? 'opacity-50' : ''
                }`}
                style={{ background: p.color, color: '#fff' }}
                title={p.name}
              >
                {p.initials}
                {p.viewing && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-success border border-surface" />
                )}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Chat thread */}
      <div className="bg-paper rounded-xl border border-line2 max-h-[260px] overflow-y-auto p-3 space-y-2">
        {messages.map((m) =>
          m.system ? (
            <div key={m.id} className="text-[10px] text-soft text-center py-1">
              · {m.body} · <span className="numeric">{m.ts}</span>
            </div>
          ) : (
            <div key={m.id} className="flex items-start gap-2">
              <span
                className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[10px] font-semibold shrink-0"
                style={{ background: m.authorColor, color: '#fff' }}
                title={m.authorName}
              >
                {m.authorInitials}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-semibold text-ink">{m.authorName}</span>
                  <span className="text-[9px] text-soft numeric">{m.ts}</span>
                </div>
                <div className="text-[12px] text-ink mt-0.5">{m.body}</div>
                {m.reactions && (
                  <div className="mt-1 flex items-center gap-1">
                    {m.reactions.map((r, i) => (
                      <span
                        key={i}
                        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] border ${
                          r.mine
                            ? 'bg-accentSoft border-accent/30 text-accent'
                            : 'bg-surface border-line2 text-muted'
                        }`}
                      >
                        {r.emoji} {r.count}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ),
        )}
      </div>

      {/* Composer */}
      <div className="bg-surface border border-line2 rounded-xl">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Message the team about this lead… (⌘+Enter to send)"
          rows={2}
          className="w-full p-3 bg-transparent text-[12px] text-ink placeholder:text-soft outline-none resize-none"
        />
        <div className="flex items-center justify-between px-2 pb-2">
          <div className="flex items-center gap-1">
            <button
              className="w-7 h-7 rounded hover:bg-paper flex items-center justify-center"
              title="Attach"
            >
              <Paperclip size={13} className="text-soft" />
            </button>
            <button
              className="w-7 h-7 rounded hover:bg-paper flex items-center justify-center"
              title="Emoji"
            >
              <Smile size={13} className="text-soft" />
            </button>
            <button
              className="w-7 h-7 rounded hover:bg-paper flex items-center justify-center"
              title="Poll"
            >
              <BarChart3 size={13} className="text-soft" />
            </button>
          </div>
          <button
            onClick={send}
            disabled={!draft.trim()}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-ink text-surface rounded-lg text-[11px] font-medium disabled:opacity-40"
          >
            <Send size={12} />
            Send
          </button>
        </div>
      </div>

      {/* Team poll */}
      <div className="bg-accentSoft/30 border border-accent/20 rounded-xl p-3 space-y-2">
        <div className="flex items-start gap-2">
          <BarChart3 size={14} className="text-accent shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-[12px] font-semibold text-ink">{SEED_POLL.question}</div>
            <div className="text-[10px] text-muted mt-0.5">
              Poll · {totalVotes} votes · closes {SEED_POLL.closesAt}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          {SEED_POLL.options.map((o) => {
            const pct = totalVotes > 0 ? Math.round((o.votes / totalVotes) * 100) : 0;
            const mine = pollVote === o.id;
            return (
              <button
                key={o.id}
                onClick={() => setPollVote(o.id)}
                className={`w-full text-left rounded-lg border px-3 py-2 transition relative overflow-hidden ${
                  mine ? 'border-accent bg-surface' : 'border-line2 bg-surface/60 hover:border-line'
                }`}
              >
                <div
                  className={`absolute inset-y-0 left-0 ${mine ? 'bg-accent/15' : 'bg-line2/60'} transition-all`}
                  style={{ width: `${pct}%` }}
                />
                <div className="relative flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {mine && <Check size={11} className="text-accent shrink-0" />}
                    <span className="text-[12px] text-ink truncate">{o.label}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex -space-x-1">
                      {o.voters.slice(0, 3).map((v, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-surface text-[7px] font-semibold bg-ink text-surface"
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                    <span className="text-[11px] font-semibold text-ink numeric">{pct}%</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
