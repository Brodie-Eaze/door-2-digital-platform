/**
 * Auth service — login, refresh, logout, currentUser.
 *
 * All mutations write AuditEvent rows in the same transaction. Refresh
 * tokens rotate on every use (one-time-use semantics) and are stored as
 * SHA-256 hashes only.
 */
import type { PlatformRole, RegionCode } from '@prisma/client';
import { Problems, ProblemError, emailDigest, newId } from '@d2d/shared-utils';
import { prisma } from '../../config/db';
import { env } from '../../config/env';
import { hashPassword, verifyPassword } from './password';
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from './tokens';
import { writeAudit } from '../../shared/audit/write';
import { revokeUserAccessTokens } from './token-revocation';

export interface AuthSuccess {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  user: {
    id: string;
    email: string;
    role: PlatformRole;
    orgId: string;
    regionCode: RegionCode;
    brandCode: string;
    givenName: string;
    familyName: string;
  };
}

/**
 * Look up a user by email digest + verify password. Creates access JWT +
 * refresh row.
 */
export async function login(args: {
  email: string;
  password: string;
  ip?: string;
  userAgent?: string;
}): Promise<AuthSuccess> {
  const e = env();
  const digest = emailDigest(args.email, e.PII_SEARCH_KEY);

  const user = await prisma().user.findUnique({
    where: { emailDigest: digest },
    include: { credential: true },
  });
  if (!user || !user.credential || user.status !== 'active') {
    // Constant-time-ish: still hash a dummy password to avoid email enumeration.
    await verifyPassword(args.password, 'dummy:00');
    throw new ProblemError(Problems.unauthorized('Invalid email or password'));
  }
  const ok = await verifyPassword(args.password, user.credential.passwordHash);
  if (!ok) {
    await prisma().$transaction(async (tx) => {
      await writeAudit(tx, {
        orgId: user.orgId,
        regionCode: user.regionCode,
        actorUserId: user.id,
        action: 'auth.login_failed',
        resourceType: 'User',
        resourceId: user.id,
        metadata: { reason: 'invalid_password' },
      });
    });
    throw new ProblemError(Problems.unauthorized('Invalid email or password'));
  }

  return issueTokens(user, { ip: args.ip, userAgent: args.userAgent, audit: 'auth.login_success' });
}

/**
 * Rotate a refresh token: mark the presented one revoked + issue a new pair.
 * If the presented token has already been revoked we treat it as token reuse
 * (potential compromise) and revoke the entire chain for the user.
 */
export async function refresh(args: {
  refreshToken: string;
  ip?: string;
  userAgent?: string;
}): Promise<AuthSuccess> {
  const presentedHash = hashRefreshToken(args.refreshToken);
  const stored = await prisma().refreshToken.findUnique({
    where: { tokenHash: presentedHash },
    include: { user: { include: { credential: true } } },
  });
  if (!stored) {
    throw new ProblemError(Problems.unauthorized('Invalid refresh token'));
  }
  if (stored.revokedAt) {
    // Token reuse — revoke all outstanding tokens for this user.
    await prisma().$transaction(async (tx) => {
      await tx.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await writeAudit(tx, {
        orgId: stored.orgId,
        regionCode: stored.user.regionCode,
        actorUserId: stored.userId,
        action: 'auth.refresh_reuse_detected',
        resourceType: 'RefreshToken',
        resourceId: stored.id,
      });
    });
    // SEC-004: refresh-chain revocation above only kills future refreshes. Any
    // access token already minted for this user stays valid until its exp (≤5
    // min). Stamp the per-user revocation epoch so those stateless tokens are
    // rejected at the auth guard immediately. Best-effort (fails open on Redis
    // error) — the refresh chain is already dead in Postgres regardless.
    await revokeUserAccessTokens(stored.userId);
    throw new ProblemError(Problems.unauthorized('Refresh token reused'));
  }
  if (stored.expiresAt < new Date()) {
    throw new ProblemError(Problems.unauthorized('Refresh token expired'));
  }
  if (stored.user.status !== 'active') {
    throw new ProblemError(Problems.unauthorized('User not active'));
  }

  // Issue new tokens, mark old refresh revoked + linked.
  return issueTokens(stored.user, {
    ip: args.ip,
    userAgent: args.userAgent,
    rotateFromId: stored.id,
    audit: 'auth.refresh_success',
  });
}

