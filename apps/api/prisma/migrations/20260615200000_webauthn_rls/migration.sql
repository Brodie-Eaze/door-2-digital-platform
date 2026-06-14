-- RLS belt for WebAuthnCredential (ADR-0026, SEC-005 extension).
--
-- WebAuthnCredential is user-scoped (not org-scoped) so the standard
-- tenant_isolation policy using app.current_org_id does not apply.
-- Instead we isolate by userId via the app.current_user_id GUC.
--
-- RLS CUTOVER NOTE
-- ----------------
-- Like all tables in the RLS belt, this policy uses ENABLE without FORCE,
-- meaning the owner role (d2d) continues to bypass it — existing code and
-- migrations are unaffected.  The policy becomes active for the d2d_app role
-- (see docs/runbooks/rls-cutover.md).
--
-- PRE-AUTH ASSERTION FLOW
-- -----------------------
-- findAuthenticatorByCredentialId() looks up a row by credentialId (PK)
-- before the actor's identity is established.  When the d2d_app role is
-- activated, that specific query will need the calling code to:
--   a) run via a SECURITY DEFINER function with BYPASSRLS, OR
--   b) set `SET LOCAL app.current_user_id = '<resolved userId>'` immediately
--      after looking up the credentialId via a separate, unrestricted lookup.
-- Tracked in: docs/runbooks/rls-cutover.md §WebAuthnCredential exception.
--
-- Idempotent: re-running drops + recreates the policy.

ALTER TABLE "WebAuthnCredential" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_isolation ON "WebAuthnCredential";
CREATE POLICY user_isolation ON "WebAuthnCredential"
  USING ("userId" = current_setting('app.current_user_id', true))
  WITH CHECK ("userId" = current_setting('app.current_user_id', true));
