-- SEC-005 · §4b — pre-auth identity resolvers (the RLS-cutover unblock, "Option C").
--
-- THE PROBLEM
--   The rls_belt migration ENABLEs (not FORCEs) Row-Level Security on every
--   org-scoped table. After cutover the app connects as the NON-owner `d2d_app`
--   role, for which the per-tenant policies read `app.current_org_id` (a GUC set
--   per transaction by runTenantTx). That works everywhere there IS an org
--   context — but three flows are PRE-AUTH: they have no session, so no org id to
--   pin, so under `d2d_app` a direct table read compares orgId against NULL →
--   deny-by-default → zero rows. The flows:
--     • login            — look a user up by emailDigest before any token exists
--     • refresh          — look a refresh-token row up by tokenHash
--     • acceptInvite     — look a credential up by inviteTokenHash
--
-- THE FIX (SECURITY DEFINER, narrow + audited)
--   A SQL function owned by the table owner (`d2d`) and marked SECURITY DEFINER
--   executes with the OWNER's privileges. Inside it the effective user is the
--   owner, who is EXEMPT from non-FORCE RLS — so the function can resolve the
--   single identity row keyed on a globally-unique secret column and hand back
--   the minimal columns the caller needs (crucially: the owning `orgId`). The
--   caller then RE-ENTERS the belt with that orgId for every subsequent write, so
--   the bypass is confined to one indexed point-lookup per pre-auth request and
--   nothing else widens.
--
-- HARDENING (why each line is here)
--   • SECURITY DEFINER + owner-owned → the only privilege that bypasses the belt.
--   • SET search_path = pg_catalog, public, pg_temp → pin resolution; pg_temp LAST
--     so a temp object can never shadow a reference (the classic DEFINER exploit).
--   • Every table reference is schema-qualified (public."User" …) so search_path
--     cannot redirect it regardless.
--   • STABLE → no writes; planner may inline; faithful read semantics.
--   • Typed text parameter → the value is bound, never concatenated (no injection).
--   • Minimal projection → only the columns the caller dereferences; enum columns
--     are cast ::text (enum→text is explicit) and re-narrowed in TypeScript.
--   • REVOKE EXECUTE … FROM PUBLIC → no role gets the bypass by default.
--   • Conditional GRANT EXECUTE … TO d2d_app → arm the app role IFF it already
--     exists. On a fresh DB d2d_app is created AFTER this migration (by the role
--     bootstrap), so the GRANT is skipped here and the bootstrap's
--     `GRANT EXECUTE ON ALL FUNCTIONS` arms it instead. When d2d_app pre-exists
--     (persistent DB), this GRANT fires. Both orderings are covered.
--
-- The owner role is unaffected (it bypasses the belt anyway), so existing tests
-- and seeds that connect as `d2d` see no behavioural change.

-- 1. login: resolve identity + password hash by the globally-unique emailDigest.
--    LEFT JOIN UserCredential so a user with no credential still returns one row
--    with passwordHash = NULL (login maps that to the same 401 as a bad password).
CREATE OR REPLACE FUNCTION app_resolve_user_by_email_digest(p_email_digest text)
RETURNS TABLE (
  id             text,
  "orgId"        text,
  role           text,
  "regionCode"   text,
  "brandCode"    text,
  email          text,
  "givenName"    text,
  "familyName"   text,
  status         text,
  "passwordHash" text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT u.id,
         u."orgId",
         u.role::text,
         u."regionCode"::text,
         u."brandCode",
         u.email,
         u."givenName",
         u."familyName",
         u.status,
         c."passwordHash"
  FROM public."User" u
  LEFT JOIN public."UserCredential" c ON c."userId" = u.id
  WHERE u."emailDigest" = p_email_digest
$$;

-- 2. refresh: resolve the token row + the owning user's identity by tokenHash.
--    INNER JOIN — RefreshToken.userId is a non-null FK to User. No passwordHash:
--    refresh never re-checks a password, so it is deliberately not returned.
CREATE OR REPLACE FUNCTION app_resolve_refresh_token(p_token_hash text)
RETURNS TABLE (
  "rtId"        text,
  "userId"      text,
  "orgId"       text,
  "expiresAt"   timestamp(3),
  "revokedAt"   timestamp(3),
  role          text,
  status        text,
  "regionCode"  text,
  "brandCode"   text,
  email         text,
  "givenName"   text,
  "familyName"  text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT rt.id,
         rt."userId",
         rt."orgId",
         rt."expiresAt",
         rt."revokedAt",
         u.role::text,
         u.status,
         u."regionCode"::text,
         u."brandCode",
         u.email,
         u."givenName",
         u."familyName"
  FROM public."RefreshToken" rt
  JOIN public."User" u ON u.id = rt."userId"
  WHERE rt."tokenHash" = p_token_hash
$$;

-- 3. acceptInvite: resolve the credential's owning user + orgId by inviteTokenHash.
--    INNER JOIN — UserCredential.userId is the PK and a FK to User. Returns just
--    enough for the caller to re-enter the belt (orgId) and gate on expiry.
CREATE OR REPLACE FUNCTION app_resolve_invite(p_invite_token_hash text)
RETURNS TABLE (
  "userId"          text,
  "orgId"           text,
  "regionCode"      text,
  "inviteExpiresAt" timestamp(3)
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT c."userId",
         u."orgId",
         u."regionCode"::text,
         c."inviteExpiresAt"
  FROM public."UserCredential" c
  JOIN public."User" u ON u.id = c."userId"
  WHERE c."inviteTokenHash" = p_invite_token_hash
$$;

-- 4. Lock the bypass down: no implicit PUBLIC execute, explicit app-role execute.
REVOKE EXECUTE ON FUNCTION app_resolve_user_by_email_digest(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app_resolve_refresh_token(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app_resolve_invite(text) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'd2d_app') THEN
    GRANT EXECUTE ON FUNCTION app_resolve_user_by_email_digest(text) TO d2d_app;
    GRANT EXECUTE ON FUNCTION app_resolve_refresh_token(text) TO d2d_app;
    GRANT EXECUTE ON FUNCTION app_resolve_invite(text) TO d2d_app;
  END IF;
END $$;
