/**
 * Compliance routes — Phase 1.2.
 *
 *   - GET  /v1/compliance/state-clearance                          matrix of (campaignId, state, status)
 *   - GET  /v1/compliance/state-clearance/:campaignId/:state       single clearance status + evidence
 *   - POST /v1/compliance/paid-solicitor-registrations             file new registration (or upload evidence)
 *   - PATCH /v1/compliance/paid-solicitor-registrations/:id        transition status (approved | rejected)
 *   - GET  /v1/compliance/cooling-off-windows                      current per-jurisdiction cooling-off
 *                                                                  windows applied to conversions
 *   - GET  /v1/compliance/quiet-hours                              quiet-hour matrix (per region/state)
 *   - GET  /v1/compliance/scripts                                  required scripts per jurisdiction
 *
 * Cross-cutting:
 *   - Conversion creation calls `assertStateCleared(orgId, campaignId, donorState)`
 *     which 409s with PROBLEM_STATE_NOT_CLEARED if not approved.
 *   - Evidence files stored in S3 with Object Lock (7yr retention).
 *   - Compliance changes emit `compliance.state_clearance_changed` webhook.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { paidSolicitorRegistrationRequestSchema } from '@d2d/shared-types';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { withIdempotency } from '../../shared/middleware/idempotency';
import { requireTenant } from '../../shared/middleware/tenant-guard';
import type { RegionCode } from '@prisma/client';
import {
  fileRegistration,
  getStateClearanceMatrix,
  transitionRegistration,
  manualClearance,
} from './service';
import { COOLING_OFF_WINDOWS, COOLING_OFF_BY_STATE } from './cooling-off-data';

const stateClearanceQuerySchema = z.object({ campaignId: z.string().min(1).optional() }).strict();

// PATCH may only drive the registration toward a terminal/effective state;
// `pending`/`submitted` are set at filing time, not via transition.
const transitionRequestSchema = z
  .object({ status: z.enum(['approved', 'rejected', 'expired']) })
  .strict();

interface IdParams {
  id: string;
}

export async function registerCompliance(app: FastifyInstance): Promise<void> {
  app.get('/_status', { preHandler: requireAuth }, async () => ({
    domain: 'compliance',
    status: 'live',
    phase: '1.2',
  }));

  // GET /v1/compliance/state-clearance — matrix for the org.
  app.get('/state-clearance', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const query = stateClearanceQuerySchema.parse(req.query);
    const data = await getStateClearanceMatrix(ctx.orgId, query.campaignId);
    return reply.code(200).send({ data });
  });

  // POST /v1/compliance/paid-solicitor-registrations — file a registration.
  app.post('/paid-solicitor-registrations', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = paidSolicitorRegistrationRequestSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const registration = await fileRegistration(body, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as RegionCode,
        });
        return { status: 201, body: { registration } };
      },
    });
  });

  // PATCH /v1/compliance/paid-solicitor-registrations/:id — transition status.
  app.patch<{ Params: IdParams }>(
    '/paid-solicitor-registrations/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      const body = transitionRequestSchema.parse(req.body);
      const registration = await transitionRegistration(req.params.id, body.status, {
        userId: ctx.userId,
        orgId: ctx.orgId,
        regionCode: ctx.regionCode as RegionCode,
      });
      return reply.code(200).send({ registration });
    },
  );

  // POST /v1/compliance/state-clearance — manual clearance override.
  // Links a campaign to an existing approved registration for campaigns created
  // after the registration was approved (auto-upsert only covers at-approval-time).
  const manualClearanceSchema = z
    .object({
      campaignId: z.string().min(1),
      state: z.string().min(2).max(2),
      paidSolicitorRegistrationId: z.string().min(1),
    })
    .strict();

  app.post('/state-clearance', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const body = manualClearanceSchema.parse(req.body);
    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const clearance = await manualClearance(body, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as RegionCode,
        });
        return { status: 201, body: { clearance } };
      },
    });
  });

  // GET /v1/compliance/cooling-off-windows — per-jurisdiction FTC + state cooling-off windows.
  // Optional query param ?state=CA for a single-state lookup.
  // Auth required: only authenticated org members need this data.
  const coolingOffQuerySchema = z
    .object({ state: z.string().length(2).toUpperCase().optional() })
    .strict();

  app.get('/cooling-off-windows', { preHandler: requireAuth }, async (req, reply) => {
    const query = coolingOffQuerySchema.parse(req.query);

    if (query.state) {
      const window = COOLING_OFF_BY_STATE.get(query.state);
      if (!window) {
        return reply
          .code(404)
          .type('application/problem+json')
          .send({
            type: 'https://docs.d2d.io/problems/not-found',
            title: 'State not found',
            status: 404,
            detail: `No cooling-off window data for state '${query.state}'.`,
          });
      }
      return reply.code(200).send({
        window,
        meta: {
          dataAsOf: '2026-06',
          legalDisclaimer:
            'This data is provided for operational reference only. Consult qualified legal counsel before relying on it for compliance decisions. State laws change; review quarterly.',
        },
      });
    }

    return reply.code(200).send({
      windows: COOLING_OFF_WINDOWS,
      meta: {
        count: COOLING_OFF_WINDOWS.length,
        dataAsOf: '2026-06',
        legalDisclaimer:
          'This data is provided for operational reference only. Consult qualified legal counsel before relying on it for compliance decisions. State laws change; review quarterly.',
      },
    });
  });
}
