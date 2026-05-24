'use client';

import { Sparkles, ImageIcon, Video, Type, Check, ShieldCheck, RotateCcw } from 'lucide-react';
import { Banner, Button, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { OrgShell } from '@/components/OrgShell';

const CREATIVES = [
  {
    id: 1,
    type: 'image',
    tone: 'success',
    title: 'Family of 4, dinner scene',
    desc: 'Warm, candid, donor empathy. Generated via FLUX 1.1 Pro.',
    model: 'flux-1.1-pro',
    approved: true,
  },
  {
    id: 2,
    type: 'image',
    tone: 'success',
    title: 'Water well portrait',
    desc: 'Impact framing. Hope Forward branded.',
    model: 'flux-1.1-pro',
    approved: true,
  },
  {
    id: 3,
    type: 'video',
    tone: 'info',
    title: '15-sec UGC testimonial',
    desc: 'Heygen avatar — Aisha narrating donor impact.',
    model: 'heygen-avatar-iv',
    approved: false,
  },
  {
    id: 4,
    type: 'copy',
    tone: 'success',
    title: 'Headline: "1,200 wells. 412,000 lives."',
    desc: 'Performance: 0.42 CTR (last 7d, Meta).',
    model: 'claude-opus',
    approved: true,
  },
  {
    id: 5,
    type: 'copy',
    tone: 'warn',
    title: 'Headline: "Save a life today"',
    desc: 'Brand-safety review held — too generic, risks compliance pattern.',
    model: 'claude-opus',
    approved: false,
  },
  {
    id: 6,
    type: 'image',
    tone: 'info',
    title: 'Texas-targeted variant',
    desc: 'Geo-personalised hero. ACS demographics-aware.',
    model: 'flux-1.1-pro',
    approved: false,
  },
];

export default function MarketingStudioPage(): JSX.Element {
  return (
    <OrgShell pageTitle="Marketing Studio">
      <div className="space-y-6 max-w-[1400px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <ShieldCheck size={14} />
            All AI-generated creatives pass brand-safety scan (Anthropic moderation + vertical rule
            engine + C2PA provenance) before publish. Per <code className="kbd">ADR-0023</code>.
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Creatives generated (7d)" value="42" delta="+18" deltaTone="positive" />
          <KpiCard label="Approved + live" value="28" />
          <KpiCard label="Held by safety scan" value="3" hint="manual review queue" />
          <KpiCard label="Budget used MTD" value="$340" hint="cap: $2,000/mo" />
        </div>

        {/* Generator */}
        <Section
          title="Generate new creative"
          subtitle="Claude copy → FLUX images → Runway video → Meta/Google/TikTok"
          action={
            <Button variant="primary" size="md" leftIcon={<Sparkles size={14} />}>
              Generate variants
            </Button>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="block text-[12px] font-medium text-ink mb-1">Brief</label>
              <textarea
                className="w-full p-3 bg-paper border border-line2 rounded-lg text-[13px] focus:outline-none focus:border-accent"
                rows={3}
                defaultValue="Hope Forward Q3 push — clean-water in East Africa. Target: women 35-65, household income $75k+, Texas + Arizona. Tone: warm, urgent without being alarming. Hero image: family-of-four, dinner table, water glass."
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-muted mb-1">Format</label>
                <select className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px]">
                  <option>Mixed (3 image + 2 video + 5 copy)</option>
                  <option>Image only</option>
                  <option>Video only</option>
                  <option>Copy only</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-muted mb-1">Audience</label>
                <select className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px]">
                  <option>Retargeting: knocked-not-converted</option>
                  <option>Lookalike: existing donors</option>
                  <option>Cold: geo + ACS demographics</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-muted mb-1">Channels</label>
                <select className="w-full px-3 h-9 bg-paper border border-line2 rounded-lg text-[13px]">
                  <option>Meta + Google + TikTok</option>
                  <option>Meta only</option>
                  <option>Google only</option>
                </select>
              </div>
            </div>
          </div>
        </Section>

        {/* Creative grid */}
        <Section
          title="Recent creatives"
          subtitle="Auto-generated · review queue · publish controls"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {CREATIVES.map((c) => {
              const Icon = c.type === 'image' ? ImageIcon : c.type === 'video' ? Video : Type;
              return (
                <div key={c.id} className="card !p-0 overflow-hidden flex flex-col">
                  <div
                    className="bg-paper flex items-center justify-center"
                    style={{ aspectRatio: '4/3' }}
                  >
                    <Icon size={42} className="text-soft" strokeWidth={1.5} />
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[13px] font-semibold text-ink truncate">{c.title}</div>
                      {c.approved ? (
                        <StatusPill tone="success">Live</StatusPill>
                      ) : c.tone === 'warn' ? (
                        <StatusPill tone="warn">Held</StatusPill>
                      ) : (
                        <StatusPill tone="info">Review</StatusPill>
                      )}
                    </div>
                    <div className="text-[11px] text-muted mt-1 flex-1">{c.desc}</div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="tag !text-[10px]">{c.model}</span>
                      <div className="flex items-center gap-1">
                        <button className="w-7 h-7 rounded-md hover:bg-paper flex items-center justify-center">
                          <RotateCcw size={12} className="text-muted" />
                        </button>
                        <button className="w-7 h-7 rounded-md hover:bg-paper flex items-center justify-center">
                          <Check size={14} className="text-success" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      </div>
    </OrgShell>
  );
}
