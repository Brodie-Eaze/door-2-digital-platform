/**
 * Do-Not-Call (DNC) routes — Phase 1.4 real.
 *
 *   POST /v1/do-not-call/scrub    hash incoming phones → partition allowed/blocked
 *   POST /v1/do-not-call/ingest   bulk upsert pre-hashed phone digests from registry
 *
 * Cross-cutting:
 *   - Phones hashed with HMAC-SHA256(PII_SEARCH_KEY, normalisedE164).
 *   - Scrub receives raw phones; ingest receives pre-hashed digests.
 *   - Both paths are region-scoped via requireTenant.
 */
import type { FastifyInstance } from 'fastify';
import { dncScrubRequestSchema, dncIngestRequestSchema } from '@d2d/shared-types';
import { phoneDigest, newId } from '@d2d/shared-utils';
import type { RegionCode } from '@prisma/client';
import { requireIdempotencyKey } from '../../shared/middleware/idempotency';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { requireTenant } from '../../shared/middleware/tenant-guard';
import { prisma } from '../../config/db';
import { env } from '../../config/env';

export async function registerDoNotCall(app: FastifyInstance): Promise<void> {
  app.get('/_status', async () => ({ domain: 'do-not-call', status: 'live', phase: '1.4' }));

  // POST /v1/do-not-call/scrub — classify a batch of raw phone numbers.
  // Returns { allowed: string[], blocked: string[] } using index positions of the
  // input array so the caller can correlate without us logging plaintext phones.
  app.post('/scrub', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const { phones } = dncScrubRequestSchema.parse(req.body);
    const e = env();

    const digests = phones.map((p) => phoneDigest(p, e.PII_SEARCH_KEY));

    const blocked = await prisma().doNotCall.findMany({
      where: {
        regionCode: ctx.regionCode as RegionCode,
        phoneDigest: { in: digests },
      },
      select: { phoneDigest: true },
    });

    const blockedSet = new Set(blocked.map((r) => r.phoneDigest));
    const allowed: string[] = [];
    const blockedPhones: string[] = [];

    for (let i = 0; i < phones.length; i++) {
      const phone = phones[i]!;
      if (blockedSet.has(digests[i]!)) {
        blockedPhones.push(phone);
      } else {
        allowed.push(phone);
      }
    }

    return reply.code(200).send({ allowed, blocked: blockedPhones });
  });

  // POST /v1/do-not-call/ingest — bulk upsert pre-hashed phone digests.
  // Caller is responsible for normalising + hashing phones before calling this.
  app.post('/ingest', { preHandler: requireAuth }, async (req, reply) => {
    requireIdempotencyKey(req);
    const ctx = requireTenant(req);
    const { source, rows } = dncIngestRequestSchema.parse(req.body);
    const regionCode = ctx.regionCode as RegionCode;

    let inserted = 0;
    for (const row of rows) {
      await prisma().doNotCall.upsert({
        where: { regionCode_phoneDigest: { regionCode, phoneDigest: row.hashedPhone } },
        create: {
          id: newId('dnc'),
          regionCode,
          phoneDigest: row.hashedPhone,
          source,
          loadedAt: row.registeredAt ? new Date(row.registeredAt) : new Date(),
        },
        update: { source, loadedAt: row.registeredAt ? new Date(row.registeredAt) : new Date() },
      });
      inserted++;
    }

    return reply.code(200).send({ inserted, source, regionCode });
  });
}
