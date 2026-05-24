/**
 * User service — invite / accept / list / patch / archive.
 *
 * Invite flow: admin POSTs /v1/users with role + name → service creates a
 * User row (status='invited') + UserCredential row with an inviteTokenHash.
 * Returns an opaque inviteToken the admin emails to the user. User POSTs
 * /v1/users/accept-invite with the token + a password → service hashes
 * the password, clears the invite, flips status to 'active'.
 *
 * Every mutation writes AuditEvent in the same TX.
 */
import type { PlatformRole, RegionCode, Prisma } from '@prisma/client';
import { emailDigest, newId, Problems, ProblemError } from '@d2d/shared-utils';
import type { CreateUserRequest, UpdateUserRequest, InviteUserRequest } from '@d2d/shared-types';
import { prisma } from '../../config/db';
import { env } from '../../config/env';
import { writeAudit } from '../../shared/audit/write';
import { generateInviteToken, hashRefreshToken } from '../auth/tokens';
import { hashPassword } from '../auth/password';
import type { ListUsersQuery } from './schemas';

interface ActorContext {
  userId: string;
  orgId: string;
  regionCode: RegionCode;
}

export interface UserPublic {
  id: string;
  orgId: string;
  email: string;
  givenName: string;
  familyName: string;
  phone: string | null;
  role: PlatformRole;
  managerId: string | null;
  status: string;
  regionCode: RegionCode;
  brandCode: string;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface InviteResult {
  user: UserPublic;
  inviteToken: string;
  inviteExpiresAt: string;
}

/**
 * Create a pending user + invite token. Caller must email the token to
 * the user — the API never sends mail itself.
 */
export async function inviteUser(
  input: CreateUserRequest & Partial<InviteUserRequest>,
  actor: ActorContext,
): Promise<InviteResult> {
  const e = env();
  const digest = emailDigest(input.email, e.PII_SEARCH_KEY);

  // Reject duplicate email digests (globally unique).
  const existing = await prisma().user.findUnique({ where: { emailDigest: digest } });
  if (existing) {
    throw new ProblemError(Problems.conflict('A user with that email already exists'));
  }
  if (input.managerId) {
    const m = await prisma().user.findUnique({
      where: { id: input.managerId },
      select: { orgId: true },
    });
    if (!m || m.orgId !== actor.orgId) {
      throw new ProblemError(Problems.validation('managerId not found in this org'));
    }
  }

  const userId = newId('usr');
  const invite = generateInviteToken();
  const expiresAt = new Date(Date.now() + (input.expiresInDays ?? 7) * 24 * 60 * 60 * 1000);

  const out = await prisma().$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        id: userId,
        orgId: actor.orgId,
        email: input.email,
        emailDigest: digest,
        phone: input.phone ?? null,
        givenName: input.givenName,
        familyName: input.familyName,
        role: input.role,
        managerId: input.managerId ?? null,
        regionCode: actor.regionCode,
        status: 'invited',
      },
    });
    await tx.userCredential.create({
      data: {
        userId,
        // Sentinel — UserCredential.passwordHash is non-null per schema;
        // we store a value that can never match any real scrypt output.
        passwordHash: '__invite_pending__:00',
        inviteTokenHash: invite.hash,
        inviteExpiresAt: expiresAt,
      },
    });
    await writeAudit(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'user.invited',
      resourceType: 'User',
      resourceId: userId,
      afterJson: {
        email: '[REDACTED]',
        role: input.role,
        status: 'invited',
      },
      metadata: { invitedBy: actor.userId, expiresAt: expiresAt.toISOString() },
    });
    return user;
  });

  return {
    user: toPublic(out),
    inviteToken: invite.plaintext,
    inviteExpiresAt: expiresAt.toISOString(),
  };
}

export async function acceptInvite(args: {
  inviteToken: string;
  password: string;
}): Promise<UserPublic> {
  const hash = hashRefreshToken(args.inviteToken); // same SHA-256 as refresh tokens
  const cred = await prisma().userCredential.findUnique({
    where: { inviteTokenHash: hash },
    include: { user: true },
  });
  if (!cred || !cred.inviteExpiresAt || cred.inviteExpiresAt < new Date()) {
    throw new ProblemError(Problems.unauthorized('Invite token invalid or expired'));
  }
  const pwHash = await hashPassword(args.password);
  const updated = await prisma().$transaction(async (tx) => {
    await tx.userCredential.update({
      where: { userId: cred.userId },
      data: {
        passwordHash: pwHash,
        inviteTokenHash: null,
        inviteExpiresAt: null,
      },
    });
    const u = await tx.user.update({
      where: { id: cred.userId },
      data: { status: 'active' },
    });
    await writeAudit(tx, {
      orgId: u.orgId,
      regionCode: u.regionCode,
      actorUserId: u.id,
      action: 'user.invite_accepted',
      resourceType: 'User',
      resourceId: u.id,
      beforeJson: { status: 'invited' },
      afterJson: { status: 'active' },
    });
    return u;
  });
  return toPublic(updated);
}

