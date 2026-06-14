/**
 * Photo service — property photos captured at every knock (KnockPhoto).
 *
 * Core data-company capture: a Knocker photographs the property whenever they
 * knock, and we collect + hold all of it. The image *bytes* live in blob
 * storage (dev: fs under `.blobstore`; prod: S3); the row holds the metadata +
 * `storageKey` pointer. ML writes `mlLabels` / `mlProcessedAt` later — capture
 * never sets them.
 *
 * Isolation discipline (mirrors catalog + field-signup):
 *   - WRITES go through `tenantTx(orgId, …)` so Postgres RLS pins every row and
 *     the AuditService hash-chain records the capture.
 *   - READS use the tenant-scoped `prisma()` `$extends` delegate, which auto-ANDs
 *     `orgId` into every `where` — a photo in another org is invisible (404).
 *   - `orgId` / `userId` / `regionCode` come from the authenticated principal,
 *     NEVER from the request body.
 *
 * Money: n/a here (KnockPhoto carries no money columns). `byteSize` is a plain
 * Int (decoded buffer length), surfaced as a JS number on the wire.
 * Dates: ISO-8601 strings on the wire (capturedAt, mlProcessedAt).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { RegionCode } from '@prisma/client';
import { newId, Problems, ProblemError } from '@d2d/shared-utils';
import { prisma, tenantTx } from '../../config/db';
import { AuditService } from '../audit/service';
import type { CreatePhotoRequest, ListPhotosQuery, PhotoContentType } from './schemas';

interface ActorContext {
  userId: string;
  orgId: string;
  regionCode: RegionCode;
}

// ───────────────────────────────────────────────────────────────────────────
// BlobStore — the binary-storage seam.
//
// DEV: write bytes to the local filesystem under `.blobstore/<storageKey>`.
// PROD: swap this implementation for S3. The clean swap is:
//   put(): instead of writing bytes, return an S3 *presigned PUT* URL for the
//          key so the device uploads the image directly to S3 (the API never
//          proxies the bytes); the row stores only the key.
//   get(): stream the object body from `s3.getObject({ Bucket, Key })`.
// The `storageKey` shape (`org/<orgId>/knockphoto/<id>.jpg`) is bucket-relative
// and already S3-safe, so prod needs no key changes — only this class.
// ───────────────────────────────────────────────────────────────────────────

const BLOB_ROOT = join(process.cwd(), '.blobstore');

const BlobStore = {
  /** Persist decoded image bytes at `storageKey`. Dev: fs; prod: S3 presigned PUT. */
  async put(storageKey: string, bytes: Buffer): Promise<void> {
    const abs = join(BLOB_ROOT, storageKey);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, bytes);
  },

  /** Read the raw bytes at `storageKey`. Dev: fs; prod: s3.getObject body. */
  async get(storageKey: string): Promise<Buffer> {
    const abs = join(BLOB_ROOT, storageKey);
    return readFile(abs);
  },
};

export interface PhotoCaptureResult {
  id: string;
  storageKey: string;
}

/**
 * Metadata-only projection — the list endpoint never returns image bytes.
 * Field names are the iOS contract; `byteSize` is a JS integer of bytes and
 * the dates are ISO-8601 strings.
 */
export interface PhotoMetadataPublic {
  id: string;
  knockId: string | null;
  clientKnockId: string | null;
  storageKey: string;
  capturedAt: string;
  latitude: number | null;
  longitude: number | null;
  contentType: string;
  byteSize: number | null;
  mlProcessedAt: string | null;
}

/** The bytes + content-type needed to stream a raw photo back. */
export interface PhotoRaw {
  bytes: Buffer;
  contentType: string;
}

/** File extension for the stored object, derived from the content-type. */
function extFor(contentType: PhotoContentType): string {
  switch (contentType) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
      return 'heic';
    case 'image/jpeg':
    default:
      return 'jpg';
  }
}

/**
 * Capture a knock photo. Decodes the base64 image, writes the bytes to blob
 * storage, and creates the KnockPhoto row inside a tenant-pinned TX with an
 * audit event. The image itself is redacted from the audit afterJson — we log
 * the pointer + provenance, never the bytes.
 */
