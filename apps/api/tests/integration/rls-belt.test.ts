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
import { PrismaClient, Prisma } from '@prisma/client';
import { userInfo } from 'node:os';
import { prisma, runTenantTx, tenantPrismaTxOn } from '../../src/config/db';
import { truncateAll, teardown } from '../helpers/app';

const orgA = 'org_RLS_A';
const orgB = 'org_RLS_B';
const leadA = 'lead_RLS_A_1';
const leadB = 'lead_RLS_B_1';
const userA = 'usr_RLS_A_1';
const userB = 'usr_RLS_B_1';
const campA = 'cmp_RLS_A_1';
const campB = 'cmp_RLS_B_1';
const cnvA = 'cnv_RLS_A_1';
const cnvB = 'cnv_RLS_B_1';
const terA = 'ter_RLS_A_1';
const terB = 'ter_RLS_B_1';
const sessA = 'sess_RLS_A_1';
const sessB = 'sess_RLS_B_1';
const knkA = 'knk_RLS_A_1';
const knkB = 'knk_RLS_B_1';
const nlgA = 'nlg_RLS_A_1';
const nlgB = 'nlg_RLS_B_1';
const audA = 'aud_RLS_A_1';
const audB = 'aud_RLS_B_1';
const audPlatform = 'aud_RLS_PLATFORM_1';
const prcA = 'prc_RLS_A_1';
const prcB = 'prc_RLS_B_1';
const cgjA = 'cgj_RLS_A_1';
const cgjB = 'cgj_RLS_B_1';
const whkA = 'whk_RLS_A_1';
const whkB = 'whk_RLS_B_1';
const purA = 'pur_RLS_A_1';
const purB = 'pur_RLS_B_1';
const ssoA = 'sso_RLS_A_1';
const ssoB = 'sso_RLS_B_1';
// Compliance: one approved registration + a campaign-state clearance for orgA only.
// Neither model carries an orgId (RLS disabled), but the clearance JOINS to the
// RLS-enabled Campaign — seeding orgA alone lets the probe prove the join is gated.
const psrA = 'psr_RLS_A_1';
const cscA = 'csc_RLS_A_1';
// One shared Address — Address carries NO orgId (RLS disabled), so a single row is
// referenced by both tenants' knocks; this also proves it stays cross-tenant visible
// on the owner connection (the knock service reads Address via plain prisma()).
const adrShared = 'adr_RLS_SHARED_1';

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
      // EXECUTE on the §4b SECURITY DEFINER pre-auth resolvers (login/refresh/
      // acceptInvite). On a fresh DB the role is created here, AFTER the resolver
      // migration ran, so the migration's conditional grant was skipped — this is
      // what actually arms d2d_app to call them.
      `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO "${APP_ROLE}";`,
      `ALTER DEFAULT PRIVILEGES FOR ROLE "${ownerRole}" IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${APP_ROLE}";`,
      `ALTER DEFAULT PRIVILEGES FOR ROLE "${ownerRole}" IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO "${APP_ROLE}";`,
      `ALTER DEFAULT PRIVILEGES FOR ROLE "${ownerRole}" IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO "${APP_ROLE}";`,
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
 */