export async function listUsers(
  query: ListUsersQuery,
  actor: ActorContext,
): Promise<{ data: UserPublic[]; nextCursor: string | null }> {
  const where: Prisma.UserWhereInput = { orgId: actor.orgId };
  if (query.role) where.role = query.role;
  if (query.status) where.status = query.status;

  const rows = await prisma().user.findMany({
    where,
    take: query.limit + 1,
    ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    orderBy: { id: 'asc' },
  });
  const hasMore = rows.length > query.limit;
  const slice = hasMore ? rows.slice(0, query.limit) : rows;
  const nextCursor = hasMore ? (slice[slice.length - 1]?.id ?? null) : null;
  return { data: slice.map(toPublic), nextCursor };
}

export async function getUser(userId: string, actor: ActorContext): Promise<UserPublic> {
  const u = await prisma().user.findUnique({ where: { id: userId } });
  if (!u) throw new ProblemError(Problems.notFound('User', userId));
  if (u.orgId !== actor.orgId) {
    throw new ProblemError(Problems.tenantMismatch(u.orgId));
  }
  return toPublic(u);
}

export async function updateUser(
  userId: string,
  input: UpdateUserRequest,
  actor: ActorContext,
): Promise<UserPublic> {
  const existing = await prisma().user.findUnique({ where: { id: userId } });
  if (!existing) throw new ProblemError(Problems.notFound('User', userId));
  if (existing.orgId !== actor.orgId) {
    throw new ProblemError(Problems.tenantMismatch(existing.orgId));
  }
  if (input.managerId && input.managerId !== existing.managerId) {
    const m = await prisma().user.findUnique({
      where: { id: input.managerId },
      select: { orgId: true },
    });
    if (!m || m.orgId !== actor.orgId) {
      throw new ProblemError(Problems.validation('managerId not found in this org'));
    }
  }

  const next = await prisma().$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        ...(input.givenName !== undefined && { givenName: input.givenName }),
        ...(input.familyName !== undefined && { familyName: input.familyName }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.role !== undefined && { role: input.role }),
        ...(input.managerId !== undefined && { managerId: input.managerId }),
      },
    });
    await writeAudit(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'user.updated',
      resourceType: 'User',
      resourceId: userId,
      beforeJson: subset(existing, Object.keys(input)),
      afterJson: subset(updated, Object.keys(input)),
    });
    return updated;
  });
  return toPublic(next);
}

export async function archiveUser(userId: string, actor: ActorContext): Promise<UserPublic> {
  const existing = await prisma().user.findUnique({ where: { id: userId } });
  if (!existing) throw new ProblemError(Problems.notFound('User', userId));
  if (existing.orgId !== actor.orgId) {
    throw new ProblemError(Problems.tenantMismatch(existing.orgId));
  }
  if (existing.status === 'archived') return toPublic(existing);

  const updated = await prisma().$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: userId },
      data: { status: 'archived' },
    });
    // Revoke all live refresh tokens for the archived user.
    await tx.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await writeAudit(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'user.archived',
      resourceType: 'User',
      resourceId: userId,
      beforeJson: { status: existing.status },
      afterJson: { status: 'archived' },
    });
    return u;
  });
  return toPublic(updated);
}

function toPublic(u: {
  id: string;
  orgId: string;
  email: string;
  givenName: string;
  familyName: string;
  phone: string | null;
  role: PlatformRole;
  managerId: string | null;
  status: string;
  regionCode: RegionCode;
  brandCode: string;
  lastLoginAt: Date | null;
  createdAt: Date;
}): UserPublic {
  return {
    id: u.id,
    orgId: u.orgId,
    email: u.email,
    givenName: u.givenName,
    familyName: u.familyName,
    phone: u.phone,
    role: u.role,
    managerId: u.managerId,
    status: u.status,
    regionCode: u.regionCode,
    brandCode: u.brandCode,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
  };
}

function subset<T extends Record<string, unknown>>(
  obj: T,
  keys: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (k in obj) {
      const v = obj[k];
      out[k] = typeof v === 'bigint' ? v.toString() : v;
    }
  }
  return out;
}
