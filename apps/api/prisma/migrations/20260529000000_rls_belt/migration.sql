-- SEC-005 · Postgres Row-Level Security belt (the database-enforced floor).
--
-- The WS1 Prisma `$extends` injector (config/db.ts) forces `where: { orgId }`
-- at the application layer — the "suspenders". This migration adds the "belt":
-- RLS policies the database enforces even if the app layer is bypassed or has
-- a bug. Together they are defence-in-depth for multi-tenant isolation.
--
-- HOW IT BITES
--   Policy: a row is visible/writable only when its "orgId" equals the
--   transaction-local GUC `app.current_org_id`. The app sets that GUC via
--   `tenantTx()` / `runTenantTx()` (config/db.ts) using
--   `set_config('app.current_org_id', $orgId, true)` — transaction-scoped, so
--   it rolls back at COMMIT and never leaks across pooled connections.
--   When the GUC is unset, `current_setting(...,true)` returns NULL, the
--   comparison is NULL (never true), and the row is excluded → DENY BY DEFAULT.
--
-- WHY `ENABLE` AND NOT `FORCE`
--   Postgres exempts a table's OWNER from RLS unless FORCE is set. Migrations,
--   seeds, and the current app all connect as the owner role (`d2d`), so they
--   are unaffected by this migration — the existing test suite stays green and
--   nothing breaks today. The belt becomes active the moment a request runs
--   under a NON-OWNER role with no BYPASSRLS (the `d2d_app` role created by
--   prisma/rls/bootstrap-app-role.sql). Arming production = pointing the app's
--   DATABASE_URL at `d2d_app` (see docs/runbooks/rls-cutover.md), which is a
--   gated cutover, not part of this migration.
--
-- Idempotent: re-running drops+recreates each policy.

-- AdAccount
ALTER TABLE "AdAccount" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AdAccount";
CREATE POLICY tenant_isolation ON "AdAccount"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- AdCampaign
ALTER TABLE "AdCampaign" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AdCampaign";
CREATE POLICY tenant_isolation ON "AdCampaign"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- ApiKey
ALTER TABLE "ApiKey" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ApiKey";
CREATE POLICY tenant_isolation ON "ApiKey"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- AuditEvent
ALTER TABLE "AuditEvent" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AuditEvent";
CREATE POLICY tenant_isolation ON "AuditEvent"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- BrandKit
ALTER TABLE "BrandKit" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "BrandKit";
CREATE POLICY tenant_isolation ON "BrandKit"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- Campaign
ALTER TABLE "Campaign" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Campaign";
CREATE POLICY tenant_isolation ON "Campaign"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- Commission
ALTER TABLE "Commission" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Commission";
CREATE POLICY tenant_isolation ON "Commission"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- CommissionPlan
ALTER TABLE "CommissionPlan" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "CommissionPlan";
CREATE POLICY tenant_isolation ON "CommissionPlan"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- ContentGenerationJob
ALTER TABLE "ContentGenerationJob" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ContentGenerationJob";
CREATE POLICY tenant_isolation ON "ContentGenerationJob"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- Conversion
ALTER TABLE "Conversion" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Conversion";
CREATE POLICY tenant_isolation ON "Conversion"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- Creative
ALTER TABLE "Creative" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Creative";
CREATE POLICY tenant_isolation ON "Creative"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- IdempotencyRecord
ALTER TABLE "IdempotencyRecord" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "IdempotencyRecord";
CREATE POLICY tenant_isolation ON "IdempotencyRecord"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- Knock
ALTER TABLE "Knock" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Knock";
CREATE POLICY tenant_isolation ON "Knock"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- KnockSession
ALTER TABLE "KnockSession" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "KnockSession";
CREATE POLICY tenant_isolation ON "KnockSession"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- Lead
ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Lead";
CREATE POLICY tenant_isolation ON "Lead"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- NotificationLog
ALTER TABLE "NotificationLog" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "NotificationLog";
CREATE POLICY tenant_isolation ON "NotificationLog"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- OrgBilling
ALTER TABLE "OrgBilling" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "OrgBilling";
CREATE POLICY tenant_isolation ON "OrgBilling"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- PayoutBatch
ALTER TABLE "PayoutBatch" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "PayoutBatch";
CREATE POLICY tenant_isolation ON "PayoutBatch"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- PiiUnmaskRequest
ALTER TABLE "PiiUnmaskRequest" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "PiiUnmaskRequest";
CREATE POLICY tenant_isolation ON "PiiUnmaskRequest"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- ProviderConnection
ALTER TABLE "ProviderConnection" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ProviderConnection";
CREATE POLICY tenant_isolation ON "ProviderConnection"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- ProviderWebhookEvent
ALTER TABLE "ProviderWebhookEvent" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ProviderWebhookEvent";
CREATE POLICY tenant_isolation ON "ProviderWebhookEvent"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- RefreshToken
ALTER TABLE "RefreshToken" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "RefreshToken";
CREATE POLICY tenant_isolation ON "RefreshToken"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- SsoConfiguration
ALTER TABLE "SsoConfiguration" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "SsoConfiguration";
CREATE POLICY tenant_isolation ON "SsoConfiguration"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- Territory
ALTER TABLE "Territory" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Territory";
CREATE POLICY tenant_isolation ON "Territory"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- User
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "User";
CREATE POLICY tenant_isolation ON "User"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- WebhookEndpoint
ALTER TABLE "WebhookEndpoint" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "WebhookEndpoint";
CREATE POLICY tenant_isolation ON "WebhookEndpoint"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));
