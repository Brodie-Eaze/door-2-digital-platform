-- C24 · RLS belt for tables added after the initial belt migration (20260529).
--
-- Covers: AnalyticsEvent, DsarRequest, Invoice, KnockPhoto, KnockerShift,
--         PropensityScore, ServiceOffering, VoiceRecording.
--
-- Follows the same pattern as 20260529000000_rls_belt/migration.sql:
--   ENABLE ROW LEVEL SECURITY + DROP POLICY IF EXISTS + CREATE POLICY.
-- Idempotent — safe to re-run.
--
-- PropensityScore is the special case: orgId is nullable. Rows with orgId=NULL
-- are "global" geo-propensity scores written by the ML pipeline (which connects
-- as the table owner and thus bypasses RLS). Tenant reads may see global rows
-- AND their own org's rows; tenant writes are restricted to their own orgId.
-- Separate SELECT / INSERT / UPDATE / DELETE policies implement the asymmetry.

-- ─────────────────────────────────────────────────────────────────────────────
-- AnalyticsEvent
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "AnalyticsEvent" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AnalyticsEvent";
CREATE POLICY tenant_isolation ON "AnalyticsEvent"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- ─────────────────────────────────────────────────────────────────────────────
-- DsarRequest
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "DsarRequest" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "DsarRequest";
CREATE POLICY tenant_isolation ON "DsarRequest"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- ─────────────────────────────────────────────────────────────────────────────
-- Invoice
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Invoice";
CREATE POLICY tenant_isolation ON "Invoice"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- ─────────────────────────────────────────────────────────────────────────────
-- KnockPhoto
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "KnockPhoto" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "KnockPhoto";
CREATE POLICY tenant_isolation ON "KnockPhoto"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- ─────────────────────────────────────────────────────────────────────────────
-- KnockerShift
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "KnockerShift" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "KnockerShift";
CREATE POLICY tenant_isolation ON "KnockerShift"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- ─────────────────────────────────────────────────────────────────────────────
-- ServiceOffering
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "ServiceOffering" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ServiceOffering";
CREATE POLICY tenant_isolation ON "ServiceOffering"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- ─────────────────────────────────────────────────────────────────────────────
-- VoiceRecording
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "VoiceRecording" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "VoiceRecording";
CREATE POLICY tenant_isolation ON "VoiceRecording"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- ─────────────────────────────────────────────────────────────────────────────
-- PropensityScore — asymmetric policy (nullable orgId)
--
-- SELECT: org-owned rows OR global (orgId IS NULL) — both visible to tenants.
-- INSERT: only org-owned rows (ML pipeline writes global rows as owner, bypasses RLS).
-- UPDATE: only org-owned rows.
-- DELETE: only org-owned rows.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "PropensityScore" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_select ON "PropensityScore";
CREATE POLICY tenant_isolation_select ON "PropensityScore" FOR SELECT
  USING (
    "orgId" = current_setting('app.current_org_id', true)
    OR "orgId" IS NULL
  );

DROP POLICY IF EXISTS tenant_isolation_insert ON "PropensityScore";
CREATE POLICY tenant_isolation_insert ON "PropensityScore" FOR INSERT
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

DROP POLICY IF EXISTS tenant_isolation_update ON "PropensityScore";
CREATE POLICY tenant_isolation_update ON "PropensityScore" FOR UPDATE
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

DROP POLICY IF EXISTS tenant_isolation_delete ON "PropensityScore";
CREATE POLICY tenant_isolation_delete ON "PropensityScore" FOR DELETE
  USING ("orgId" = current_setting('app.current_org_id', true));
