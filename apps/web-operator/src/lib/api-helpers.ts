/**
 * Shared helpers for Next.js Route Handlers acting as the same-origin BFF.
 *
 * Why this file exists: every route handler under /app/api/orgs/** needs the
 * same authentication gate, the same RFC 7807 error shapes, the same
 * idempotency-key enforcement, and the same JSON-encoder workaround for
 * BigInt / Date values that Prisma loves to return. Centralising prevents
 * the eight-line copy/paste at every route boundary.
 *
 * Rules (mirrors apps/api conventions):
 * - Every protected handler MUST call `requireSession()` first.
 * - Every mutating handler MUST call `requireIdempotencyKey()`.
 * - Every error response uses `application/problem+json` (RFC 7807).
 * - JSON encoder coerces BigInt → string + Date → ISO so Money cents and
 *   audit timestamps survive the wire.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession, type Session } from '@/lib/session';

const PROBLEM_BASE = 'https://docs.d2d.io/problems';

export interface ProblemBody {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  [key: string]: unknown;
}

export function problem(
  slug: string,
  title: string,
  status: number,
  detail?: string,
  extras?: Record<string, unknown>,
): ProblemBody {
  return {
    type: `${PROBLEM_BASE}/${slug}`,
    title,
    status,
    ...(detail !== undefined && { detail }),
    ...(extras ?? {}),
  };
}

/**
 * Build a NextResponse with the RFC 7807 content type and structured body.
 * Use for every non-2xx branch.
 */
export function problemResponse(body: ProblemBody): NextResponse {
  return new NextResponse(JSON.stringify(body, jsonReplacer), {
    status: body.status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

export const unauthorized = (): NextResponse =>
  problemResponse(problem('unauthorized', 'Unauthorized', 401, 'Authentication required'));

export const forbidden = (detail = 'Insufficient permissions'): NextResponse =>
  problemResponse(problem('forbidden', 'Forbidden', 403, detail));

export const notFound = (resource: string, id?: string): NextResponse =>
  problemResponse(problem('not-found', `${resource} not found`, 404, id ? `id=${id}` : undefined));

export const conflict = (detail: string): NextResponse =>
  problemResponse(problem('conflict', 'Conflict', 409, detail));

export const validation = (detail: string, fields?: unknown): NextResponse =>
  problemResponse(
    problem('validation-failed', 'Validation failed', 400, detail, fields ? { fields } : undefined),
  );

export const idempotencyKeyMissing = (): NextResponse =>
  problemResponse(
    problem(
      'idempotency-key-required',
      'Idempotency-Key header required',
      400,
      'Mutating endpoints require an Idempotency-Key request header per ADR-0010.',
    ),
  );

export const internal = (detail?: string): NextResponse =>
  problemResponse(problem('internal-error', 'Internal error', 500, detail));

/**
 * Resolves the current session from the d2d_at cookie. Returns the
 * Session object on success, or a 401 NextResponse on failure — the
 * handler MUST early-return that NextResponse.
 *
 * Pattern:
 *   const sessionOrErr = await requireSession();
 *   if (sessionOrErr instanceof NextResponse) return sessionOrErr;
 *   const session = sessionOrErr;
 */
export async function requireSession(): Promise<Session | NextResponse> {
  const session = await getSession();
  if (!session) return unauthorized();
  return session;
}

export function requireIdempotencyKey(req: NextRequest): string | NextResponse {
  const key = req.headers.get('idempotency-key');
  if (!key || key.length < 8) return idempotencyKeyMissing();
  return key;
}

/**
 * JSON replacer that survives Prisma's BigInt + Date returns.
 * BigInt → string (preserves precision — never coerce to Number).
 * Date   → ISO string.
 */
export function jsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  return value;
}

/**
 * 200 JSON response that pre-serialises with the BigInt/Date replacer.
 * Equivalent to NextResponse.json but safe for Prisma-shaped objects.
 */
export function ok<T>(
  body: T,
  init?: { status?: number; headers?: Record<string, string> },
): NextResponse {
  return new NextResponse(JSON.stringify(body, jsonReplacer), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
}