export async function capturePhoto(
  input: CreatePhotoRequest,
  actor: ActorContext,
): Promise<PhotoCaptureResult> {
  const contentType: PhotoContentType = input.contentType ?? 'image/jpeg';

  // Decode the base64 image. `Buffer.from(_, 'base64')` decodes leniently, so a
  // payload that decodes to zero bytes means it carried no real image — reject
  // rather than store an empty object the raw endpoint would later 500 on.
  const bytes = Buffer.from(input.imageBase64, 'base64');
  if (bytes.length === 0) {
    throw new ProblemError(Problems.validation('imageBase64 did not decode to any bytes'));
  }

  const id = newId('kph');
  // Bucket-relative, S3-safe key: tenant-partitioned so prod lifecycle/replication
  // rules can target a single org's objects.
  const storageKey = `org/${actor.orgId}/knockphoto/${id}.${extFor(contentType)}`;

  // Write bytes BEFORE the row so a row never points at a missing object. (If
  // the TX then fails, we have an orphan blob, which is harmless + reclaimable —
  // far better than a row whose `GET /:id/raw` 500s.)
  await BlobStore.put(storageKey, bytes);

  await tenantTx(actor.orgId, async (tx) => {
    await tx.knockPhoto.create({
      data: {
        id,
        orgId: actor.orgId,
        regionCode: actor.regionCode,
        userId: actor.userId,
        clientKnockId: input.clientKnockId ?? null,
        knockId: input.knockId ?? null,
        storageKey,
        contentType,
        byteSize: bytes.length,
        capturedAt: new Date(input.capturedAt),
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        addressLine: input.addressLine ?? null,
        // mlLabels / mlProcessedAt are written by the ML pipeline, not capture.
      },
    });

    await AuditService.recordEvent(tx, {
      orgId: actor.orgId,
      regionCode: actor.regionCode,
      actorUserId: actor.userId,
      action: 'knock_photo.captured',
      resourceType: 'KnockPhoto',
      resourceId: id,
      afterJson: {
        // Image bytes redacted — we record the pointer + provenance only.
        storageKey,
        contentType,
        byteSize: bytes.length,
        capturedAt: new Date(input.capturedAt).toISOString(),
        clientKnockId: input.clientKnockId ?? null,
        knockId: input.knockId ?? null,
        hasLocation: input.latitude !== undefined && input.longitude !== undefined,
        hasAddressLine: input.addressLine !== undefined,
      },
    });
  });

  return { id, storageKey };
}

/**
 * List captured photos for the org (metadata only — no bytes). Filter by
 * `clientKnockId`, `knockId`, or a `since` watermark on `capturedAt`.
 * Cursor-paginated on the stable `id` (cap 100). Tenant-scoped by the
 * `$extends` injector.
 */
export async function listPhotos(
  query: ListPhotosQuery,
  actor: ActorContext,
): Promise<PhotoMetadataPublic[]> {
  const rows = await prisma().knockPhoto.findMany({
    where: {
      orgId: actor.orgId,
      ...(query.clientKnockId && { clientKnockId: query.clientKnockId }),
      ...(query.knockId && { knockId: query.knockId }),
      ...(query.since && { capturedAt: { gte: new Date(query.since) } }),
    },
    take: query.limit,
    ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    orderBy: { id: 'asc' },
  });
  return rows.map(toMetadataPublic);
}

/**
 * Load the raw bytes for one photo. The tenant-scoped read 404s a photo that
 * isn't in the caller's org (the `$extends` injector ANDs orgId into the
 * lookup), so cross-tenant ids never resolve.
 */
export async function getPhotoRaw(id: string, actor: ActorContext): Promise<PhotoRaw> {
  const row = await prisma().knockPhoto.findFirst({
    where: { id, orgId: actor.orgId },
    select: { storageKey: true, contentType: true },
  });
  if (!row) throw new ProblemError(Problems.notFound('KnockPhoto', id));

  const bytes = await BlobStore.get(row.storageKey);
  return { bytes, contentType: row.contentType };
}

function toMetadataPublic(r: {
  id: string;
  knockId: string | null;
  clientKnockId: string | null;
  storageKey: string;
  capturedAt: Date;
  latitude: number | null;
  longitude: number | null;
  contentType: string;
  byteSize: number | null;
  mlProcessedAt: Date | null;
}): PhotoMetadataPublic {
  return {
    id: r.id,
    knockId: r.knockId,
    clientKnockId: r.clientKnockId,
    storageKey: r.storageKey,
    capturedAt: r.capturedAt.toISOString(),
    latitude: r.latitude,
    longitude: r.longitude,
    contentType: r.contentType,
    byteSize: r.byteSize,
    mlProcessedAt: r.mlProcessedAt?.toISOString() ?? null,
  };
}
