/**
 * Propensity routes — the ML plug-in surface (registered under /v1/propensity).
 *
 *   GET   /v1/propensity              list scores visible to the caller org
 *                                     (org-specific OR shared/global). auth.
 *   GET   /v1/propensity/heatmap      compact [{lat,lng,score,band}] map layer.
 *   POST  /v1/propensity/scores       ML write-back batch upsert. super_admin |
 *                                     org_admin (see write-auth note below).
 *   GET   /v1/propensity/_status      liveness.
 *
 * READ vs WRITE contract:
 *   - Data scientists WRITE scores via POST /scores.
 *   - The platform (heatmaps, manager area-setting) READS via GET / + /heatmap.
 *
 * WRITE AUTHENTICATION:
 *   The prod path for the ML pipeline is a dedicated service credential — an
 *   `ApiKey` row (model exists: prefix + secretHash + scopes) presented as
 *   `X-Api-Key`, scoped e.g. `propensity:write`. There is no clean,
 *   reusable ApiKey->principal preHandler in the codebase today (the
 *   ApiKey model is defined but unwired), so we gate POST /scores to the
 *   human admin roles {super_admin, org_admin} for now. When an ml-service key
 *   preHandler lands, add it to the write gate alongside these roles — the
 *   service body already keys everything off the resolved principal's orgId.
 */
import type { FastifyInstance } from 'fastify';
import { Problems, ProblemError } from '@d2d/shared-utils';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { withIdempotency } from '../../shared/middleware/idempotency';
import { requireTenant } from '../../shared/middleware/tenant-guard';
import { heatmap, listScores, writeScores } from './service';
import { heatmapQuerySchema, listScoresQuerySchema, writeScoresRequestSchema } from './schemas';

// Who may write scores back. super_admin additionally may write GLOBAL
// (shared, orgId IS NULL) rows; org_admin writes are pinned to their own org.
const WRITE_ROLES = new Set(['super_admin', 'org_admin']);
// Only super_admin may publish shared/global scores every org reads.
const GLOBAL_WRITE_ROLES = new Set(['super_admin']);

function requireRole(role: string, allowed: Set<string>, detail: string): void {
  if (!allowed.has(role)) {
    throw new ProblemError(Problems.forbidden(detail));
  }
}

export async function registerPropensity(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'propensity', status: 'live', phase: '1.3' }));

  // GET /v1/propensity — scores visible to the caller (org-specific OR global).
  app.get('/', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const query = listScoresQuerySchema.parse(req.query);
    const result = await listScores(query, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      role: ctx.role,
      regionCode: ctx.regionCode as never,
    });
    return reply.code(200).send(result);
  });

  // GET /v1/propensity/heatmap — compact map layer (org + global visibility).
  app.get('/heatmap', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const query = heatmapQuerySchema.parse(req.query);
    const points = await heatmap(query, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      role: ctx.role,
      regionCode: ctx.regionCode as never,
    });
    return reply.code(200).send(points);
  });

  // POST /v1/propensity/scores — ML write-back batch upsert.
  app.post('/scores', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    requireRole(ctx.role, WRITE_ROLES, 'Role not permitted to write propensity scores');
    const body = writeScoresRequestSchema.parse(req.body);
    // Publishing GLOBAL (shared) scores is super_admin-only.
    if (body.global === true) {
      requireRole(
        ctx.role,
        GLOBAL_WRITE_ROLES,
        'Only super_admin may write global propensity scores',
      );
    }
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const result = await writeScores(body, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          role: ctx.role,
          regionCode: ctx.regionCode as never,
        });
        return { status: 200, body: result };
      },
    });
  });
}
