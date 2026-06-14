/**
 * /api/orgs/[slug]/knockers — the per-account Team/Knockers surface.
 *
 * GET   List the sub-account's knockers (User where role=knocker), masked.
 * POST  Invite a knocker: create a User (status='invited') + a UserCredential
 *       carrying the SHA-256 of an opaque invite token, and return the token so
 *       the manager can send the set-password link. This is the web BFF twin of
 *       the Fastify `POST /v1/users` invite path (apps/api domains/user/service
 *       inviteUser) — same tables, same emailDigest, same audit chain, same
 *       inviteTokenHash that `POST /v1/users/accept-invite` verifies on the
 *       knocker's side.
 *
 * Tenant scope: resolveAccountOrg pins every read/write to the slug's Org and
 * authorizes the verified session against it (super_admin → any sub-account;
 * everyone else → their own only). The orgId is NEVER taken from the body.
 *
 * PII-first: the list NEVER returns plaintext email/phone — email is masked,
 * family name is reduced to an initial (mirrors the Fastify staff-directory
 * read boundary). The invite token is returned exactly once on create and never
 * persisted in plaintext.
 */
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma, db } from '@d2d/database';
import {
  conflict,
  forbidden,
  internal,
  ok,
  requireSession,
  resolveAccountOrg,
  validation,
} from '@/lib/api-helpers';
import {
  emailDigest,
  generateInviteToken,
  maskEmail,
  newUserId,
  writeAudit,
} from '@/lib/db-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Roles permitted to invite a knocker — mirrors the Fastify USER_ADMIN_ROLES. */
const INVITE_ROLES: ReadonlySet<string> = new Set(['super_admin', 'org_admin', 'manager']);

const inviteKnockerSchema = z
  .object({
    givenName: z.string().trim().min(1).max(100),
    familyName: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(200),
    // Optional invite TTL; defaults to 7 days (matches the Fastify invite).
    expiresInDays: z.number().int().min(1).max(60).optional(),
  })
  .strict();

/** "JD" from given + family — same convention as the roster/staff display. */
function initialsFor(givenName: string, familyName: string): string {
  return `${givenName.charAt(0)}${familyName.charAt(0) ?? ''}`.toUpperCase();
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } },
): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  const orgOrErr = await resolveAccountOrg(params.slug, session);
  if (orgOrErr instanceof Response) return orgOrErr;
  const org = orgOrErr;

  try {
    const rows = await db.user.findMany({
      where: { orgId: org.id, role: 'knocker', status: { not: 'archived' } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        givenName: true,
        familyName: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    return ok({
      orgId: org.id,
      knockers: rows.map((u) => ({
        id: u.id,
        // PII-first: given name kept (needed for the roster picker), family
        // name → initial, email masked. Full contact requires an audited unmask.
        givenName: u.givenName,
        familyName: u.familyName ? `${u.familyName.charAt(0)}.` : '',
        initials: initialsFor(u.givenName, u.familyName),
        email: maskEmail(u.email),
        status: u.status, // 'invited' | 'active' | 'suspended'
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
      })),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/orgs/:slug/knockers GET] failed:', err);
    return internal('Failed to load knockers');
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } },
): Promise<Response> {
  const sessionOrErr = await requireSession();
  if (sessionOrErr instanceof Response) return sessionOrErr;
  const session = sessionOrErr;

  const orgOrErr = await resolveAccountOrg(params.slug, session);
  if (orgOrErr instanceof Response) return orgOrErr;
  const org = orgOrErr;

  // Authz: inviting a user is a privileged mutation. requireSession is authn
  // only — this is the authz gate (mirrors the Fastify requireActorRole).
  if (!INVITE_ROLES.has(session.role)) {
    return forbidden('Your role may not invite knockers');
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return validation('Request body must be JSON');
  }

  const parsed = inviteKnockerSchema.safeParse(raw);
  if (!parsed.success) {
    return validation('Invalid invite payload', parsed.error.flatten().fieldErrors);
  }
  const input = parsed.data;

  const digest = emailDigest(input.email);

  // Reject a duplicate email (emailDigest is globally unique in the schema).
  try {
    const existing = await db.user.findUnique({ where: { emailDigest: digest } });
    if (existing) return conflict('A user with that email already exists');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/orgs/:slug/knockers POST] dup-check failed:', err);
    return internal('Failed to invite knocker');
  }

  const userId = newUserId();
  const invite = generateInviteToken();
  const expiresAt = new Date(Date.now() + (input.expiresInDays ?? 7) * 24 * 60 * 60 * 1000);

  try {
    await db.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: userId,
          orgId: org.id,
          email: input.email,
          emailDigest: digest,
          givenName: input.givenName,
          familyName: input.familyName,
          role: 'knocker',
          regionCode: org.regionCode,
          status: 'invited',
        },
      });
      await tx.userCredential.create({
        data: {
          userId,
          // Sentinel — UserCredential.passwordHash is non-null; this value can
          // never match a real scrypt output, exactly like the Fastify invite.
          passwordHash: '__invite_pending__:00',
          inviteTokenHash: invite.hash,
          inviteExpiresAt: expiresAt,
        },
      });
      await writeAudit(tx, {
        orgId: org.id,
        regionCode: org.regionCode,
        actorUserId: session.userId,
        action: 'user.invited',
        resourceType: 'User',
        resourceId: userId,
        afterJson: { email: '[REDACTED]', role: 'knocker', status: 'invited' },
        metadata: {
          invitedBy: session.userId,
          via: 'web-operator.account-team',
          expiresAt: expiresAt.toISOString(),
        },
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return conflict('A user with that email already exists');
    }
    // eslint-disable-next-line no-console
    console.error('[api/orgs/:slug/knockers POST] transaction failed:', err);
    return internal('Failed to invite knocker');
  }

  return ok(
    {
      user: {
        id: userId,
        givenName: input.givenName,
        familyName: input.familyName ? `${input.familyName.charAt(0)}.` : '',
        initials: initialsFor(input.givenName, input.familyName),
        email: maskEmail(input.email),
        status: 'invited',
      },
      // Returned exactly once — the manager sends this to the knocker, who
      // POSTs it + a password to /v1/users/accept-invite to set their login.
      inviteToken: invite.plaintext,
      inviteExpiresAt: expiresAt.toISOString(),
    },
    { status: 201 },
  );
}
