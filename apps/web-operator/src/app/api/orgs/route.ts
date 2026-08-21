/**
 * /api/orgs — list + create the operator's sub-accounts.
 *
 * GET: returns every org the signed-in user can see.
 *   - super_admin sees every non-archived org (Brodie's command-centre).
 *   - org_admin (and lesser roles) see only their own org.
 *
 * POST: creates a new Org + BrandKit + OrgBilling + AuditEvent atomically.
 *   - Requires Idempotency-Key header (ADR-0010).
 *   - Region is immutable post-create (ADR per schema comment).
 *   - Slug derived from tradingName, collision-suffixed.
 *
 * All responses use RFC 7807 problem+json on error and embed BigInt
 * (Money cents) as string via the api-helpers JSON replacer.
 */
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma, db } from '@d2d/database';
import {
  forbidden,
  internal,
  isCrossTenantOperator,
  ok,
  problemResponse,
  problem,
  requireIdempotencyKey,
  requireSession,
  validation,
} from '@/lib/api-helpers';
import {
  emailDigest,
  ensureUniqueSlug,
  generateInviteToken,
  newBillingId,
  newBrandKitId,
  newOrgId,
  newUserId,
  writeAudit,
} from '@/lib/db-helpers';

// Force Node runtime — Prisma can't run on the Edge.
export const runtime = 'nodejs';
// User-scoped reads + writes — never cache at the framework layer.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const verticalEnum = z.enum(['charity', 'commercial']);
const regionEnum = z.enum(['US', 'AU', 'SG']);

const createOrgSchema = z.object({
  legalName: z.string().min(1).max(200),
  tradingName: z.string().min(1).max(100),
  vertical: verticalEnum,
  // 'healthcare' from the UI wizard maps to 'charity' because the schema enum
  // only allows charity|commercial. The wizard accepts 'healthcare' for UX;
  // we coerce here so DB integrity stays clean.
  uiVertical: z.enum(['charity', 'commercial', 'healthcare']).optional(),
  regionCode: regionEnum,
  brandCode: z.string().default('d2d'),
  abnAcnUen: z.string().optional().nullable(),
  // Optional founding org_admin — invited atomically with the org so a new
  // client account is never born ownerless (D2: onboarding mints logins).
  admin: z
    .object({
      email: z.string().email(),
      givenName: z.string().min(1).max(80),
      familyName: z.string().min(1).max(80),
    })
    .optional(),
  // Optional brand kit overrides — applied at create-time.
  brandKit: z
    .object({
      displayName: z.string().min(1).optional(),
      primaryColor: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .optional(),
      accentColor: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .optional(),
      supportEmail: z.string().email().optional(),
      privacyPolicyUrl: z.string().url().optional(),
      termsUrl: z.string().url().optional(),
    })
    .optional(),
  // Optional billing overrides — defaulted by Prisma schema otherwise.
  billing: z
    .object({
      platformFeeMonthlyCents: z.number().int().min(0).optional(),
      doorRakePercent: z.number().min(0).max(100).optional(),
      insideSalesRakePercent: z.number().min(0).max(100).optional(),
      retargetingRakePercent: z.number().min(0).max(100).optional(),
      billingDay: z.number().int().min(1).max(28).optional(),
      currency: z.string().length(3).optional(),
    })
    .optional(),
});

