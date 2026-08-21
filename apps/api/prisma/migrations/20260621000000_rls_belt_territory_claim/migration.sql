-- C2 · TerritoryClaim table baseline + RLS belt (table "territory_claims").
--
-- Two gaps closed here, both for the same deferred table:
--
--   1. MISSING MIGRATION. TerritoryClaim was added to schema.prisma and synced
--      to the running d2d_dev DB via `prisma db push` — it has NO CREATE TABLE
--      in the migration history. A fresh `prisma migrate deploy` (CI / a new
--      env) therefore never creates "territory_claims". This migration adds the
--      baseline DDL, guarded with IF NOT EXISTS so it is a no-op where the table
--      already exists (d2d_dev) and creates it where it doesn't (fresh CI DB).
--      Shape mirrors the live table exactly (see \d+ territory_claims) and the
--      @@map/@@index in schema.prisma.
--
--   2. RLS BELT. It was the last org-scoped table (carries "orgId") missing from
--      the SEC-005 belt; the other 37 such tables already have a
--      tenant_isolation policy (20260529000000_rls_belt,
--      20260614060000_rls_belt_new_tables, 20260614070000_crm_sequences).
--
-- Follows the EXACT belt pattern: ENABLE ROW LEVEL SECURITY (NOT FORCE) +
-- DROP POLICY IF EXISTS + CREATE POLICY keyed on the transaction-local GUC
-- app.current_org_id (set by tenantTx / runTenantTx in src/config/db.ts via
-- set_config(..., true)).
--
-- WHY ENABLE AND NOT FORCE (consistent with the whole belt)
--   Postgres exempts a table's OWNER from non-FORCEd RLS. Migrations, seeds and
--   the app today connect as the owner role (d2d) / a superuser locally, so the
--   policy is dormant for them — the suite stays green and live reads are
--   unaffected. The belt BITES the moment a request runs under the non-owner,
--   NOBYPASSRLS role d2d_app (prisma/rls/bootstrap-app-role.sql), which is the
--   gated production cutover in docs/runbooks/rls-cutover.md. Adding FORCE to a
--   single table would diverge from the other 37 and would break owner-run
--   seeds/migrations that write territory_claims with no GUC set — exactly the
--   regression the belt is designed to avoid. The DB-level enforcement is proven
--   by tests/integration/rls-belt.test.ts running as d2d_app.
--
-- NOTE: physical table name is "territory_claims" (TerritoryClaim @@map), NOT
-- the PascalCase model name — DDL and policy target the mapped name.
--
-- Idempotent: re-running is a no-op on the table + recreates the policy.

-- 1. Baseline table (no-op where it already exists)
CREATE TABLE IF NOT EXISTS "territory_claims" (
  "id"          TEXT NOT NULL,
  "orgId"       TEXT NOT NULL,
  "territoryId" TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "userName"    TEXT NOT NULL,
  "claimedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "territory_claims_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "territory_claims_orgId_territoryId_idx"
  ON "territory_claims" ("orgId", "territoryId");
CREATE INDEX IF NOT EXISTS "territory_claims_orgId_expiresAt_idx"
  ON "territory_claims" ("orgId", "expiresAt");

-- 2. RLS belt
ALTER TABLE "territory_claims" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "territory_claims";
CREATE POLICY tenant_isolation ON "territory_claims"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));
