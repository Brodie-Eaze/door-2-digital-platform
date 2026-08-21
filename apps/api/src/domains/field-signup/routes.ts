/**
 * Field-signup routes — one-call door-step sign-up for the native Knocker app.
 *
 *   POST /v1/field/signups   create Lead + Conversion (+ Donation) atomically
 *                            from the simple field shape. requireAuth +
 *                            Idempotency-Key, exactly like POST /v1/conversions.
 *
 * The org is taken from the authenticated principal — NEVER from the body.
 */
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { withIdempotency } from '../../shared/middleware/idempotency';
import { requireTenant } from '../../shared/middleware/tenant-guard';
import { createFieldSignup } from './service';
import { createFieldSignupRequestSchema } from './schemas';

export async function registerFieldSignup(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'field-signup', status: 'live', phase: '1.3' }));

  // POST /v1/field/signups — create Lead + Conversion in one call
  app.post('/signups', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = createFieldSignupRequestSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const signup = await createFieldSignup(body, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
        });
        return { status: 201, body: signup };
      },
    });
  });
}