export async function GET(): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  try {
    // Tenant scope (defense-in-depth, now over a CRYPTOGRAPHICALLY VERIFIED
    // session): only a genuine cross-tenant operator lists every org. A valid
    // org_admin/lesser role is pinned to its own session.orgId; a session with
    // no orgId resolves to an impossible id (empty result), never all orgs.
    const orgs = await db.org.findMany({
      where: isCrossTenantOperator(session)
        ? { status: { not: 'archived' }, slug: { not: null } }
        : session.orgId
          ? { id: session.orgId, status: { not: 'archived' }, slug: { not: null } }
          : { id: '__no_org__' },
      orderBy: { createdAt: 'asc' },
      include: { brandKit: true, billing: true },
    });
    return ok({
      orgs: orgs.map((o) => ({
        id: o.id,
        slug: o.slug,
        legalName: o.legalName,
        tradingName: o.tradingName,
        vertical: o.vertical,
        regionCode: o.regionCode,
        brandCode: o.brandCode,
        status: o.status,
        createdAt: o.createdAt,
        brandKit: o.brandKit
          ? {
              displayName: o.brandKit.displayName,
              primaryColor: o.brandKit.primaryColor,
              accentColor: o.brandKit.accentColor,
              supportEmail: o.brandKit.supportEmail,
            }
          : null,
        billing: o.billing
          ? {
              platformFeeMonthlyCents: o.billing.platformFeeMonthlyCents,
              doorRakePercent: o.billing.doorRakePercent.toString(),
              insideSalesRakePercent: o.billing.insideSalesRakePercent.toString(),
              retargetingRakePercent: o.billing.retargetingRakePercent.toString(),
              billingDay: o.billing.billingDay,
              currency: o.billing.currency,
            }
          : null,
      })),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/orgs GET] failed:', err);
    return internal('Failed to load orgs');
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  // Only a genuine cross-tenant operator can mint new sub-accounts.
  if (!isCrossTenantOperator(session)) {
    return forbidden('Only platform admins may create sub-accounts');
  }

  const idemOrErr = requireIdempotencyKey(req);
  if (idemOrErr instanceof Response) return idemOrErr;
  const idempotencyKey = idemOrErr;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return validation('Request body must be JSON');
  }

  const parsed = createOrgSchema.safeParse(raw);
  if (!parsed.success) {
    return validation('Invalid create-org payload', parsed.error.flatten());
  }
  const input = parsed.data;

  // Idempotency — bail out fast if we already serviced this key.
  try {
    const existing = await db.idempotencyRecord.findUnique({ where: { key: idempotencyKey } });
    if (existing) {
      const body = (existing.responseBody as { orgId: string; slug: string } | null) ?? null;
      if (body) return ok(body, { status: existing.responseStatus });
      // Race: record exists but body missing — fall through and try again
      // (rare; only the in-progress writer hits this).
    }
  } catch (err) {
    // Idempotency lookup must never block the write path. Log and proceed.
    // eslint-disable-next-line no-console
    console.warn('[api/orgs POST] idempotency lookup failed:', err);
  }

  // Coerce UI vertical → schema vertical (healthcare → charity).
  const schemaVertical: 'charity' | 'commercial' =
    input.vertical === 'commercial' ? 'commercial' : 'charity';

  const slug = await ensureUniqueSlug(input.tradingName || input.legalName);

  const orgId = newOrgId();
  const brkId = newBrandKitId();
  const bilId = newBillingId();

  // Founding admin invite — dup-check the email up front so the whole org
  // create fails fast instead of half-provisioning.
  const adminUserId = input.admin ? newUserId() : null;
  const adminInvite = input.admin ? generateInviteToken() : null;
  const adminInviteExpiresAt = input.admin ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null;
  if (input.admin) {
    try {
      const existing = await db.user.findUnique({
        where: { emailDigest: emailDigest(input.admin.email) },
      });
      if (existing) {
        return problemResponse(
          problem(
            'conflict',
            'Admin email already registered',
            409,
            'A user with that email already exists. Use a different admin email.',
          ),
        );
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[api/orgs POST] admin dup-check failed:', err);
      return internal('Failed to provision sub-account');
    }
  }

  let createdOrg: { id: string; slug: string | null };
  try {
    createdOrg = await db.$transaction(async (tx) => {
      const org = await tx.org.create({
        data: {
          id: orgId,
          slug,
          legalName: input.legalName,
          tradingName: input.tradingName,
          vertical: schemaVertical,
          type: 'client',
          regionCode: input.regionCode,
          brandCode: input.brandCode ?? 'd2d',
          abnAcnUen: input.abnAcnUen ?? null,
          status: 'active',
        },
      });
      await tx.brandKit.create({
        data: {
          id: brkId,
          orgId,
          displayName: input.brandKit?.displayName ?? input.tradingName,
          primaryColor: input.brandKit?.primaryColor ?? '#0F172A',
          accentColor: input.brandKit?.accentColor ?? '#3B82F6',
          supportEmail: input.brandKit?.supportEmail ?? null,
          privacyPolicyUrl: input.brandKit?.privacyPolicyUrl ?? null,
          termsUrl: input.brandKit?.termsUrl ?? null,
        },
      });
      const currency =
        input.billing?.currency ??
        (input.regionCode === 'AU' ? 'AUD' : input.regionCode === 'SG' ? 'SGD' : 'USD');
      await tx.orgBilling.create({
        data: {
          id: bilId,
          orgId,
          currency,
          platformFeeMonthlyCents: BigInt(input.billing?.platformFeeMonthlyCents ?? 250000),
          ...(input.billing?.doorRakePercent !== undefined && {
            doorRakePercent: new Prisma.Decimal(input.billing.doorRakePercent),
          }),
          ...(input.billing?.insideSalesRakePercent !== undefined && {
            insideSalesRakePercent: new Prisma.Decimal(input.billing.insideSalesRakePercent),
          }),
          ...(input.billing?.retargetingRakePercent !== undefined && {
            retargetingRakePercent: new Prisma.Decimal(input.billing.retargetingRakePercent),
          }),
          ...(input.billing?.billingDay !== undefined && { billingDay: input.billing.billingDay }),
        },
      });
      if (input.admin && adminUserId && adminInvite && adminInviteExpiresAt) {
        await tx.user.create({
          data: {
            id: adminUserId,
            orgId,
            email: input.admin.email,
            emailDigest: emailDigest(input.admin.email),
            givenName: input.admin.givenName,
            familyName: input.admin.familyName,
            role: 'org_admin',
            regionCode: org.regionCode,
            status: 'invited',
          },
        });
        await tx.userCredential.create({
          data: {
            userId: adminUserId,
            // Sentinel — can never match a real scrypt output (same as the
            // Fastify invite path). accept-invite swaps it for a real hash.
            passwordHash: '__invite_pending__:00',
            inviteTokenHash: adminInvite.hash,
            inviteExpiresAt: adminInviteExpiresAt,
          },
        });
        await writeAudit(tx, {
          orgId,
          regionCode: org.regionCode,
          actorUserId: session.userId,
          action: 'user.invited',
          resourceType: 'User',
          resourceId: adminUserId,
          afterJson: { email: '[REDACTED]', role: 'org_admin', status: 'invited' },
          metadata: {
            invitedBy: session.userId,
            via: 'web-operator.onboard-wizard',
            expiresAt: adminInviteExpiresAt.toISOString(),
          },
        });
      }
      await writeAudit(tx, {
        orgId,
        regionCode: org.regionCode,
        actorUserId: session.userId,
        action: 'org.created',
        resourceType: 'Org',
        resourceId: orgId,
        afterJson: {
          slug,
          legalName: org.legalName,
          regionCode: org.regionCode,
          vertical: org.vertical,
          type: org.type,
        },
        metadata: { source: 'web-operator.onboard-wizard', idempotencyKey },
      });
      return { id: org.id, slug: org.slug };
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/orgs POST] transaction failed:', err);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return problemResponse(
        problem(
          'conflict',
          'Slug already exists',
          409,
          'A sub-account with that name already exists. Try a different trading name.',
        ),
      );
    }
    return internal('Failed to provision sub-account');
  }

  const body = { orgId: createdOrg.id, slug: createdOrg.slug };
  // The invite token rides the live response EXACTLY ONCE and is never
  // persisted in plaintext — idempotent replays return the org without it.
  const liveBody =
    input.admin && adminInvite && adminInviteExpiresAt
      ? {
          ...body,
          adminInvite: {
            email: input.admin.email,
            inviteToken: adminInvite.plaintext,
            expiresAt: adminInviteExpiresAt.toISOString(),
          },
        }
      : body;

  // Persist idempotency record for replay safety (24h TTL).
  try {
    await db.idempotencyRecord.create({
      data: {
        key: idempotencyKey,
        orgId,
        method: 'POST',
        path: '/api/orgs',
        bodyHash: '', // body hash optional in BFF (the prod API computes it)
        responseStatus: 201,
        responseBodyKey: '',
        responseBody: body as unknown as Prisma.InputJsonValue,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  } catch (err) {
    // Idempotency persistence is best-effort. Surface in logs but don't
    // fail the otherwise-successful write.
    // eslint-disable-next-line no-console
    console.warn('[api/orgs POST] idempotency persist failed:', err);
  }

  return ok(liveBody, { status: 201 });
}
