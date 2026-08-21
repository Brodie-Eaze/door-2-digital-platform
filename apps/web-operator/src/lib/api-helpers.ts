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
import { db } from '@d2d/database';
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

/**
 * The ONLY roles permitted to read/write across tenant boundaries. Everything
 * else is pinned to its own `session.orgId`. Default-deny: an unknown role is
 * never cross-tenant. Centralised so every BFF query scopes identically and a
 * new role can't silently inherit god-mode.
 */
const CROSS_TENANT_ROLES: ReadonlySet<string> = new Set(['super_admin']);

export function isCrossTenantOperator(session: Session): boolean {
  return CROSS_TENANT_ROLES.has(session.role);
}

/**
 * Roles permitted to mutate the roster (create / edit / delete shifts).
 * knocker / inside_sales / accountant / auditor / viewer are read-only on
 * scheduling. Default-deny: unknown roles cannot write.
 */
const ROSTER_WRITE_ROLES: ReadonlySet<string> = new Set(['super_admin', 'org_admin', 'manager']);

export function canWriteRoster(session: Session): boolean {
  return ROSTER_WRITE_ROLES.has(session.role);
}

/**
 * Roles permitted to take OPERATOR ACTIONS that mutate org-visible field state
 * or push to the fleet: territory reassignment, fleet broadcasts, pipeline
 * lead moves, marketing creative queue/publish/generate. knocker, inside_sales,
 * accountant, auditor, viewer are read-only on these. Default-deny: an unknown
 * role gets nothing. Centralised so every privileged BFF action gates identically
 * — authn (requireSession) is NOT authz; every sensitive POST/PATCH must also
 * pass canOperate.
 */
const OPERATOR_ROLES: ReadonlySet<string> = new Set(['super_admin', 'org_admin', 'manager']);

export function canOperate(session: Session): boolean {
  return OPERATOR_ROLES.has(session.role);
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

/**
 * The org the caller is targeting for a slug-addressed sub-account route.
 * `regionCode` is needed by every write path (audit chain + row regionCode).
 */
export interface ResolvedOrg {
  id: string;
  slug: string;
  regionCode: 'US' | 'AU' | 'SG';
  tradingName: string;
}

/**
 * Resolve `[slug]` → Org and authorize the verified session against it.
 *
 * Mirrors the authorization in /api/orgs/[slug]/leads exactly: a genuine
 * cross-tenant operator (super_admin) may target any sub-account; everyone
 * else is pinned to their own `session.orgId`. Returns the resolved org on
 * success, or an RFC 7807 NextResponse (404 / 403 / 500) the handler MUST
 * early-return. Every per-account workspace BFF route funnels through this so
 * one account can never read or write another's knockers / catalog / shifts.
 *
 * Pattern:
 *   const orgOrErr = await resolveAccountOrg(slug, session);
 *   if (orgOrErr instanceof NextResponse) return orgOrErr;
 *   const org = orgOrErr;
 */
export async function resolveAccountOrg(
  slug: string,
  session: Session,
): Promise<ResolvedOrg | NextResponse> {
  if (!slug) return notFound('Org', slug);

  let org: { id: string; slug: string | null; regionCode: 'US' | 'AU' | 'SG'; tradingName: string } | null;
  try {
    org = await db.org.findUnique({
      where: { slug },
      select: { id: true, slug: true, regionCode: true, tradingName: true },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[resolveAccountOrg] org lookup failed:', err);
    return internal('Failed to resolve account');
  }
  if (!org || !org.slug) return notFound('Org', slug);

  // Authorization over a CRYPTOGRAPHICALLY VERIFIED session: a cross-tenant
  // operator can target any org; everyone else only their own. Tenant scope is
  // also re-enforced in every query below (where: { orgId: org.id }).
  if (!isCrossTenantOperator(session) && session.orgId !== org.id) {
    return forbidden('You do not have access to this sub-account');
  }

  return { id: org.id, slug: org.slug, regionCode: org.regionCode, tradingName: org.tradingName };
}
