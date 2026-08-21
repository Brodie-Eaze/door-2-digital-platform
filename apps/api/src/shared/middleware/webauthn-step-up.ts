/**
 * requireWebAuthnStepUp — Fastify preHandler that verifies the
 * X-WebAuthn-Step-Up header issued by POST /v1/auth/webauthn/assert/finish.
 *
 * Use on routes that require hardware-key confirmation (payout lock,
 * instruction-file download) per ADR-0026.
 *
 * The step-up token is a pipe-delimited HMAC-signed string:
 *   {userId}|{expiresIso}|{hmac-sha256-hex}
 * TTL is 5 minutes from issuance. Token is bound to the authenticated user —
 * a token issued for user A cannot be used on a request authenticated as user B.
 */

import type { FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';
import { Problems, ProblemError } from '@d2d/shared-utils';
import { verifyStepUpToken } from '../../domains/auth/webauthn.service';

export const requireWebAuthnStepUp: preHandlerHookHandler = async (
  req: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> => {
  if (!req.principal) {
    throw new ProblemError(Problems.unauthorized('Authentication required'));
  }

  const header = req.headers['x-webauthn-step-up'];
  const token = typeof header === 'string' ? header.trim() : undefined;

  if (!token) {
    throw new ProblemError(
      Problems.unauthorized(
        'WebAuthn step-up required — call POST /v1/auth/webauthn/assert/begin then /finish to obtain X-WebAuthn-Step-Up',
      ),
    );
  }

  verifyStepUpToken(token, req.principal.userId);
};
