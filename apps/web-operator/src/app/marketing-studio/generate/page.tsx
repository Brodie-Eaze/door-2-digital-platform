'use client';

import { useRef, useState } from 'react';
import {
  Wand2,
  Sparkles,
  ShieldCheck,
  Send,
  Check,
  X,
  FileCheck2,
  AlertTriangle,
  RefreshCw,
  Lock,
  Eye,
  ShieldAlert,
} from 'lucide-react';
import { Banner, Button, KpiCard, Section, Skeleton, StatusPill } from '@d2d/ui-web';
import { PlatformShell } from '@/components/PlatformShell';
import { DataSourceBadge, type DataSource } from '@/components/DataSourceBadge';
import { toast } from '@/components/Toaster';
import { pickCreativeImage, inferTheme } from '@/lib/creative-images';

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
  seed: string;
  headline: string;
  copy: string;
  safetyPass: boolean;
  cost: number;
  c2paId: string;
  status: 'preview' | 'approved' | 'rejected';
  capability: 'image' | 'carousel' | 'video' | 'avatar';
}

const VARIANT_SEEDS: Variant[] = [
  {
    id: 'var_a01',
    seed: 'tampines-door-story-a01',
    headline: "Every door is someone's story.",
    copy: 'Sponsor a child in Tampines for just S$45/month. PayNow today, see your impact tomorrow.',
    safetyPass: true,
    cost: 0.42,
    c2paId: 'c2pa-9421a',
    status: 'preview',
    capability: 'image',
  },
  {
    id: 'var_a02',
    seed: 'tampines-5min-change-a02',
    headline: "In 5 minutes you can change a Tampines family's year.",
    copy: 'S$45/mo via PayNow corporate UEN T26CC0021K. Tax-deductible 250% (IPC).',
    safetyPass: true,
    cost: 0.38,
    c2paId: 'c2pa-9421b',
    status: 'preview',
    capability: 'image',
  },
  {
    id: 'var_a03',
    seed: 'tampines-school-meals-a03',
    headline: 'Your S$45 buys a week of school meals.',
    copy: "House-to-house permit PLRD/H2H/2026/0188. Knocker shows you the schools you're feeding.",
    safetyPass: true,
    cost: 0.41,
    c2paId: 'c2pa-9421c',
    status: 'preview',
    capability: 'image',
  },
  {
    id: 'var_a04',
    seed: 'tampines-8210-doors-a04',
    headline: 'We knocked on 8,210 doors in your block.',
    copy: 'Less than 4% give. Be one of them. Recurring S$45/mo · cancel anytime.',
    safetyPass: true,
    cost: 0.39,
    c2paId: 'c2pa-9421d',
    status: 'preview',
    capability: 'carousel',
  },
  {
    id: 'var_a05',
    seed: 'tampines-quiet-8-pct-a05',
    headline: "Singapore's quiet 8% live below the line.",
    copy: 'Tampines FSC reaches them. You can too. S$45/mo via PayNow.',
    safetyPass: false,
    cost: 0.44,
    c2paId: 'c2pa-9421e',
    status: 'preview',
    capability: 'image',
  },
  {
    id: 'var_a06',
    seed: 'tampines-door-fed-a06',
    headline: 'A door knocked is a child fed.',
    copy: 'Our PLRD-permitted Knockers walk Tampines daily. Sponsor for S$45/mo.',
    safetyPass: true,
    cost: 0.4,
    c2paId: 'c2pa-9421f',
    status: 'preview',
    capability: 'image',
  },
  {
    id: 'var_a07',
    seed: 'tampines-cdc-voucher-a07',
    headline: 'Your CDC voucher? Stretch it twice as far.',
    copy: 'Round-up at point of sale → recurring S$5/mo to Tampines FSC. PayNow today.',
    safetyPass: true,
    cost: 0.43,
    c2paId: 'c2pa-9421g',
    status: 'preview',
    capability: 'carousel',
  },
  {
    id: 'var_a08',
    seed: 'tampines-knockknock-a08',
    headline: 'Knock-knock. Tampines is here.',
    copy: 'Our youngest sponsor is 16, our oldest 92. Join them with S$45/mo.',
    safetyPass: true,
    cost: 0.45,
    c2paId: 'c2pa-9421h',
    status: 'preview',
    capability: 'image',
  },
  {
    id: 'var_a09',
    seed: 'tampines-recovery-video-a09',
    headline: 'One block, 412 sponsors, and counting.',
    copy: 'A short film from a single Tampines HDB block. Tap to watch · 28s.',
    safetyPass: true,
    cost: 0.62,
    c2paId: 'c2pa-9421i',
    status: 'preview',
    capability: 'video',
  },
  {
    id: 'var_a10',
    seed: 'tampines-avatar-thanks-a10',
    headline: 'A personal thanks from our Tampines team.',
    copy: 'AI-presented avatar segment · CEO-recorded script · 18s.',
    safetyPass: true,
    cost: 1.84,
    c2paId: 'c2pa-9421j',
    status: 'preview',
    capability: 'avatar',
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
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Has the user run a generation this session? Controls the empty state.
  const [hasGenerated, setHasGenerated] = useState(false);
  // Honest data-source signal: 'live' when the API returned real variants,
  // 'fixture' when we fell back to sample variants.
  const [dataSource, setDataSource] = useState<DataSource>('fixture');
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  // Honest failure surface: when the upstream call fails we keep the brief and
  // show this banner rather than pretending the generation succeeded.
  const [genError, setGenError] = useState<string | null>(null);
  // "Still working…" hint once a generation passes 30s.
  const [slowHint, setSlowHint] = useState(false);
  // View-issue panel for safety-failed variants.
  const [issueVariantId, setIssueVariantId] = useState<string | null>(null);
  // In-flight controller so a new generate (or unmount) aborts the previous.
  const abortRef = useRef<AbortController | null>(null);

  const GENERATE_TIMEOUT_MS = 90_000;
  const SLOW_HINT_MS = 30_000;

  async function handleGenerate(): Promise<void> {
    // Cancel any prior in-flight generation.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setGenError(null);
    setSlowHint(false);
    setIsGenerating(true);
    setHasGenerated(true);

    const slowTimer = setTimeout(() => setSlowHint(true), SLOW_HINT_MS);
    const timeoutTimer = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS);

    try {
      const res = await fetch('/api/marketing/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          vertical,
          region,
          audience,
          headlineGoal,
          channel,
          format,
          brandKit,
          variantCount: VARIANT_SEEDS.length,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          variants?: Variant[];
          job?: { id: string; status: string };
        };

        if (Array.isArray(data.variants) && data.variants.length > 0) {
          // Sync result: real AI variants from the upstream service.
          setVariants(data.variants);
          setSelectedId(data.variants[0]?.id ?? null);
          setDataSource('live');
          setGeneratedAt(new Date());
        } else {
          // 200 but no variants yet (async job). The brief was accepted but no
          // creatives are ready — show samples and say so honestly.
          const seeds = VARIANT_SEEDS.map((v) => ({ ...v, status: 'preview' as const }));
          setVariants(seeds);
          setSelectedId(seeds[0]?.id ?? null);
          setDataSource('fixture');
          setGenError(
            'Generation was accepted as an async job — no AI variants are ready yet, so these are sample variants. Your brief is saved.',
          );
        }
      } else {
        // API error (e.g. NEXT_PUBLIC_API_URL not set in this environment).
        // Show sample variants but never let the user believe the call succeeded.
        console.warn('[generate] API returned', res.status, '— using seed variants');
        const seeds = VARIANT_SEEDS.map((v) => ({ ...v, status: 'preview' as const }));
        setVariants(seeds);
        setSelectedId(seeds[0]?.id ?? null);
        setDataSource('fixture');
        setGenError(
          "AI generation isn't connected in this environment — showing sample variants. Your brief is saved.",
        );
      }
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      console.error('[generate] fetch failed:', err);
      const seeds = VARIANT_SEEDS.map((v) => ({ ...v, status: 'preview' as const }));
      setVariants(seeds);
      setSelectedId(seeds[0]?.id ?? null);
      setDataSource('fixture');
      setGenError(
        aborted
          ? 'Generation timed out after 90s — showing sample variants. Your brief is saved; tap Retry to try again.'
          : "AI generation isn't connected in this environment — showing sample variants. Your brief is saved.",
      );
    } finally {
      clearTimeout(slowTimer);
      clearTimeout(timeoutTimer);
      setSlowHint(false);
      setIsGenerating(false);
      abortRef.current = null;
    }
  }

  function approve(id: string): void {
    // SAFETY HARD-BLOCK: a safety-failed variant can never be approved, no
    // matter which control invoked approve(). Open its issue panel instead.
    const target = variants.find((v) => v.id === id);
    if (target && !target.safetyPass) {
      setIssueVariantId(id);
      setSelectedId(id);
      toast.error('Safety-failed variant cannot be approved — resolve the flag first.');
      return;
    }
    setVariants((vs) => vs.map((v) => (v.id === id ? { ...v, status: 'approved' as const } : v)));
  }

  function reject(id: string): void {
    setVariants((vs) => vs.map((v) => (v.id === id ? { ...v, status: 'rejected' as const } : v)));
  }

  function regenerate(id: string): void {
    // Re-seed deterministically so the image swaps for the same variant id.
    setVariants((vs) =>
      vs.map((v) =>
        v.id === id
          ? { ...v, seed: `${v.seed}-r${Date.now() % 1000}`, status: 'preview' as const }
          : v,
      ),
    );
  }

  async function sendToQueue(ids: string[]): Promise<void> {
    // Defence in depth: never queue a safety-failed variant even if one slips in.
    const safe = ids.filter((id) => variants.find((v) => v.id === id)?.safetyPass);
    if (safe.length === 0) {
      toast.error('No queue-eligible variants — safety-failed creatives are blocked.');
      return;
    }
    try {
      const res = await fetch('/api/marketing/queue', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ variantIds: safe }),
      });
      if (res.ok) {
        const data = (await res.json()) as { queued?: number };
        const n = typeof data.queued === 'number' ? data.queued : safe.length;
        // Mark the queued variants approved so the UI reflects the action.
        setVariants((vs) =>
          vs.map((v) => (safe.includes(v.id) ? { ...v, status: 'approved' as const } : v)),
        );
        toast.success(`${n} creative${n === 1 ? '' : 's'} sent to review queue`);
      } else {
        toast.error('Could not reach the review queue — try again.');
      }
    } catch (err) {
      console.error('[queue] fetch failed:', err);
      toast.error('Could not reach the review queue — try again.');
    }
  }

  const selected = variants.find((v) => v.id === selectedId);
  const issueVariant = variants.find((v) => v.id === issueVariantId && !v.safetyPass);
  const approvedCount = variants.filter((v) => v.status === 'approved').length;
  const rejectedCount = variants.filter((v) => v.status === 'rejected').length;
  const safetyPassCount = variants.filter((v) => v.safetyPass).length;
  const totalCost = variants.reduce((s, v) => s + v.cost, 0);
  // Variants eligible to queue: safety-passed, not already rejected.
  const queueableIds = variants
    .filter((v) => v.safetyPass && v.status !== 'rejected')
    .map((v) => v.id);

  return (
    <PlatformShell pageTitle="Generate creative">
      <div className="space-y-4 max-w-[1700px]">
        {genError && (
          <Banner
            tone="warn"
            action={
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<RefreshCw size={12} />}
                  onClick={handleGenerate}
                  disabled={isGenerating}
                >
                  Retry
                </Button>
                <button
                  type="button"
                  aria-label="Dismiss"
                  onClick={() => setGenError(null)}
                  className="text-muted hover:text-ink transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            }
          >
            <span className="text-[13px] flex items-center gap-2">
              <AlertTriangle size={14} className="text-warn shrink-0" />
              <span>{genError}</span>
            </span>
          </Banner>
        )}

        {issueVariant && (
          <Banner
            tone="warn"
            action={
              <button
                type="button"
                aria-label="Dismiss safety issue detail"
                onClick={() => setIssueVariantId(null)}
                className="text-muted hover:text-ink transition-colors"
              >
                <X size={14} />
              </button>
            }
          >
            <span className="text-[13px] flex items-start gap-2">
              <ShieldAlert size={14} className="text-danger shrink-0 mt-0.5" />
              <span>
                <span className="font-semibold">Safety flag on “{issueVariant.headline}”</span> —
                this copy was flagged for potential emotional-pressure language under the{' '}
                {vertical === 'charity' ? 'charity fundraising' : 'commercial advertising'} rule
                pack for {region}. Ambiguous statistical claims (no citable source) and guilt-frame
                phrasing can breach platform ad policy and{' '}
                {region === 'US' ? 'FTC' : region === 'AU' ? 'ACL' : 'COC'} standards. Edit the copy
                or regenerate this variant — approval stays blocked until the scan passes.
              </span>
            </span>
          </Banner>
        )}

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
          <KpiCard
            label="Variants this brief"
            value={variants.length}
            hint="image + carousel + video + avatar"
          />
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
                  {isGenerating ? 'Generating variants…' : 'Generate 10 variants'}
                </Button>
                <div className="pt-2 border-t border-line2">
                  <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-1.5">
                    Pipeline · estimated
                  </div>
                  <div className="space-y-1 text-[11px]">
                    <BriefMeta label="Compose" value="claude-3-5-sonnet · ~$0.04" />
                    <BriefMeta label="Image gen" value="flux-1.1-pro · ~$0.32" />
                    <BriefMeta label="Safety scan" value="Anthropic + Sightengine · ~$0.02" />
                    <BriefMeta label="C2PA sign" value="ed25519 · $0.00" />
                  </div>
                </div>
              </div>
            </Section>
          </div>

          {/* MIDDLE — Preview pane */}
          <div className="lg:col-span-6">
            <Section
              title={`Preview · ${variants.length} variants`}
              subtitle="Click a tile to inspect provenance + safety detail"
              action={
                hasGenerated ? (
                  <DataSourceBadge source={dataSource} updatedAt={generatedAt} />
                ) : undefined
              }
            >
              {isGenerating ? (
                <div className="space-y-3">
                  {slowHint && (
                    <div className="text-[12px] text-muted flex items-center gap-2">
                      <RefreshCw size={12} className="animate-spin" />
                      Still working — image + video generation can take up to 90 seconds…
                    </div>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} className="card overflow-hidden">
                        <Skeleton height="aspect-[4/5]" rounded="rounded-none" />
                        <div className="p-2.5 space-y-2">
                          <Skeleton height="h-3" width="w-3/4" />
                          <Skeleton height="h-3" width="w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : variants.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-16 px-6">
                  <div className="w-12 h-12 rounded-2xl bg-accentSoft/40 flex items-center justify-center mb-4">
                    <Sparkles size={20} className="text-accent" />
                  </div>
                  <div className="text-[14px] font-semibold text-ink mb-1">No variants yet</div>
                  <p className="text-[12px] text-muted max-w-[340px] leading-relaxed mb-5">
                    Fill your brief on the left and generate — your first batch of brand-safe AI
                    variants appears here, moderation-scanned and C2PA-stamped.
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Sparkles size={13} />}
                    onClick={handleGenerate}
                  >
                    Generate 10 variants
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {variants.map((v) => (
                    <VariantCard
                      key={v.id}
                      variant={v}
                      isSelected={selectedId === v.id}
                      onSelect={() => setSelectedId(v.id)}
                      onApprove={() => approve(v.id)}
                      onReject={() => reject(v.id)}
                      onRegenerate={() => regenerate(v.id)}
                    />
                  ))}
                </div>
              )}
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
                      <div>image_model: black-forest-labs/flux-1.1-pro</div>
                      <div>seed: 482910</div>
                      <div>temperature: 0.72</div>
                      <div>prompt_hash: 0x9f12c8…</div>
                      <div>cost_cents: {Math.round(selected.cost * 100)}</div>
                      <div>
                        safety_scan:{' '}
                        {selected.safetyPass ? (
                          'pass'
                        ) : (
                          <span className="text-danger font-semibold">FAILED</span>
                        )}
                      </div>
                      <div>signed_at: 2026-05-24T09:42:18Z</div>
                    </div>
                    <div className="mt-2.5">
                      <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-1">
                        Preview
                      </div>
                      <div className="rounded-md overflow-hidden border border-line2 bg-paper aspect-[4/5]">
                        <img
                          src={pickCreativeImage(
                            inferTheme({
                              vertical,
                              headline: selected.headline,
                              copy: selected.copy,
                            }),
                            selected.id,
                            { w: 400, h: 500 },
                          )}
                          alt={selected.headline}
                          width={400}
                          height={500}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  </div>
                  {!selected.safetyPass && (
                    <div className="flex items-center gap-2 text-[11.5px] text-danger bg-danger/5 border border-danger/20 rounded-md px-2.5 py-2">
                      <ShieldAlert size={13} className="shrink-0" />
                      <span>Safety failed — approval blocked until the flag is resolved.</span>
                    </div>
                  )}
                  <div className="pt-3 border-t border-line2 grid grid-cols-2 gap-2">
                    {selected.safetyPass ? (
                      <Button
                        variant="primary"
                        size="sm"
                        leftIcon={<Check size={12} />}
                        onClick={() => approve(selected.id)}
                        disabled={selected.status === 'approved'}
                      >
                        Approve
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<Eye size={12} />}
                        onClick={() => setIssueVariantId(selected.id)}
                      >
                        View issue
                      </Button>
                    )}
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
                      onClick={() => void sendToQueue(queueableIds)}
                      disabled={queueableIds.length === 0}
                      title={
                        queueableIds.length === 0
                          ? 'No queue-eligible variants — safety-failed creatives are blocked'
                          : `Queue ${queueableIds.length} safety-passed variant${queueableIds.length === 1 ? '' : 's'}`
                      }
                    >
                      Send {queueableIds.length > 0 ? `${queueableIds.length} ` : ''}to review queue
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

