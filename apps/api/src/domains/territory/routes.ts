/**
 * Territory routes — Phase 0 stubs.
 *
 * Full implementation Phase 1.2:
 *   - POST  /v1/territories                       create polygon (PostGIS GEOGRAPHY)
 *   - GET   /v1/territories                       list (filter campaign, vertical)
 *   - GET   /v1/territories/:id                   read with assignments + KPIs
 *   - PATCH /v1/territories/:id                   rename / re-polygon (audit-logged)
 *   - POST  /v1/territories/:id/archive           soft-delete
 *   - GET   /v1/territories/heatmap               bbox + layer (seifa | acs | singstat | knock-density)
 *   - POST  /v1/territories/:id/assignments       assign knocker / crew-leader (primary | secondary)
 *   - DELETE /v1/territories/:id/assignments/:aid revoke
 *   - GET   /v1/territories/:id/suggestions       AI: under-knocked + high-propensity cells
 *
 * Cross-cutting:
 *   - PostGIS polygon validation (CW orientation, no self-intersection, ≤500 vertices).
 *   - Heatmap layer reads route through `services/mapping` cache.
 *   - Assignment writes emit `territory.assignment.changed` webhook.
 */
import type { FastifyInstance } from 'fastify';
import {
  createTerritoryRequestSchema,
  territoryAssignmentRequestSchema,
  heatmapQuerySchema,
} from '@d2d/shared-types';
import { requireIdempotencyKey } from '../../shared/middleware/idempotency';

export async function registerTerritory(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'territory', status: 'scaffold', phase: '1.2' }));

  app.post('/', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = createTerritoryRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Territory create lands in Phase 1.2',
    });
  });

  app.get('/', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Territory list lands in Phase 1.2',
    }),
  );

  app.get('/:id', async (_req, reply) =>
    reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Territory read lands in Phase 1.2',
    }),
  );

  app.get('/heatmap', async (req, reply) => {
    const parsed = heatmapQuerySchema.parse(req.query);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Territory heatmap lands in Phase 1.2',
    });
  });

  app.post('/:id/assignments', async (req, reply) => {
    requireIdempotencyKey(req);
    const parsed = territoryAssignmentRequestSchema.parse(req.body);
    void parsed;
    return reply.code(501).type('application/problem+json').send({
      type: 'https://docs.d2d.io/problems/not-implemented',
      title: 'Not implemented',
      status: 501,
      detail: 'Territory assignment lands in Phase 1.2',
    });
  });
}
