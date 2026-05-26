'use client';

import { useMemo, useState } from 'react';
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
} from 'lucide-react';
import { Banner, Button, KpiCard, Section, Skeleton, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { MarketingStudioTabs } from '@/components/marketing-studio-tabs';
import { getAccount } from '@/lib/accounts';
import {
  getAccountMarketing,
  CHANNEL_LABEL,
  type Channel,
  type Format,
} from '@/lib/account-marketing';
import { pickCreativeImage, type CreativeTheme } from '@/lib/creative-images';

/**
 * Per-account creative generator — same 3-pane layout as HQ but the brief is
 * pre-populated with this account's vertical, region, brand voice, and only
 * shows channels/formats the account actually runs.
 */

interface PageProps {
  params: { slug: string };
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

const ACCOUNT_BRIEF_DEFAULTS: Record<
  string,
  {
    audience: string;
    headlineGoal: string;
    brandKit: string;
  }
> = {
  'hope-forward': {
    audience: 'TX-based households · age 35-65 · prior charitable givers · $50k+ HHI',
    headlineGoal: 'Drive recurring $5/wk sponsorship via ACH',
    brandKit: 'Hope Forward · navy + gold · Inter · 4-star Charity Navigator',
  },
  'world-vision': {
    audience: 'AU households · age 35-65 · NSW/VIC SEIFA-9 · prior child sponsors',
    headlineGoal: 'Drive AUD $50/mo child sponsorship via direct debit',
    brandKit: 'World Vision AU · orange + navy · Inter · ACNC-registered',
  },
  pestmax: {
    audience: 'TX + AZ homeowners · age 30-60 · single-family detached · pest pain past 90d',
    headlineGoal: 'Drive same-week annual pest plan signups · $48/mo',
    brandKit: 'PestMax · green + black · Inter · TX-CPM 8845 · OPM 9112',
  },
  'gold-coast-hospital': {
    audience:
      'QLD high-income · age 50-75 · GCH catchment · prior major donors / bequest prospects',
    headlineGoal: 'Drive monthly capital-campaign pledge or bequest enquiry',
    brandKit: 'GCH Foundation · navy + teal · Inter · ACNC · AHPRA-compliant',
  },
};

const SEED_HEADLINES: Record<string, Array<{ headline: string; copy: string }>> = {
  'hope-forward': [
    {
      headline: 'Five dollars covers a meal — every Tuesday.',
      copy: 'Hope Forward · TX recurring giving · $5/wk · ACH or card · tax-deductible.',
    },
    {
      headline: 'Sponsor a child for $5/week — start in 2 minutes.',
      copy: 'Recurring monthly · cancel anytime · 4-star Charity Navigator · 92¢ to programs.',
    },
    {
      headline: 'Help feed 50 Texas families this month.',
      copy: 'Hope Forward · TX hunger relief · $25 covers a family · tax receipt by email.',
    },
    {
      headline: 'Texas wildfires · your gift goes 100% to recovery.',
      copy: 'Hope Forward emergency · matched 2:1 by board · gifts processed in 2 hours.',
    },
    {
      headline: 'A Hope Forward dollar lasts longer.',
      copy: '92¢ of every dollar to programs · tax-deductible · EIN 47-8821334.',
    },
    {
      headline: 'Renew your faith in giving — Hope Forward 2026.',
      copy: 'Annual giving day · 7 May 2026 · matched 2:1 by anonymous donor.',
    },
    {
      headline: 'Clean water for a Houston classroom · $40.',
      copy: 'Hope Forward water · one classroom = 28 kids drinking safely for a year.',
    },
    {
      headline: 'Our nurses thank you for your monthly gift.',
      copy: 'Hope Forward medical · mobile clinics across TX · $30/mo funds one visit.',
    },
  ],
  'world-vision': [
    {
      headline: 'Sponsor a child in Cebu — AUD $50/month.',
      copy: 'World Vision AU · child sponsorship · ACNC-registered · tax-deductible · cancel anytime.',
    },
    {
      headline: 'For every child sponsored in Cebu, a Knocker plants a tree.',
      copy: 'World Vision AU · ACNC-registered · paid solicitor licensed VIC + NSW.',
    },
    {
      headline: '3 in 5 Aussie families need help this winter.',
      copy: 'World Vision AU · winter appeal · SEIFA decile-9 targeting · tax-deductible.',
    },
    {
      headline: '1L of clean water for a Khmer village · $20.',
      copy: 'World Vision AU water · Cambodia · ACNC · tax-deductible · 100% to wells.',
    },
    {
      headline: 'EOFY · double your tax refund · donate before 30 June.',
      copy: 'World Vision AU · End of Financial Year giving · ACNC · receipt by email.',
    },
    {
      headline: 'A nurse in Khmer reaches your sponsored child every month.',
      copy: 'World Vision AU · child sponsorship · medical reach · ACNC · tax-deductible.',
    },
    {
      headline: 'Bushfire recovery · $40 funds a family for a week.',
      copy: 'World Vision AU · disaster relief · NSW/VIC bushfire recovery · ACNC.',
    },
    {
      headline: 'Aussie kids on the line · sponsor a child in NT today.',
      copy: 'World Vision AU · NT remote programs · ACNC · paid solicitor WA0118.',
    },
  ],
  pestmax: [
    {
      headline: "Don't share your meal with roaches · Texas-licensed.",
      copy: 'PestMax · Houston + Austin · same-day service · TX-CPM 8845.',
    },
    {
      headline: 'Year-round pest protection · free re-treat included.',
      copy: 'PestMax annual plan $48/mo · TX-licensed CPM 8845 · EPA-registered.',
    },
    {
      headline: 'AZ termite season starts in May · we knock at 9am.',
      copy: 'PestMax · AZ termite specialists · OPM 9112 · EPA · same-week service.',
    },
    {
      headline: 'Bedbug? We come tonight. PestMax 24/7.',
      copy: 'PestMax bedbug emergency · TX-CPM 8845 · same-night response · 90-day guarantee.',
    },
    {
      headline: 'Roach-free in 1 visit or we come back free.',
      copy: 'PestMax · TX + AZ · EPA-registered · CPM 8845 / OPM 9112 · contract terms.',
    },
    {
      headline: 'Warranty renewal · $39/mo locks in 2026 rates.',
      copy: 'PestMax loyalty renewal · prior customers · TX + AZ · CPM 8845.',
    },
    {
      headline: 'PestMax · we live where you live.',
      copy: 'Local techs · TX + AZ · CPM 8845 · OPM 9112 · neighborhood field crews.',
    },
    {
      headline: 'Mosquito-free yard · before your BBQ.',
      copy: 'PestMax mosquito service · 21-day window · EPA · same-week appt.',
    },
  ],
  'gold-coast-hospital': [
    {
      headline: 'Help fund the new oncology wing · Gold Coast Hospital.',
      copy: 'Gold Coast Hospital Foundation · capital campaign · tax-deductible · ACNC.',
    },
    {
      headline: 'One pledge a month feeds research at GCH.',
      copy: 'Gold Coast Hospital Foundation · monthly giving · ACNC · TGA-compliant.',
    },
    {
      headline: 'Our nurses thank you for your bequest.',
      copy: 'Gold Coast Hospital Foundation · bequest program · ACNC · solicitor referral inside.',
    },
    {
      headline: 'New oncology wing · open 2027 · be part of it.',
      copy: 'GCH Foundation · capital campaign · ACNC · TGA · AHPRA-compliant.',
    },
    {
      headline: 'GCH paediatric wing · meet the team.',
      copy: 'GCH Foundation · paediatric appeal · ACNC · TGA-compliant content.',
    },
    {
      headline: 'Capital campaign · we are 74% there.',
      copy: 'GCH Foundation · capital campaign · progress update · ACNC.',
    },
    {
      headline: 'Every bequest builds a wing.',
      copy: 'GCH Foundation · bequest program · ACNC · solicitor referrals listed.',
    },
    {
      headline: 'GCH paediatric · sponsor a hospital room.',
      copy: 'GCH Foundation · room-naming opportunity · major gifts · ACNC.',
    },
  ],
};

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

function buildSeedVariants(slug: string, themes: CreativeTheme[]): Variant[] {
  const seeds = SEED_HEADLINES[slug] ?? SEED_HEADLINES['hope-forward']!;
  const caps: Array<Variant['capability']> = ['image', 'image', 'carousel', 'video'];
  return seeds.slice(0, 8).map((s, i) => {
    const themeIdx = djb2(`${slug}-${i}`) % themes.length;
    const cap = caps[i % caps.length]!;
    return {
      id: `${slug}_var_${(i + 1).toString().padStart(2, '0')}`,
      headline: s.headline,
      copy: s.copy,
      theme: themes[themeIdx]!,
      capability: cap,
      safetyPass: i !== 4, // simulate one safety flag for variety
      cost: 0.32 + i * 0.04,
      c2paId: `c2pa-${slug.slice(0, 2)}${(9421 + i).toString(16)}`,
      status: 'preview',
    };
  });
}

export default function Page({ params }: PageProps): JSX.Element {
  const account = getAccount(params.slug);
  const data = getAccountMarketing(params.slug);
  const briefDefaults =
    ACCOUNT_BRIEF_DEFAULTS[params.slug] ?? ACCOUNT_BRIEF_DEFAULTS['hope-forward']!;
  const themes = data?.themes ?? [];
  const channels = data?.channels ?? ['meta'];

  const [audience, setAudience] = useState(briefDefaults.audience);
  const [headlineGoal, setHeadlineGoal] = useState(briefDefaults.headlineGoal);
  const [channel, setChannel] = useState<Channel>(channels[0] ?? 'meta');
  const [format, setFormat] = useState<Format>('image');
  const [brandKit, setBrandKit] = useState(briefDefaults.brandKit);
  const [isGenerating, setIsGenerating] = useState(false);
  const [variants, setVariants] = useState<Variant[]>(() => buildSeedVariants(params.slug, themes));
  const [selectedId, setSelectedId] = useState<string | null>(variants[0]?.id ?? null);

  const availableFormats: Array<{ value: Format; label: string }> = useMemo(() => {
    const formats: Format[] =
      channel === 'email' || channel === 'sms' ? ['text'] : ['image', 'carousel', 'video'];
    return formats.map((f) => ({ value: f, label: f.charAt(0).toUpperCase() + f.slice(1) }));
  }, [channel]);

  if (!account || !data) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Marketing Studio · Generator">
        <div className="text-[13px] text-muted">No marketing data wired for this account.</div>
      </AccountShell>
    );
  }

  function handleGenerate(): void {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setVariants(buildSeedVariants(params.slug, themes).map((v) => ({ ...v, status: 'preview' })));
    }, 1200);
  }

  function approve(id: string): void {
    setVariants((vs) => vs.map((v) => (v.id === id ? { ...v, status: 'approved' as const } : v)));
  }

  function reject(id: string): void {
    setVariants((vs) => vs.map((v) => (v.id === id ? { ...v, status: 'rejected' as const } : v)));
  }

  function regenerate(id: string): void {
    setVariants((vs) =>
      vs.map((v) =>
        v.id === id ? { ...v, id: `${v.id}-r${Date.now() % 1000}`, status: 'preview' as const } : v,
      ),
    );
  }

  const selected = variants.find((v) => v.id === selectedId);
  const approvedCount = variants.filter((v) => v.status === 'approved').length;
  const rejectedCount = variants.filter((v) => v.status === 'rejected').length;
  const safetyPassCount = variants.filter((v) => v.safetyPass).length;
  const totalCost = variants.reduce((s, v) => s + v.cost, 0);

  return (
    <AccountShell
      accountSlug={params.slug}
      pageTitle={`Marketing Studio · ${account.shortName} · Generator`}
    >
      <div className="space-y-4 max-w-[1700px]">
        <MarketingStudioTabs slug={params.slug} active="generate" />

        <Banner tone="info">
          <span className="text-[13px] flex items-center gap-2">
            <Wand2 size={14} className="text-accent" />
            <span>
              <span className="font-semibold">{data.scopeLabel}</span> generator · pre-loaded with
              this account&apos;s vertical ({data.vertical}), region ({data.region}), brand voice,
              and the {data.channels.length} channels you actually run. Every output is
              moderation-scanned and brand-safety-checked against your account&apos;s rule pack
              before it leaves this surface.
            </span>
          </span>
        </Banner>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="Variants this brief"
            value={variants.length}
            hint={`${data.themes.length} themes × ${data.channels.length} channels`}
          />
          <KpiCard
            label="Safety pass"
            value={`${safetyPassCount} / ${variants.length}`}
            hint={`${data.brandRules.length} rules applied`}
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
            <Section title="Brief" subtitle={`${account.shortName} · ${data.region}`}>
              <div className="space-y-3">
                <Readonly label="Vertical" value={data.vertical} />
                <Readonly label="Region" value={data.region} />
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
                <Field label={`Channel · ${data.channels.length} available`}>
                  <PillToggle
                    value={channel}
                    options={data.channels.map((c) => ({ value: c, label: CHANNEL_LABEL[c] }))}
                    onChange={(v) => setChannel(v)}
                  />
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
                  {isGenerating ? 'Generating variants…' : 'Generate 8 variants'}
                </Button>
                <div className="pt-2 border-t border-line2">
                  <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-1.5">
                    Pipeline · estimated
                  </div>
                  <div className="space-y-1 text-[11px]">
                    <BriefMeta label="Compose" value="claude-3-5-sonnet · ~$0.04" />
                    <BriefMeta label="Image gen" value="flux-1.1-pro · ~$0.32" />
                    <BriefMeta
                      label="Safety scan"
                      value={`${data.brandRules.length} rules · ~$0.02`}
                    />
                    <BriefMeta label="C2PA sign" value="ed25519 · $0.00" />
                  </div>
                </div>
              </div>
            </Section>
          </div>

          {/* MIDDLE — Preview */}
          <div className="lg:col-span-6">
            <Section
              title={`Preview · ${variants.length} variants`}
              subtitle="Themes drawn from your account's brand voice"
            >
              {isGenerating ? (
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

          {/* RIGHT — Safety */}
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
                        : 'Flagged for review against vertical rule pack.'
                    }
                  />
                  <SafetyRow
                    icon={<Sparkles size={13} className="text-accent" />}
                    label={`Vertical rules (${data.vertical}/${data.region})`}
                    pass={selected.safetyPass}
                    detail={
                      selected.safetyPass
                        ? `${data.brandRules.length} rules passed · ${data.region}-specific code applied.`
                        : 'Substantiation required for one efficacy/impact claim.'
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
                    detail="No legal-hold record matched account or program names."
                  />
                  <div className="pt-3 border-t border-line2">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted font-medium mb-1.5">
                      <FileCheck2 size={11} className="text-accent" /> C2PA manifest preview
                    </div>
                    <div className="bg-paper border border-line2 rounded-md p-2.5 font-mono text-[10px] leading-relaxed text-ink space-y-0.5">
                      <div>
                        manifest_id: <span className="text-accent">{selected.c2paId}</span>
                      </div>
                      <div>account: {params.slug}</div>
                      <div>vertical: {data.vertical}</div>
                      <div>region: {data.region}</div>
                      <div>model: anthropic/claude-3.5-sonnet</div>
                      <div>image_model: flux-1.1-pro</div>
                      <div>cost_cents: {Math.round(selected.cost * 100)}</div>
                      <div>safety_scan: pass</div>
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
}: {
  variant: Variant;
  isSelected: boolean;
  onSelect: () => void;
  onApprove: () => void;
  onReject: () => void;
  onRegenerate: () => void;
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