async function ensureAppRole(): Promise<string | null> {
  if (await appRoleConnectable()) return null;

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
  // One User + one Campaign per org — the other Class A models the migrated lead
  // service now reads through the belt (createLead/updateLead/assignLead validation).
  for (const [org, uid] of [
    [orgA, userA],
    [orgB, userB],
  ] as const) {
    await prisma().user.create({
      data: {
        id: uid,
        orgId: org,
        email: `${uid}@rls.test`,
        emailDigest: `digest_${uid}`,
        givenName: 'Seed',
        familyName: org,
        role: 'inside_sales',
        regionCode: 'US',
      },
    });
  }
  // One SsoConfiguration per org (auth/saml domain — task #104). loadActiveConfig /
  // getSsoConfigPublic / upsertSsoConfigurationBySlug derive org.id from the public
  // Org slug (control-plane, visible to d2d_app) then read the config through the
  // belt; this proves a foreign tenant's SAML config is invisible under d2d_app, so
  // org A can never load org B's IdP cert/metadata even though SsoConfiguration is
  // unique-per-org and was historically read via a bare prisma() include.
  for (const [org, sso] of [
    [orgA, ssoA],
    [orgB, ssoB],
  ] as const) {
    await prisma().ssoConfiguration.create({
      data: {
        id: sso,
        orgId: org,
        provider: 'okta',
        entityId: `https://idp.${org}.example/metadata`,
        ssoUrl: `https://idp.${org}.example/sso`,
        certificateKey: `s3://kms/${org}/cert.pem`,
        attributeMappingJson: { email: 'email', role: 'role' },
        status: 'active',
      },
    });
  }
  for (const [org, cid] of [
    [orgA, campA],
    [orgB, campB],
  ] as const) {
    await prisma().campaign.create({
      data: { id: cid, orgId: org, regionCode: 'US', name: `Camp ${org}`, vertical: 'commercial' },
    });
  }
  // One Conversion per org (the money path — second migrated domain after lead).
  // getConversion/listConversions now read through the belt; this proves a foreign
  // Conversion PK is invisible under d2d_app → the service maps null to a 404.
  for (const [org, cnv, lead] of [
    [orgA, cnvA, leadA],
    [orgB, cnvB, leadB],
  ] as const) {
    await prisma().conversion.create({
      data: {
        id: cnv,
        orgId: org,
        regionCode: 'US',
        leadId: lead,
        type: 'donation_oneoff',
        attributionSource: 'door',
        amountCents: 1000n,
        signedAt: new Date(),
        paymentProvider: 'micamp',
        idempotencyKey: `idem_${cnv}`,
      },
    });
  }
  // One Territory per org (third migrated domain — task #104). getTerritory /
  // listTerritories / updateTerritory / addAssignment / removeAssignment /
  // heatmap now read through the belt; this proves a foreign Territory PK is
  // invisible under d2d_app → the service maps null to a 404.
  for (const [org, ter, camp] of [
    [orgA, terA, campA],
    [orgB, terB, campB],
  ] as const) {
    await prisma().territory.create({
      data: {
        id: ter,
        orgId: org,
        regionCode: 'US',
        name: `Ter ${org}`,
        vertical: 'commercial',
        campaignId: camp,
      },
    });
  }
  // One shared Address (no orgId — RLS disabled, lives on the owner connection).
  await prisma().address.create({
    data: {
      id: adrShared,
      regionCode: 'US',
      formatted: '1 RLS St, Austin, TX 78701',
      street: '1 RLS St',
      locality: 'Austin',
      region: 'TX',
      postcode: '78701',
      countryCode: 'US',
      hashKey: `hash_${adrShared}`,
    },
  });
  // One KnockSession + one Knock per org (knock domain — task #104). getKnock /
  // listKnocks / endSession / createKnock validation now read through the belt;
  // this proves a foreign Knock or KnockSession PK is invisible under d2d_app →
  // the service maps null to a 404 (single-resource GET / endSession).
  for (const [org, sess, knk, ter, usr] of [
    [orgA, sessA, knkA, terA, userA],
    [orgB, sessB, knkB, terB, userB],
  ] as const) {
    await prisma().knockSession.create({
      data: {
        id: sess,
        orgId: org,
        userId: usr,
        territoryId: ter,
        regionCode: 'US',
        startedAt: new Date(),
        deviceId: `dev_${org}`,
      },
    });
    await prisma().knock.create({
      data: {
        id: knk,
        sessionId: sess,
        orgId: org,
        userId: usr,
        territoryId: ter,
        addressId: adrShared,
        regionCode: 'US',
        disposition: 'no_answer',
        capturedAt: new Date(),
        idempotencyKey: `idem_${knk}`,
      },
    });
  }
  // One NotificationLog per org (notification domain — task #104). listNotifications
  // now reads through the belt; this proves a foreign tenant's queued message is
  // invisible under d2d_app (the recipient is HMAC-hashed at rest, but the belt is
  // what keeps org B's message rows out of org A's list query).
  for (const [org, nlg] of [
    [orgA, nlgA],
    [orgB, nlgB],
  ] as const) {
    await prisma().notificationLog.create({
      data: {
        id: nlg,
        orgId: org,
        regionCode: 'US',
        channel: 'sms',
        recipientHash: `hash_${nlg}`,
        bodyPreview: `Seed message for ${org}`,
        status: 'queued',
      },
    });
  }
  // One AuditEvent per org + one platform-level (orgId NULL) row (audit domain —
  // task #104). listEvents + verifyChain's org-branch read through the belt; the
  // NULL-org platform chain deliberately stays on the owner connection because RLS
  // hides a NULL-orgId row from ANY GUC'd role (NULL = current_setting(...) is never
  // true). The raw prevHash/rowHash here are arbitrary — this probe tests ROW
  // VISIBILITY/scoping, not chain integrity (that's audit.test.ts).
  for (const [org, aud] of [
    [orgA, audA],
    [orgB, audB],
  ] as const) {
    await prisma().auditEvent.create({
      data: {
        ulid: aud,
        orgId: org,
        regionCode: 'US',
        action: 'test.seed',
        resourceType: 'Seed',
        resourceId: aud,
        prevHash: 'GENESIS',
        rowHash: `rowhash_${aud}`,
      },
    });
  }
  await prisma().auditEvent.create({
    data: {
      ulid: audPlatform,
      orgId: null,
      regionCode: 'US',
      action: 'platform.seed',
      resourceType: 'Seed',
      resourceId: audPlatform,
      prevHash: 'GENESIS',
      rowHash: `rowhash_${audPlatform}`,
    },
  });
  // One ProviderConnection + one ContentGenerationJob per org (marketing domain —
  // task #104). listProviders / connectProvider / disconnectProvider / getProviderStatus /
  // getJob / listJobs / recordInboundWebhook / requireActiveConnection now read through
  // the belt. This proves a foreign ProviderConnection or ContentGenerationJob PK is
  // invisible under d2d_app → the service maps null to a 404 (getJob single-resource GET)
  // or treats the provider as un-connected (status reads), never cross-tenant readable.
  for (const [org, prc, cgj] of [
    [orgA, prcA, cgjA],
    [orgB, prcB, cgjB],
  ] as const) {
    await prisma().providerConnection.create({
      data: {
        id: prc,
        orgId: org,
        kind: 'claude_copy',
        displayName: `Claude Copy ${org}`,
        mode: 'sandbox',
        status: 'connected',
      },
    });
    await prisma().contentGenerationJob.create({
      data: {
        id: cgj,
        orgId: org,
        providerConnectionId: prc,
        providerKind: 'claude_copy',
        capability: 'creative.generate.text',
        status: 'ready',
        inputJson: { prompt: `seed ${org}` },
        createdById: org === orgA ? userA : userB,
      },
    });
  }
  // Webhook domain (task #104): WebhookEndpoint carries orgId + is RLS-enabled, so
  // rotateSecret / softDeleteEndpoint / listDeliveries / listEndpoints all read it
  // through the belt. WebhookDelivery has NO orgId (not RLS-enabled) and is read on
  // the bare client, transitively scoped by the already-ownership-verified endpointId.
  for (const [org, whk] of [
    [orgA, whkA],
    [orgB, whkB],
  ] as const) {
    await prisma().webhookEndpoint.create({
      data: {
        id: whk,
        orgId: org,
        url: `https://example.com/${org}`,
        secretCipher: `sha256_${org}`,
        eventTypes: ['lead.created'],
        status: 'active',
      },
    });
  }
  // PII-vault domain (task #104): PiiUnmaskRequest carries orgId + is RLS-enabled,
  // so requestUnmask / approveUnmask / revealUnmask / getUnmaskRequest all read it
  // through the belt. We seed one pending request per org; the probe proves a foreign
  // request id resolves to null under d2d_app (404 in the service, never 403).
  for (const [org, pur, usr, lead] of [
    [orgA, purA, userA, leadA],
    [orgB, purB, userB, leadB],
  ] as const) {
    await prisma().piiUnmaskRequest.create({
      data: {
        id: pur,
        orgId: org,
        regionCode: 'US',
        requesterId: usr,
        rowType: 'Lead',
        rowId: lead,
        fields: ['email'],
        justification: `belt seed for ${org}`,
        status: 'pending',
      },
    });
  }
  // One approved PaidSolicitorRegistration + CampaignStateClearance for orgA's
  // campaign (compliance domain — task #104). Neither model has an orgId, so both
  // stay on the owner connection and are NOT RLS-enabled. We seed orgA ONLY: the
  // probe proves getStateClearanceMatrix's CSC→Campaign relation join is GUC-gated
  // (no GUC → empty matrix; orgA GUC → orgA's row), which is why that read had to
  // move to tenantTx rather than a bare prisma() call.
  await prisma().paidSolicitorRegistration.create({
    data: {
      id: psrA,
      regionCode: 'US',
      state: 'CA',
      entityOrgId: orgA,
      clientOrgId: orgA,
      status: 'approved',
      filedAt: new Date(),
      approvedAt: new Date(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma().campaignStateClearance.create({
    data: {
      id: cscA,
      campaignId: campA,
      state: 'CA',
      paidSolicitorRegistrationId: psrA,
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

/**
 * §4b — the READ-SIDE GUC mechanism (tenantPrismaTx). The plain `app` client
 * sees zero rows (proven above: "DENY BY DEFAULT"). tenantPrismaTxOn drops the
 * GUC in per operation, so a standalone read under the RLS-enforced d2d_app role
 * returns exactly the caller's tenant — without the call-site having to open a
 * transaction by hand. This is the mechanism the cutover runbook §4b/§5 gates on.
 */
describe('SEC-005 §4b — tenantPrismaTx is the read-side GUC belt under d2d_app', () => {
  it('scopes a standalone NON-owner read to the caller tenant (no manual tx)', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    const a = tenantPrismaTxOn(app!, orgA);
    const aRows = await a.lead.findMany();
    expect(aRows).toHaveLength(1);
    expect(aRows[0]?.id).toBe(leadA);

    const b = tenantPrismaTxOn(app!, orgB);
    const bRows = await b.lead.findMany();
    expect(bRows).toHaveLength(1);
    expect(bRows[0]?.id).toBe(leadB);
  });

  it('findUnique by another tenant PK is invisible (rewritten to findFirst + GUC)', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    const a = tenantPrismaTxOn(app!, orgA);
    // findUnique(orgB PK) → reshaped to findFirst with orgId AND'd in, run inside
    // an orgA-GUC tx → RLS hides the row → null. No cross-tenant read.
    expect(await a.lead.findUnique({ where: { id: leadB } })).toBeNull();
    // …while its own PK resolves fine.
    expect((await a.lead.findUnique({ where: { id: leadA } }))?.id).toBe(leadA);
  });

  it('count/aggregate are tenant-scoped under the GUC belt', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    expect(await tenantPrismaTxOn(app!, orgA).lead.count()).toBe(1);
    expect(await tenantPrismaTxOn(app!, orgB).lead.count()).toBe(1);
  });

  it('a write stamps the caller tenant; a spoofed orgId is rejected before the DB', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    const a = tenantPrismaTxOn(app!, orgA);
    const created = await a.lead.create({
      // orgId intentionally omitted — the reshaper stamps it. Cast to the
      // Unchecked input (orgId optional) since the static type still wants org.
      data: {
        id: 'lead_RLS_TX_A',
        regionCode: 'US',
        vertical: 'commercial',
        givenName: 'Tx',
        familyName: 'A',
      } as Prisma.LeadUncheckedCreateInput,
    });
    expect(created.orgId).toBe(orgA); // orgId injected by the reshaper, not the caller

    // Spoofing orgB in the data is caught by stampData BEFORE it reaches Postgres.
    await expect(
      a.lead.create({
        data: {
          id: 'lead_RLS_TX_SPOOF',
          orgId: orgB,
          regionCode: 'US',
          vertical: 'commercial',
          givenName: 'Spoof',
          familyName: 'B',
        },
      }),
    ).rejects.toThrow(/does not match tenant orgId/);
    expect(await prisma().lead.findUnique({ where: { id: 'lead_RLS_TX_SPOOF' } })).toBeNull();
  });
});

/**
 * §4b-mig — the lead domain is the FIRST migrated reference domain (task #104).
 * Its validation reads (createLead/updateLead/assignLead) now resolve User and
 * Campaign through `tenantPrismaTx`, not the owner client. The belt mechanism is
 * model-agnostic, but these assertions prove it bites for EVERY org-scoped model
 * the lead service touches under the enforcing d2d_app role — so a foreign User
 * or Campaign id is invisible (→ the service's 400 / 404), never cross-tenant
 * readable. Guards against an org-scoped model shipping without an RLS policy.
 */
describe('SEC-005 §4b-mig — lead-domain models (User, Campaign) scope under d2d_app', () => {
  it('User: tenantPrismaTx hides a foreign-tenant user (the assign/validation read)', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    const a = tenantPrismaTxOn(app!, orgA);
    // Own user resolves; org B's user is invisible → service maps null to a 400.
    expect((await a.user.findUnique({ where: { id: userA } }))?.id).toBe(userA);
    expect(await a.user.findUnique({ where: { id: userB } })).toBeNull();
    expect(await a.user.count()).toBe(1);
  });

  it('Campaign: tenantPrismaTx hides a foreign-tenant campaign (createLead validation read)', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    const a = tenantPrismaTxOn(app!, orgA);
    // Own campaign resolves; org B's campaign is invisible → service maps null to a 404.
    expect((await a.campaign.findUnique({ where: { id: campA } }))?.id).toBe(campA);
    expect(await a.campaign.findUnique({ where: { id: campB } })).toBeNull();
    expect(await a.campaign.count()).toBe(1);
  });
});

/**
 * §4b-mig — the conversion domain is the SECOND migrated domain (task #104, the
 * money path). getConversion/listConversions now read through `tenantPrismaTx`.
 * This proves the belt bites for the Conversion model under d2d_app: a foreign
 * Conversion PK is invisible → the service maps null to a 404 (NOT a 403 — the
 * whole point of tenant isolation is to withhold cross-tenant existence). The
 * createConversion lead-validation read rides the same mechanism (Lead is already
 * proven above), so a lead in another tenant is likewise invisible → 404.
 */
describe('SEC-005 §4b-mig — conversion domain scopes under d2d_app', () => {
  it('Conversion: tenantPrismaTx hides a foreign-tenant conversion (getConversion read)', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    const a = tenantPrismaTxOn(app!, orgA);
    // Own conversion resolves; org B's conversion is invisible → service maps null to a 404.
    expect((await a.conversion.findUnique({ where: { id: cnvA } }))?.id).toBe(cnvA);
    expect(await a.conversion.findUnique({ where: { id: cnvB } })).toBeNull();
    expect(await a.conversion.count()).toBe(1); // listConversions sees only its own tenant
  });
});

/**
 * §4b-mig — the territory domain is the THIRD migrated domain (task #104). Its
 * reads (getTerritory / listTerritories / updateTerritory, plus the addAssignment
 * territory+user validation, removeAssignment's parent-territory guard, and the
 * heatmap territory+knock reads) now resolve through `tenantPrismaTx`. This proves
 * the belt bites for the Territory model under d2d_app: a foreign Territory PK is
 * invisible → the service maps null to a 404 (single-resource GET) or a 400
 * ("not in this org" for the addAssignment body-reference), never cross-tenant
 * readable. The campaign-reference read in createTerritory rides the same
 * mechanism (Campaign is already proven in the lead-domain block above).
 *
 * Note: TerritoryAssignment has NO orgId — it intentionally stays on the owner
 * `prisma()` connection and rides its parent territory's visibility, which the
 * service enforces by belt-guarding the parent BEFORE the assignment read.
 */
describe('SEC-005 §4b-mig — territory domain scopes under d2d_app', () => {
  it('Territory: tenantPrismaTx hides a foreign-tenant territory (getTerritory read)', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    const a = tenantPrismaTxOn(app!, orgA);
    // Own territory resolves; org B's territory is invisible → service maps null to a 404.
    expect((await a.territory.findUnique({ where: { id: terA } }))?.id).toBe(terA);
    expect(await a.territory.findUnique({ where: { id: terB } })).toBeNull();
    expect(await a.territory.count()).toBe(1); // listTerritories sees only its own tenant
  });
});

