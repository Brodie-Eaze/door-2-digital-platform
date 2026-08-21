'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
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
  ShieldAlert,
} from 'lucide-react';
import { Banner, Button, KpiCard, Section, Skeleton, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { DataSourceBadge, type DataSource } from '@/components/DataSourceBadge';
import { toast } from '@/components/Toaster';
import { MarketingStudioTabs } from '@/components/marketing-studio-tabs';
import { CHANNEL_LABEL, type Channel, type Format } from '@/lib/marketing-taxonomy';
import { pickCreativeImage, type CreativeTheme } from '@/lib/creative-images';

/**
 * Per-account creative generator. The brief is pre-loaded with this
 * account's real vertical/region (from Org) and the channels it actually
 * has a connected provider for — not a fixture registry. Generation calls
 * the real platform BFF (/api/marketing/generate, /api/marketing/queue);
 * when the upstream isn't configured it falls back to disclosed sample
 * variants (never silently, always via the DataSourceBadge + a banner).
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface Variant {
  id: string;
  headline: string;
  copy: string;
  theme: CreativeTheme;
  capability: 'image' | 'carousel' | 'video' | 'avatar';
  safetyPass: boolean;
  cost: number;
  c2paId: string;
  status: 'preview' | 'approved' | 'rejected';
}

interface OrgBrief {
  tradingName: string;
  regionCode: 'AU' | 'US' | 'SG';
  vertical: 'charity' | 'commercial' | null;
  channels: Channel[];
}

interface ApiProvider {
  kind: string;
  status: string;
}

const PROVIDER_TO_CHANNEL: Record<string, Channel> = {
  meta_marketing: 'meta',
  google_ads: 'google',
  tiktok_marketing: 'tiktok',
  youtube: 'youtube',
};

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Disclosed sample variants shown ONLY when the upstream AI service isn't
 * reachable — echoes the operator's own brief instead of inventing
 * account-specific marketing claims (license numbers, stats, EINs).
 */
function buildSampleVariants(headlineGoal: string, theme: CreativeTheme): Variant[] {
  const caps: Array<Variant['capability']> = ['image', 'image', 'carousel', 'video'];
  return Array.from({ length: 4 }).map((_, i) => {
    const id = `sample_${(i + 1).toString().padStart(2, '0')}`;
    return {
      id,
      headline: headlineGoal || 'Sample headline — edit the brief and generate',
      copy: 'Sample variant — AI generation is not connected in this environment.',
      theme,
      capability: caps[i % caps.length]!,
      safetyPass: true,
      cost: 0,
      c2paId: `sample-${djb2(id).toString(16)}`,
      status: 'preview' as const,
    };
  });
}

function safetyIssueReason(): string {
  return 'Flagged by the safety scanner — a claim requires substantiation or a sensitive-targeting review. A human must resolve the flag before this variant can be approved.';
}

export default function Page({ params: paramsPromise }: PageProps): JSX.Element {
  const params = use(paramsPromise);

  const [org, setOrg] = useState<OrgBrief | null>(null);
  const [orgLoadError, setOrgLoadError] = useState<string | null>(null);

  const [audience, setAudience] = useState('');
  const [headlineGoal, setHeadlineGoal] = useState('');
  const [channel, setChannel] = useState<Channel>('meta');
  const [format, setFormat] = useState<Format>('image');
  const [brandKit, setBrandKit] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [dataSource, setDataSource] = useState<DataSource>('fixture');
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [slowHint, setSlowHint] = useState(false);
  const [issueVariantId, setIssueVariantId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const GENERATE_TIMEOUT_MS = 90_000;
  const SLOW_HINT_MS = 30_000;

  useEffect(() => {
    // W3 fix: no longer gated on the fixture-keyed firstRunSnapshot — see
    // brand-safety/page.tsx for the full rationale.
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/orgs/${encodeURIComponent(params.slug)}/marketing/providers`,
          { credentials: 'include' },
        );
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = (await res.json()) as {
          providers: ApiProvider[];
          org: {
            tradingName: string;
            regionCode: 'AU' | 'US' | 'SG';
            vertical: 'charity' | 'commercial' | null;
          };
        };
        if (cancelled) return;
        const channels = Array.from(
          new Set(
            json.providers
              .filter((p) => p.status === 'connected' && PROVIDER_TO_CHANNEL[p.kind])
              .map((p) => PROVIDER_TO_CHANNEL[p.kind]!),
          ),
        );
        const brief: OrgBrief = { ...json.org, channels };
        setOrg(brief);
        setChannel(channels[0] ?? 'meta');
        setBrandKit(json.org.tradingName);
      } catch (err) {
        if (!cancelled) {
          console.error('[generate] org load failed:', err);
          setOrgLoadError('Could not load this account — please retry.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.slug]);

  const availableFormats: Array<{ value: Format; label: string }> = useMemo(() => {
    const formats: Format[] =
      channel === 'email' || channel === 'sms' ? ['text'] : ['image', 'carousel', 'video'];
    return formats.map((f) => ({ value: f, label: f.charAt(0).toUpperCase() + f.slice(1) }));
  }, [channel]);

  const theme: CreativeTheme = org?.vertical === 'charity' ? 'charity_food' : 'business_b2b';

  async function handleGenerate(): Promise<void> {
    if (!org) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setGenError(null);
    setSlowHint(false);
    setIsGenerating(true);
    setHasGenerated(true);

    const slowTimer = setTimeout(() => setSlowHint(true), SLOW_HINT_MS);
    const timeoutTimer = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS);

    const seedFallback = (): void => {
      setVariants(buildSampleVariants(headlineGoal, theme));
      setSelectedId(`sample_01`);
      setDataSource('fixture');
    };

    try {
      const res = await fetch('/api/marketing/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          vertical: org.vertical === 'charity' ? 'charity' : 'commercial',
          region: org.regionCode,
          audience: audience || org.tradingName,
          headlineGoal: headlineGoal || 'brand awareness',
          channel,
          format,
          brandKit,
          orgId: params.slug,
          variantCount: variants.length || 8,
        }),
      });

      if (res.ok) {
        const json = (await res.json()) as { variants?: Variant[] };
        if (Array.isArray(json.variants) && json.variants.length > 0) {
          const live = json.variants.map((v) => ({ ...v, theme: v.theme ?? theme }));
          setVariants(live);
          setSelectedId(live[0]?.id ?? null);
          setDataSource('live');
          setGeneratedAt(new Date());
        } else {
          seedFallback();
          setGenError(
            'Generation was accepted as an async job — no AI variants are ready yet, so these are sample variants. Your brief is saved.',
          );
        }
      } else {
        console.warn('[generate] API returned', res.status, '— using sample variants');
        seedFallback();
        setGenError(
          "AI generation isn't connected in this environment — showing sample variants. Your brief is saved.",
        );
      }
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      console.error('[generate] fetch failed:', err);
      seedFallback();
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
    const newId = `${id}-r${Date.now() % 1000}`;
    setVariants((vs) =>
      vs.map((v) => (v.id === id ? { ...v, id: newId, status: 'preview' as const } : v)),
    );
    setSelectedId((cur) => (cur === id ? newId : cur));
    setIssueVariantId((cur) => (cur === id ? newId : cur));
  }

  async function sendToQueue(ids: string[]): Promise<void> {
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
        const json = (await res.json()) as { queued?: number };
        const n = typeof json.queued === 'number' ? json.queued : safe.length;
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

  if (orgLoadError) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Marketing Studio · Generator">
        <div className="card card-pad text-center py-8 max-w-[1400px]">
          <div className="text-[13px] text-ink mb-2" role="alert">
            {orgLoadError}
          </div>
          <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </AccountShell>
    );
  }

  if (!org) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Marketing Studio · Generator">
        <div className="card card-pad text-center py-10 text-[12px] text-muted max-w-[1400px]">
          Loading account…
        </div>
      </AccountShell>
    );
  }

  const selected = variants.find((v) => v.id === selectedId);
  const issueVariant = variants.find((v) => v.id === issueVariantId && !v.safetyPass);
  const approvedCount = variants.filter((v) => v.status === 'approved').length;
  const rejectedCount = variants.filter((v) => v.status === 'rejected').length;
  const safetyPassCount = variants.filter((v) => v.safetyPass).length;
  const totalCost = variants.reduce((s, v) => s + v.cost, 0);
  const queueableIds = variants
    .filter((v) => v.safetyPass && v.status !== 'rejected')
    .map((v) => v.id);

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Marketing Studio · Generator">
      <div className="space-y-4 max-w-[1700px]">
        <MarketingStudioTabs slug={params.slug} active="generate" />

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
          <div className="flex items-start gap-2.5 border border-danger/40 bg-dangerSoft rounded-lg p-3">
            <ShieldAlert size={16} className="text-danger shrink-0 mt-0.5" />
            <div className="flex-1 text-[12.5px] text-ink leading-snug">
              <span className="font-semibold">{issueVariant.id} failed safety review.</span>{' '}
              {safetyIssueReason()}
            </div>
            <button
              type="button"
              aria-label="Dismiss safety issue"
              onClick={() => setIssueVariantId(null)}
              className="text-muted hover:text-ink transition-colors shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Wand2 size={14} className="text-accent" />
            <span>
              <span className="font-semibold">{org.tradingName}</span> generator · pre-loaded with
              this account&apos;s vertical ({org.vertical ?? 'unset'}), region ({org.regionCode}),
              and the {org.channels.length} channel{org.channels.length === 1 ? '' : 's'} you have a
              connected provider for. Every output is moderation-scanned before it leaves this
              surface.
            </span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Variants this brief" value={variants.length} />
          <KpiCard label="Safety pass" value={`${safetyPassCount} / ${variants.length}`} />
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
            <Section title="Brief" subtitle={`${org.tradingName} · ${org.regionCode}`}>
              <div className="space-y-3">
                <Readonly label="Vertical" value={org.vertical ?? 'unset'} />
                <Readonly label="Region" value={org.regionCode} />
                <Field label="Audience">
                  <textarea
                    className="w-full text-[12px] border border-line2 rounded-md px-2.5 py-2 bg-paper text-ink resize-none leading-snug"
                    rows={3}
                    placeholder="Describe who this brief targets"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                  />
                </Field>
                <Field label="Headline goal">
                  <input
                    className="w-full text-[12px] border border-line2 rounded-md px-2.5 py-2 bg-paper text-ink"
                    placeholder="What should the headline drive?"
                    value={headlineGoal}
                    onChange={(e) => setHeadlineGoal(e.target.value)}
                  />
                </Field>
                <Field label={`Channel · ${org.channels.length} connected`}>
                  {org.channels.length === 0 ? (
                    <div className="text-[11px] text-muted">
                      No ad provider connected yet — connect one in Integrations to unlock channel
                      targeting.
                    </div>
                  ) : (
                    <PillToggle
                      value={channel}
                      options={org.channels.map((c) => ({ value: c, label: CHANNEL_LABEL[c] }))}
                      onChange={(v) => setChannel(v)}
                    />
                  )}
                </Field>
                <Field label="Format">
                  <PillToggle
                    value={format}
                    options={availableFormats}
                    onChange={(v) => setFormat(v)}
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
                  {isGenerating ? 'Generating variants…' : 'Generate variants'}
                </Button>
              </div>
            </Section>
          </div>

          {/* MIDDLE — Preview */}
          <div className="lg:col-span-6">
            <Section
              title={`Preview · ${variants.length} variants`}
              action={
                hasGenerated ? (
                  <DataSourceBadge source={dataSource} updatedAt={generatedAt} />
                ) : undefined
              }
            >
              {isGenerating ? (
                <div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="card overflow-hidden">
                        <Skeleton height="aspect-[4/5]" rounded="rounded-none" />
                        <div className="p-2.5 space-y-2">
                          <Skeleton height="h-3" width="w-3/4" />
                          <Skeleton height="h-3" width="w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                  {slowHint && (
                    <div className="mt-3 flex items-center gap-1.5 text-[11.5px] text-muted">
                      <RefreshCw size={11} className="animate-spin" />
                      <span>
                        Still working — large briefs can take up to 90s. We time out honestly rather
                        than hang.
                      </span>
                    </div>
                  )}
                </div>
              ) : variants.length === 0 ? (
                <div className="py-12 px-6 text-center">
                  <div className="mx-auto w-10 h-10 rounded-full bg-paper border border-line2 flex items-center justify-center mb-3">
                    <Sparkles size={16} className="text-accent" />
                  </div>
                  <div className="text-[13px] font-semibold text-ink mb-1">No variants yet</div>
                  <div className="text-[12px] text-muted leading-snug max-w-sm mx-auto mb-4">
                    Fill in the brief and generate — every output is moderation-scanned before it
                    lands here.
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Sparkles size={12} />}
                    onClick={handleGenerate}
                  >
                    Generate variants
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
                      onViewIssue={() => {
                        setSelectedId(v.id);
                        setIssueVariantId(v.id);
                      }}
                    />
                  ))}
                </div>
              )}
            </Section>
          </div>

          {/* RIGHT — Safety */}
          <div className="lg:col-span-3">
            <Section title="Safety panel" subtitle={selected ? selected.id : 'select a variant'}>
              {selected ? (
                <div className="space-y-3 text-[12px]">
                  <SafetyRow
                    icon={<ShieldCheck size={13} className="text-success" />}
                    label="Moderation scan"
                    pass={selected.safetyPass}
                    detail={
                      selected.safetyPass
                        ? 'Passed the moderation scan.'
                        : 'Flagged for review — a human must resolve this before approval.'
                    }
                  />
                  <SafetyRow
                    icon={<Lock size={13} className="text-accent" />}
                    label="Approval status"
                    pass={selected.status !== 'rejected'}
                    detail={`Status: ${selected.status}.`}
                  />
                  <div className="pt-3 border-t border-line2">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted font-medium mb-1.5">
                      <FileCheck2 size={11} className="text-accent" /> C2PA manifest
                    </div>
                    <div className="bg-paper border border-line2 rounded-md p-2.5 font-mono text-[10px] leading-relaxed text-ink space-y-0.5">
                      <div>
                        manifest_id: <span className="text-accent">{selected.c2paId}</span>
                      </div>
                      <div>account: {params.slug}</div>
                      <div>cost_cents: {Math.round(selected.cost * 100)}</div>
                      <div>
                        safety_scan:{' '}
                        {selected.safetyPass ? (
                          'pass'
                        ) : (
                          <span className="text-danger font-semibold">FAILED</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2.5">
                      <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-1">
                        Preview
                      </div>
                      <div className="rounded-md overflow-hidden border border-line2 bg-paper aspect-[4/5]">
                        <img
                          src={pickCreativeImage(selected.theme, selected.id)}
                          alt={selected.headline}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  </div>
                  {!selected.safetyPass && (
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-danger bg-dangerSoft border border-danger/30 rounded-md px-2.5 py-1.5">
                      <ShieldAlert size={12} /> Safety failed — approval blocked
                    </div>
                  )}
                  <div className="pt-3 border-t border-line2 grid grid-cols-2 gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<Check size={12} />}
                      onClick={() => approve(selected.id)}
                      disabled={selected.status === 'approved' || !selected.safetyPass}
                      title={
                        !selected.safetyPass
                          ? 'Safety-failed variants cannot be approved'
                          : undefined
                      }
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
                    {!selected.safetyPass && (
                      <Button
                        variant="danger"
                        size="sm"
                        leftIcon={<ShieldAlert size={12} />}
                        className="col-span-2"
                        onClick={() => setIssueVariantId(selected.id)}
                      >
                        View issue
                      </Button>
                    )}
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
                          : undefined
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
    </AccountShell>
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

function Readonly({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-1">
        {label}
      </div>
      <div className="text-[12px] font-medium text-ink capitalize bg-paper border border-line2 rounded-md px-2.5 py-2">
        {value}
      </div>
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
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full border border-line2 bg-paper flex-wrap">
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
  onViewIssue,
}: {
  variant: Variant;
  isSelected: boolean;
  onSelect: () => void;
  onApprove: () => void;
  onReject: () => void;
  onRegenerate: () => void;
  onViewIssue: () => void;
}): JSX.Element {
  const ring = isSelected ? 'ring-2 ring-accent' : 'ring-1 ring-transparent hover:ring-line2';
  return (
    <div className={`card overflow-hidden cursor-pointer transition ${ring}`} onClick={onSelect}>
      <div className={`${aspectClass(variant.capability)} relative overflow-hidden bg-paper`}>
        <img
          src={pickCreativeImage(variant.theme, variant.id)}
          alt={variant.headline}
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
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewIssue();
              }}
              className="bg-danger/95 text-surface rounded text-[9px] uppercase tracking-wider px-1.5 py-0.5 font-semibold inline-flex items-center gap-1 hover:bg-danger"
              title="Safety failed — click to view issue"
            >
              <ShieldAlert size={9} /> safety failed
            </button>
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
              disabled={!variant.safetyPass}
              className="w-5 h-5 rounded hover:bg-successSoft flex items-center justify-center text-success disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              title={variant.safetyPass ? 'Approve' : 'Safety failed — cannot approve'}
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
