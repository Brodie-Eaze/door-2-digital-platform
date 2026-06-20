/**
 * Provider error taxonomy. Every adapter returns these wrapped in `Result.error`.
 * The route layer maps them onto RFC 7807 problem responses.
 *
 * Stable codes (used by clients + dashboards):
 *   - STUB_MODE       sandbox or no-creds — adapter intentionally inert
 *   - NOT_CONNECTED   no adapter registered for this kind in this org
 *   - RATE_LIMITED    provider 429 — `retryAfterSec` carries the backoff
 *   - INVALID_CONFIG  credentials missing or malformed
 *   - INVALID_INPUT   request body failed adapter-side validation
 *   - PROVIDER_5XX    upstream failure
 *   - SIGNATURE_FAIL  webhook HMAC didn't verify
 *   - UNSUPPORTED     adapter doesn't implement the requested operation
 */

export class ProviderError extends Error {
  constructor(
    public code: string,
    message: string,
    public providerKind?: string,
    public httpStatus?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class NotConnectedError extends ProviderError {
  constructor(kind: string) {
    super('NOT_CONNECTED', `Provider ${kind} is not connected for this org`, kind, 412);
    this.name = 'NotConnectedError';
  }
}

export class RateLimitedError extends ProviderError {
  constructor(
    kind: string,
    public retryAfterSec: number,
  ) {
    super('RATE_LIMITED', `Provider ${kind} rate limited; retry in ${retryAfterSec}s`, kind, 429);
    this.name = 'RateLimitedError';
  }
}

export class StubModeError extends ProviderError {
  constructor(kind: string, detail = 'no production credentials available') {
    super('STUB_MODE', `Provider ${kind} is in stub mode: ${detail}`, kind, 200);
    this.name = 'StubModeError';
  }
}

/**
 * Raised when a provider is configured for `mode: 'production'` but its
 * credentials are missing or blank. This is the FAIL-CLOSED guard: in
 * production we must NEVER silently fall through to stub data — the operator
 * has to be told to supply real credentials. Distinct from `InvalidConfigError`
 * (malformed creds) so dashboards can surface "needs production credentials"
 * specifically.
 */
export class CredentialsRequiredError extends ProviderError {
  constructor(kind: string, detail = 'production mode requires real credentials') {
    super('CREDENTIALS_REQUIRED', `Provider ${kind}: ${detail}`, kind, 424);
    this.name = 'CredentialsRequiredError';
  }
}

/**
 * Raised when an outbound provider call exceeds its timeout budget. Carries
 * the elapsed budget so callers/dashboards can distinguish a slow partner from
 * an outright failure.
 */
export class ProviderTimeoutError extends ProviderError {
  constructor(
    kind: string,
    public timeoutMs: number,
  ) {
    super('TIMEOUT', `Provider ${kind} call timed out after ${timeoutMs}ms`, kind, 504);
    this.name = 'ProviderTimeoutError';
  }
}

export class UnsupportedOperationError extends ProviderError {
  constructor(kind: string, operation: string) {
    super('UNSUPPORTED', `Provider ${kind} does not implement ${operation}`, kind, 400);
    this.name = 'UnsupportedOperationError';
  }
}

export class InvalidConfigError extends ProviderError {
  constructor(kind: string, detail: string) {
    super('INVALID_CONFIG', `Provider ${kind} config invalid: ${detail}`, kind, 400);
    this.name = 'InvalidConfigError';
  }
}

export class SignatureFailError extends ProviderError {
  constructor(kind: string) {
    super('SIGNATURE_FAIL', `Webhook signature verification failed for ${kind}`, kind, 401);
    this.name = 'SignatureFailError';
  }
}

/** Helper — most adapters return this when no real creds are available. */
export function stubResult(kind: string): { ok: false; error: ProviderError } {
  return { ok: false, error: new StubModeError(kind) };
}
