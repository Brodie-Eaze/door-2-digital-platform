/**
 * RFC 7807 Problem Details — the only acceptable error response shape.
 *
 * Per ADR-0009, every API error returns Content-Type: application/problem+json
 * with the structure below. Subtypes are namespaced at
 * https://docs.d2d.io/problems/<slug>.
 *
 * Usage in Fastify:
 *   reply.code(403).type('application/problem+json').send(
 *     problem('region-mismatch', 'Region mismatch', { status: 403, ... })
 *   );
 *
 * Usage in clients:
 *   if (!res.ok) {
 *     const p = await res.json() as Problem;
 *     throw new ProblemError(p);
 *   }
 */

export interface Problem {
  /** A URI reference identifying the problem type. */
  type: string;
  /** Short, human-readable summary. SHOULD NOT change between occurrences. */
  title: string;
  /** HTTP status code. */
  status: number;
  /** Human-readable explanation specific to this occurrence. */
  detail?: string;
  /** URI reference identifying the specific occurrence. */
  instance?: string;
  /** Correlation ID for tracing — included on every D2D response. */
  traceId?: string;
  /** Additional, problem-specific fields. */
  [key: string]: unknown;
}

export const PROBLEM_BASE = 'https://docs.d2d.io/problems' as const;

/**
 * Build a Problem object. Extra fields land at the top level per RFC 7807.
 */
export function problem(
  slug: string,
  title: string,
  init: {
    status: number;
    detail?: string;
    instance?: string;
    traceId?: string;
    extras?: Record<string, unknown>;
  },
): Problem {
  return {
    type: `${PROBLEM_BASE}/${slug}`,
    title,
    status: init.status,
    ...(init.detail && { detail: init.detail }),
    ...(init.instance && { instance: init.instance }),
    ...(init.traceId && { traceId: init.traceId }),
    ...(init.extras ?? {}),
  };
}

// Curated factories for the most common D2D problems.

export const Problems = {
  validation: (detail: string, fields?: unknown[]): Problem =>
    problem('validation-failed', 'Validation failed', {
      status: 400,
      detail,
      extras: fields ? { fields } : {},
    }),

  unauthorized: (detail = 'Authentication required'): Problem =>
    problem('unauthorized', 'Unauthorized', { status: 401, detail }),

  forbidden: (detail = 'Insufficient permissions'): Problem =>
    problem('forbidden', 'Forbidden', { status: 403, detail }),

  /** Cross-tenant access attempt. Always audit-logged. */
  tenantMismatch: (orgId: string): Problem =>
    problem('tenant-mismatch', 'Tenant mismatch', {
      status: 403,
      detail: 'You do not have access to this org',
      extras: { orgId },
    }),

  /** Cross-region access attempt. Always audit-logged. */
  regionMismatch: (expected: string, actual: string): Problem =>
    problem('region-mismatch', 'Region mismatch', {
      status: 403,
      detail: 'Resource lives in a different region',
      extras: { expectedRegion: expected, actualRegion: actual },
    }),

  notFound: (resource: string, id?: string): Problem =>
    problem('not-found', 'Not found', {
      status: 404,
      detail: id ? `${resource} ${id} not found` : `${resource} not found`,
    }),

  conflict: (detail: string): Problem => problem('conflict', 'Conflict', { status: 409, detail }),

  /** Idempotency replay returned a different body. */
  idempotencyKeyReused: (detail = 'Idempotency key reused with different body'): Problem =>
    problem('idempotency-key-conflict', 'Idempotency key conflict', { status: 409, detail }),

  /** Solicitor state-clearance gate. Campaign cannot deliver to that state. */
  stateNotCleared: (state: string): Problem =>
    problem('state-not-cleared', 'State not cleared', {
      status: 409,
      detail: `Paid-solicitor registration not yet approved for ${state}`,
      extras: { state },
    }),

  /** AI / marketing budget exhausted. */
  budgetExhausted: (orgId: string): Problem =>
    problem('budget-exhausted', 'Budget exhausted', {
      status: 429,
      detail: 'Monthly AI generation budget reached',
      extras: { orgId },
    }),

  rateLimited: (retryAfterSeconds: number): Problem =>
    problem('rate-limited', 'Rate limited', {
      status: 429,
      detail: 'Too many requests',
      extras: { retryAfter: retryAfterSeconds },
    }),

  internal: (detail = 'Internal server error', traceId?: string): Problem =>
    problem('internal', 'Internal server error', { status: 500, detail, traceId }),
} as const;

/** Throwable wrapper for use inside service code. */
export class ProblemError extends Error {
  constructor(public readonly problem: Problem) {
    super(problem.detail ?? problem.title);
    this.name = 'ProblemError';
  }
}
