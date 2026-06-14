/**
 * /api/orgs/[slug]/catalog/[id] — edit / archive a single ServiceOffering.
 *
 * PATCH   Update an offering (manager+). Mirrors the Fastify `PATCH /v1/catalog/:id`.
 * DELETE  SOFT delete (active=false) — mirrors the Fastify `DELETE /v1/catalog/:id`.
 *         Offerings are never hard-deleted so historic conversions + the audit
 *         chain keep referencing a real catalog row.
 *
 * Tenant scope: resolveAccountOrg pins the org; the offering is then looked up
 * org-scoped (where: { id, orgId }) so a cross-tenant id 404s rather than
 * silently touching another account's catalog.
 */
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@d2d/database';
import {
  forbidden,
  internal,
  notFound,
  ok,
  requireSession,
  resolveAccountOrg,
  validation,
} from '@/lib/api-helpers';
import { writeAudit } from '@/lib/db-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WRITE_ROLES: ReadonlySet<string> = new Set(['super_admin', 'org_admin', 'manager']);

const frequencyEnum = z.enum(['monthly', 'weekly', 'once']);

const updateOfferingSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    blurb: z.string().max(500).optional(),
    amountCents: z.number().int().positive().optional(),
    frequency: frequencyEnum.optional(),
    highlighted: z.boolean().optional(),
    active: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  })
  .strict();

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
}): Record<string, unknown> {
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string; id: string } },
): Promise<Response> {
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

  const parsed = updateOfferingSchema.safeParse(raw);
  if (!parsed.success) {
    return validation('Invalid offering payload', parsed.error.flatten().fieldErrors);
  }
  const input = parsed.data;

  try {
    const existing = await db.serviceOffering.findFirst({
      where: { id: params.id, orgId: org.id },
    });
    if (!existing) return notFound('ServiceOffering', params.id);

    const updated = await db.$transaction(async (tx) => {
      const next = await tx.serviceOffering.update({
        where: { id: params.id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.blurb !== undefined && { blurb: input.blurb }),
          ...(input.amountCents !== undefined && { amountCents: BigInt(input.amountCents) }),
          ...(input.frequency !== undefined && { frequency: input.frequency }),
          ...(input.highlighted !== undefined && { highlighted: input.highlighted }),
          ...(input.active !== undefined && { active: input.active }),
          ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
        },
      });
      await writeAudit(tx, {
        orgId: org.id,
        regionCode: org.regionCode,
        actorUserId: session.userId,
        action: 'service_offering.updated',
        resourceType: 'ServiceOffering',
        resourceId: params.id,
        beforeJson: {
          name: existing.name,
          blurb: existing.blurb,
          amountCents: existing.amountCents.toString(),
          frequency: existing.frequency,
          highlighted: existing.highlighted,
          active: existing.active,
          sortOrder: existing.sortOrder,
        },
        afterJson: {
          name: next.name,
          blurb: next.blurb,
          amountCents: next.amountCents.toString(),
          frequency: next.frequency,
          highlighted: next.highlighted,
          active: next.active,
          sortOrder: next.sortOrder,
        },
        metadata: { via: 'web-operator.account-catalog' },
      });
      return next;
    });
    return ok({ offering: toOfferingPublic(updated) });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/orgs/:slug/catalog/:id PATCH] failed:', err);
    return internal('Failed to update offering');
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { slug: string; id: string } },
): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  const orgOrErr = await resolveAccountOrg(params.slug, session);
  if (orgOrErr instanceof Response) return orgOrErr;
  const org = orgOrErr;

  if (!WRITE_ROLES.has(session.role)) {
    return forbidden('Your role may not manage the catalog');
  }

  try {
    const existing = await db.serviceOffering.findFirst({
      where: { id: params.id, orgId: org.id },
    });
    if (!existing) return notFound('ServiceOffering', params.id);

    await db.$transaction(async (tx) => {
      await tx.serviceOffering.update({
        where: { id: params.id },
        data: { active: false },
      });
      await writeAudit(tx, {
        orgId: org.id,
        regionCode: org.regionCode,
        actorUserId: session.userId,
        action: 'service_offering.archived',
        resourceType: 'ServiceOffering',
        resourceId: params.id,
        beforeJson: { active: existing.active },
        afterJson: { active: false },
        metadata: { via: 'web-operator.account-catalog' },
      });
    });
    return ok({ id: params.id, archived: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/orgs/:slug/catalog/:id DELETE] failed:', err);
    return internal('Failed to archive offering');
  }
}
