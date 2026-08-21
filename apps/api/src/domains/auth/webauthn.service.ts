/**
 * WebAuthn service — hardware-key registration + step-up assertion (ADR-0026).
 *
 * Two flows:
 *   Registration:
 *     POST /v1/auth/webauthn/register/begin  → generateRegistrationOptions
 *     POST /v1/auth/webauthn/register/finish → verifyRegistrationResponse, store credential
 *
 *   Step-up assertion (gates payout lock + instruction-file):
 *     POST /v1/auth/webauthn/assert/begin    → generateAuthenticationOptions
 *     POST /v1/auth/webauthn/assert/finish   → verifyAuthenticationResponse, issue step-up token
 *
 * Challenges are ephemeral Redis entries (5-min TTL) keyed by userId.
 *
 * Step-up token format: `{userId}|{expiresIso}|{hmac-sha256-hex}`
 * Signed with MFA_STEP_UP_SECRET; TTL = 5 minutes.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { Problems, ProblemError, newId } from '@d2d/shared-utils';
import type { RegionCode } from '@prisma/client';
import { prisma } from '../../config/db';
import { redis } from '../../config/redis';
import { env } from '../../config/env';
import { writeAudit } from '../../shared/audit/write';

const CHALLENGE_TTL_SECONDS = 300; // 5 min — matches assertion window
const STEP_UP_TTL_MS = 5 * 60 * 1000;

function challengeKey(type: 'reg' | 'auth', userId: string): string {
  return `webauthn:challenge:${type}:${userId}`;
}

export function issueStepUpToken(userId: string): string {
  const expiresIso = new Date(Date.now() + STEP_UP_TTL_MS).toISOString();
  const payload = `${userId}|${expiresIso}`;
  const mac = createHmac('sha256', env().MFA_STEP_UP_SECRET).update(payload).digest('hex');
  return `${payload}|${mac}`;
}

export function verifyStepUpToken(token: string, principalUserId: string): void {
  const parts = token.split('|');
  // Format: userId|expiresIso|mac — userId never contains '|', expiresIso never contains '|'
  if (parts.length !== 3) {
    throw new ProblemError(Problems.unauthorized('Invalid WebAuthn step-up token'));
  }
  const [userId, expiresIso, mac] = parts as [string, string, string];

  const expectedMac = createHmac('sha256', env().MFA_STEP_UP_SECRET)
    .update(`${userId}|${expiresIso}`)
    .digest('hex');

  const macBuf = Buffer.from(mac, 'hex');
  const expectedBuf = Buffer.from(expectedMac, 'hex');
  if (macBuf.length !== expectedBuf.length || !timingSafeEqual(macBuf, expectedBuf)) {
    throw new ProblemError(Problems.unauthorized('Invalid WebAuthn step-up token'));
  }

  if (new Date(expiresIso).getTime() < Date.now()) {
    throw new ProblemError(Problems.unauthorized('WebAuthn step-up token expired'));
  }

  if (userId !== principalUserId) {
    throw new ProblemError(Problems.unauthorized('WebAuthn step-up token user mismatch'));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Registration
// ─────────────────────────────────────────────────────────────────────────────

export async function beginRegistration(userId: string, userEmail: string, givenName: string) {
  const e = env();

  const existing = await prisma().webAuthnCredential.findMany({
    where: { userId },
    select: { credentialId: true, transports: true },
  });

  const options = await generateRegistrationOptions({
    rpName: 'Door 2 Digital',
    rpID: e.WEBAUTHN_RP_ID,
    userName: userEmail,
    userDisplayName: givenName,
    attestationType: 'none',
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: c.transports as ('usb' | 'nfc' | 'ble' | 'internal' | 'hybrid')[],
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  await redis().set(challengeKey('reg', userId), options.challenge, 'EX', CHALLENGE_TTL_SECONDS);
  return options;
}

export async function finishRegistration(
  userId: string,
  orgId: string,
  regionCode: RegionCode,
  deviceName: string | undefined,
  response: RegistrationResponseJSON,
): Promise<{ credentialId: string }> {
  const e = env();
  const r = redis();

  const challenge = await r.get(challengeKey('reg', userId));
  if (!challenge) {
    throw new ProblemError(
      Problems.validation('Registration challenge expired — restart the flow'),
    );
  }

  let verifyResult: Awaited<ReturnType<typeof verifyRegistrationResponse>> | null = null;
  try {
    verifyResult = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: e.WEBAUTHN_ORIGIN,
      expectedRPID: e.WEBAUTHN_RP_ID,
    });
  } catch (err) {
    throw new ProblemError(
      Problems.validation(`WebAuthn registration failed: ${(err as Error).message}`),
    );
  }

  if (!verifyResult?.verified || !verifyResult.registrationInfo) {
    throw new ProblemError(Problems.validation('WebAuthn registration not verified'));
  }

  const { credential, aaguid } = verifyResult.registrationInfo;
  const publicKeyB64 = Buffer.from(credential.publicKey).toString('base64');

  await prisma().$transaction(async (tx) => {
    await tx.webAuthnCredential.create({
      data: {
        id: newId('wac'),
        userId,
        credentialId: credential.id,
        publicKey: publicKeyB64,
        counter: BigInt(credential.counter),
        deviceName: deviceName ?? null,
        aaguid: aaguid ?? null,
        transports: (credential.transports ?? []) as string[],
      },
    });
    await writeAudit(tx, {
      orgId,
      regionCode,
      actorUserId: userId,
      action: 'auth.webauthn_registered',
      resourceType: 'WebAuthnCredential',
      resourceId: credential.id,
    });
  });

  await r.del(challengeKey('reg', userId));
  return { credentialId: credential.id };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step-up assertion
// ─────────────────────────────────────────────────────────────────────────────

export async function beginAssertion(userId: string) {
  const e = env();

  const creds = await prisma().webAuthnCredential.findMany({
    where: { userId },
    select: { credentialId: true, transports: true },
  });

  if (creds.length === 0) {
    throw new ProblemError(
      Problems.validation('No WebAuthn credentials registered — register a hardware key first'),
    );
  }

  const options = await generateAuthenticationOptions({
    rpID: e.WEBAUTHN_RP_ID,
    userVerification: 'preferred',
    allowCredentials: creds.map((c) => ({
      id: c.credentialId,
      transports: c.transports as ('usb' | 'nfc' | 'ble' | 'internal' | 'hybrid')[],
    })),
  });

  await redis().set(challengeKey('auth', userId), options.challenge, 'EX', CHALLENGE_TTL_SECONDS);
  return options;
}

export async function finishAssertion(
  userId: string,
  orgId: string,
  regionCode: RegionCode,
  response: AuthenticationResponseJSON,
): Promise<{ stepUpToken: string }> {
  const e = env();
  const r = redis();

  const challenge = await r.get(challengeKey('auth', userId));
  if (!challenge) {
    throw new ProblemError(Problems.validation('Assertion challenge expired — restart the flow'));
  }

  const cred = await prisma().webAuthnCredential.findUnique({
    where: { credentialId: response.id },
    select: {
      id: true,
      userId: true,
      credentialId: true,
      publicKey: true,
      counter: true,
      transports: true,
    },
  });

  if (!cred || cred.userId !== userId) {
    throw new ProblemError(Problems.unauthorized('Credential not found or not owned by user'));
  }

  const publicKey = Buffer.from(cred.publicKey, 'base64');

  let assertResult: Awaited<ReturnType<typeof verifyAuthenticationResponse>> | null = null;
  try {
    assertResult = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: e.WEBAUTHN_ORIGIN,
      expectedRPID: e.WEBAUTHN_RP_ID,
      credential: {
        id: cred.credentialId ?? response.id,
        publicKey,
        counter: Number(cred.counter),
        transports: cred.transports as ('usb' | 'nfc' | 'ble' | 'internal' | 'hybrid')[],
      },
    });
  } catch (err) {
    throw new ProblemError(
      Problems.unauthorized(`WebAuthn assertion failed: ${(err as Error).message}`),
    );
  }

  if (!assertResult?.verified || !assertResult.authenticationInfo) {
    throw new ProblemError(Problems.unauthorized('WebAuthn assertion not verified'));
  }

  const { newCounter } = assertResult.authenticationInfo;

  await prisma().$transaction(async (tx) => {
    await tx.webAuthnCredential.update({
      where: { id: cred.id },
      data: {
        counter: BigInt(newCounter),
        lastUsedAt: new Date(),
      },
    });
    await writeAudit(tx, {
      orgId,
      regionCode,
      actorUserId: userId,
      action: 'auth.webauthn_step_up_granted',
      resourceType: 'WebAuthnCredential',
      resourceId: response.id,
    });
  });

  await r.del(challengeKey('auth', userId));

  return { stepUpToken: issueStepUpToken(userId) };
}