/**
 * §4b-mig — the knock domain (task #104). getKnock / listKnocks read through the
 * belt for the Knock model; startSession / endSession / createKnock validation read
 * KnockSession + Territory the same way. This proves both Knock and KnockSession row
 * under d2d_app: a foreign PK is invisible → the service maps null to a 404 (single
 * GET / endSession) rather than a cross-tenant 403 that would leak existence.
 *
 * Note: Address carries NO orgId — it intentionally stays on the owner `prisma()`
 * connection (the createKnock/batch address-existence read). The single shared
 * Address row is referenced by BOTH tenants' knocks here; we assert it stays
 * cross-tenant visible on the owner connection (the belt does not — and must not —
 * hide a model with no tenant column, which is why the knock service reads it via
 * plain prisma(), not tenantPrismaTx).
 */
describe('SEC-005 §4b-mig — knock domain scopes under d2d_app', () => {
  it('Knock: tenantPrismaTx hides a foreign-tenant knock (getKnock / listKnocks)', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    const a = tenantPrismaTxOn(app!, orgA);
    // Own knock resolves; org B's knock is invisible → service maps null to a 404.
    expect((await a.knock.findUnique({ where: { id: knkA } }))?.id).toBe(knkA);
    expect(await a.knock.findUnique({ where: { id: knkB } })).toBeNull();
    expect(await a.knock.count()).toBe(1); // listKnocks sees only its own tenant
  });

  it('KnockSession: tenantPrismaTx hides a foreign-tenant session (endSession / createKnock)', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    const a = tenantPrismaTxOn(app!, orgA);
    // Own session resolves; org B's session is invisible → endSession/createKnock 404.
    expect((await a.knockSession.findUnique({ where: { id: sessA } }))?.id).toBe(sessA);
    expect(await a.knockSession.findUnique({ where: { id: sessB } })).toBeNull();
    expect(await a.knockSession.count()).toBe(1);
  });

  it('Address: no orgId — stays cross-tenant visible on the owner connection (not belted)', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    // The knock service reads Address via plain prisma() (no tenant column to pin).
    // The shared row is referenced by both tenants' knocks and remains visible —
    // proving we did NOT mistakenly wrap a no-orgId model in tenantPrismaTx.
    const owner = prisma();
    expect((await owner.address.findUnique({ where: { id: adrShared } }))?.id).toBe(adrShared);
  });
});

