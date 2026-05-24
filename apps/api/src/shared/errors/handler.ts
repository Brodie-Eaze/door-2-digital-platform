/**
 * Unified Fastify error handler — every response that isn't 2xx returns
 * RFC 7807 Problem Details (per ADR-0009).
 */
import type { FastifyReply, FastifyRequest, FastifyError } from 'fastify';
import { Problems, ProblemError, type Problem } from '@d2d/shared-utils';
import { ZodError } from 'zod';
import { logger } from '../../config/logger';

export async function errorHandler(
  err: FastifyError | ProblemError | ZodError | Error,
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const traceId = req.id;
  let problem: Problem;

  if (err instanceof ProblemError) {
    problem = { ...err.problem, traceId };
  } else if (err instanceof ZodError) {
    problem = {
      ...Problems.validation('Request schema invalid', err.flatten().fieldErrors as unknown[]),
      traceId,
    };
  } else if ('statusCode' in err && typeof err.statusCode === 'number') {
    // Fastify built-in or @fastify/rate-limit errors
    if (err.statusCode === 429) {
      problem = { ...Problems.rateLimited(60), traceId };
    } else if (err.statusCode === 401) {
      problem = { ...Problems.unauthorized(), traceId };
    } else if (err.statusCode === 404) {
      problem = { ...Problems.notFound('Route'), traceId };
    } else {
      problem = {
        type: 'https://docs.d2d.io/problems/http-error',
        title: err.message ?? 'HTTP error',
        status: err.statusCode,
        traceId,
      };
    }
  } else {
    logger().error({ err, traceId }, 'unhandled error');
    problem = { ...Problems.internal('Internal server error', traceId) };
  }

  await reply.code(problem.status).type('application/problem+json').send(problem);
}