/**
 * Revoke the presented refresh token. Idempotent — already-revoked tokens
 * are a no-op.
 */
export async function logout(args: {
  refreshToken?: string;
  userId?: string;
  orgId?: string;
  regionCode?: RegionCode;
}): Promise<void> {
  if (!args.refreshToken && !args.userId) return;
  await prisma().$transaction(async (tx) => {
    if (args.refreshToken) {
      const hash = hashRefreshToken(args.refreshToken);
      await tx.refreshToken.updateMany({
        where: { tokenHash: hash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    if (args.userId && args.orgId && args.regionCode) {
      await writeAudit(tx, {
        orgId: args.orgId,
        regionCode: args.regionCode,
        actorUserId: args.userId,
        action: 'auth.logout',
        resourceType: 'User',
        resourceId: args.userId,
      });
    }
  });
}

/**
 * Get the user identified by the auth context.
 */
export async function getCurrentUser(userId: string): Promise<{
  id: string;
  email: string;
  role: PlatformRole;
  orgId: string;
  regionCode: RegionCode;
  brandCode: string;
  givenName: string;
  familyName: string;
} | null> {
  const u = await prisma().user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      orgId: true,
      regionCode: true,
      brandCode: true,
      givenName: true,
      familyName: true,
      status: true,
    },
  });
  if (!u || u.status !== 'active') return null;
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    orgId: u.orgId,
    regionCode: u.regionCode,
    brandCode: u.brandCode,
    givenName: u.givenName,
    familyName: u.familyName,
  };
}

/**
 * Convenience used by test/dev seed: create a user with a known password.
 */
export async function setUserPassword(userId: string, plaintext: string): Promise<void> {
  const hash = await hashPassword(plaintext);
  await prisma().userCredential.upsert({
    where: { userId },
    update: { passwordHash: hash, inviteTokenHash: null, inviteExpiresAt: null },
    create: { userId, passwordHash: hash },
  });
}

export interface IssueArgs {
  ip?: string;
  userAgent?: string;
  rotateFromId?: string;
  audit: string;
}

export interface IssueUser {
  id: string;
  email: string;
  role: PlatformRole;
  orgId: string;
  regionCode: RegionCode;
  brandCode: string;
  givenName: string;
  familyName: string;
}

/**
 * Mint an access+refresh session for an already-authenticated user. Exported
 * so the SAML SSO flow (domains/auth/saml) can issue a session after the IdP
 * assertion validates — it reuses the exact same token-issuance + audit path
 * as password login, so SSO sessions are indistinguishable downstream.
 */
export async function issueTokens(user: IssueUser, args: IssueArgs): Promise<AuthSuccess> {
  const e = env();
  const { token: accessToken } = signAccessToken(
    {
      sub: user.id,
      orgId: user.orgId,
      role: user.role,
      regionCode: user.regionCode,
      brandCode: user.brandCode,
      // Vanity claims for browser topbar — never read for authz decisions.
      email: user.email,
      givenName: user.givenName,
    },
    e.JWT_ACCESS_SECRET,
  );
  const refresh = generateRefreshToken();
  const refreshId = newId('rft');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

  await prisma().$transaction(async (tx) => {
    if (args.rotateFromId) {
      await tx.refreshToken.update({
        where: { id: args.rotateFromId },
        data: { revokedAt: new Date(), rotatedToId: refreshId },
      });
    }
    await tx.refreshToken.create({
      data: {
        id: refreshId,
        userId: user.id,
        orgId: user.orgId,
        tokenHash: refresh.hash,
        expiresAt,
        userAgent: args.userAgent ?? null,
        ip: args.ip ?? null,
      },
    });
    await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await writeAudit(tx, {
      orgId: user.orgId,
      regionCode: user.regionCode,
      actorUserId: user.id,
      action: args.audit,
      resourceType: 'User',
      resourceId: user.id,
      metadata: { ip: args.ip, userAgent: args.userAgent },
    });
  });

  return {
    accessToken,
    refreshToken: refresh.plaintext,
    accessTokenExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      orgId: user.orgId,
      regionCode: user.regionCode,
      brandCode: user.brandCode,
      givenName: user.givenName,
      familyName: user.familyName,
    },
  };
}