/**
 * §4b-mig — the notification domain (task #104). listNotifications is the only read
 * in the service and now scopes through `tenantPrismaTx`; the writes already ran in
 * `tenantTx`. NotificationLog rows hold an HMAC-hashed recipient (never plaintext),
 * but hashing is confidentiality-at-rest, not tenant isolation — the belt is what
 * stops org A's list query from returning org B's queued messages. This proves the
 * NotificationLog model row-scopes under d2d_app.
 */
describe('SEC-005 §4b-mig — notification domain scopes under d2d_app', () => {
  it('NotificationLog: tenantPrismaTx hides a foreign-tenant message (listNotifications)', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    const a = tenantPrismaTxOn(app!, orgA);
    // Own message resolves; org B's message is invisible → listNotifications never
    // pages another tenant's rows.
    expect((await a.notificationLog.findUnique({ where: { id: nlgA } }))?.id).toBe(nlgA);
    expect(await a.notificationLog.findUnique({ where: { id: nlgB } })).toBeNull();
    expect(await a.notificationLog.count()).toBe(1);
  });
});

/**
 * §4b-mig — the audit domain (task #104). listEvents and the org-branch of
 * verifyChain now read through `tenantPrismaTx`; recordEvent keeps writing in the
 * caller's `tenantTx`. AuditEvent has a dual chain scope: per-org rows (orgId set)
 * AND a platform chain (orgId NULL) for platform-level events. The org chain rides
 * the belt; the platform chain CANNOT — RLS's `"orgId" = current_setting(...)`
 * compares NULL against the GUC and yields NULL (never true), so a NULL-orgId row
 * is invisible to the enforcing role under EVERY GUC. That is exactly why
 * verifyChain branches: org chains verify through tenantPrismaTx, the platform
 * chain only on the owner prisma() (a worker/cron). These probes pin both halves.
 */
