/**
 * Consent routes — Phase 1.2 real.
 *
 *   POST /v1/consent/capture                     capture consent at point of collection
 *   GET  /v1/consent/lookup?leadId=&channel=     active consent for a lead + optional channel
 *   POST /v1/consent/:id/withdraw               withdraw consent (cascades per scope)
 *
 * Consent is source of truth for "may we contact this person". Lives outside
 * Lead so it survives lead deletion. Signature + evidence stored in S3 (proofKey).
 */
import type { FastifyInstance } from 'fastify';
import { captureConsentRequestSchema } from '@d2d/shared-types';
import type { ConsentChannel } from '@prisma/client';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { withIdempotency } from '../../shared/middleware/idempotency';
import { requireTenant } from '../../shared/middleware/tenant-guard';
import { captureConsent, lookupConsent, withdrawConsent } from './service';

interface IdParams {
  id: string;
}

export async function registerConsent(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'consent', status: 'live', phase: '1.2' }));

  // POST /v1/consent/capture
  app.post('/capture', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const parsed = captureConsentRequestSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const result = await captureConsent(parsed, {
          userId: ctx.userId,
          orgId: ctx.orgId,
        });
        return { status: 201, body: result };
      },
    });
  });

  // GET /v1/consent/lookup?leadId=&channel=
  app.get('/lookup', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const query = req.query as { leadId?: string; channel?: string };
    if (!query.leadId) {
      return reply.code(400).type('application/problem+json').send({
        type: 'https://docs.d2d.io/problems/validation-error',
        title: 'Validation error',
        status: 400,
        detail: 'Query parameter "leadId" is required',
      });
    }
    const result = await lookupConsent(
      query.leadId,
      { userId: ctx.userId, orgId: ctx.orgId },
      query.channel as ConsentChannel | undefined,
    );
    return reply.code(200).send(result);
  });

  // POST /v1/consent/:id/withdraw
  app.post<{ Params: IdParams }>(
    '/:id/withdraw',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      await withIdempotency({
        req,
        reply,
        orgId: ctx.orgId,
        handler: async () => {
          const record = await withdrawConsent(req.params.id, {
            userId: ctx.userId,
            orgId: ctx.orgId,
          });
          return { status: 200, body: { record } };
        },
      });
    },
  );
}
