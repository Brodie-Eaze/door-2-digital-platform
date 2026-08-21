/**
 * SEC-005 — Postgres Row-Level Security "belt" probe (the DATABASE-enforced floor).
 *
 * The tenantPrisma `$extends` injector (tenant-prisma.test.ts) proves the
 * APPLICATION layer forces `where: { orgId }` — the "suspenders". This suite
 * proves the "belt": even a client that COMPLETELY bypasses the app layer and
 * talks raw SQL to Postgres still cannot cross tenants, because the database
 * itself refuses. We prove it by connecting as the real production-shaped role
 * `d2d_app` (NON-owner, NOBYPASSRLS) — the only role RLS actually bites.
 *
 * WHY A SEPARATE ROLE
 *   The rls_belt migration uses ENABLE (not FORCE) RLS, so the table OWNER is
 *   exempt. Migrations/seeds/the current app connect as the owner (`d2d`) and
 *   stay green. RLS only ENFORCES for a non-owner without BYPASSRLS. So this
 *   test bootstraps `d2d_app` (idempotent, see prisma/rls/bootstrap-app-role.sql)
 *   and drives it through `runTenantTx`, which sets the transaction-local
 *   `app.current_org_id` GUC the policies read.
 *
 * GRACEFUL SKIP: bootstrapping the role needs a privileged connection (CREATE
 * ROLE). In CI the `d2d` service user is the container superuser; locally a
 * superuser is reachable via peer auth. If NO privileged connection is
 * reachable AND the role isn't already present, the suite skips with a logged
 * reason rather than failing — so it never goes red on an unprovisioned box,
 * but DOES run (and bite) everywhere the belt will actually ship.
 */
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { userInfo } from 'node:os';
import { prisma, runTenantTx } from '../../src/config/db';
import { truncateAll, teardown } from '../helpers/app';

const orgA = 'org_RLS_A';
const orgB = 'org_RLS_B';
const leadA = 'lead_RLS_A_1';
const leadB = 'lead_RLS_B_1';
// C2 — TerritoryClaim (table "territory_claims") was the last org-scoped table
// missing from the belt. These ids prove its tenant_isolation policy bites.
const claimA = 'claim_RLS_A_1';
const claimB = 'claim_RLS_B_1';

const APP_ROLE = 'd2d_app';
const APP_PASSWORD = process.env.D2D_APP_PASSWORD ?? 'd2d_app';

/** Build a connection URL for `role` against the same host/port/db as the test DB. */
function urlForRole(role: string, password?: string): string {
  const base = new URL(process.env.DATABASE_URL as string);
  base.username = role;
  base.password = password ?? '';
  return base.toString();
}

/** A PrismaClient connected as the non-owner app role (RLS enforced). */
function makeAppClient(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlForRole(APP_ROLE, APP_PASSWORD) } },
    log: ['error'],
  });
}

/**
 * Idempotently ensure the `d2d_app` role exists with DML grants, run from a
 * privileged connection. Statements mirror prisma/rls/bootstrap-app-role.sql
 * (kept inline so the test is self-contained and needs no shell/psql).
 */
async function bootstrapAppRole(superUrl: string): Promise<void> {
  const su = new PrismaClient({ datasources: { db: { url: superUrl } }, log: ['error'] });
  try {
    const dbRows = await su.$queryRawUnsafe<{ current_database: string }[]>(
      'SELECT current_database()',
    );
    const dbName = dbRows[0]!.current_database;
    const ownerRole = new URL(process.env.DATABASE_URL as string).username || 'd2d';
    // Escape single quotes in the password for the literal; APP_PASSWORD is a
    // known test/dev constant, not user input, but quote defensively anyway.
    const pwLit = `'${APP_PASSWORD.replace(/'/g, "''")}'`;
    const stmts = [
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${APP_ROLE}') THEN CREATE ROLE "${APP_ROLE}" LOGIN; END IF; END $$;`,
      `ALTER ROLE "${APP_ROLE}" WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD ${pwLit};`,
      `GRANT CONNECT ON DATABASE "${dbName}" TO "${APP_ROLE}";`,
      `GRANT USAGE ON SCHEMA public TO "${APP_ROLE}";`,
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${APP_ROLE}";`,
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${APP_ROLE}";`,
      `ALTER DEFAULT PRIVILEGES FOR ROLE "${ownerRole}" IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${APP_ROLE}";`,
      `ALTER DEFAULT PRIVILEGES FOR ROLE "${ownerRole}" IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO "${APP_ROLE}";`,
    ];
    for (const s of stmts) await su.$executeRawUnsafe(s);
  } finally {
    await su.$disconnect();
  }
}