describe('SEC-005 §4b-mig — audit domain scopes under d2d_app', () => {
  it('AuditEvent: tenantPrismaTx hides a foreign-tenant audit row (listEvents / verifyChain org-branch)', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    const a = tenantPrismaTxOn(app!, orgA);
    // Own audit row resolves; org B's row is invisible → listEvents pages only its
    // own tenant and verifyChain's org-branch replays only its own chain.
    expect((await a.auditEvent.findUnique({ where: { ulid: audA } }))?.ulid).toBe(audA);
    expect(await a.auditEvent.findUnique({ where: { ulid: audB } })).toBeNull();
    expect(await a.auditEvent.count()).toBe(1); // own org row only — NOT org B, NOT the platform row
  });

  it('AuditEvent: a NULL-orgId platform row is owner-only — invisible to ANY GUC under d2d_app', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    // NULL = '<orgA>' → NULL (never true), so the platform-chain row is hidden from
    // the enforcing role under both tenants' GUCs. This is WHY verifyChain's
    // null-branch must stay on the owner prisma() connection, never tenantPrismaTx —
    // a naive belt read there would silently return zero rows (a false-empty chain).
    expect(
      await tenantPrismaTxOn(app!, orgA).auditEvent.findUnique({ where: { ulid: audPlatform } }),
    ).toBeNull();
    expect(
      await tenantPrismaTxOn(app!, orgB).auditEvent.findUnique({ where: { ulid: audPlatform } }),
    ).toBeNull();
    // The owner — the only connection that can verify the platform chain — sees it.
    expect((await prisma().auditEvent.findUnique({ where: { ulid: audPlatform } }))?.ulid).toBe(
      audPlatform,
    );
  });
});

/**
 * §4b-mig — the compliance domain (task #104) is the SUBTLE one, and the reason
 * this probe earns its keep. Neither CampaignStateClearance (CSC) nor
 * PaidSolicitorRegistration carries an orgId, so neither is RLS-enabled — a bare
 * read of CSC under d2d_app sees the row. BUT getStateClearanceMatrix filters AND
 * selects THROUGH the CSC→Campaign relation, and Campaign IS RLS-enabled. A join
 * to an RLS table with no `app.current_org_id` GUC compares campaign.orgId against
 * NULL → the joined Campaign is invisible → the relation filter matches nothing →
 * a silently-EMPTY matrix. That is exactly why getStateClearanceMatrix moved to
 * `tenantTx` (NOT tenantPrismaTx — that no-ops on the non-orgScoped CSC model and
 * would leave the matrix empty). These probes pin both halves: the relation join is
 * closed with no GUC, and admitted inside the org's GUC.
 *
 * (The fileRegistration Campaign-validation read rides tenantPrismaTx directly, so
 * a foreign campaign is invisible → 404; Campaign row-scoping itself is already
 * proven by the lead-domain block above, so it isn't re-asserted here.)
 */
