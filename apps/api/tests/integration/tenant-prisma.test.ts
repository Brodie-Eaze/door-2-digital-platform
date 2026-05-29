/**
 * SEC-005 — tenant-isolation "suspenders" probe.
 *
 * Proves the `tenantPrisma(orgId)` `$extends` injector forces `where: { orgId }`
 * on reads/updates/deletes and stamps `orgId` on writes, so a forgotten manual
 * filter in a domain service can never leak across tenants.
 *
 * Uses `Lead` as the orgId-bearing model (plain `orgId` column + `@id` on `id`,
 * which exercises the findUnique→findFirst rewrite). Seeds two orgs directly via
 * the raw client, then attacks across the tenant boundary via tenantPrisma.
 *
 * Requires a live test DB (postgres `d2d_test`) — see tests/setup.ts. If the DB
 * is unreachable the suite errors at beforeAll rather than silently passing.
 */
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma, tenantPrisma } from '../../src/config/db';
import { truncateAll, teardown } from '../helpers/app';

const orgA = 'org_TEST_TENANT_A';
const orgB = 'org_TEST_TENANT_B';
const leadA = 'lead_TEST_A_1';
const leadB = 'lead_TEST_B_1';

async function seedOrg(id: string): Promise<void> {
  await prisma().org.create({
    data: {
      id,
      legalName: `Legal ${id}`,
      tradingName: `Trade ${id}`,
      vertical: 'commercial',
      type: 'client',
      regionCode: 'US',
    },
  });
}

async function seedLead(id: string, orgId: string): Promise<void> {
  await prisma().lead.create({
    data: {
      id,
      orgId,
      regionCode: 'US',
      vertical: 'commercial',
      givenName: 'Seed',
      familyName: orgId,
    },
  });
}

beforeAll(async () => {
  // Touch the connection so a dead DB fails loudly here, not mid-assertion.
  await prisma().$queryRaw`SELECT 1`;
});

afterAll(async () => {
  await teardown();
});

beforeEach(async () => {
  await truncateAll();
  await seedOrg(orgA);
  await seedOrg(orgB);
  await seedLead(leadA, orgA);
  await seedLead(leadB, orgB);
});

describe('tenantPrisma — read isolation', () => {
  it('findMany returns only the caller-org rows', async () => {
    const rows = await tenantPrisma(orgA).lead.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(leadA);
    expect(rows[0]?.orgId).toBe(orgA);
  });

  it('findMany merges injected orgId with caller-supplied where (no clobber)', async () => {
    const rows = await tenantPrisma(orgA).lead.findMany({
      where: { givenName: 'Seed' },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(leadA);
  });

  it('count is scoped to the caller org', async () => {
    expect(await tenantPrisma(orgA).lead.count()).toBe(1);
    expect(await tenantPrisma(orgB).lead.count()).toBe(1);
  });

  it('findUnique cannot read another org row (findFirst rewrite + orgId AND)', async () => {
    // orgA asking for orgB's row by its primary key → null, not the row.
    const leaked = await tenantPrisma(orgA).lead.findUnique({ where: { id: leadB } });
    expect(leaked).toBeNull();
    // Own row still resolves.
    const own = await tenantPrisma(orgA).lead.findUnique({ where: { id: leadA } });
    expect(own?.id).toBe(leadA);
  });

  it('findUniqueOrThrow on a foreign row throws (not found in this tenant)', async () => {
    await expect(
      tenantPrisma(orgA).lead.findUniqueOrThrow({ where: { id: leadB } }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });
});

describe('tenantPrisma — write stamping + isolation', () => {
  it('create stamps the caller orgId when absent', async () => {
    const created = await tenantPrisma(orgA).lead.create({
      data: {
        id: 'lead_TEST_A_2',
        regionCode: 'US',
        vertical: 'commercial',
        givenName: 'Created',
        familyName: 'NoOrg',
      } as Prisma.LeadUncheckedCreateInput,
    });
    expect(created.orgId).toBe(orgA);
  });

  it('create with a matching explicit orgId is allowed (belt + suspenders)', async () => {
    const created = await tenantPrisma(orgA).lead.create({
      data: {
        id: 'lead_TEST_A_3',
        orgId: orgA,
        regionCode: 'US',
        vertical: 'commercial',
        givenName: 'Created',
        familyName: 'WithOrg',
      },
    });
    expect(created.orgId).toBe(orgA);
  });

  it('create with a conflicting explicit orgId throws (caller bug)', async () => {
    await expect(
      tenantPrisma(orgA).lead.create({
        data: {
          id: 'lead_TEST_A_4',
          orgId: orgB, // spoofed
          regionCode: 'US',
          vertical: 'commercial',
          givenName: 'Spoof',
          familyName: 'Org',
        },
      }),
    ).rejects.toThrow(/does not match tenant orgId/);
  });

  it('findMany with a conflicting explicit orgId in where throws', async () => {
    await expect(tenantPrisma(orgA).lead.findMany({ where: { orgId: orgB } })).rejects.toThrow(
      /does not match tenant orgId/,
    );
  });

  it('cannot update another org row — updateMany affects 0 rows', async () => {
    const res = await tenantPrisma(orgA).lead.updateMany({
      where: { id: leadB },
      data: { status: 'lost' },
    });
    expect(res.count).toBe(0);
    // Confirm orgB's row is untouched (read it back with the raw client).
    const untouched = await prisma().lead.findUnique({ where: { id: leadB } });
    expect(untouched?.status).toBe('new');
  });

  it('cannot delete another org row — deleteMany affects 0 rows', async () => {
    const res = await tenantPrisma(orgA).lead.deleteMany({ where: { id: leadB } });
    expect(res.count).toBe(0);
    expect(await prisma().lead.findUnique({ where: { id: leadB } })).not.toBeNull();
  });
});

describe('tenantPrisma — control-plane passthrough', () => {
  it('models without an orgId column are not scoped (Org is global)', async () => {
    // Org has no orgId field, so tenantPrisma(orgA) must still see both orgs.
    const orgs = await tenantPrisma(orgA).org.findMany();
    const ids = orgs.map((o) => o.id);
    expect(ids).toContain(orgA);
    expect(ids).toContain(orgB);
  });
});
