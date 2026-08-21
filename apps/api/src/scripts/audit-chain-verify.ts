/**
 * Audit chain integrity verifier — runs weekly in CI (Gate 10) and on demand.
 *
 * Algorithm:
 *   1. Enumerate every distinct (orgId | null, regionCode) chain scope in the DB.
 *   2. For each scope, replay ALL rows in insert order and recompute every rowHash.
 *   3. Build a Merkle root for each region from the tip-hashes of each chain in
 *      that region.  Write roots to docs/audits/merkle-roots/<region>/<YYYY-Www>.json.
 *
 * Exit 0 → all chains intact.
 * Exit 1 → at least one chain is broken; details printed to stderr.
 *
 * Usage:
 *   pnpm --filter api audit:verify
 *   DATABASE_URL=... AUDIT_CHAIN_SECRET=... tsx src/scripts/audit-chain-verify.ts
 */

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { computeRowHash, GENESIS_PREV_HASH } from '@d2d/shared-utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../..');
const MERKLE_ROOT_DIR = path.join(REPO_ROOT, 'docs', 'audits', 'merkle-roots');

const prisma = new PrismaClient();

function isoWeek(): string {
  const d = new Date();
  // ISO week: Thursday rule
  const thursday = new Date(d);
  thursday.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3);
  const year = thursday.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const week = Math.ceil(
    ((thursday.getTime() - jan4.getTime()) / 86400000 + ((jan4.getDay() + 6) % 7) + 1) / 7,
  );
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function merkleRoot(hashes: string[]): string {
  if (hashes.length === 0) return GENESIS_PREV_HASH;
  if (hashes.length === 1) return hashes[0]!;
  const concat = hashes.sort().join('|');
  return createHash('sha256').update(concat).digest('hex');
}

async function main(): Promise<void> {
  const secret = process.env['AUDIT_CHAIN_SECRET'];
  if (!secret) {
    console.error('❌  AUDIT_CHAIN_SECRET env var is required');
    process.exit(1);
  }

  // Enumerate all chain scopes: (orgId, regionCode) pairs + platform-level (orgId=null) per region.
  const scopes = await prisma.$queryRaw<Array<{ orgId: string | null; regionCode: string }>>`
    SELECT DISTINCT "orgId", "regionCode"
    FROM "AuditEvent"
    ORDER BY "regionCode", "orgId" NULLS FIRST
  `;

  if (scopes.length === 0) {
    console.log('✅  Audit chain: 0 scopes to verify (empty DB — trivially intact).');
    await prisma.$disconnect();
    process.exit(0);
  }

  console.log(`Verifying ${scopes.length} audit chain scope(s)…`);

  let broken = 0;
  // region → list of tip hashes (one per scope)
  const tipsByRegion = new Map<string, string[]>();

  for (const scope of scopes) {
    const where = scope.orgId
      ? { orgId: scope.orgId }
      : {
          orgId: null as null,
          regionCode: scope.regionCode as import('@prisma/client').RegionCode,
        };

    const rows = await prisma.auditEvent.findMany({
      where,
      orderBy: { id: 'asc' },
      select: {
        ulid: true,
        orgId: true,
        regionCode: true,
        actorUserId: true,
        action: true,
        resourceType: true,
        resourceId: true,
        beforeJson: true,
        afterJson: true,
        metadata: true,
        occurredAt: true,
        prevHash: true,
        rowHash: true,
      },
    });

    const label = scope.orgId
      ? `org=${scope.orgId} region=${scope.regionCode}`
      : `platform region=${scope.regionCode}`;

    let expectedPrev = GENESIS_PREV_HASH;
    let firstBroken: string | null = null;
    let count = 0;

    for (const row of rows) {
      count++;
      const forHash = {
        id: row.ulid,
        orgId: row.orgId,
        regionCode: row.regionCode,
        actorUserId: row.actorUserId,
        action: row.action,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        beforeJson: row.beforeJson ?? null,
        afterJson: row.afterJson ?? null,
        metadata: (row.metadata as Record<string, unknown>) ?? {},
        occurredAt: row.occurredAt.toISOString(),
      };
      const expected = computeRowHash(expectedPrev, forHash, secret);
      if (row.prevHash !== expectedPrev || expected !== row.rowHash) {
        firstBroken = row.ulid;
        broken++;
        console.error(`❌  BROKEN  [${label}]  first bad row ulid=${row.ulid}  (row ${count})`);
        console.error(`    stored  prevHash=${row.prevHash}`);
        console.error(`    expected prevHash=${expectedPrev}`);
        console.error(`    stored  rowHash=${row.rowHash}`);
        console.error(`    expected rowHash=${expected}`);
        break;
      }
      expectedPrev = row.rowHash;
    }

    if (!firstBroken) {
      const tipHash = rows.length > 0 ? rows[rows.length - 1]!.rowHash : GENESIS_PREV_HASH;
      const region = scope.regionCode;
      if (!tipsByRegion.has(region)) tipsByRegion.set(region, []);
      tipsByRegion.get(region)!.push(tipHash);
      console.log(`✅  OK   [${label}]  ${count} rows`);
    }
  }

  // Write Merkle roots for intact regions.
  const week = isoWeek();
  for (const [region, tips] of tipsByRegion) {
    const root = merkleRoot(tips);
    const dir = path.join(MERKLE_ROOT_DIR, region);
    mkdirSync(dir, { recursive: true });
    const outPath = path.join(dir, `${week}.json`);
    const payload = {
      region,
      week,
      generatedAt: new Date().toISOString(),
      scopeCount: tips.length,
      merkleRoot: root,
    };
    writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n');
    console.log(`📄  Merkle root for ${region}: ${root}  → ${outPath}`);
  }

  await prisma.$disconnect();

  if (broken > 0) {
    console.error(`\n❌  ${broken} chain scope(s) BROKEN — audit chain integrity violation.`);
    process.exit(1);
  }

  console.log(`\n✅  All ${scopes.length} audit chain scope(s) intact.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error in audit-chain-verify:', err);
  process.exit(1);
});