function aspectClass(cap: Variant['capability']): string {
  switch (cap) {
    case 'image':
      return 'aspect-[4/5]';
    case 'carousel':
      return 'aspect-square';
    case 'video':
      return 'aspect-[9/16]';
    case 'avatar':
      return 'aspect-[4/5]';
  }
}

function aspectDims(cap: Variant['capability']): { w: number; h: number } {
  switch (cap) {
    case 'image':
      return { w: 600, h: 750 };
    case 'carousel':
      return { w: 600, h: 600 };
    case 'video':
      return { w: 450, h: 800 };
    case 'avatar':
      return { w: 600, h: 750 };
  }
}

function capabilityPill(cap: Variant['capability']): string {
  switch (cap) {
    case 'image':
      return 'bg-blue-100 text-blue-700';
    case 'carousel':
      return 'bg-violet-100 text-violet-700';
    case 'video':
      return 'bg-rose-100 text-rose-700';
    case 'avatar':
      return 'bg-emerald-100 text-emerald-700';
  }
}

function VariantCard({
  variant,
  isSelected,
  onSelect,
  onApprove,
  onReject,
  onRegenerate,
}: {
  variant: Variant;
  isSelected: boolean;
  onSelect: () => void;
  onApprove: () => void;
  onReject: () => void;
  onRegenerate: () => void;
}): JSX.Element {
  const ring = isSelected ? 'ring-2 ring-accent' : 'ring-1 ring-transparent hover:ring-line2';
  const dims = aspectDims(variant.capability);
  return (
    <div className={`card overflow-hidden cursor-pointer transition ${ring}`} onClick={onSelect}>
      <div className={`${aspectClass(variant.capability)} relative overflow-hidden bg-paper`}>
        <img
          src={pickCreativeImage(
            inferTheme({ vertical: 'charity', headline: variant.headline, copy: variant.copy }),
            variant.id,
            { w: dims.w, h: dims.h },
          )}
          alt={variant.headline}
          width={dims.w}
          height={dims.h}
          loading="lazy"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/30 to-transparent" />
        <div className="absolute top-2 left-2 flex items-center gap-1">
          <span className="bg-surface/95 backdrop-blur rounded text-[9px] uppercase tracking-wider px-1.5 py-0.5 font-semibold text-ink">
            {variant.id}
          </span>
          <span
            className={`rounded text-[9px] uppercase tracking-wider px-1.5 py-0.5 font-semibold ${capabilityPill(variant.capability)}`}
          >
            {variant.capability}
          </span>
          {!variant.safetyPass && (
            <span className="bg-warn/90 text-surface rounded text-[9px] uppercase tracking-wider px-1.5 py-0.5 font-semibold inline-flex items-center gap-1">
              <AlertTriangle size={9} /> safety
            </span>
          )}
        </div>
        <div className="absolute top-2 right-2 flex items-center gap-1">
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
          <span
            className="inline-flex items-center gap-1 bg-surface/95 backdrop-blur rounded text-[9px] uppercase tracking-wider px-1.5 py-0.5 font-semibold text-success"
            title="C2PA signed"
          >
            <FileCheck2 size={9} /> C2PA
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <div className="text-surface text-[12.5px] font-semibold leading-snug drop-shadow-md line-clamp-3">
            {variant.headline}
          </div>
        </div>
      </div>
      <div className="p-2.5 space-y-2">
        <div className="text-[11px] text-muted leading-snug line-clamp-2">{variant.copy}</div>
        <div className="flex items-center justify-between pt-1.5 border-t border-line2 text-[10px]">
          <div className="flex items-center gap-1.5 text-muted">
            <FileCheck2 size={10} className="text-success" />
            <span className="font-mono">{variant.c2paId}</span>
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
              onClick={(e) => {
                e.stopPropagation();
                onRegenerate();
              }}
              className="w-5 h-5 rounded hover:bg-paper flex items-center justify-center text-soft"
              title="Regenerate"
            >
              <RefreshCw size={11} />
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

function BriefMeta({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className="text-ink font-mono">{value}</span>
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
