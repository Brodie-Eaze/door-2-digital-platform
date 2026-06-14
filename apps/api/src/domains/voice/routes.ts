/**
 * Voice routes — door-conversation recording CAPTURE scaffold (under /v1/voice).
 *
 *   POST  /v1/voice           upload a recording (knocker uploads own)
 *   GET   /v1/voice           list recordings (metadata only), tenant-scoped
 *   GET   /v1/voice/:id/raw   raw audio for the ML pipeline, tenant-scoped
 *   GET   /v1/voice/_status    domain status + the `enabled` feature-flag value
 *
 *  ⚠️  SAFE-BY-DEFAULT — ALL-PARTY-CONSENT LEGAL RISK. ⚠️
 *  The upload (POST) is DOUBLE-GATED (see service.ts file header for the full
 *  legal note + sign-off preconditions):
 *    1. FEATURE FLAG  — disabled unless D2D_VOICE_ENABLED === "true"
 *                       → 403 voice-capture-disabled.
 *    2. CONSENT GATE  — even when enabled, requires body.consentObtained === true
 *                       → 422 voice-consent-required otherwise.
 *  The org is taken from the authenticated principal — NEVER from body/path.
 */
import type { FastifyInstance } from 'fastify';
import { problem, ProblemError } from '@d2d/shared-utils';
import { requireAuth } from '../../shared/middleware/auth-guard';
import { withIdempotency } from '../../shared/middleware/idempotency';
import { requireTenant } from '../../shared/middleware/tenant-guard';
import {
  captureVoiceRecording,
  getVoiceRecordingAudio,
  listVoiceRecordings,
  voiceCaptureEnabled,
} from './service';
import { createVoiceRecordingRequestSchema, listVoiceRecordingsQuerySchema } from './schemas';

/** 403 — the whole capture path is turned off (default). */
function voiceCaptureDisabledProblem(): ProblemError {
  return new ProblemError(
    problem('voice-capture-disabled', 'Voice capture disabled', {
      status: 403,
      detail:
        'Door-conversation recording is disabled. It requires legal sign-off + per-state ' +
        'consent configuration before it can be enabled.',
    }),
  );
}

/** 422 — capture is on, but all-party consent was not obtained. */
function voiceConsentRequiredProblem(): ProblemError {
  return new ProblemError(
    problem('voice-consent-required', 'Voice consent required', {
      status: 422,
      detail:
        'Recording requires all-party consent. Set consentObtained=true only after every ' +
        'party has consented (many US states require all-party consent to record).',
    }),
  );
}

export async function registerVoice(app: FastifyInstance): Promise<void> {
  // GET /v1/voice/_status — exposes the feature-flag state.
  app.get('/_status', async () => ({
    domain: 'voice',
    status: 'scaffold',
    enabled: voiceCaptureEnabled(),
  }));

  // POST /v1/voice — upload a recording (knocker uploads own). DOUBLE-GATED.
  app.post('/', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);

    // GATE 1 — feature flag. Checked BEFORE schema parse + idempotency so a
    // disabled deployment never even decodes/stores audio or caches a response.
    if (!voiceCaptureEnabled()) {
      throw voiceCaptureDisabledProblem();
    }

    const body = createVoiceRecordingRequestSchema.parse(req.body);

    // GATE 2 — consent. Checked BEFORE the idempotency wrapper so a
    // non-consenting request is never persisted in the idempotency cache.
    if (body.consentObtained !== true) {
      throw voiceConsentRequiredProblem();
    }

    await withIdempotency({
      req,
      reply,
      orgId: ctx.orgId,
      handler: async () => {
        const result = await captureVoiceRecording(body, {
          userId: ctx.userId,
          orgId: ctx.orgId,
          regionCode: ctx.regionCode as never,
        });
        return { status: 201, body: result };
      },
    });
  });

  // GET /v1/voice — list recordings (metadata only), tenant-scoped.
  app.get('/', { preHandler: requireAuth }, async (req, reply) => {
    const ctx = requireTenant(req);
    const query = listVoiceRecordingsQuerySchema.parse(req.query);
    const result = await listVoiceRecordings(query, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      regionCode: ctx.regionCode as never,
    });
    return reply.code(200).send(result);
  });

  // GET /v1/voice/:id/raw — raw audio for the ML pipeline. Cross-org id → 404.
  app.get<{ Params: { id: string } }>(
    '/:id/raw',
    { preHandler: requireAuth },
    async (req, reply) => {
      const ctx = requireTenant(req);
      const audio = await getVoiceRecordingAudio(req.params.id, {
        userId: ctx.userId,
        orgId: ctx.orgId,
        regionCode: ctx.regionCode as never,
      });
      return reply
        .code(200)
        .type(audio.contentType)
        .header('content-length', audio.bytes.length)
        .header('content-disposition', `attachment; filename="${req.params.id}.m4a"`)
        .send(audio.bytes);
    },
  );
}