describe('SEC-005 §4b-mig — compliance: the CSC→Campaign relation join is GUC-gated under d2d_app', () => {
  it('the matrix read returns ZERO rows with no GUC — the RLS Campaign join is closed', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    // Mirror getStateClearanceMatrix's where: filter CSC through campaign.orgId.
    // CSC itself is visible to d2d_app (no policy), but with no app.current_org_id
    // the Campaign join sees campaign.orgId = NULL → the joined campaign is hidden →
    // the relation filter matches nothing → empty. A bare prisma() read post-cutover
    // would silently return an empty matrix; this is the failure tenantTx prevents.
    const leaked = await app!.campaignStateClearance.findMany({
      where: { campaign: { orgId: orgA } },
    });
    expect(leaked).toHaveLength(0);
    // The owner sees the seeded clearance — the matrix exists; only the belt hides it.
    expect(await prisma().campaignStateClearance.count()).toBe(1);
  });

  it('inside the orgA GUC the join resolves — the matrix returns orgA campaign rows', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    // runTenantTx pins app.current_org_id=orgA for the tx, so the RLS Campaign join
    // admits orgA's campaign and the select resolves — exactly what tenantTx does
    // inside getStateClearanceMatrix.
    const seen = await runTenantTx(app!, orgA, (tx) =>
      tx.campaignStateClearance.findMany({
        where: { campaign: { orgId: orgA } },
        select: { campaignId: true, state: true, campaign: { select: { name: true } } },
      }),
    );
    expect(seen).toHaveLength(1);
    expect(seen[0]?.campaignId).toBe(campA);
    expect(seen[0]?.campaign.name).toBe(`Camp ${orgA}`);

    // orgB has no clearance seeded AND cannot see orgA's campaign through its own GUC,
    // so the same relation-filtered read returns empty — no cross-tenant matrix leak.
    const none = await runTenantTx(app!, orgB, (tx) =>
      tx.campaignStateClearance.findMany({ where: { campaign: { orgId: orgA } } }),
    );
    expect(none).toHaveLength(0);
  });
});

/**
 * §4b-mig — the user domain is migrated (task #104). Its primary reads
 * (getUser/listUsers/updateUser/archiveUser) now scope through `tenantPrismaTx`;
 * the User model's row-scoping under d2d_app is already proven by the lead-domain
 * block above (own user resolves, foreign user invisible, count tenant-scoped), so
 * we do not re-assert it here.
 *
 * What IS unique to the user domain — and what the migrated inviteUser depends on —
 * is that `User.emailDigest` is GLOBALLY @unique: a duplicate in another tenant must
 * still be refused even though RLS hides that tenant's row. Under the belt the
 * service's owner-role pre-check sees nothing (no cross-tenant visibility), so the
 * DB unique index is the real arbiter and surfaces P2002 → the service maps it to a
 * clean 409. This probe proves the index bites cross-tenant under the enforcing role.
 */
describe('SEC-005 §4b-mig — user domain: emailDigest global-uniqueness bites under d2d_app', () => {
  it('a digest that collides with an RLS-invisible tenant still throws P2002 (the inviteUser 409 contract)', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    // Inside orgA's GUC, org B's user row is invisible (proven above). Yet inserting a
    // NEW orgA user whose emailDigest equals org B's must still fail on the global
    // unique index — not silently succeed into a cross-tenant duplicate.
    await expect(
      runTenantTx(app!, orgA, (tx) =>
        tx.user.create({
          data: {
            id: 'usr_RLS_DIGEST_DUP',
            orgId: orgA, // matches the GUC → WITH CHECK passes; only the unique index can fire
            email: 'digest-dup@rls.test', // distinct email so ONLY emailDigest collides
            emailDigest: `digest_${userB}`, // collides with org B's RLS-invisible user
            givenName: 'Dup',
            familyName: 'A',
            role: 'inside_sales',
            regionCode: 'US',
          },
        }),
      ),
    ).rejects.toMatchObject({ code: 'P2002' });
    // The owner confirms no duplicate landed.
    expect(await prisma().user.findUnique({ where: { id: 'usr_RLS_DIGEST_DUP' } })).toBeNull();
  });
});

/**
 * §4b-mig — the marketing domain (task #104, the largest read surface). The AI
 * Marketing Studio service migrated all 17 of its reads onto `tenantPrismaTx`; its
 * writes-with-audit already ran in `tenantTx`. Three RLS-enabled models carry an
 * orgId and ride the belt: ProviderConnection, ContentGenerationJob, and
 * ProviderWebhookEvent. These probes prove the belt bites for the two that drive
 * single-resource reads under d2d_app — a foreign ProviderConnection or
 * ContentGenerationJob PK is invisible → getJob maps null to a 404 (the §4b.1
 * status change: cross-tenant job reads flip 403→404), and the provider-status /
 * requireActiveConnection reads see a foreign provider as simply un-connected.
 *
 * The compound-key reads (`findUnique({ where: { orgId_kind } })`,
 * `findUnique({ where: { providerKind_externalId } })`) could NOT survive the
 * reshaper as-is — it AND's orgId at the top level of `where`, and a compound-key
 * name is not a valid findFirst filter. They were rewritten to explicit scalar
 * findFirst reads (e.g. `.findFirst({ where: { kind } })`), which the belt then
 * scopes by GUC. The ProviderWebhookEvent `(providerKind, externalId)` unique is
 * GLOBAL (no orgId): the old owner read could surface another tenant's event by a
 * colliding externalId; the scoped read returns null on a foreign collision and the
 * P2002 re-throws — a near-impossible cross-org clash 500s rather than leaking.
 */
