/**
 * Roster routes — registered under prefix `/v1/roster` by the orchestrator, so
 * paths here are sub-paths (no `/v1` segment).
 *
 *   GET   /v1/roster/shifts/mine             rep's current+next week shifts (iOS)
 *   POST  /v1/roster/shifts                  roster a knocker — manager|admin
 *   POST  /v1/roster/shifts/:id/clock-in     open the working session
 *   POST  /v1/roster/shifts/:id/clock-out    close the working session
 *
 * A KnockerShift is the plan; a KnockSession is the actual clocked-in session.
 */
import type { FastifyInstance } from 'fastify';
import { Problems, ProblemError } from '@d2d/shared-utils';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { withIdempotency } from '../../shared/middleware/idempotency';
import { requireTenant } from '../../shared/middleware/tenant-guard';
import { clockIn, clockOut, createShift, listMyShifts } from './service';
import { clockInRequestSchema, createShiftRequestSchema } from './schemas';

/** Roles permitted to roster a knocker (write a shift for another user). */
const ROSTER_WRITE_ROLES = new Set(['super_admin', 'org_admin', 'manager']);

function requireRole(role: string, allowed: Set<string>): void {
  if (!allowed.has(role)) {
    throw new ProblemError(Problems.forbidden('Role not permitted to roster shifts'));
  }
}

export async function registerRoster(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'roster', status: 'live' }));

  // GET /v1/roster/shifts/mine — JSON array, decoded directly by iOS.
  app.get('/shifts/mine', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const shifts = await listMyShifts({
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
    });
    return reply.code(200).send(shifts);
  });

  // POST /v1/roster/shifts — roster a knocker (manager|admin).
  app.post('/shifts', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    requireRole(ctx.role, ROSTER_WRITE_ROLES);
    const body = createShiftRequestSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const created = await createShift(body, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
        });
        return { status: 201, body: created };
      },
    });
  });

  // POST /v1/roster/shifts/:id/clock-in — caller must own the shift.
  app.post<{ Params: { id: string } }>(
    '/shifts/:id/clock-in',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      const body = clockInRequestSchema.parse(req.body);
      await withIdempotency({
        req,
        reply,
        orgId: ctx.orgId,
        handler: async () => {
          const result = await clockIn(req.params.id, body, {
            userId: ctx.userId,
            orgId: ctx.orgId,
            regionCode: ctx.regionCode as never,
          });
          return { status: 200, body: result };
        },
      });
    },
  );

  // POST /v1/roster/shifts/:id/clock-out — caller must own the shift.
  app.post<{ Params: { id: string } }>(
    '/shifts/:id/clock-out',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      await withIdempotency({
        req,
        reply,
        orgId: ctx.orgId,
        handler: async () => {
          const result = await clockOut(req.params.id, {
            userId: ctx.userId,
            orgId: ctx.orgId,
            regionCode: ctx.regionCode as never,
          });
          return { status: 200, body: result };
        },
      });
    },
  );
}
