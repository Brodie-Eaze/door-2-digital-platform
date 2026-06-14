/**
 * /api/orgs/[slug]/leads — list leads scoped to a single sub-account.
 *
 * Authorization mirrors GET /api/orgs:
 *   - super_admin → can read any org's leads
 *   - everyone else → only their own org's leads
 *
 * Pagination: cursor-based. `?cursor=lead_xxx` returns the next 50
 * leads strictly older than (or equal to creation-time ordering) that
 * cursor. `nextCursor` is null when the page is partial.
 *
 * PII masking: every row's `email` and `phone` are masked on the wire.
 * The Fastify API's pii-vault step-up unmask is the only path to
 * plaintext; this BFF never returns raw PII even to the row's own
 * tenant.
 */
import type { NextRequest } from 'next/server';
import { db } from '@d2d/database';
import {
  forbidden,
  internal,
  isCrossTenantOperator,
  notFound,
  ok,
  requireSession,
} from '@/lib/api-helpers';
import { maskEmail, maskPhone } from '@/lib/db-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PAGE_SIZE = 50;

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } },
): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  const slug = params.slug;
  if (!slug) return notFound('Org', slug);

  let org;
  try {
    org = await db.org.findUnique({
      where: { slug },
      select: { id: true, slug: true, regionCode: true, tradingName: true, status: true },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/orgs/:slug/leads] org lookup failed:', err);
    return internal('Failed to resolve org');
  }
  if (!org || !org.slug) return notFound('Org', slug);

  // Authorization (over a cryptographically verified session): a genuine
  // cross-tenant operator can read any org's leads; everyone else only their
  // own org's. Tenant scope is also enforced in the lead query below
  // (where: { orgId: org.id }), so PII never leaks across tenants.
  if (!isCrossTenantOperator(session) && session.orgId !== org.id) {
    return forbidden('You do not have access to this sub-account');
  }

  const cursor = req.nextUrl.searchParams.get('cursor');
  const take = PAGE_SIZE + 1; // fetch one extra to detect "hasMore"

  try {
    const leads = await db.lead.findMany({
      where: { orgId: org.id, status: { not: 'do_not_contact' } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        address: { select: { street: true, locality: true, region: true, postcode: true } },
      },
    });
    const hasMore = leads.length > PAGE_SIZE;
    const items = hasMore ? leads.slice(0, PAGE_SIZE) : leads;

    return ok({
      org: { id: org.id, slug: org.slug, tradingName: org.tradingName, regionCode: org.regionCode },
      leads: items.map((l) => ({
        id: l.id,
        // PII-first: this is a BULK list surface. Reduce the PII footprint —
        // given name + family INITIAL only (e.g. "Maria S."), masked email/phone,
        // and a COARSE address (locality + region; no street/postcode). Full
        // name + precise address for a single lead is available only through the
        // lead-detail JIT PII-unmask path, which audits the access.
        givenName: l.givenName,
        familyName: l.familyName ? `${l.familyName.charAt(0)}.` : null,
        status: l.status,
        vertical: l.vertical,
        email: maskEmail(l.email),
        phone: maskPhone(l.phone),
        emailDigestPrefix: l.emailDigest?.slice(0, 8) ?? null,
        address: l.address
          ? `${l.address.locality}${l.address.region ? `, ${l.address.region}` : ''}`
          : null,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
      })),
      nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
      total: items.length,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/orgs/:slug/leads] failed:', err);
    return internal('Failed to load leads');
  }
}