describe('SEC-005 §4b-mig — marketing domain scopes under d2d_app', () => {
  it('ProviderConnection: tenantPrismaTx hides a foreign-tenant connection (status / requireActiveConnection)', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    const a = tenantPrismaTxOn(app!, orgA);
    // Own connection resolves; org B's is invisible → status reads see it as un-connected.
    expect((await a.providerConnection.findUnique({ where: { id: prcA } }))?.id).toBe(prcA);
    expect(await a.providerConnection.findUnique({ where: { id: prcB } })).toBeNull();
    expect(await a.providerConnection.count()).toBe(1); // listProviders sees only its own tenant
  });

  it('ProviderConnection: the (orgId, kind) lookup is scoped — a foreign kind match is invisible', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    // connectProvider/disconnectProvider/getProviderStatus rewrote the compound
    // orgId_kind findUnique to a scalar findFirst({ where: { kind } }); the belt
    // pins it to the caller's tenant. Both orgs seed the SAME kind ('claude_copy'),
    // so this proves orgA resolves ITS row and never org B's despite the kind match.
    const a = tenantPrismaTxOn(app!, orgA);
    expect((await a.providerConnection.findFirst({ where: { kind: 'claude_copy' } }))?.id).toBe(
      prcA,
    );
    const b = tenantPrismaTxOn(app!, orgB);
    expect((await b.providerConnection.findFirst({ where: { kind: 'claude_copy' } }))?.id).toBe(
      prcB,
    );
  });

  it('ContentGenerationJob: tenantPrismaTx hides a foreign-tenant job (getJob → 404, listJobs)', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    const a = tenantPrismaTxOn(app!, orgA);
    // Own job resolves; org B's job is invisible → getJob maps null to a 404 (the
    // §4b.1 cross-tenant 403→404 flip), and listJobs pages only its own tenant.
    expect((await a.contentGenerationJob.findUnique({ where: { id: cgjA } }))?.id).toBe(cgjA);
    expect(await a.contentGenerationJob.findUnique({ where: { id: cgjB } })).toBeNull();
    expect(await a.contentGenerationJob.count()).toBe(1);
  });
});

describe('SEC-005 §4b-mig — webhook domain scopes under d2d_app', () => {
  it('WebhookEndpoint: tenantPrismaTx hides a foreign-tenant endpoint (rotate/delete/listDeliveries → 404)', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    const a = tenantPrismaTxOn(app!, orgA);
    // rotateSecret / softDeleteEndpoint / listDeliveries each read the endpoint by id
    // through the belt FIRST. Org A resolves its own; org B's is invisible → null → the
    // service maps it to a 404 (the §4b.1 cross-tenant 403→404 flip), so a foreign
    // endpoint can be neither rotated, archived, nor have its deliveries enumerated —
    // the WebhookDelivery query (bare client, no orgId) is never reached for it.
    expect((await a.webhookEndpoint.findUnique({ where: { id: whkA } }))?.id).toBe(whkA);
    expect(await a.webhookEndpoint.findUnique({ where: { id: whkB } })).toBeNull();
    expect(await a.webhookEndpoint.count()).toBe(1); // listEndpoints pages only its own tenant
  });
});

describe('SEC-005 §4b-mig — pii-vault domain scopes under d2d_app', () => {
  it('PiiUnmaskRequest: tenantPrismaTx hides a foreign-tenant grant (approve/reveal/get → 404, never 403)', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    const a = tenantPrismaTxOn(app!, orgA);
    // approveUnmask / revealUnmask / getUnmaskRequest each read the request by id
    // through the belt FIRST. Org A resolves its own; org B's is invisible → null → the
    // service maps it to a 404 (the §4b.1 cross-tenant 403→404 flip), so a foreign
    // unmask grant can be neither approved, revealed, nor inspected. The decrypt step
    // (fetchAndDecryptFields) is likewise belt-scoped — a foreign Lead/Donation rowId
    // resolves to null under the GUC, closing the cross-tenant PII-reveal hole.
    expect((await a.piiUnmaskRequest.findUnique({ where: { id: purA } }))?.id).toBe(purA);
    expect(await a.piiUnmaskRequest.findUnique({ where: { id: purB } })).toBeNull();
    expect(await a.piiUnmaskRequest.count()).toBe(1); // a tenant only ever lists its own grants
  });
});

