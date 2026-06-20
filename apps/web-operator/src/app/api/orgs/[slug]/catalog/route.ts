/**
 * /api/orgs/[slug]/catalog — the per-account ServiceOffering catalog surface.
 *
 * GET   List the sub-account's ACTIVE offerings (sortOrder asc) — this is what
 *       the native Knocker app shows on the sign-up flow.
 * POST  Create an offering — manager+. Mirrors the Fastify `POST /v1/catalog`
 *       (apps/api domains/catalog/service.createOffering): same ServiceOffering
 *       columns, BigInt amountCents, same audit action `service_offering.created`.
 *
 * Tenant scope: resolveAccountOrg pins every read/write to the slug's Org and
 * authorizes the verified session. orgId/regionCode come from the resolved org,
 * NEVER the body.
 *
 * Money: `amountCents` is a positive integer of cents on the wire (4000 = $40)
 * → BigInt in the DB. The iOS contract reads `amountCents` as an integer.
 */
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@d2d/database';
import {
  forbidden,
  internal,
  ok,
  requireSession,
  resolveAccountOrg,
  validation,
} from '@/lib/api-helpers';
import { newOfferingId, writeAudit } from '@/lib/db-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Roles permitted to manage the catalog — mirrors the Fastify WRITE_ROLES. */
const WRITE_ROLES: ReadonlySet<string> = new Set(['super_admin', 'org_admin', 'manager']);

// Field names + enums mirror apps/api domains/catalog/schemas exactly.
const frequencyEnum = z.enum(['monthly', 'weekly', 'once']);
const verticalEnum = z.enum(['charity', 'commercial']);

const createOfferingSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    blurb: z.string().max(500).optional(),
    // Positive integer cents — a $0 doorstep offering is meaningless.
    amountCents: z.number().int().positive(),
    frequency: frequencyEnum,
    vertical: verticalEnum,
    highlighted: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  })
  .strict();

/** BigInt cents → JS number of cents (catalog amounts are far below MAX_SAFE). */
function toOfferingPublic(r: {
  id: string;
  name: string;
  blurb: string;
  amountCents: bigint;
  frequency: string;
  vertical: 'charity' | 'commercial';
  highlighted: boolean;
  sortOrder: number;
  active: boolean;
}): {
  id: string;
  name: string;
  blurb: string;
  amountCents: number;
  frequency: string;
  vertical: 'charity' | 'commercial';
  highlighted: boolean;
  sortOrder: number;
  active: boolean;
} {
  return {
    id: r.id,
    name: r.name,
    blurb: r.blurb,
    amountCents: Number(r.amountCents),
    frequency: r.frequency,
    vertical: r.vertical,
    highlighted: r.highlighted,
    sortOrder: r.sortOrder,
    active: r.active,
  };
}

export async function GET(
  _req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const params = await paramsPromise;
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  const orgOrErr = await resolveAccountOrg(params.slug, session);
  if (orgOrErr instanceof Response) return orgOrErr;
  const org = orgOrErr;

  try {
    const rows = await db.serviceOffering.findMany({
      where: { orgId: org.id, active: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return ok({
      orgId: org.id,
      offerings: rows.map(toOfferingPublic),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/orgs/:slug/catalog GET] failed:', err);
    return internal('Failed to load catalog');
  }
}

export async function POST(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const params = await paramsPromise;
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  const orgOrErr = await resolveAccountOrg(params.slug, session);
  if (orgOrErr instanceof Response) return orgOrErr;
  const org = orgOrErr;

  if (!WRITE_ROLES.has(session.role)) {
    return forbidden('Your role may not manage the catalog');
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return validation('Request body must be JSON');
  }

  const parsed = createOfferingSchema.safeParse(raw);
  if (!parsed.success) {
    return validation('Invalid offering payload', parsed.error.flatten().fieldErrors);
  }
  const input = parsed.data;

  const id = newOfferingId();
  const amountCents = BigInt(input.amountCents);

  try {
    const created = await db.$transaction(async (tx) => {
      const row = await tx.serviceOffering.create({
        data: {
          id,
          orgId: org.id,
          regionCode: org.regionCode,
          name: input.name,
          blurb: input.blurb ?? '',
          amountCents,
          frequency: input.frequency,
          vertical: input.vertical,
          highlighted: input.highlighted ?? false,
          sortOrder: input.sortOrder ?? 0,
        },
      });
      await writeAudit(tx, {
        orgId: org.id,
        regionCode: org.regionCode,
        actorUserId: session.userId,
        action: 'service_offering.created',
        resourceType: 'ServiceOffering',
        resourceId: id,
        afterJson: {
          name: input.name,
          amountCents: amountCents.toString(),
          frequency: input.frequency,
          vertical: input.vertical,
          highlighted: input.highlighted ?? false,
          sortOrder: input.sortOrder ?? 0,
        },
        metadata: { via: 'web-operator.account-catalog' },
      });
      return row;
    });
    return ok({ offering: toOfferingPublic(created) }, { status: 201 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/orgs/:slug/catalog POST] failed:', err);
    return internal('Failed to create offering');
  }
}