/** Can we already log in as d2d_app? (role provisioned in a prior run / by CI setup) */
async function appRoleConnectable(): Promise<boolean> {
  const c = makeAppClient();
  try {
    await c.$queryRawUnsafe('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await c.$disconnect();
  }
}

/**
 * Ensure d2d_app is usable, trying privileged connections in order:
 *   1. RLS_SUPERUSER_URL (explicit override)
 *   2. DATABASE_URL itself (CI: the `d2d` service user is the superuser)
 *   3. peer/trust as the OS user (local dev: e.g. `Brodie` is a superuser)
 * Returns a skip-reason string if the belt can't be provisioned, else null.
 *
 * We ALWAYS (re)run the privileged bootstrap when a privileged connection is
 * reachable — even if the role already connects — because `GRANT … ON ALL
 * TABLES` is idempotent and is the ONLY thing that grants DML on tables created
 * AFTER a prior bootstrap (e.g. territory_claims, added later). Skipping the
 * grant-refresh when the role merely exists is what hid the missing grant. If no
 * privileged connection works but the role already connects, we accept that
 * (older provisioning) rather than fail the box.
 */
async function ensureAppRole(): Promise<string | null> {
  const candidates: string[] = [];
  if (process.env.RLS_SUPERUSER_URL) candidates.push(process.env.RLS_SUPERUSER_URL);
  if (process.env.DATABASE_URL) candidates.push(process.env.DATABASE_URL);
  candidates.push(urlForRole(userInfo().username)); // peer/trust, no password

  for (const url of candidates) {
    try {
      await bootstrapAppRole(url);
      if (await appRoleConnectable()) return null;
    } catch {
      // try the next privileged candidate
    }
  }
  // No privileged connection worked — accept a pre-provisioned role if present.
  if (await appRoleConnectable()) return null;
  return 'no privileged connection could provision the d2d_app role (RLS belt unprovable here)';
}

let app: PrismaClient | null = null;
let skipReason: string | null = null;

async function seed(): Promise<void> {
  for (const id of [orgA, orgB]) {
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
  await prisma().lead.create({
    data: {
      id: leadA,
      orgId: orgA,
      regionCode: 'US',
      vertical: 'commercial',
      givenName: 'Seed',
      familyName: 'A',
    },
  });
  await prisma().lead.create({
    data: {
      id: leadB,
      orgId: orgB,
      regionCode: 'US',
      vertical: 'commercial',
      givenName: 'Seed',
      familyName: 'B',
    },
  });
  // territory_claims has no FK to Territory (no relation in the model), so a
  // bare orgId-tagged claim per org is enough to probe the policy. expiresAt is
  // far-future so the row is "active" regardless of when the suite runs.
  const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  await prisma().territoryClaim.create({
    data: {
      id: claimA,
      orgId: orgA,
      territoryId: 'ter_RLS_A',
      userId: 'usr_RLS_A',
      userName: 'Knocker A',
      expiresAt: farFuture,
    },
  });
  await prisma().territoryClaim.create({
    data: {
      id: claimB,
      orgId: orgB,
      territoryId: 'ter_RLS_B',
      userId: 'usr_RLS_B',
      userName: 'Knocker B',
      expiresAt: farFuture,
    },
  });
}

beforeAll(async () => {
  await prisma().$queryRaw`SELECT 1`; // fail loud if DB is dead
  skipReason = await ensureAppRole();
  if (skipReason) {
    // eslint-disable-next-line no-console
    console.warn(`[rls-belt] SKIPPING RLS belt suite: ${skipReason}`);
    return;
  }
  app = makeAppClient();
});

afterAll(async () => {
  await app?.$disconnect();
  await teardown();
});

beforeEach(async () => {
  if (skipReason) return;
  await truncateAll();
  await seed();
});

describe('SEC-005 RLS belt — enforced for the non-owner d2d_app role', () => {
  it('the d2d_app role is NOT superuser and does NOT bypass RLS', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    const rows = await prisma().$queryRawUnsafe<{ rolsuper: boolean; rolbypassrls: boolean }[]>(
      `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname='${APP_ROLE}'`,
    );
    expect(rows[0]?.rolsuper).toBe(false);
    expect(rows[0]?.rolbypassrls).toBe(false);
  });

  it('DENY BY DEFAULT — with no org GUC set, the app role sees zero rows', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    // Direct read, no transaction, no GUC → policy compares against NULL → excluded.
    const rows = await app!.lead.findMany();
    expect(rows).toHaveLength(0);
    // …even though the owner can see both seeded rows.
    expect(await prisma().lead.count()).toBe(2);
  });

  it('runTenantTx(orgA) scopes the app role to org A rows only', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    const seen = await runTenantTx(app!, orgA, async (tx) => tx.lead.findMany());
    expect(seen).toHaveLength(1);
    expect(seen[0]?.id).toBe(leadA);

    const seenB = await runTenantTx(app!, orgB, async (tx) => tx.lead.findMany());
    expect(seenB).toHaveLength(1);
    expect(seenB[0]?.id).toBe(leadB);
  });

  it('cross-tenant READ is invisible — orgA tx cannot fetch orgB by primary key', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    const leaked = await runTenantTx(app!, orgA, async (tx) =>
      tx.lead.findUnique({ where: { id: leadB } }),
    );
    expect(leaked).toBeNull();
  });

  it('cross-tenant WRITE is refused — inserting an orgB-tagged row inside an orgA tx throws (WITH CHECK)', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    await expect(
      runTenantTx(app!, orgA, async (tx) =>
        tx.lead.create({
          data: {
            id: 'lead_RLS_SPOOF',
            orgId: orgB, // spoof another tenant
            regionCode: 'US',
            vertical: 'commercial',
            givenName: 'Spoof',
            familyName: 'B',
          },
        }),
      ),
    ).rejects.toThrow();
    // The owner confirms no spoofed row landed.
    expect(await prisma().lead.findUnique({ where: { id: 'lead_RLS_SPOOF' } })).toBeNull();
  });

  it('cross-tenant UPDATE/DELETE affect zero rows — orgB row is untouched by an orgA tx', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    const upd = await runTenantTx(app!, orgA, async (tx) =>
      tx.lead.updateMany({ where: { id: leadB }, data: { status: 'lost' } }),
    );
    expect(upd.count).toBe(0);

    const del = await runTenantTx(app!, orgA, async (tx) =>
      tx.lead.deleteMany({ where: { id: leadB } }),
    );
    expect(del.count).toBe(0);

    // Owner confirms orgB's row survived intact.
    const survivor = await prisma().lead.findUnique({ where: { id: leadB } });
    expect(survivor?.status).toBe('new');
  });

  it('a legitimate write inside the matching tenant tx succeeds and is scoped', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    const created = await runTenantTx(app!, orgA, async (tx) =>
      tx.lead.create({
        data: {
          id: 'lead_RLS_A_2',
          orgId: orgA,
          regionCode: 'US',
          vertical: 'commercial',
          givenName: 'Legit',
          familyName: 'A',
        },
      }),
    );
    expect(created.orgId).toBe(orgA);
    // Visible within orgA's scope, still invisible to orgB.
    const inA = await runTenantTx(app!, orgA, async (tx) => tx.lead.count());
    expect(inA).toBe(2);
    const inB = await runTenantTx(app!, orgB, async (tx) => tx.lead.count());
    expect(inB).toBe(1);
  });
});

