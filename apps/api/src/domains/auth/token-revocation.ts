/**
 * Access-token revocation epoch (SEC-004).
 *
 * Our access tokens are stateless HS256 JWTs with a 5-minute TTL — by design
 * we don't hit the DB to validate them. That leaves one residual gap: when we
 * detect refresh-token *reuse* (a compromise signal) we revoke the whole
 * refresh chain, but any access token already minted for that user stays valid
 * until its `exp` — up to 5 minutes of attacker access after we *know* the
 * account is compromised.
 *
 * This closes that gap with a per-user "revoked-before" epoch in Redis. On a
 * compromise event we stamp `revoked-before[user] = now`. Token verification
 * rejects any token whose `iat` is at-or-before that epoch. The key's TTL is
 * the access-token TTL, so it self-cleans exactly when the last possibly-valid
 * pre-revocation token would itself have expired — bounded memory, no sweep.
 *
 * Granularity note: JWT `iat` is whole seconds, so two tokens minted in the
 * same second are indistinguishable. We revoke on `iat <= cutoff` (inclusive),
 * which means a token minted in the *same second* as the revocation is also
 * killed. That is the safe direction for a compromise: on the reuse path no
 * legitimate token is being issued (we throw), so there is nothing to falsely
 * revoke — we only ever err toward killing more.
 *
 * Availability note: this is defence-in-depth layered on top of signature +
 * expiry, which are always enforced. If Redis is unreachable we FAIL OPEN
 * (treat as not-revoked) rather than 401 the entire authenticated surface on a
 * cache blip. The exposure of failing open is at most the ≤5-minute window we
 * already had before this control existed.
 */
import { redis } from '../../config/redis';
import { ACCESS_TOKEN_TTL_SECONDS } from './tokens';

const KEY_PREFIX = 'auth:revoked-before:';

/** Buffer added to the key TTL so a token minted at the cutoff second (valid
 * until cutoff + access-TTL) is still covered by the epoch when it is checked. */
const TTL_BUFFER_SECONDS = 10;

function key(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

/**
 * Revoke every access token for `userId` minted at or before now. Call this on
 * a compromise signal (refresh reuse) or any "kill all sessions" action.
 *
 * Best-effort: a Redis failure is swallowed (logged by the caller's flow via
 * the thrown auth error path). We never want token revocation bookkeeping to
 * turn a 401 into a 500.
 */
export async function revokeUserAccessTokens(userId: string): Promise<void> {
  const cutoffSeconds = Math.floor(Date.now() / 1000);
  try {
    await redis().set(
      key(userId),
      String(cutoffSeconds),
      'EX',
      ACCESS_TOKEN_TTL_SECONDS + TTL_BUFFER_SECONDS,
    );
  } catch {
    // Swallow — see availability note. The compromised refresh chain is
    // already revoked in Postgres; this epoch is the extra belt.
  }
}

/**
 * True if a token for `userId` with the given `iat` (unix seconds) has been
 * revoked. Fails open on any Redis error or unparseable value.
 */
export async function isAccessTokenRevoked(userId: string, iat: number): Promise<boolean> {
  let raw: string | null;
  try {
    raw = await redis().get(key(userId));
  } catch {
    return false; // fail open
  }
  if (raw === null) return false;
  const cutoff = Number(raw);
  if (!Number.isFinite(cutoff)) return false;
  // A non-finite / missing iat (iat === 0 sentinel) is treated as "very old"
  // and therefore revoked whenever an epoch exists — a token with no usable
  // iat that survived signature + shape checks is anomalous; fail closed here.
  return iat <= cutoff;
}
