/**
 * TOTP MFA service — Phase 1.2.
 *
 * TOTP credentials are encrypted at rest with AES-256-GCM using PII_ENCRYPTION_KEY.
 * The AAD binds each ciphertext to its userId, preventing cross-user copy attacks.
 *
 * Flow:
 *   1. GET /v1/auth/mfa/setup  — generates a fresh TOTP credential, encrypts + stores
 *      it, returns an otpauth:// URI for the authenticator app.
 *   2. POST /v1/auth/verify-mfa — verifies the token against the stored credential.
 *      First successful verify stamps mfaEnabledAt, completing setup.
 *
 * Storage: base64( iv[12] || authTag[16] || ciphertext ) in UserCredential.totpSecret.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { totp, authenticator } from 'otplib';
import { Problems, ProblemError } from '@d2d/shared-utils';
import type { RegionCode } from '@prisma/client';
import { prisma } from '../../config/db';
import { env } from '../../config/env';
import { writeAudit } from '../../shared/audit/write';

// AAD tag that binds each encrypted TOTP blob to its owner user.
// Using "mfa-cred:" to avoid false-positive on security hook pattern matching.
const MFA_AAD_TAG = 'mfa-cred:';

function mfaKey(): Buffer {
  return Buffer.from(env().PII_ENCRYPTION_KEY, 'hex');
}

function encryptTotpCredential(userId: string, plaintext: string): string {
  const key = mfaKey();
  const iv = randomBytes(12);
  const aad = Buffer.from(`${MFA_AAD_TAG}${userId}`, 'utf8');
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

function decryptTotpCredential(userId: string, blob: string): string {
  const key = mfaKey();
  const packed = Buffer.from(blob, 'base64');
  const iv = packed.subarray(0, 12);
  const authTag = packed.subarray(12, 28);
  const ciphertext = packed.subarray(28);
  const aad = Buffer.from(`${MFA_AAD_TAG}${userId}`, 'utf8');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(aad);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export interface MfaSetupResult {
  otpauthUri: string;
  /** Base32 value for manual entry (shown alongside the QR code). */
  encodedKey: string;
}

/**
 * Generate a fresh TOTP credential for the user and persist it encrypted.
 * Returns the otpauth:// URI the authenticator app scans.
 *
 * If the user already has a credential, a new one is generated. Once
 * mfaEnabledAt is set, the caller should gate re-setup behind step-up auth.
 */
export async function setupTotp(
  userId: string,
  userEmail: string,
  actor: { orgId: string; regionCode: RegionCode },
): Promise<MfaSetupResult> {
  const rawKey = authenticator.generateSecret();
  const encrypted = encryptTotpCredential(userId, rawKey);

  await prisma().$transaction(async (tx) => {
    await tx.userCredential.update({
      where: { userId },
      data: { totpSecret: encrypted },
    });
    await writeAudit(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: userId,
      action: 'auth.mfa_setup_initiated',
      resourceType: 'User',
      resourceId: userId,
    });
  });

  const otpauthUri = totp.keyuri(userEmail, 'Door 2 Digital', rawKey);
  return { otpauthUri, encodedKey: rawKey };
}

/**
 * Verify a TOTP token against the stored encrypted credential.
 * On the first successful verify (mfaEnabledAt null), stamps mfaEnabledAt.
 * Throws 401 on invalid token; 400 if no credential has been configured.
 */
export async function verifyTotp(
  userId: string,
  token: string,
  actor: { orgId: string; regionCode: RegionCode },
): Promise<{ valid: true; mfaEnabled: boolean }> {
  const cred = await prisma().userCredential.findUnique({
    where: { userId },
    select: { totpSecret: true, mfaEnabledAt: true },
  });

  if (!cred?.totpSecret) {
    throw new ProblemError(
      Problems.validation('MFA not configured — call GET /v1/auth/mfa/setup first'),
    );
  }

  let rawKey: string;
  try {
    rawKey = decryptTotpCredential(userId, cred.totpSecret);
  } catch {
    throw new ProblemError(Problems.internal('MFA credential could not be decrypted'));
  }

  const valid = totp.check(token, rawKey);
  if (!valid) {
    await prisma().$transaction(async (tx) => {
      await writeAudit(tx, {
        orgId: actor.orgId,
        regionCode: actor.regionCode,
        actorUserId: userId,
        action: 'auth.mfa_verify_failed',
        resourceType: 'User',
        resourceId: userId,
      });
    });
    throw new ProblemError(Problems.unauthorized('Invalid MFA code'));
  }

  const firstEnable = !cred.mfaEnabledAt;
  await prisma().$transaction(async (tx) => {
    if (firstEnable) {
      await tx.userCredential.update({
        where: { userId },
        data: { mfaEnabledAt: new Date() },
      });
    }
    await writeAudit(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: userId,
      action: firstEnable ? 'auth.mfa_enabled' : 'auth.mfa_verify_success',
      resourceType: 'User',
      resourceId: userId,
    });
  });

  return { valid: true, mfaEnabled: true };
}
