'use client';

import { useState } from 'react';
import {
  Wand2,
  Sparkles,
  ShieldCheck,
  ImageIcon,
  Send,
  Check,
  X,
  FileCheck2,
  AlertTriangle,
  RefreshCw,
  Lock,
  Eye,
} from 'lucide-react';
import { Banner, Button, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';

/**
 * Creative generator UI — 3-pane layout.
 *
 * LEFT: brief form (vertical, region, audience, headline goal,
 * channel, format, brand kit).
 *
 * MIDDLE: live preview of 8–12 generated variants (gradient
 * placeholders + headline + copy snippet).
 *
 * RIGHT: safety panel — Anthropic moderation result, custom rule
 * engine result, legal-hold flag, C2PA manifest preview.
 *
 * "Generate" is decorative — setIsGenerating(true) then setTimeout
 * flips back. No backend wiring yet.
 */

type Vertical = 'charity' | 'commercial';
type Region = 'US' | 'AU' | 'SG';
type Channel = 'Meta' | 'Google' | 'TikTok';
type Format = 'image' | 'carousel' | 'video';

interface Variant {
  id: string;
  headline: string;
  copy: string;
  gradient: string;
  safetyPass: boolean;
  cost: number;
  c2paId: string;
  status: 'preview' | 'approved' | 'rejected';
}

const VARIANT_SEEDS: Variant[] = [
  {
    id: 'var_a01',
    headline: "Every door is someone's story.",
    copy: 'Sponsor a child in Tampines for just S$45/month. PayNow today, see your impact tomorrow.',
    gradient: 'from-emerald-500 to-teal-700',
    safetyPass: true,
    cost: 0.42,
    c2paId: 'c2pa-9421a',
    status: 'preview',
  },
  {
    id: 'var_a02',
    headline: "In 5 minutes you can change a Tampines family's year.",
    copy: 'S$45/mo via PayNow corporate UEN T26CC0021K. Tax-deductible 250% (IPC).',
    gradient: 'from-blue-500 to-indigo-700',
    safetyPass: true,
    cost: 0.38,
    c2paId: 'c2pa-9421b',
    status: 'preview',
  },
  {
    id: 'var_a03',
    headline: 'Your S$45 buys a week of school meals.',
    copy: "House-to-house permit PLRD/H2H/2026/0188. Knocker shows you the schools you're feeding.",
    gradient: 'from-violet-500 to-purple-700',
    safetyPass: true,
    cost: 0.41,
    c2paId: 'c2pa-9421c',
    status: 'preview',
  },
  {
    id: 'var_a04',
    headline: 'We knocked on 8,210 doors in your block.',
    copy: 'Less than 4% give. Be one of them. Recurring S$45/mo · cancel anytime.',
    gradient: 'from-amber-500 to-orange-700',
    safetyPass: true,
    cost: 0.39,
    c2paId: 'c2pa-9421d',
    status: 'preview',
  },
  {
    id: 'var_a05',
    headline: "Singapore's quiet 8% live below the line.",
    copy: 'Tampines FSC reaches them. You can too. S$45/mo via PayNow.',
    gradient: 'from-rose-500 to-red-700',
    safetyPass: false,
    cost: 0.44,
    c2paId: 'c2pa-9421e',
    status: 'preview',
  },
  {
    id: 'var_a06',
    headline: 'A door knocked is a child fed.',
    copy: 'Our PLRD-permitted Knockers walk Tampines daily. Sponsor for S$45/mo.',
    gradient: 'from-sky-500 to-blue-700',
    safetyPass: true,
    cost: 0.4,
    c2paId: 'c2pa-9421f',
    status: 'preview',
  },
  {
    id: 'var_a07',
    headline: 'Your CDC voucher? Stretch it twice as far.',
    copy: 'Round-up at point of sale → recurring S$5/mo to Tampines FSC. PayNow today.',
    gradient: 'from-green-500 to-emerald-700',
    safetyPass: true,
    cost: 0.43,
    c2paId: 'c2pa-9421g',
    status: 'preview',
  },
  {
    id: 'var_a08',
    headline: 'Knock-knock. Tampines is here.',
    copy: 'Our youngest sponsor is 16, our oldest 92. Join them with S$45/mo.',
    gradient: 'from-pink-500 to-rose-700',
    safetyPass: true,
    cost: 0.45,
    c2paId: 'c2pa-9421h',
    status: 'preview',
  },
];

export default function GenerateCreativePage(): JSX.Element {
  const [vertical, setVertical] = useState<Vertical>('charity');
  const [region, setRegion] = useState<Region>('SG');
  const [audience, setAudience] = useState(
    'Tampines + Bedok HDB residents · age 35–55 · combined household > S$8k/mo',
  );
  const [headlineGoal, setHeadlineGoal] = useState('Drive PayNow recurring at S$45/mo');
  const [channel, setChannel] = useState<Channel>('Meta');
  const [format, setFormat] = useState<Format>('image');
  const [brandKit, setBrandKit] = useState('Tampines FSC · navy + amber · Inter');
  const [isGenerating, setIsGenerating] = useState(false);
  const [variants, setVariants] = useState<Variant[]>(VARIANT_SEEDS);
  const [selectedId, setSelectedId] = useState<string | null>(VARIANT_SEEDS[0]?.id ?? null);

  function handleGenerate(): void {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setVariants(VARIANT_SEEDS.map((v) => ({ ...v, status: 'preview' })));
    }, 1400);
  }

  function approve(id: string): void {
    setVariants((vs) => vs.map((v) => (v.id === id ? { ...v, status: 'approved' as const } : v)));
  }

  function reject(id: string): void {
    setVariants((vs) => vs.map((v) => (v.id === id ? { ...v, status: 'rejected' as const } : v)));
  }

  const selected = variants.find((v) => v.id === selectedId);
  const approvedCount = variants.filter((v) => v.status === 'approved').length;
  const rejectedCount = variants.filter((v) => v.status === 'rejected').length;
  const safetyPassCount = variants.filter((v) => v.safetyPass).length;
  const totalCost = variants.reduce((s, v) => s + v.cost, 0);

  return (
    <PlatformShell pageTitle="Generate creative">
      <div className="space-y-4 max-w-[1700px]">
        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Wand2 size={14} className="text-accent" />
            <span>
              Describe an audience + goal · we generate 8–12 brand-safe variants across your chosen
              channel. Every output is moderation-scanned, vertical-rule-checked, and C2PA-stamped
              before it leaves this surface.
            </span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Variants this brief" value={variants.length} hint="image · 8 default" />
          <KpiCard
            label="Safety pass"
            value={`${safetyPassCount} / ${variants.length}`}
            hint="of last generation"
          />
          <KpiCard
            label="Approved · queued"
            value={approvedCount}
            hint={`${rejectedCount} rejected`}
            deltaTone="positive"
          />
          <KpiCard
            label="Brief spend"
            value={`$${totalCost.toFixed(2)}`}
            hint="AI cost · this brief"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* LEFT — Brief form */}
          <div className="lg:col-span-3">
            <Section title="Brief" subtitle="Audience + goal + channel · 30s setup">
              <div className="space-y-3">
                <Field label="Vertical">
                  <PillToggle
                    value={vertical}
                    options={[
                      { value: 'charity', label: 'Charity' },
                      { value: 'commercial', label: 'Commercial' },
                    ]}
                    onChange={(v) => setVertical(v as Vertical)}
                  />
                </Field>
                <Field label="Region">
                  <PillToggle
                    value={region}
                    options={[
                      { value: 'US', label: 'US' },
                      { value: 'AU', label: 'AU' },
                      { value: 'SG', label: 'SG' },
                    ]}
                    onChange={(v) => setRegion(v as Region)}
                  />
                </Field>
                <Field label="Audience">
                  <textarea
                    className="w-full text-[12px] border border-line2 rounded-md px-2.5 py-2 bg-paper text-ink resize-none leading-snug"
                    rows={3}
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                  />
                </Field>
                <Field label="Headline goal">
                  <input
                    className="w-full text-[12px] border border-line2 rounded-md px-2.5 py-2 bg-paper text-ink"
                    value={headlineGoal}
                    onChange={(e) => setHeadlineGoal(e.target.value)}
                  />
                </Field>
                <Field label="Channel">
                  <PillToggle
                    value={channel}
                    options={[
                      { value: 'Meta', label: 'Meta' },
                      { value: 'Google', label: 'Google' },
                      { value: 'TikTok', label: 'TikTok' },
                    ]}
                    onChange={(v) => setChannel(v as Channel)}
                  />
                </Field>
                <Field label="Format">
                  <PillToggle
                    value={format}
                    options={[
                      { value: 'image', label: 'Image' },
                      { value: 'carousel', label: 'Carousel' },
                      { value: 'video', label: 'Video' },
                    ]}
                    onChange={(v) => setFormat(v as Format)}
                  />
                </Field>
                <Field label="Brand kit">
                  <input
                    className="w-full text-[12px] border border-line2 rounded-md px-2.5 py-2 bg-paper text-ink"
                    value={brandKit}
                    onChange={(e) => setBrandKit(e.target.value)}
                  />
                </Field>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  leftIcon={
                    isGenerating ? (
                      <RefreshCw size={13} className="animate-spin" />
                    ) : (
                      <Sparkles size={13} />
                    )
                  }
                  className="w-full"
                >
                  {isGenerating ? 'Generating variants…' : 'Generate 8 variants'}
                </Button>
              </div>
            </Section>
          </div>

          {/* MIDDLE — Preview pane */}
          <div className="lg:col-span-6">
            <Section
              title={`Preview · ${variants.length} variants`}
              subtitle="Click a tile to inspect provenance + safety detail"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {variants.map((v) => (
                  <VariantCard
                    key={v.id}
                    variant={v}
                    isSelected={selectedId === v.id}
                    onSelect={() => setSelectedId(v.id)}
                    onApprove={() => approve(v.id)}
                    onReject={() => reject(v.id)}
                  />
                ))}
              </div>
            </Section>
          </div>

          {/* RIGHT — Safety panel */}
          <div className="lg:col-span-3">
            <Section title="Safety panel" subtitle={selected ? selected.id : 'select a variant'}>
              {selected ? (
                <div className="space-y-3 text-[12px]">
                  <SafetyRow
                    icon={<ShieldCheck size={13} className="text-success" />}
                    label="Anthropic moderation"
                    pass={selected.safetyPass}
                    detail={
                      selected.safetyPass
                        ? 'All categories below threshold.'
                        : 'Flagged: harassment/charity_guilt 0.71 → review.'
                    }
                  />
                  <SafetyRow
                    icon={<Sparkles size={13} className="text-accent" />}
                    label={`Vertical rules (${vertical}/${region})`}
                    pass={selected.safetyPass}
                    detail={
                      selected.safetyPass
                        ? 'COC fundraising code ok · PLRD permit number disclosable.'
                        : '"Quiet 8% live below the line" → ambiguous claim → request source.'
                    }
                  />
                  <SafetyRow
                    icon={<Lock size={13} className="text-accent" />}
                    label="Image safety (Sightengine)"
                    pass={true}
                    detail="NSFW 0.01 · violence 0.00 · brand-logo collision 0.02 (clear)."
                  />
                  <SafetyRow
                    icon={<AlertTriangle size={13} className="text-warn" />}
                    label="Legal-hold flag"
                    pass={true}
                    detail="No legal-hold record matched donor/program names."
                  />
                  <div className="pt-3 border-t border-line2">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted font-medium mb-1.5">
                      <FileCheck2 size={11} className="text-accent" /> C2PA manifest preview
                    </div>
                    <div className="bg-paper border border-line2 rounded-md p-2.5 font-mono text-[10px] leading-relaxed text-ink space-y-0.5">
                      <div>
                        manifest_id: <span className="text-accent">{selected.c2paId}</span>
                      </div>
                      <div>model: anthropic/claude-3.5-sonnet</div>
                      <div>seed: 482910</div>
                      <div>temperature: 0.72</div>
                      <div>prompt_hash: 0x9f12c8…</div>
                      <div>cost_cents: {Math.round(selected.cost * 100)}</div>
                      <div>safety_scan: pass</div>
                      <div>signed_at: 2026-05-24T09:42:18Z</div>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-line2 grid grid-cols-2 gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<Check size={12} />}
                      onClick={() => approve(selected.id)}
                      disabled={selected.status === 'approved'}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<X size={12} />}
                      onClick={() => reject(selected.id)}
                      disabled={selected.status === 'rejected'}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Send size={12} />}
                      className="col-span-2"
                    >
                      Send to review queue
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-[12px] text-muted p-3 text-center">
                  Pick a variant tile to see safety detail.
                </div>
              )}
            </Section>
          </div>
        </div>
      </div>
    </PlatformShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-1">
        {label}
      </div>
      {children}
    </div>
  );
}

function PillToggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}): JSX.Element {
  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full border border-line2 bg-paper">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={
              active
                ? 'text-[10.5px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-ink text-surface transition'
                : 'text-[10.5px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full text-muted hover:text-ink transition'
            }
            aria-pressed={active}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function VariantCard({
  variant,
  isSelected,
  onSelect,
  onApprove,
  onReject,
}: {
  variant: Variant;
  isSelected: boolean;
  onSelect: () => void;
  onApprove: () => void;
  onReject: () => void;
}): JSX.Element {
  const ring = isSelected ? 'ring-2 ring-accent' : 'ring-1 ring-transparent hover:ring-line2';
  return (
    <div className={`card overflow-hidden cursor-pointer transition ${ring}`} onClick={onSelect}>
      <div className={`h-28 bg-gradient-to-br ${variant.gradient} relative flex items-end p-3`}>
        <div className="absolute top-2 left-2 flex items-center gap-1">
          <span className="bg-surface/95 backdrop-blur rounded text-[9px] uppercase tracking-wider px-1.5 py-0.5 font-semibold text-ink">
            {variant.id}
          </span>
          {!variant.safetyPass && (
            <span className="bg-warn/90 text-surface rounded text-[9px] uppercase tracking-wider px-1.5 py-0.5 font-semibold inline-flex items-center gap-1">
              <AlertTriangle size={9} /> safety
            </span>
          )}
        </div>
        <div className="absolute top-2 right-2">
          {variant.status === 'approved' && (
            <span className="bg-success/95 text-surface rounded text-[9px] uppercase tracking-wider px-1.5 py-0.5 font-semibold inline-flex items-center gap-1">
              <Check size={9} /> approved
            </span>
          )}
          {variant.status === 'rejected' && (
            <span className="bg-danger/95 text-surface rounded text-[9px] uppercase tracking-wider px-1.5 py-0.5 font-semibold inline-flex items-center gap-1">
              <X size={9} /> rejected
            </span>
          )}
        </div>
        <div className="text-surface text-[12.5px] font-semibold leading-snug drop-shadow-md">
          {variant.headline}
        </div>
      </div>
      <div className="p-2.5 space-y-2">
        <div className="text-[11px] text-muted leading-snug">{variant.copy}</div>
        <div className="flex items-center justify-between pt-1.5 border-t border-line2 text-[10px]">
          <div className="flex items-center gap-1.5 text-muted">
            <FileCheck2 size={10} className="text-success" />
            <span className="mono">{variant.c2paId}</span>
            <span>· ${variant.cost.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onApprove();
              }}
              className="w-5 h-5 rounded hover:bg-successSoft flex items-center justify-center text-success"
              title="Approve"
            >
              <Check size={11} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReject();
              }}
              className="w-5 h-5 rounded hover:bg-dangerSoft flex items-center justify-center text-danger"
              title="Reject"
            >
              <X size={11} />
            </button>
            <button
              type="button"
              className="w-5 h-5 rounded hover:bg-paper flex items-center justify-center text-soft"
              title="Inspect"
              onClick={(e) => e.stopPropagation()}
            >
              <Eye size={11} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SafetyRow({
  icon,
  label,
  pass,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  pass: boolean;
  detail: string;
}): JSX.Element {
  return (
    <div className="border-b border-line2 last:border-b-0 pb-2.5 last:pb-0">
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <div className="flex items-center gap-1.5">
          {icon}
          <div className="text-[12px] font-semibold text-ink">{label}</div>
        </div>
        <StatusPill tone={pass ? 'success' : 'warn'}>{pass ? 'Pass' : 'Review'}</StatusPill>
      </div>
      <div className="text-[11px] text-muted leading-snug pl-5">{detail}</div>
    </div>
  );
}
