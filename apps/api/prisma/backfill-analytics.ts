/**
 * backfill-analytics.ts — one-shot, idempotent derivation of AnalyticsEvent rows
 * from EXISTING OLTP data so the data team has a populated warehouse stream the
 * moment they plug in (BigQuery/Snowflake + dbt), without backfilling event
 * emission across every domain first.
 *
 * Derivations:
 *   Knock        -> "knock"          (payload: disposition, geo, capturedAt, territoryId)
 *   Conversion   -> "sale"           (payload: amountCents, attributionSource, type)
 *   KnockSession -> "session_start"  (payload: territoryId, deviceId, startedAt)
 *                -> "session_end"    (payload: territoryId, endedAt, durationMs) — only if ended
 *
 * Idempotency: every derived row is keyed by (entityType, entityId, eventType).
 * We load the set of already-existing keys up front and skip any that exist, so
 * re-running the script never double-inserts. New IDs use newId('aev').
 *
 * Money: amountCents is BigInt in the DB -> stored as a JS Number of cents on
 * the flat payload (Number(bigint)) so the warehouse never sees BigInt JSON.
 * Dates: all timestamps on the payload are ISO-8601 strings.
 *
 *   Run:  pnpm tsx prisma/backfill-analytics.ts
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import { newId } from '@d2d/shared-utils';

const prisma = new PrismaClient();

/** Stable dedupe key: entityType + entityId + eventType. */
function dedupeKey(entityType: string, entityId: string, eventType: string): string {
  return `${entityType}::${entityId}::${eventType}`;
}

/** BigInt cents -> JS number of cents for the flat warehouse payload. */
function toCents(amountCents: bigint): number {
  return Number(amountCents);
}

async function loadExistingKeys(): Promise<Set<string>> {
  // Only rows that were themselves derived (have entityType+entityId) can clash
  // with a re-run; load just those three columns for the whole table.
  const rows = await prisma.analyticsEvent.findMany({
    where: { entityType: { not: null }, entityId: { not: null } },
    select: { entityType: true, entityId: true, eventType: true },
  });
  const set = new Set<string>();
  for (const r of rows) {
    if (r.entityType && r.entityId) {
      set.add(dedupeKey(r.entityType, r.entityId, r.eventType));
    }
  }
  return set;
}

interface DerivedEvent {
  orgId: string;
  regionCode: Prisma.AnalyticsEventCreateManyInput['regionCode'];
  userId: string | null;
  eventType: string;
  entityType: string;
  entityId: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
}

function toCreateInput(e: DerivedEvent): Prisma.AnalyticsEventCreateManyInput {
  return {
    id: newId('aev'),
    orgId: e.orgId,
    regionCode: e.regionCode,
    userId: e.userId,
    eventType: e.eventType,
    entityType: e.entityType,
    entityId: e.entityId,
    occurredAt: e.occurredAt,
    payload: e.payload as Prisma.InputJsonValue,
    // shippedAt left null — these are fresh, unshipped events for the warehouse
    // sink to drain via GET /v1/analytics/export.
  };
}

async function main(): Promise<void> {
  const existing = await loadExistingKeys();
  const pending: DerivedEvent[] = [];
  const counts = {
    knock: 0,
    sale: 0,
    session_start: 0,
    session_end: 0,
    skippedExisting: 0,
  };

  const push = (e: DerivedEvent): void => {
    const key = dedupeKey(e.entityType, e.entityId, e.eventType);
    if (existing.has(key)) {
      counts.skippedExisting += 1;
      return;
    }
    // Guard against duplicate keys within THIS run too (e.g. dirty data).
    existing.add(key);
    pending.push(e);
  };

  // ── Knock -> "knock" ──────────────────────────────────────────────────────
  const knocks = await prisma.knock.findMany({
    select: {
      id: true,
      orgId: true,
      regionCode: true,
      userId: true,
      territoryId: true,
      disposition: true,
      geo: true,
      capturedAt: true,
    },
  });
  for (const k of knocks) {
    push({
      orgId: k.orgId,
      regionCode: k.regionCode,
      userId: k.userId,
      eventType: 'knock',
      entityType: 'Knock',
      entityId: k.id,
      occurredAt: k.capturedAt,
      payload: {
        disposition: k.disposition,
        geo: k.geo,
        capturedAt: k.capturedAt.toISOString(),
        territoryId: k.territoryId,
      },
    });
    counts.knock += 1;
  }

  // ── Conversion -> "sale" ──────────────────────────────────────────────────
  // "sale" is the warehouse term for any closed conversion (donation or sale);
  // `type` distinguishes them on the flat payload.
  const conversions = await prisma.conversion.findMany({
    select: {
      id: true,
      orgId: true,
      regionCode: true,
      knockerId: true,
      amountCents: true,
      currency: true,
      attributionSource: true,
      type: true,
      signedAt: true,
    },
  });
  for (const c of conversions) {
    push({
      orgId: c.orgId,
      regionCode: c.regionCode,
      userId: c.knockerId,
      eventType: 'sale',
      entityType: 'Conversion',
      entityId: c.id,
      occurredAt: c.signedAt,
      payload: {
        amountCents: toCents(c.amountCents),
        currency: c.currency,
        attributionSource: c.attributionSource,
        type: c.type,
        signedAt: c.signedAt.toISOString(),
      },
    });
    counts.sale += 1;
  }

  // ── KnockSession -> "session_start" / "session_end" ───────────────────────
  const sessions = await prisma.knockSession.findMany({
    select: {
      id: true,
      orgId: true,
      regionCode: true,
      userId: true,
      territoryId: true,
      deviceId: true,
      startedAt: true,
      endedAt: true,
    },
  });
  for (const s of sessions) {
    push({
      orgId: s.orgId,
      regionCode: s.regionCode,
      userId: s.userId,
      eventType: 'session_start',
      entityType: 'KnockSession',
      entityId: s.id,
      occurredAt: s.startedAt,
      payload: {
        territoryId: s.territoryId,
        deviceId: s.deviceId,
        startedAt: s.startedAt.toISOString(),
      },
    });
    counts.session_start += 1;

    if (s.endedAt) {
      push({
        orgId: s.orgId,
        regionCode: s.regionCode,
        userId: s.userId,
        eventType: 'session_end',
        entityType: 'KnockSession',
        entityId: s.id,
        occurredAt: s.endedAt,
        payload: {
          territoryId: s.territoryId,
          startedAt: s.startedAt.toISOString(),
          endedAt: s.endedAt.toISOString(),
          durationMs: s.endedAt.getTime() - s.startedAt.getTime(),
        },
      });
      counts.session_end += 1;
    }
  }

  // Bulk insert the new rows. createMany is a single round-trip; skipDuplicates
  // guards the (unlikely) race where another run inserted between our key-load
  // and now — the dedupe key set is the primary guard.
  let inserted = 0;
  if (pending.length > 0) {
    const result = await prisma.analyticsEvent.createMany({
      data: pending.map(toCreateInput),
      skipDuplicates: true,
    });
    inserted = result.count;
  }

  /* eslint-disable no-console */
  console.log('backfill-analytics — derived AnalyticsEvent rows from OLTP:');
  console.log(`  knock          : ${counts.knock}`);
  console.log(`  sale           : ${counts.sale}`);
  console.log(`  session_start  : ${counts.session_start}`);
  console.log(`  session_end    : ${counts.session_end}`);
  console.log(`  skipped (existing, idempotent) : ${counts.skippedExisting}`);
  console.log(`  inserted this run              : ${inserted}`);
  /* eslint-enable no-console */
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
