import { MessageCircle, Phone, Mail, MessageSquare, Search } from 'lucide-react';
import { Banner, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';

const THREADS = [
  {
    name: 'Maria Santos',
    channel: 'sms',
    preview: 'Got it — see you Tuesday. Looking forward to learning more!',
    unread: 2,
    time: '12m',
  },
  {
    name: 'David Chen',
    channel: 'call',
    preview: 'Voicemail left · "Hi David, this is Sarah from Hope Forward…"',
    unread: 0,
    time: '1h',
  },
  {
    name: 'Aisha Williams',
    channel: 'email',
    preview: 'Thanks for the impact report — really compelling stats on the wells program.',
    unread: 1,
    time: '2h',
  },
  {
    name: 'Robert Kim',
    channel: 'sms',
    preview: 'Can we move the call to 4pm Wed?',
    unread: 1,
    time: '3h',
  },
  {
    name: 'Sophia Patel',
    channel: 'sms',
    preview: 'Done — card on file. Thanks!',
    unread: 0,
    time: '4h',
  },
  {
    name: 'Kevin Murphy',
    channel: 'email',
    preview: "I'll review with my partner this weekend and get back to you.",
    unread: 0,
    time: 'Yest',
  },
];
const ICON = { sms: MessageSquare, call: Phone, email: Mail };

export default function ConversationsPage({ params }: { params: { slug: string } }): JSX.Element {
  return (
    <AccountShell accountSlug={params.slug} pageTitle="Conversations">
      <div className="space-y-6 max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px]">
            Every SMS, call, and email with a lead lives here. Sales reps can pick up any thread
            from any channel. Backed by Twilio + Aircall + Resend with full delivery + read
            receipts.
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Open threads"
            value={THREADS.length}
            hint={`${THREADS.filter((t) => t.unread > 0).length} unread`}
          />
          <KpiCard label="Avg response" value="8m" delta="-2m" deltaTone="positive" />
          <KpiCard label="Messages today" value="287" delta="+12%" deltaTone="positive" />
          <KpiCard label="Calls connected" value="64" hint="34% rate" />
        </div>

        <Section title="Inbox" subtitle="All channels · all reps" paddedBody={false}>
          <div className="px-4 py-2 border-b border-line2 flex items-center gap-2">
            <Search size={14} className="text-soft" />
            <input
              className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-soft"
              placeholder="Search conversations…"
            />
          </div>
          <div className="divide-y divide-line2">
            {THREADS.map((t, i) => {
              const Icon = ICON[t.channel as keyof typeof ICON];
              return (
                <div
                  key={i}
                  className={`flex items-start gap-3 px-5 py-3 hover:bg-paper cursor-pointer ${t.unread > 0 ? 'border-l-2 border-l-accent bg-accentSoft/20' : ''}`}
                >
                  <span className="mono">
                    {t.name
                      .split(' ')
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join('')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[13px] font-semibold text-ink truncate flex items-center gap-1.5">
                        {t.name}
                        <Icon size={11} className="text-soft" />
                      </div>
                      <div className="text-[10px] text-soft shrink-0">{t.time}</div>
                    </div>
                    <div className="text-[12px] text-muted truncate mt-0.5">{t.preview}</div>
                  </div>
                  {t.unread > 0 && (
                    <span className="bg-accent text-surface text-[10px] font-semibold px-1.5 py-0.5 rounded-full numeric">
                      {t.unread}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      </div>
    </AccountShell>
  );
}
