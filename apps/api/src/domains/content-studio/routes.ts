/**
 * Content-Studio routes — Agent 16 real.
 *
 * Mount: `app.register(registerContentStudio, { prefix: '/v1/content-studio' })`.
 *
 *   GET   /providers            content-generation providers (filtered)
 *   POST  /jobs/copy            claude_copy by default
 *   POST  /jobs/image           flux_image by default
 *   POST  /jobs/video           runway_video by default (async)
 *   POST  /jobs/avatar          heygen_avatar (async)
 *   GET   /jobs/:id             status + payload (auto-polls async jobs)
 */
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { withIdempotency } from '../../shared/middleware/idempotency';
import { requireTenant } from '../../shared/middleware/tenant-guard';
import { MarketingService } from '../marketing/service';
import { ContentStudioService } from './service';
import {
  avatarJobRequestSchema,
  copyJobRequestSchema,
  imageJobRequestSchema,
  videoJobRequestSchema,
} from './schemas';

interface IdParams {
  id: string;
}

export async function registerContentStudio(app: FastifyInstance): Promise<void> {
  const marketing = new MarketingService(app.integrations);
  const service = new ContentStudioService(marketing);

  app.get('/_status', { preHandler: requireAuth }, async () => ({
    domain: 'content-studio',
    status: 'live',
    phase: '3.1',
  }));

  app.get('/providers', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const data = await service.listProviders(ctx.orgId);
    return reply.code(200).send({ providers: data });
  });

  app.post('/jobs/copy', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = copyJobRequestSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const job = await service.submitCopy(body, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
        });
        return { status: 201, body: { job } };
      },
    });
  });

  app.post('/jobs/image', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = imageJobRequestSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const job = await service.submitImage(body, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
        });
        return { status: 201, body: { job } };
      },
    });
  });

  app.post('/jobs/video', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = videoJobRequestSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const job = await service.submitVideo(body, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
        });
        return { status: 202, body: { job } };
      },
    });
  });

  app.post('/jobs/avatar', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = avatarJobRequestSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const job = await service.submitAvatar(body, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
        });
        return { status: 202, body: { job } };
      },
    });
  });

  app.get<{ Params: IdParams }>('/jobs/:id', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const job = await service.getJob(req.params.id, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
    });
    return reply.code(200).send({ job });
  });
}
