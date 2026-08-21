/**
 * Deterministic monogram-avatar background for an account slug. Shared by the
 * account-meta and account-list endpoints so an org's avatar colour is stable
 * and identical everywhere without a stored brand field. Pure — no data, no
 * fixtures. House-style palette (navy / slate / blue).
 */
const AVATAR_PALETTE = ['#0F172A', '#1E293B', '#334155', '#475569', '#3B82F6'] as const;

export function avatarBgFor(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]!;
}

/** Human-readable fallback name from a slug while live meta loads. */
export function prettifySlug(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * 2-letter monogram from a display name. Pure — no data. Kept here (a plain,
 * non-'use client' module) so server components (e.g. /screens) can use it
 * without pulling a client boundary in.
 */
export function monogramFrom(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  return (parts[0]?.slice(0, 2) ?? '??').toUpperCase();
}
