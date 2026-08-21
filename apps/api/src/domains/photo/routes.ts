/**
 * Photo routes — property photos captured at every knock (KnockPhoto).
 *
 * Registered under /v1/photos (prefix applied at registration — paths here are
 * prefix-free):
 *
 *   POST  /v1/photos          capture a photo (any authed in-org role)
 *   GET   /v1/photos          list metadata (no bytes), filterable + cursored
 *   GET   /v1/photos/:id/raw  stream the raw image bytes for one photo
 *   GET   /v1/photos/_status  liveness
 *
 * Capture carries an Idempotency-Key (mirrors field-signup / catalog writes) so
 * a flaky-network retry from the field app never double-stores the same photo.
 * The org/user/region come from the authenticated principal — NEVER the body.
 */
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { withIdempotency } from '../../shared/middleware/idempotency';
import { requireTenant } from '../../shared/middleware/tenant-guard';
import { capturePhoto, getPhotoRaw, listPhotos } from './service';
import { createPhotoRequestSchema, listPhotosQuerySchema } from './schemas';

export async function registerPhoto(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'photo', status: 'live' }));

  // POST /v1/photos — capture a property photo (any authed in-org role).
  // The image arrives as base64 in the JSON body (dev path), which inflates the
  // raw bytes ~33%, so the global 1 MB bodyLimit would reject a normal phone
  // photo. Bump THIS route to 15 MB (≈11 MB image) — scoped to the route options
  // so sibling routes keep the default. (Prod's S3 presigned PUT path uploads
  // bytes out-of-band, so this limit only matters for the dev base64 path.)
  app.post('/', { preHandler: requireAuth, bodyLimit: 15 * 1024 * 1024 }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = createPhotoRequestSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const result = await capturePhoto(body, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
        });
        return { status: 201, body: result };
      },
    });
  });

  // GET /v1/photos — metadata only (no bytes), tenant-scoped + cursored.
  app.get('/', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const query = listPhotosQuerySchema.parse(req.query);
    const photos = await listPhotos(query, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
    });
    return reply.code(200).send(photos);
  });

  // GET /v1/photos/:id/raw — stream the raw image bytes. A photo not in the
  // caller's org 404s (the service does a tenant-scoped lookup first).
  app.get<{ Params: { id: string } }>(
    '/:id/raw',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      const { bytes, contentType } = await getPhotoRaw(req.params.id, {
        userId: ctx.userId,
        orgId: ctx.orgId,
        regionCode: ctx.regionCode as never,
      });
      // Private image bytes — never let a shared cache hold a tenant's photo.
      return reply
        .code(200)
        .header('content-type', contentType)
        .header('cache-control', 'private, no-store')
        .send(bytes);
    },
  );
}