describe('SEC-005 RLS belt — TerritoryClaim (C2 close-out, table "territory_claims")', () => {
  it('DENY BY DEFAULT — with no org GUC set, the app role sees zero claims', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    const rows = await app!.territoryClaim.findMany();
    expect(rows).toHaveLength(0);
    // …even though the owner can see both seeded claims.
    expect(await prisma().territoryClaim.count()).toBe(2);
  });

  it('runTenantTx(orgA) scopes claims to org A only', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    const seenA = await runTenantTx(app!, orgA, async (tx) => tx.territoryClaim.findMany());
    expect(seenA).toHaveLength(1);
    expect(seenA[0]?.id).toBe(claimA);

    const seenB = await runTenantTx(app!, orgB, async (tx) => tx.territoryClaim.findMany());
    expect(seenB).toHaveLength(1);
    expect(seenB[0]?.id).toBe(claimB);
  });

  it('cross-tenant READ is invisible — orgA tx cannot fetch orgB claim by primary key', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    const leaked = await runTenantTx(app!, orgA, async (tx) =>
      tx.territoryClaim.findUnique({ where: { id: claimB } }),
    );
    expect(leaked).toBeNull();
  });

  it('cross-tenant WRITE is refused — inserting an orgB-tagged claim inside an orgA tx throws (WITH CHECK)', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    await expect(
      runTenantTx(app!, orgA, async (tx) =>
        tx.territoryClaim.create({
          data: {
            id: 'claim_RLS_SPOOF',
            orgId: orgB, // spoof another tenant
            territoryId: 'ter_RLS_B',
            userId: 'usr_RLS_SPOOF',
            userName: 'Spoof',
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          },
        }),
      ),
    ).rejects.toThrow();
    expect(
      await prisma().territoryClaim.findUnique({ where: { id: 'claim_RLS_SPOOF' } }),
    ).toBeNull();
  });

  it('cross-tenant DELETE affects zero rows — orgB claim is untouched by an orgA tx', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    const del = await runTenantTx(app!, orgA, async (tx) =>
      tx.territoryClaim.deleteMany({ where: { id: claimB } }),
    );
    expect(del.count).toBe(0);
    // Owner confirms orgB's claim survived.
    expect(await prisma().territoryClaim.findUnique({ where: { id: claimB } })).not.toBeNull();
  });
});
