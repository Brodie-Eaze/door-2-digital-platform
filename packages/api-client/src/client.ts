/**
 * Base fetch wrapper. Adds:
 *   - automatic Content-Type and Idempotency-Key headers
 *   - `credentials: 'include'` so httpOnly session cookies travel
 *   - one-shot refresh-on-401 retry against /v1/auth/refresh
 *   - structured ApiError carrying the RFC 7807 ProblemDetails body
 *
 * Used from BOTH server components (Node fetch, same-origin /proxy/api/*)
 * and client components (browser fetch, same-origin).
 */
import type { ProblemDetails } from './types';

export interface ApiClientOptions {
  /**
   * Base URL prepended to every request path. Empty string means same-origin
   * (typical when used inside the Next.js web-operator app, where requests
   * route through the /proxy/api/* rewrite).
   */
  baseUrl?: string;
  /** Called when refresh fails — typically forces logout. */
  onAuthFail?: () => void;
  /** Optional override of `fetch` (for tests / SSR). */
  fetchImpl?: typeof fetch;
}

export interface ApiRequestInit extends RequestInit {
  /** Sets the `Idempotency-Key` header (required by mutating endpoints). */
  idempotencyKey?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails;

  constructor(status: number, problem: ProblemDetails) {
    super(problem.detail ?? problem.title ?? `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.problem = problem;
  }
}

export class ApiClient {
  private readonly opts: ApiClientOptions;

  constructor(opts: ApiClientOptions = {}) {
    this.opts = opts;
  }

  /**
   * Issue an authenticated request. The fetch wrapper handles refresh-once
   * on 401: if a refresh succeeds the original request is retried; if it
   * also fails we surface ApiError(401) and call opts.onAuthFail().
   */
  async request<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
    const fetchImpl: typeof fetch = this.opts.fetchImpl ?? fetch;
    const base = this.opts.baseUrl ?? '';
    const url = `${base}${path}`;

    const buildHeaders = (): Headers => {
      const h = new Headers(init.headers);
      if (init.idempotencyKey) h.set('Idempotency-Key', init.idempotencyKey);
      if (init.body && !h.has('Content-Type')) h.set('Content-Type', 'application/json');
      if (!h.has('Accept')) h.set('Accept', 'application/json');
      return h;
    };

    const fire = async (): Promise<Response> =>
      fetchImpl(url, { ...init, headers: buildHeaders(), credentials: 'include' });

    let res = await fire();

    if (res.status === 401 && path !== '/v1/auth/refresh' && path !== '/v1/auth/login') {
      // Try one refresh, then retry the original.
      try {
        const refresh = await fetchImpl(`${base}/v1/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (refresh.ok) {
          res = await fire();
        }
      } catch {
        // fall through — refresh network error treated as no-refresh
      }
      if (res.status === 401) {
        this.opts.onAuthFail?.();
      }
    }

    if (!res.ok) {
      let problem: ProblemDetails = {};
      try {
        problem = (await res.json()) as ProblemDetails;
      } catch {
        problem = { title: res.statusText, status: res.status };
      }
      throw new ApiError(res.status, problem);
    }

    // 204 → no body
    if (res.status === 204) return undefined as T;
    // Defensively handle empty bodies
    const text = await res.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }
}

/**
 * A lazily-instantiated singleton, configured the first time it's accessed.
 * Most callers should use `client` directly; tests can construct a fresh
 * ApiClient(...) for isolation.
 */
let _singleton: ApiClient | undefined;

export function getClient(opts: ApiClientOptions = {}): ApiClient {
  if (!_singleton) _singleton = new ApiClient(opts);
  return _singleton;
}

export function resetClient(): void {
  _singleton = undefined;
}
