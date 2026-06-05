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
import type {
  CreateUserRequest,
  UpdateUserRequest,
  ChangeUserRoleRequest,
  InviteUserRequest,
} from '@d2d/shared-types';
import { prisma, tenantTx } from '../../config/db';
import { env } from '../../config/env';
import { writeAudit } from '../../shared/audit/write';
import { generateInviteToken, hashRefreshToken } from '../auth/tokens';
import { revokeUserAccessTokens } from '../auth/token-revocation';
import { hashPassword } from '../auth/password';
import type { ListUsersQuery } from './schemas';

interface ActorContext {
  userId: string;
  orgId: string;
  regionCode: RegionCode;
  /** The actor's own role — required for privileged mutations (role/archive). */
  role?: string;
}

/**
 * Roles permitted to mutate other users (change role, archive). Anything below
 * `manager` is a default-deny. `super_admin` is platform-internal.
 */
const USER_ADMIN_ROLES: ReadonlySet<string> = new Set(['super_admin', 'org_admin', 'manager']);

/**
 * Roles permitted to CHANGE another user's role. Tighter than archive — only
 * org_admin and the platform super_admin. A `manager` can archive but not
 * re-grade.
 */
const ROLE_GRANT_ROLES: ReadonlySet<string> = new Set(['super_admin', 'org_admin']);

/** `super_admin` is cross-tenant and may only ever be granted/revoked by an existing super_admin. */
const SUPER_ADMIN: PlatformRole = 'super_admin';

function requireActorRole(actor: ActorContext, allowed: ReadonlySet<string>): string {
  if (!actor.role || !allowed.has(actor.role)) {
    throw new ProblemError(Problems.forbidden('Your role may not perform this action'));
  }
  return actor.role;
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
  // Authorization (P0): only manager+ may invite users, and only an existing
  // super_admin may mint another super_admin. The role-change path was guarded
  // but invite was not — any authenticated user could invite themselves an admin.
  requireActorRole(actor, USER_ADMIN_ROLES);
  if (input.role === SUPER_ADMIN && actor.role !== SUPER_ADMIN) {
    throw new ProblemError(Problems.forbidden('Only a super_admin may invite a super_admin'));
  }

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

  // SEC-011: always run hashPassword regardless of whether the token was found
  // or is expired — this normalises the response time across both failure paths
  // so a probe cannot distinguish "token not found" from "token expired".
  // The hash result is only used when the token is genuinely valid.
  const pwHash = await hashPassword(args.password);

  if (!cred || !cred.inviteExpiresAt || cred.inviteExpiresAt < new Date()) {
    throw new ProblemError(Problems.unauthorized('Invite token invalid or expired'));
  }
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
  // Authorization (P1): editing your OWN profile is allowed; editing ANOTHER
  // user (name/phone/managerId) requires manager+. Previously unguarded.
  if (userId !== actor.userId) {
    requireActorRole(actor, USER_ADMIN_ROLES);
  }
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

  const next = await tenantTx(actor.orgId, async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      // NOTE: `role` is deliberately NOT writable here. Role changes go through
      // changeUserRole() (guarded). `UpdateUserRequest` omits `role` so this
      // path can never escalate, even if a body smuggled the field. (D3)
      data: {
        ...(input.givenName !== undefined && { givenName: input.givenName }),
        ...(input.familyName !== undefined && { familyName: input.familyName }),
        ...(input.phone !== undefined && { phone: input.phone }),
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

/**
 * Change a user's role — the ONLY path that may write `role`. Guard rails:
 *   - actor must hold a role-grant role (org_admin or super_admin);
 *   - target must be in the actor's org (no cross-tenant re-grade);
 *   - an actor may NOT change their OWN role (no self-escalation);
 *   - `super_admin` may only be GRANTED or REVOKED by an existing super_admin —
 *     an org_admin can neither mint one nor act on an existing one.
 * Writes an AuditEvent in the same TX as the update.
 */
export async function changeUserRole(
  userId: string,
  input: ChangeUserRoleRequest,
  actor: ActorContext,
): Promise<UserPublic> {
  const actorRole = requireActorRole(actor, ROLE_GRANT_ROLES);

  // Self-escalation guard: you can never change your own role.
  if (userId === actor.userId) {
    throw new ProblemError(Problems.forbidden('You cannot change your own role'));
  }

  const existing = await prisma().user.findUnique({ where: { id: userId } });
  if (!existing) throw new ProblemError(Problems.notFound('User', userId));
  // Same-org only. 404-style not-found above already hides existence; a real
  // cross-tenant target is a tenant mismatch (audited).
  if (existing.orgId !== actor.orgId) {
    throw new ProblemError(Problems.tenantMismatch(existing.orgId));
  }

  // super_admin is platform-internal: only an existing super_admin may grant it,
  // revoke it, or otherwise re-grade an account that currently holds it.
  const touchesSuperAdmin = input.role === SUPER_ADMIN || existing.role === SUPER_ADMIN;
  if (touchesSuperAdmin && actorRole !== SUPER_ADMIN) {
    throw new ProblemError(
      Problems.forbidden('Only a super_admin may assign or change super_admin'),
    );
  }

  if (existing.role === input.role) return toPublic(existing);

  const next = await tenantTx(actor.orgId, async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: { role: input.role },
    });
    // A role change is a security-relevant event — re-grading an account into a
    // lower-trust role should not leave stale sessions live. Revoke this user's
    // refresh tokens so the new role takes effect on next refresh.
    await tx.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await writeAudit(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'user.role_changed',
      resourceType: 'User',
      resourceId: userId,
      beforeJson: { role: existing.role },
      afterJson: { role: updated.role },
      metadata: { changedBy: actor.userId, actorRole },
    });
    return updated;
  });
  // SEC-002: also stamp the access-token revocation epoch so any live access
  // token (up to 5 min residual) is rejected immediately. Refresh tokens were
  // already revoked inside the TX above; this closes the access-token window.
  await revokeUserAccessTokens(userId);
  return toPublic(next);
}

