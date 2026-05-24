/**
 * Idempotency middleware — every POST mutation MUST provide an
 * Idempotency-Key header. Replays return the stored response.
 *
 * Per ADR-0010. Storage in IdempotencyRecord table with 24h TTL.
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  Problems,
  ProblemError,
  isValidIdempotencyKey,
  hashRequestBody,
  computeExpiresAt,
} from '@d2d/shared-utils';
import { prisma } from '../../config/db';

/**
 * Validate Idempotency-Key header presence + format. To be called from
 * controllers handling POST mutations.
 */
export function requireIdempotencyKey(req: FastifyRequest): string {
  const k = req.headers['idempotency-key'];
  if (typeof k !== 'string' || !isValidIdempotencyKey(k)) {
    throw new ProblemError(
      Problems.validation('Idempotency-Key header required (8–64 chars, [a-zA-Z0-9._-])'),
    );
  }
  return k;
}

/**
 * Load an existing idempotency record. Returns the cached response if the
 * request body matches the stored hash; throws 409 if bodies differ.
 *
 * orgId may be '__public__' for unauthenticated mutations (e.g. signup).
 */
export async function loadCachedResponse(
  orgId: string,
  key: string,
  method: string,
  path: string,
  body: unknown,
): Promise<{ status: number; body: unknown } | null> {
  const record = await prisma().idempotencyRecord.findUnique({ where: { key } });
  if (!record) return null;
  if (record.expiresAt < new Date()) return null;
  if (record.orgId !== orgId || record.method !== method || record.path !== path) {
    throw new ProblemError(Problems.idempotencyKeyReused());
  }
  const bodyHash = hashRequestBody(body);
  if (bodyHash !== record.bodyHash) {
    throw new ProblemError(Problems.idempotencyKeyReused());
  }
  return { status: record.responseStatus, body: record.responseBody };
}

/**
 * Persist the response for an idempotency-key so retries replay it.
 * For Phase 1.1 we keep the body inline (JSONB) — large payloads will
 * spill to S3 in a later phase.
 */
export async function storeResponse(args: {
  orgId: string;
  key: string;
  method: string;
  path: string;
  body: unknown;
  responseStatus: number;
  responseBody: unknown;
}): Promise<void> {
  const bodyHash = hashRequestBody(args.body);
  await prisma().idempotencyRecord.upsert({
    where: { key: args.key },
    update: {
      responseStatus: args.responseStatus,
      responseBody: args.responseBody as object,
      expiresAt: computeExpiresAt(),
    },
    create: {
      key: args.key,
      orgId: args.orgId,
      method: args.method,
      path: args.path,
      bodyHash,
      responseStatus: args.responseStatus,
      responseBodyKey: 'inline', // S3 path replaced inline JSON in dev
      responseBody: args.responseBody as object,
      expiresAt: computeExpiresAt(),
    },
  });
}

/**
 * Convenience helper for controllers: validate the key, check the cache,
 * run the handler, persist the response. Caller does the actual work in
 * `handler` and returns `{ status, body }`.
 */
export async function withIdempotency(args: {
  req: FastifyRequest;
  reply: FastifyReply;
  orgId: string;
  handler: () => Promise<{ status: number; body: unknown }>;
}): Promise<void> {
  const key = requireIdempotencyKey(args.req);
  const method = args.req.method;
  const path = args.req.url;
  const cached = await loadCachedResponse(args.orgId, key, method, path, args.req.body);
  if (cached) {
    await args.reply.code(cached.status).send(cached.body);
    return;
  }
  const result = await args.handler();
  await storeResponse({
    orgId: args.orgId,
    key,
    method,
    path,
    body: args.req.body,
    responseStatus: result.status,
    responseBody: result.body,
  });
  await args.reply.code(result.status).send(result.body);
}
