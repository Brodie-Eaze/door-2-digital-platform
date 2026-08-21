/**
 * Marketing Studio shared types + presentational label maps.
 *
 * The per-account fixture registry (ACCOUNT_MARKETING / getAccountMarketing)
 * that used to live here was deleted — every /accounts/[slug]/marketing-studio
 * page now reads live Prisma via /api/orgs/[slug]/marketing/* (providers,
 * jobs, creatives, campaigns), tenant-scoped by resolveAccountOrg. What
 * remains are the type defs and static UI label/badge maps (channel labels,
 * provider display names/docs) — legitimate presentational constants, not
 * fabricated business data, safe to reuse when rendering real rows.
 *
 * `ScopedCreative`/`ScopedCampaign`/etc and `AccountMarketing` below describe
 * the old fixture shape and are unused now that every page reads the real
 * Prisma-backed API response shapes directly; kept only if something still
 * imports them, otherwise safe to delete in a follow-up pass.
 */

import type { CreativeTheme } from './creative-images';

export type Channel = 'meta' | 'google' | 'tiktok' | 'youtube' | 'email' | 'sms';
export type Format = 'image' | 'carousel' | 'video' | 'avatar' | 'text';
export type CreativeStatus = 'draft' | 'review' | 'approved' | 'published' | 'blocked';

export interface ScopedCreative {
  id: string;
  headline: string;
  copy: string;
  theme: CreativeTheme;
  channel: Channel;
  format: Format;
  status: CreativeStatus;
  spendCents: number;
  conversions: number;
  convRate: number;
  roas: number;
  liveAt?: string; // ISO
  reviewerInitials?: string;
}

export interface ScopedCampaign {
  id: string;
  name: string;
  channel: Channel;
  status: 'active' | 'paused' | 'scheduled' | 'ended';
  budgetCents: number;
  spendCents: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctrPct: number;
  roas: number;
  attribution: 'knock' | 'inside_sales' | 'retargeting' | 'cold';
  startedAt: string;
}

export interface ScopedRetargetingCohort {
  id: string;
  name: string;
  source: string;
  audienceSize: number;
  reach: number;
  ctrPct: number;
  attributedConversions: number;
  revenueCents: number;
}

export interface ScopedBrandRule {
  id: string;
  category: 'charity' | 'pest' | 'solar' | 'energy' | 'healthcare' | 'generic';
  rule: string;
  scope: string; // e.g. "US (FTC, ACFR)" or "AU (ACNC, ACL)"
  severity: 'critical' | 'warn' | 'info';
}

export interface ScopedBlock {
  id: string;
  creativeId: string;
  creativeHeadline: string;
  ruleViolated: string;
  severity: 'critical' | 'warn' | 'info';
  reviewer: string;
  blockedAt: string;
  status: 'pending' | 'released' | 'rewritten';
}

export interface ScopedProvider {
  kind: string;
  status: 'connected' | 'sandbox' | 'not_connected' | 'error';
  accountLabel: string;
  callsToday: number;
  costCentsToday: number;
  lastPingAt: string;
}

export interface AccountMarketing {
  scopeLabel: string;
  currency: 'USD' | 'AUD' | 'SGD';
  region: 'US' | 'AU' | 'SG';
  vertical: 'charity' | 'commercial' | 'healthcare';
  /** Themes used by the generator + library scope filters. */
  themes: CreativeTheme[];
  /** Channels this account actively runs on. */
  channels: Channel[];
  creatives: ScopedCreative[];
  campaigns: ScopedCampaign[];
  retargetingCohorts: ScopedRetargetingCohort[];
  brandRules: ScopedBrandRule[];
  recentBlocks: ScopedBlock[];
  providers: ScopedProvider[];
  pipelineCounts: {
    brief: number;
    compose: number;
    variation: number;
    review: number;
    publish: number;
    measure: number;
  };
  kpis: {
    creativesThisWeek: number;
    safetyPassPct: number;
    avgCostPerCreativeCents: number;
    activeCampaigns: number;
    rollingRoas: number;
    aiAssistHoursSaved: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers shared across per-account marketing-studio surfaces
// ─────────────────────────────────────────────────────────────────────────────

export const CHANNEL_LABEL: Record<Channel, string> = {
  meta: 'Meta',
  google: 'Google',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  email: 'Email',
  sms: 'SMS',
};

export const CHANNEL_BADGE: Record<Channel, string> = {
  meta: 'bg-blue-100 text-blue-700',
  google: 'bg-amber-100 text-amber-700',
  tiktok: 'bg-rose-100 text-rose-700',
  youtube: 'bg-red-100 text-red-700',
  email: 'bg-emerald-100 text-emerald-700',
  sms: 'bg-violet-100 text-violet-700',
};

export const PROVIDER_LABEL: Record<string, string> = {
  meta_marketing: 'Meta Marketing',
  google_ads: 'Google Ads',
  tiktok_marketing: 'TikTok Marketing',
  youtube: 'YouTube',
  claude_copy: 'Anthropic Claude (copy)',
  openai_copy: 'OpenAI (copy fallback)',
  flux_image: 'FLUX 1.1 Pro (image)',
  ideogram_image: 'Ideogram (image)',
  higgsfield_video: 'Higgsfield (video)',
  runway_video: 'Runway Gen-3 (video)',
  heygen_avatar: 'HeyGen (avatar)',
  anthropic_mod: 'Anthropic moderation',
};

export const PROVIDER_INITIALS: Record<string, string> = {
  meta_marketing: 'M',
  google_ads: 'G',
  tiktok_marketing: 'T',
  youtube: 'YT',
  claude_copy: 'A',
  openai_copy: 'O',
  flux_image: 'F',
  ideogram_image: 'I',
  higgsfield_video: 'H',
  runway_video: 'R',
  heygen_avatar: 'HG',
  anthropic_mod: 'AM',
};

export const PROVIDER_GRADIENT: Record<string, string> = {
  meta_marketing: 'from-blue-600 to-indigo-700',
  google_ads: 'from-emerald-600 to-teal-700',
  tiktok_marketing: 'from-pink-600 to-rose-700',
  youtube: 'from-red-600 to-rose-700',
  claude_copy: 'from-orange-500 to-red-600',
  openai_copy: 'from-slate-700 to-slate-900',
  flux_image: 'from-cyan-600 to-blue-700',
  ideogram_image: 'from-fuchsia-600 to-pink-700',
  higgsfield_video: 'from-amber-600 to-orange-700',
  runway_video: 'from-zinc-600 to-zinc-800',
  heygen_avatar: 'from-green-600 to-emerald-700',
  anthropic_mod: 'from-orange-600 to-amber-700',
};
