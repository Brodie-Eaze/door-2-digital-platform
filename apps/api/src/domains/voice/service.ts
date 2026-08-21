/**
 * ============================================================================
 *  VOICE CAPTURE — DOOR-CONVERSATION RECORDINGS  (CAPTURE SCAFFOLD)
 * ============================================================================
 *
 *  ⚠️  LEGAL — ALL-PARTY-CONSENT RECORDING RISK. READ BEFORE ENABLING. ⚠️
 *
 *  This domain captures audio of in-person door conversations for a FUTURE
 *  conversation-intelligence ML pipeline. Recording a conversation is a
 *  wiretap-law question, and many US states require ALL PARTIES to consent to
 *  being recorded (two-party / all-party states include CA, FL, PA, IL, WA,
 *  MA, MD, MI, MT, NH, CT, OR, and more). Recording the householder without
 *  their consent in one of those states can be a CRIMINAL offence and a civil
 *  liability, not merely a policy violation.
 *
 *  Because of that, this feature is SAFE-BY-DEFAULT and DOUBLE-GATED:
 *
 *    1. FEATURE FLAG  — the upload path is DISABLED unless
 *       `process.env.D2D_VOICE_ENABLED === "true"`. Default = disabled →
 *       POST returns 403 voice-capture-disabled.
 *    2. CONSENT GATE  — even when enabled, POST is REJECTED (422
 *       voice-consent-required) unless `body.consentObtained === true`. The
 *       obtained-consent flag is persisted on the row for the audit trail.
 *
 *  DO NOT flip `D2D_VOICE_ENABLED` on in any environment until:
 *    • legal counsel has signed off on the capture flow, AND
 *    • a per-state consent configuration exists (so the app does not even
 *      offer recording in all-party states without an explicit, recorded
 *      verbal/written all-party consent), AND
 *    • the consent-capture UX is wired into the knocker app.
 *
 *  The `transcript`/`analysis` columns are written ONLY by the downstream ML
 *  pipeline and are PII — they are never returned by the metadata endpoints.
 * ============================================================================
 *
 * READS use the tenant-scoped `prisma()`-derived delegate (the `$extends`
 * injector auto-ANDs `orgId` into every `where`, mirroring catalog/lead);
 * WRITES go through `tenantTx(orgId, …)` so Postgres RLS pins every row + the
 * AuditService chain captures the mutation (mirrors field-signup). NEVER
 * bypass RLS — the orgId is ALWAYS taken from the authenticated principal,
 * never the request body.
 */
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { RegionCode } from '@prisma/client';
import { newId, Problems, ProblemError } from '@d2d/shared-utils';
import { prisma, tenantTx } from '../../config/db';
import { AuditService } from '../audit/service';
import type { CreateVoiceRecordingRequest, ListVoiceRecordingsQuery } from './schemas';

interface ActorContext {
  userId: string;
  orgId: string;
  regionCode: RegionCode;
}

/**
 * Feature flag — the audio upload path is DISABLED by default. Only `"true"`
 * (exact string) enables it. Read at call time (not module load) so tests /
 * ops can toggle without a restart.
 */
export function voiceCaptureEnabled(): boolean {
  return process.env.D2D_VOICE_ENABLED === 'true';
}

// ───────────────────────────────────────────────────────────────────────────
// BlobStore — dev-only local blob seam.
//
// In DEV we persist the raw audio to the on-disk .blobstore and store only the
// storage KEY on the row. The interface below is the seam: in PROD this is
// swapped for an S3-backed implementation where the client uploads directly via
// a presigned PUT URL (the API never proxies the bytes) and the same storageKey
// is recorded. Keep this helper LOCAL to the voice domain — do not import a
// shared blob client across domains.
// ───────────────────────────────────────────────────────────────────────────

interface BlobStore {
  put(storageKey: string, bytes: Buffer): Promise<void>;
  get(storageKey: string): Promise<Buffer>;
}

// Dev blob root: apps/api/.blobstore. The api runs from apps/api, so cwd-relative
// keeps this ESM-safe (__dirname is undefined in ES module scope). Mirrors the
// photo domain's BLOB_ROOT.
const DEV_BLOB_ROOT = path.resolve(process.cwd(), '.blobstore');

class LocalBlobStore implements BlobStore {
  constructor(private readonly root: string) {}

  private resolve(storageKey: string): string {
    // Defence-in-depth: storageKey is server-generated (org/<orgId>/voice/<id>.m4a)
    // so it can't escape the root, but normalise + assert containment anyway.
    const full = path.resolve(this.root, storageKey);
    if (full !== this.root && !full.startsWith(this.root + path.sep)) {
      throw new ProblemError(Problems.validation('invalid storage key'));
    }
    return full;
  }

  async put(storageKey: string, bytes: Buffer): Promise<void> {
    const full = this.resolve(storageKey);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, bytes);
  }

  async get(storageKey: string): Promise<Buffer> {
    const full = this.resolve(storageKey);
    try {
      return await fs.readFile(full);
    } catch {
      throw new ProblemError(Problems.notFound('VoiceRecording audio'));
    }
  }
}

const blobStore: BlobStore = new LocalBlobStore(DEV_BLOB_ROOT);

// ───────────────────────────────────────────────────────────────────────────
// Public shapes
// ───────────────────────────────────────────────────────────────────────────

/** Metadata-only projection — NEVER includes transcript/analysis (PII, ML). */
export interface VoiceRecordingPublic {
  id: string;
  knockId: string | null;
  clientKnockId: string | null;
  durationMs: number | null;
  capturedAt: string;
  consentObtained: boolean;
  transcriptionStatus: string;
  processedAt: string | null;
}