describe('SEC-005 §4b-mig — auth/saml domain: SsoConfiguration scopes under d2d_app', () => {
  it('tenantPrismaTx loads only the principal org SAML config; a foreign tenant config is invisible', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    // The saml service reads Org by public slug (control-plane, RLS-free) to derive
    // org.id, then scopes SsoConfiguration via tenantPrismaTx(org.id). SsoConfiguration
    // is unique-on-orgId, so the historical `org.findUnique({ include: ssoConfiguration })`
    // would silently return null under d2d_app (no GUC on the joined RLS table). The
    // belt-scoped read resolves org A's config and hides org B's — the cert/IdP-metadata
    // for one tenant can never leak into another tenant's SSO start/ACS flow.
    const a = tenantPrismaTxOn(app!, orgA);
    expect((await a.ssoConfiguration.findUnique({ where: { orgId: orgA } }))?.id).toBe(ssoA);
    // A forged config id belonging to org B resolves to null under the belt: the reshaper
    // ANDs orgId=orgA into the where and the RLS GUC pins orgA, so org B's row is invisible
    // (the same defence getCurrentUser relies on for a forged userId). The service never
    // passes a foreign orgId explicitly — it derives org.id from the slug — so this models
    // the real leak vector (a wrong/forged primary key), not an impossible call shape.
    expect(await a.ssoConfiguration.findUnique({ where: { id: ssoB } })).toBeNull();
    expect(await a.ssoConfiguration.count()).toBe(1); // a tenant only ever sees its own config
  });
});

/**
 * §4b — the pre-auth SECURITY DEFINER resolvers (the cutover unblock, "Option C").
 *
 * login / refresh / acceptInvite are PRE-AUTH: they have no org context, so under
 * d2d_app a direct keyed read of the RLS-enabled identity tables compares orgId
 * against a NULL GUC → deny-by-default → zero rows, and the flow can't even find
 * the user to authenticate. The fix is three owner-owned SECURITY DEFINER functions
 * (prisma/migrations/.../preauth_resolvers) that resolve a SINGLE identity row by a
 * globally-unique secret column and hand back the orgId; the caller then re-enters
 * the belt with that orgId for every write.
 *
 * These probes prove the bypass works AND is confined: each resolver, called by the
 * enforcing d2d_app role with NO GUC, returns exactly the keyed identity row — even
 * though the SAME role doing a direct table read sees nothing. This is the mechanism
 * the runbook §4b.3 / §5 cutover precondition gates on.
 */
describe('SEC-005 §4b — pre-auth SECURITY DEFINER resolvers bypass the belt under d2d_app', () => {
  it('app_resolve_user_by_email_digest resolves identity + passwordHash with NO GUC', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    // Seed a credential via the OWNER — the belt hides User from d2d_app, so only the
    // owner can plant the row the pre-auth login resolver must later read back.
    await prisma().userCredential.create({
      data: { userId: userA, passwordHash: 'scrypt$fake$A' },
    });

    // Belt proof: a DIRECT raw read of User under d2d_app with no GUC sees nothing…
    const direct = await app!.$queryRawUnsafe<{ id: string }[]>(
      'SELECT id FROM "User" WHERE "emailDigest" = $1',
      `digest_${userA}`,
    );
    expect(direct).toHaveLength(0);

    // …yet the SECURITY DEFINER resolver (owner privileges inside) returns the row.
    const rows = await app!.$queryRaw<
      { id: string; orgId: string; status: string; passwordHash: string | null; role: string }[]
    >`SELECT * FROM app_resolve_user_by_email_digest(${`digest_${userA}`})`;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(userA);
    expect(rows[0]?.orgId).toBe(orgA);
    expect(rows[0]?.status).toBe('active');
    expect(rows[0]?.passwordHash).toBe('scrypt$fake$A');
    expect(rows[0]?.role).toBe('inside_sales');
  });

  it('app_resolve_user_by_email_digest returns passwordHash NULL when the user has no credential', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    // userB has no UserCredential (seed creates none) → the LEFT JOIN yields NULL.
    // login() maps this to the same 401 as a bad password (never a 500).
    const rows = await app!.$queryRaw<{ id: string; passwordHash: string | null }[]>`
      SELECT * FROM app_resolve_user_by_email_digest(${`digest_${userB}`})
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(userB);
    expect(rows[0]?.passwordHash).toBeNull();
  });

  it('app_resolve_user_by_email_digest returns no rows for an unknown digest', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    const rows = await app!.$queryRaw<{ id: string }[]>`
      SELECT * FROM app_resolve_user_by_email_digest(${'digest_nobody'})
    `;
    expect(rows).toHaveLength(0);
  });

  it('app_resolve_refresh_token resolves the token row + owning identity', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    await prisma().refreshToken.create({
      data: {
        id: 'rft_RLS_A',
        userId: userA,
        orgId: orgA,
        tokenHash: 'rls_rt_hash_A',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const rows = await app!.$queryRaw<
      {
        rtId: string;
        userId: string;
        orgId: string;
        status: string;
        role: string;
        revokedAt: Date | null;
      }[]
    >`SELECT * FROM app_resolve_refresh_token(${'rls_rt_hash_A'})`;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.rtId).toBe('rft_RLS_A');
    expect(rows[0]?.userId).toBe(userA);
    expect(rows[0]?.orgId).toBe(orgA);
    expect(rows[0]?.status).toBe('active');
    expect(rows[0]?.revokedAt).toBeNull();
  });

  it('app_resolve_invite resolves userId + orgId by inviteTokenHash', async () => {
    if (skipReason) return expect(skipReason).toBeTruthy();
    await prisma().userCredential.create({
      data: {
        userId: userA,
        passwordHash: '__invite_pending__:00',
        inviteTokenHash: 'rls_invite_hash_A',
        inviteExpiresAt: new Date(Date.now() + 60_000),
      },
    });
    const rows = await app!.$queryRaw<
      { userId: string; orgId: string; inviteExpiresAt: Date | null }[]
    >`SELECT * FROM app_resolve_invite(${'rls_invite_hash_A'})`;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe(userA);
    expect(rows[0]?.orgId).toBe(orgA);
    expect(rows[0]?.inviteExpiresAt).not.toBeNull();
  });
});
