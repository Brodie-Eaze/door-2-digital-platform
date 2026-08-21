/**
 * /api/accounts/[slug]/meta — live account header metadata (name, region,
 * avatar colour) for a single org, straight off Prisma. Replaces the static
 * `@/lib/accounts` fixture fleet for the header surfaces (AccountShell etc.).
 *
 * Tenant-scoped: a non-cross-tenant caller may only read their own org; a
 * request for any other slug 404s (never 403 — no existence leak, mirroring
 * the API's cross-tenant posture). Avatar colour is derived deterministically
 * from the slug so it's stable without a stored brand field.
 */
import type { NextRequest } from 'next/server';
import { db } from '@d2d/database';
import { internal, isCrossTenantOperator, notFound, ok, requireSession } from '@/lib/api-helpers';
import { avatarBgFor } from '@/lib/account-color';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface AccountMeta {
  slug: string;
  name: string;
  region: string;
  vertical: string;
  avatarBg: string;
}

export async function GET(
  _req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const params = await paramsPromise;
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  try {
    const org = await db.org.findUnique({
      where: { slug: params.slug },
      select: { id: true, slug: true, tradingName: true, regionCode: true, vertical: true },
    });
    if (!org || !org.slug) return notFound('Account', params.slug);
    // Cross-tenant isolation: only a cross-tenant operator, or a caller pinned
    // to THIS org, may read it. Anyone else gets 404 (no existence leak).
    if (!isCrossTenantOperator(session) && session.orgId !== org.id) {
      return notFound('Account', params.slug);
    }

    const meta: AccountMeta = {
      slug: org.slug,
      name: org.tradingName,
      region: org.regionCode,
      vertical: org.vertical,
      avatarBg: avatarBgFor(org.slug),
    };
    return ok(meta);
  } catch (err) {
    console.error('[api/accounts/[slug]/meta GET] failed:', err);
    return internal('Failed to load account metadata');
  }
}