/** Raw audio + its content type, for the ML pipeline (GET /:id/raw). */
export interface VoiceRecordingAudio {
  bytes: Buffer;
  contentType: string;
  storageKey: string;
}

// ───────────────────────────────────────────────────────────────────────────
// Create — flag + consent gated (the route enforces both BEFORE calling this;
// we re-assert here as defence-in-depth so the service is safe on its own).
// ───────────────────────────────────────────────────────────────────────────

export async function captureVoiceRecording(
  input: CreateVoiceRecordingRequest,
  actor: ActorContext,
): Promise<{ id: string; storageKey: string }> {
  // SAFETY (belt + suspenders) — the route gates these first, but the service
  // refuses to write a recording if the flag is off or consent is not true.
  if (!voiceCaptureEnabled()) {
    throw new ProblemError(Problems.forbidden('Voice capture is disabled'));
  }
  if (input.consentObtained !== true) {
    throw new ProblemError(Problems.validation('All-party consent is required to record'));
  }

  const id = newId('vrc');
  const storageKey = `org/${actor.orgId}/voice/${id}.m4a`;

  // Decode the dev-path inline audio. Prod path = client PUTs to S3 presigned
  // URL and never sends bytes through this API.
  const bytes = Buffer.from(input.audioBase64, 'base64');
  if (bytes.length === 0) {
    throw new ProblemError(Problems.validation('audioBase64 did not decode to any bytes'));
  }

  // Write the blob FIRST (outside the tx). If the DB write fails the orphan
  // blob is harmless (no row references it); if we wrote the row first and the
  // blob failed we'd have a row pointing at nothing.
  await blobStore.put(storageKey, bytes);

  const capturedAt = new Date(input.capturedAt);

  // SEC-005 — tenant-pinned TX so Postgres RLS scopes every row to actor.orgId.
  await tenantTx(actor.orgId, async (tx) => {
    await tx.voiceRecording.create({
      data: {
        id,
        orgId: actor.orgId,
        userId: actor.userId, // the knocker uploads their OWN recording
        regionCode: actor.regionCode,
        knockId: input.knockId ?? null,
        clientKnockId: input.clientKnockId ?? null,
        storageKey,
        durationMs: input.durationMs ?? null,
        capturedAt,
        consentObtained: input.consentObtained, // persisted for the audit trail
        transcriptionStatus: 'pending', // ML pipeline flips this later
      },
    });

    await AuditService.recordEvent(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'voice.captured',
      resourceType: 'VoiceRecording',
      resourceId: id,
      afterJson: {
        knockId: input.knockId ?? null,
        clientKnockId: input.clientKnockId ?? null,
        storageKey,
        durationMs: input.durationMs ?? null,
        capturedAt: capturedAt.toISOString(),
        consentObtained: input.consentObtained,
        byteLength: bytes.length,
        // NEVER log audio bytes / transcript — metadata only.
      },
    });
  });

  return { id, storageKey };
}

// ───────────────────────────────────────────────────────────────────────────
// List — tenant-scoped, metadata only.
// ───────────────────────────────────────────────────────────────────────────

export async function listVoiceRecordings(
  query: ListVoiceRecordingsQuery,
  actor: ActorContext,
): Promise<{ data: VoiceRecordingPublic[]; nextCursor: string | null }> {
  // Cap the page at 100 (the prompt's cursor cap) regardless of the requested
  // limit, then over-fetch by one to detect a further page.
  const limit = Math.min(query.limit, 100);

  const rows = await prisma().voiceRecording.findMany({
    where: {
      orgId: actor.orgId,
      ...(query.knockId && { knockId: query.knockId }),
      ...(query.status && { transcriptionStatus: query.status }),
    },
    take: limit + 1,
    ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    orderBy: { id: 'asc' },
    // Explicit select — the metadata projection NEVER reads transcript/analysis.
    select: {
      id: true,
      knockId: true,
      clientKnockId: true,
      durationMs: true,
      capturedAt: true,
      consentObtained: true,
      transcriptionStatus: true,
      processedAt: true,
    },
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (slice[slice.length - 1]?.id ?? null) : null;
  return { data: slice.map(toPublic), nextCursor };
}

// ───────────────────────────────────────────────────────────────────────────
// Raw audio — tenant-scoped fetch for the ML pipeline. Cross-org id → 404.
// ───────────────────────────────────────────────────────────────────────────

export async function getVoiceRecordingAudio(
  id: string,
  actor: ActorContext,
): Promise<VoiceRecordingAudio> {
  // Tenant-scoped read (the `$extends` injector ANDs orgId in) so a cross-tenant
  // id is indistinguishable from a non-existent one — returns null → 404.
  const row = await prisma().voiceRecording.findFirst({
    where: { id, orgId: actor.orgId },
    select: { storageKey: true },
  });
  if (!row) throw new ProblemError(Problems.notFound('VoiceRecording', id));

  const bytes = await blobStore.get(row.storageKey);
  return { bytes, contentType: 'audio/m4a', storageKey: row.storageKey };
}

function toPublic(r: {
  id: string;
  knockId: string | null;
  clientKnockId: string | null;
  durationMs: number | null;
  capturedAt: Date;
  consentObtained: boolean;
  transcriptionStatus: string;
  processedAt: Date | null;
}): VoiceRecordingPublic {
  return {
    id: r.id,
    knockId: r.knockId,
    clientKnockId: r.clientKnockId,
    durationMs: r.durationMs,
    capturedAt: r.capturedAt.toISOString(),
    consentObtained: r.consentObtained,
    transcriptionStatus: r.transcriptionStatus,
    processedAt: r.processedAt?.toISOString() ?? null,
  };
}