/**
 * Clear a per-account login lockout. Only org_admin and super_admin may call
 * this — same access level as role-granting. The operation is idempotent: if
 * the account is not currently locked the write is a no-op and the audit row
 * still lands so the action is traceable.
 *
 * Same-org invariant: actor must be in the target user's org. The service
 * enforces this explicitly rather than relying solely on the RLS GUC because
 * UserCredential is keyed on userId and cross-tenant probing must be blocked
 * before any credential row is read.
 */
export async function unlockUser(userId: string, actor: ActorContext): Promise<UserPublic> {
  // Tighter than USER_ADMIN_ROLES — only org_admin and above; a manager can
  // archive users but must not be able to unilaterally un-throttle an account.
  requireActorRole(actor, ROLE_GRANT_ROLES);

  const existing = await prisma().user.findUnique({ where: { id: userId } });
  if (!existing) throw new ProblemError(Problems.notFound('User', userId));
  if (existing.orgId !== actor.orgId) {
    throw new ProblemError(Problems.tenantMismatch(existing.orgId));
  }

  await tenantTx(actor.orgId, async (tx) => {
    await tx.userCredential.update({
      where: { userId },
      data: { lockedUntil: null, failedLoginCount: 0 },
    });
    await writeAudit(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'user.lockout_cleared',
      resourceType: 'User',
      resourceId: userId,
      metadata: { clearedBy: actor.userId },
    });
  });

  return toPublic(existing);
}

export async function archiveUser(userId: string, actor: ActorContext): Promise<UserPublic> {
  requireActorRole(actor, USER_ADMIN_ROLES);
  const existing = await prisma().user.findUnique({ where: { id: userId } });
  if (!existing) throw new ProblemError(Problems.notFound('User', userId));
  if (existing.orgId !== actor.orgId) {
    throw new ProblemError(Problems.tenantMismatch(existing.orgId));
  }
  // A lower/equal-trust actor must not archive a super_admin out of existence.
  if (existing.role === SUPER_ADMIN && actor.role !== SUPER_ADMIN) {
    throw new ProblemError(Problems.forbidden('Only a super_admin may archive a super_admin'));
  }
  if (existing.status === 'archived') return toPublic(existing);

  const updated = await tenantTx(actor.orgId, async (tx) => {
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
  // SEC-002: stamp the access-token revocation epoch so any live access token
  // issued to this user (up to 5 min residual) is rejected immediately.
  await revokeUserAccessTokens(userId);
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
