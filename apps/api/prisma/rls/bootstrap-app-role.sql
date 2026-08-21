-- SEC-005 · Bootstrap the NON-OWNER application role that RLS actually bites.
--
-- WHY THIS EXISTS
--   The rls_belt migration ENABLEs (not FORCEs) Row-Level Security on every
--   org-scoped table. Postgres exempts a table's OWNER from non-FORCEd RLS, so
--   migrations/seeds/the current app — all connecting as the owner role `d2d` —
--   are unaffected and the test suite stays green. RLS only *enforces* for a
--   role that (a) is NOT the table owner and (b) does NOT have BYPASSRLS. That
--   role is `d2d_app`, created here. Arming production = pointing the app's
--   DATABASE_URL at `d2d_app` (see docs/runbooks/rls-cutover.md).
--
-- RUN AS A SUPERUSER (CREATE ROLE needs CREATEROLE/superuser). Locally that is
-- your OS user via peer auth; in CI it is the provisioning superuser. Example:
--
--   psql -h localhost -U <superuser> -d <db> \
--     -v app_password="$D2D_APP_PASSWORD" \
--     -f apps/api/prisma/rls/bootstrap-app-role.sql
--
-- The password is supplied as a psql variable and NEVER stored in this file.
-- `owner_role` defaults to `d2d` (the migration/owner role); override with
-- `-v owner_role=<role>` if your environment differs.
--
-- Idempotent: safe to re-run. Re-running rotates the password and re-applies
-- grants (useful for credential rotation).

\set ON_ERROR_STOP on

-- Default owner_role to 'd2d' when not provided on the command line.
\if :{?owner_role}
\else
  \set owner_role d2d
\endif

-- Require app_password — refuse to create a passwordless login role.
\if :{?app_password}
\else
  \echo 'FATAL: app_password is required. Pass -v app_password="<secret>".'
  \quit 1
\endif

-- 1. Create the role only if absent (\gexec runs the generated CREATE, or
--    nothing when the SELECT returns zero rows because the role exists).
SELECT 'CREATE ROLE d2d_app LOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'd2d_app')
\gexec

-- 2. Pin the role attributes every time (idempotent) and (re)set the password.
--    Explicitly NOSUPERUSER + NOBYPASSRLS so RLS is guaranteed to apply — this
--    is the whole point of the belt.
ALTER ROLE d2d_app
  WITH LOGIN
       NOSUPERUSER
       NOCREATEDB
       NOCREATEROLE
       NOBYPASSRLS
       PASSWORD :'app_password';

-- 3. Connect + schema usage. Use current_database() so this works regardless of
--    db name (d2d_test locally, the prod db in production).
SELECT 'GRANT CONNECT ON DATABASE ' || quote_ident(current_database()) || ' TO d2d_app'
\gexec

GRANT USAGE ON SCHEMA public TO d2d_app;

-- 4. DML on all existing tables + sequences. No DDL, no TRUNCATE, no ownership.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO d2d_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO d2d_app;

-- 4b. EXECUTE on existing functions — specifically the SECURITY DEFINER pre-auth
--     identity resolvers (§4b / Option C). They are the ONLY belt bypass: login,
--     refresh, and acceptInvite call them to resolve identity + orgId before any
--     session exists, then re-enter the belt with that orgId. Without this grant
--     the app role cannot execute them and the pre-auth flows break post-cutover.
--     (The resolver migration also conditionally grants this when d2d_app already
--     exists; this line covers the fresh-DB ordering where the role is created
--     AFTER the migration ran.)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO d2d_app;

-- 5. Future tables/sequences/functions created by the owner role inherit the same
--    grants, so new migrations don't silently lock the app out. Scoped to objects
--    the owner creates (that is who migrations run as).
ALTER DEFAULT PRIVILEGES FOR ROLE :owner_role IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO d2d_app;
ALTER DEFAULT PRIVILEGES FOR ROLE :owner_role IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO d2d_app;
ALTER DEFAULT PRIVILEGES FOR ROLE :owner_role IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO d2d_app;

\echo 'd2d_app bootstrapped: LOGIN NOSUPERUSER NOBYPASSRLS, DML + function EXECUTE granted, RLS will enforce.'
