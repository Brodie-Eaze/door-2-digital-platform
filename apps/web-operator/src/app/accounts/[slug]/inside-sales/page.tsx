'use client';

import { useState } from 'react';
import { PhoneCall, Mic, PhoneOff, Clock, FileText, Bookmark } from 'lucide-react';
import { Banner, Button, KpiCard, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { InsideSalesEmpty, FirstRunBanner } from '@/components/AccountEmptyStates';
import { firstRunSnapshot } from '@/lib/first-run';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { toast } from '@/components/Toaster';

interface QueueLead {
  name: string;
  phone: string;
  priority: 'high' | 'medium';
  address: string;
  source: string;
}

const QUEUE: QueueLead[] = [
  {
    name: 'Maria Santos',
    phone: '+15125550182',
    priority: 'high',
    address: '4218 Lakeview, Austin TX',
    source: 'door',
  },
  {
    name: 'David Chen',
    phone: '+12145550293',
    priority: 'high',
    address: '887 Maple Ave, Dallas TX',
    source: 'door',
  },
  {
    name: 'Aisha Williams',
    phone: '+15125550441',
    priority: 'medium',
    address: '1502 Cedar St, Austin TX',
    source: 'retargeting',
  },
  {
    name: 'Sophia Patel',
    phone: '+14045550923',
    priority: 'medium',
    address: '4502 Walnut Cir, Atlanta GA',
    source: 'door',
  },
  {
    name: 'Kevin Murphy',
    phone: '+12145551034',
    priority: 'medium',
    address: '729 Elm Pl, Dallas TX',
    source: 'door',
  },
];

const SOFTPHONE_DEFERRED =
  'Softphone integration (Twilio Voice / Telnyx WebRTC) is deferred — call controls require a real carrier session and are never simulated. Lands in Phase 1.x.';

export default function Page({ params }: { params: { slug: string } }): JSX.Element {
  const firstRun = firstRunSnapshot(params.slug);
  const [activeIdx, setActiveIdx] = useState(0);
  const active = QUEUE[activeIdx] ?? QUEUE[0]!;

  if (firstRun.isFirstRun) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Inside sales">
        <div className="space-y-5 max-w-[1400px]">
          <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          <InsideSalesEmpty slug={params.slug} accountName={firstRun.accountName} />
        </div>
      </AccountShell>
    );
  }

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Inside sales · Dialer">
      <div className="space-y-6 max-w-[1600px]">
        <Banner tone="info">
          <span className="text-[13px]">
            Inside-sales cockpit — queue is auto-routed by territory. {SOFTPHONE_DEFERRED} Demo data
            — live wiring lands in Phase 1.x.
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Queue depth" value="42" hint="auto-routed by territory" />
          <KpiCard label="Calls today" value="187" delta="+22" deltaTone="positive" />
          <KpiCard label="Connect rate" value="34%" delta="+2pp" deltaTone="positive" />
          <KpiCard label="Conversions today" value="22" hint="$5,940 GMV" />
        </div>

        {/* 3-column dialer cockpit */}
        <div className="grid grid-cols-12 gap-4" style={{ minHeight: 600 }}>
          {/* Queue */}
          <div className="col-span-3 card !p-0 flex flex-col">
            <div className="px-4 py-3 border-b border-line2 flex items-center justify-between">
              <div>
                <div className="text-[13px] font-semibold text-ink">Queue · {QUEUE.length}</div>
                <div className="text-[11px] text-muted mt-0.5">Auto-routed</div>
              </div>
              <DataSourceBadge source="fixture" />
            </div>
            <div className="flex-1 overflow-y-auto">
              {QUEUE.map((c, i) => (
                <button
                  key={c.phone}
                  onClick={() => setActiveIdx(i)}
                  className={`w-full text-left px-4 py-3 border-b border-line2 hover:bg-paper cursor-pointer ${
                    i === activeIdx ? 'bg-accentSoft border-l-2 border-l-accent' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] font-medium text-ink truncate">{c.name}</span>
                    <StatusPill tone={c.priority === 'high' ? 'danger' : 'muted'}>
                      {c.priority}
                    </StatusPill>
                  </div>
                  <div className="text-[11px] text-muted truncate numeric">{c.phone}</div>
                  <div className="text-[10px] text-soft truncate mt-0.5">{c.source}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Customer + script */}
          <div className="col-span-6 card !p-0 flex flex-col">
            <div className="px-5 py-3 border-b border-line2 flex items-center justify-between bg-paper/40">
              <div>
                <div className="text-base font-semibold text-ink">{active.name}</div>
                <div className="text-[12px] text-muted">
                  {active.phone} · {active.address}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill tone="success">Connected</StatusPill>
                <span className="numeric text-[12px] text-muted flex items-center gap-1">
                  <Clock size={11} /> 02:43
                </span>
              </div>
            </div>
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              <div className="space-y-2">
                <div className="h-section">Pitch script — Hope Forward Q3 2026</div>
                <div className="card !shadow-none border border-line2 card-pad text-[13px] leading-relaxed space-y-3">
                  <p className="text-ink">
                    &ldquo;Hi {active.name.split(' ')[0]}, this is Sarah from Hope Forward. Our knocker
                    Jada visited your home yesterday and you mentioned you were interested in our
                    clean-water programme. Do you have a moment to talk?&rdquo;
                  </p>
                  <div className="text-[11px] text-muted">
                    → If <span className="font-semibold">yes</span>: confirm donation amount, offer
                    monthly recurring
                    <br />→ If <span className="font-semibold">no time</span>: schedule callback
                    within 48h
                    <br />→ If <span className="font-semibold">not interested</span>: thank, mark
                    do_not_contact
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="h-section">Lead activity</div>
                <div className="space-y-2 text-[12px]">
                  <div className="flex items-start gap-2">
                    <span className="text-soft numeric">16:42</span>
                    <span className="text-ink">Inbound call connected (this call)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-soft numeric">15:18</span>
                    <span className="text-ink">SMS sent — appointment confirmation</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-soft numeric">14:55</span>
                    <span className="text-ink">Knocker captured lead at door — high interest</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="h-section">Notes</div>
                <textarea
                  className="w-full p-3 bg-paper border border-line2 rounded-lg text-[13px] focus:outline-none focus:border-accent"
                  rows={4}
                  placeholder="Mid-call notes…"
                  defaultValue="Confirmed interest in clean-water programme. Wants $20/month. Has 2 kids in college, prefers card auto-debit on 5th of each month."
                />
              </div>
            </div>

            {/* Call control bar */}
            <div className="border-t border-line2 bg-ink text-surface px-5 py-3 flex items-center gap-3">
              <button
                onClick={() => toast.info(SOFTPHONE_DEFERRED)}
                className="w-10 h-10 rounded-full bg-surface/10 hover:bg-surface/20 flex items-center justify-center"
                aria-label="Mute"
              >
                <Mic size={16} />
              </button>
              <button
                onClick={() => toast.info(SOFTPHONE_DEFERRED)}
                className="w-10 h-10 rounded-full bg-surface/10 hover:bg-surface/20 flex items-center justify-center"
                aria-label="Call"
              >
                <PhoneCall size={16} />
              </button>
              <button
                onClick={() => toast.info(SOFTPHONE_DEFERRED)}
                className="w-10 h-10 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center"
                aria-label="Hang up"
              >
                <PhoneOff size={16} />
              </button>
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<FileText size={14} />}
                className="!text-surface !border-surface/20 hover:!bg-surface/10"
                onClick={() =>
                  toast.info(`Mark ${active.name} converted — disposition wiring lands in Phase 1.x`)
                }
              >
                Mark converted
              </Button>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Bookmark size={14} />}
                className="!text-surface !border-surface/20 hover:!bg-surface/10"
                onClick={() =>
                  toast.info(`Schedule callback for ${active.name} — wiring lands in Phase 1.x`)
                }
              >
                Schedule callback
              </Button>
            </div>
          </div>

          {/* Sequence / objections */}
          <div className="col-span-3 card !p-0 flex flex-col">
            <div className="px-4 py-3 border-b border-line2">
              <div className="text-[13px] font-semibold text-ink">Sequence step</div>
              <div className="text-[11px] text-muted mt-0.5">Day 2 · call attempt 1</div>
            </div>
            <div className="flex-1 p-4 space-y-3 overflow-y-auto">
              <div className="h-section">Common objections</div>
              <div className="space-y-2">
                {[
                  [
                    '"How much of my donation actually reaches the cause?"',
                    '87¢ of every dollar — last ACFR audit 2025.',
                  ],
                  [
                    '"I already give to several charities."',
                    'Mention impact compounding — small monthly > large one-off.',
                  ],
                  [
                    '"I don\'t give over the phone."',
                    'Offer SMS-link self-checkout via Stripe-secured page.',
                  ],
                ].map(([q, a], i) => (
                  <div key={i} className="bg-paper rounded-lg p-3 text-[12px]">
                    <div className="text-ink font-medium">{q}</div>
                    <div className="text-muted mt-1">{a}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AccountShell>
  );
}
