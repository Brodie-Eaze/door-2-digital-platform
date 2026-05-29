# Runbook — RLS belt cutover (Phase B: arm the database-enforced tenant floor)

> **Status:** Phase A shipped (RLS policies live, owner-bypassed, proven by
> `tests/integration/rls-belt.test.ts`). Phase B (this runbook) is the GATED
> production cutover that points the app's `DATABASE_URL` at the non-owner
> `d2d_app` role so the database itself enforces tenant isolation.
> **Owner:** Brodie · **Risk:** HIGH (a wrong move locks the app out of its own
> data or breaks login). Do staging + canary first. Have rollback ready.
> **Related:** `prisma/migrations/20260529000000_rls_belt/migration.sql`,
> `prisma/rls/bootstrap-app-role.sql`, `src/config/db.ts` (`tenantTx`/`runTenantTx`).

---

## 0. TL;DR

The RLS belt is already enforced for the non-owner role `d2d_app` — we prove it
in CI today. It is _dormant in production_ only because the app connects as the
table owner (`d2d`), which Postgres exempts from non-FORCEd RLS. **Arming the
belt = changing one secret** (`DATABASE_URL` → `d2d_app`). Before you flip it,
two things must be true or the app breaks:

1. **Every tenant-data mutation path runs inside `tenantTx(orgId, …)`** so the
   `app.current_org_id` GUC is set; otherwise writes fail `WITH CHECK` and reads
   return zero rows (deny-by-default).
2. **The pre-auth credential-lookup tables are handled** (see §3, Class B) —
   these are read _before_ any org context exists, so RLS deny-by-default would
   break login/refresh/idempotency outright.

This runbook is the checklist for making both true, then cutting over safely.

---

## 1. Why the belt is dormant today (and why tests still prove it)

- The `rls_belt` migration uses `ENABLE ROW LEVEL SECURITY` (not `FORCE`).
- Postgres exempts a table's **owner** from non-FORCEd RLS. Migrations, seeds,
  and the running app all connect as the owner role `d2d` → unaffected → the
  full suite (240 tests) stays green.
- RLS only _bites_ for a role that is **not** the owner **and** does **not**
  have `BYPASSRLS`. That role is `d2d_app` (see `bootstrap-app-role.sql`).
- `tests/integration/rls-belt.test.ts` connects as `d2d_app` and proves
  deny-by-default, positive scoping, cross-tenant read invisibility, and
  `WITH CHECK` write refusal. **So the belt is real and verified — it is simply
  not yet the role the app uses.**

---

## 2. The single switch

Production today (owner, RLS dormant):

```
DATABASE_URL = postgresql://d2d:<owner-pw>@<host>:5432/<db>?schema=public
```

After cutover (non-owner, RLS enforced):

```
DATABASE_URL = postgresql://d2d_app:<D2D_APP_PASSWORD>@<host>:5432/<db>?schema=public
```

`d2d_app` is `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS` with DML
(SELECT/INSERT/UPDATE/DELETE) on all tables + USAGE/SELECT on sequences, and no
DDL. **Migrations keep running as the owner `d2d`** — never migrate as
`d2d_app` (it can't, by design).

---

## 3. Cutover hazard inventory — the two classes of RLS-enabled table

The migration enabled RLS on **26** tables. They split into two classes with
very different cutover requirements.

### Class A — tenant-data tables (the belt's real target) — 22 tables

```
AdAccount  AdCampaign  AuditEvent  BrandKit  Campaign  Commission
CommissionPlan  ContentGenerationJob  Conversion  Creative  Knock
KnockSession  Lead  NotificationLog  OrgBilling  PayoutBatch
PiiUnmaskRequest  ProviderConnection  ProviderWebhookEvent
SsoConfiguration  Territory  WebhookEndpoint
```

These are always accessed **with** an org context (the request is
authenticated, `actor.orgId` is known). Requirement: every **mutation** path
that writes these must run inside `tenantTx(actor.orgId, …)` so the GUC is set.
Reads via the WS1 `tenantPrisma($extends)` injector already carry
`where: { orgId }`; under the belt the DB enforces the same constraint as a
second wall.

> **Status of Class A migration:** the canonical money path —
> `conversion/service.ts` `createConversion` — is **done** (it now calls
> `tenantTx(actor.orgId, …)` instead of `prisma().$transaction`). It is the
> reference implementation; replicate that one-line swap across the remaining
> `prisma().$transaction(async (tx) => …)` sites listed in §4.

### Class B — identity / credential-lookup tables read PRE-AUTH — 4 tables

```
User   RefreshToken   IdempotencyRecord   ApiKey
```

These are read **before** any org context exists, **by a globally-unique
credential**, where the orgId is the _output_ of the lookup, not an input:

| Path               | Code                               | Lookup key                                     | Hazard under `d2d_app`                                                                  |
| ------------------ | ---------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| Login              | `auth/service.ts` `login()`        | `User.emailDigest`                             | `findUnique` returns **0 rows** (no GUC) → **every login fails**                        |
| Token refresh      | `auth/service.ts` `refresh()`      | `RefreshToken.tokenHash`                       | `findUnique` returns **0 rows** → **every refresh fails**                               |
| Idempotency replay | `shared/middleware/idempotency.ts` | `IdempotencyRecord.key` (incl. `'__public__'`) | `findUnique` returns null → replays silently re-execute; `upsert` may fail `WITH CHECK` |
| Partner API auth   | `ApiKey` by prefix                 | `ApiKey.prefix`                                | `findUnique` returns **0 rows** → **partner keys never authenticate**                   |
| Failed-login audit | `login()` failed branch            | writes `AuditEvent` with no GUC                | `INSERT` fails `WITH CHECK` → **login error path 500s**                                 |

You **cannot** set `app.current_org_id` before these reads because you do not
yet know the org — that is the whole point of an authentication lookup. RLS
deny-by-default is therefore the _wrong tool_ for the credential-lookup itself.

#### Recommended Class B remediation (pick ONE; option 1 is the default)

**Option 1 — leave RLS OFF on the 4 credential tables (DEFAULT).**
The lookup key on each is a high-entropy unique secret (`emailDigest` is an
HMAC; `tokenHash` is SHA-256; `ApiKey.prefix` + secret; idempotency `key` is
caller-supplied + checked against stored `orgId` in app code). A cross-tenant
read would require _already possessing another tenant's secret_, so the residual
risk of relying on the existing app-layer checks (which are present:
`refresh()` re-validates `stored.user.status`; `loadCachedResponse` rejects on
`record.orgId !== orgId`) is low. The belt covers the other 22 tables in full.

Apply at cutover time (NOT now — gated):

```sql
-- Phase B remediation migration (run as owner d2d, immediately BEFORE flipping
-- DATABASE_URL). Disables RLS on the pre-auth credential-lookup tables so the
-- d2d_app role can perform identity bootstrap. Compensating control = the
-- unique secret + the existing app-layer orgId checks.
ALTER TABLE "User"              DISABLE ROW LEVEL SECURITY;
ALTER TABLE "RefreshToken"      DISABLE ROW LEVEL SECURITY;
ALTER TABLE "IdempotencyRecord" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "ApiKey"            DISABLE ROW LEVEL SECURITY;
```

> Trade-off (be honest): `User`, `RefreshToken`, `IdempotencyRecord`, `ApiKey`
> are then protected by the app layer only (WS1 injector + explicit checks), not
> by the DB belt. Accept this consciously and note it in the SOC 2 control
> narrative for CC6 (logical access).

**Option 2 — bootstrap policies keyed on a session flag.** Keep RLS enabled but
add a permissive policy that allows a credential-lookup `SELECT` when a
`app.auth_bootstrap` GUC is set true by the auth/idempotency layer for exactly
that one query, then cleared. More surface area, more ways to get it subtly
wrong; only choose this if an auditor insists every table carry RLS.

**Option 3 — a second narrow role `d2d_auth`** used solely by the auth +
idempotency modules with `BYPASSRLS`, while `d2d_app` (no bypass) serves
everything else. Two pools, two secrets, routing complexity. Not recommended for
a solo operator.

#### Class B writes you SHOULD still pin (defense in depth, orgId is known)

Even with Option 1, wrap these writes in `tenantTx(orgId, …)` because the org is
known by the time they run — costs nothing, and they keep working if RLS is ever
re-enabled on those tables:

- `auth/service.ts` `issueTokens()` — `RefreshToken.create` + `User.update` +
  audit (has `user.orgId`).
- `auth/service.ts` `login()` failed branch — failed-login audit (has
  `user.orgId` after the user lookup).
- `auth/service.ts` `logout()` — when `args.orgId` is present.

---

## 4. Class A paths still to wrap before cutover

Reference swap (already applied to `conversion/service.ts`):

```ts
// before
const result = await prisma().$transaction(async (tx) => { … });
// after
import { tenantTx } from '../../config/db';
const result = await tenantTx(actor.orgId, async (tx) => { … });
```

Remaining `prisma().$transaction` sites that write Class A tables (grep
`'\$transaction'` under `src/domains`). Wrap each with the caller's org id:

- `domains/sale/service.ts`
- `domains/donation/service.ts` (×3)
- `domains/pii-vault/service.ts` (×4) — uses `PiiUnmaskRequest`
- `domains/notification/service.ts`
- `domains/user/service.ts` (×4) — **Class A writes (e.g. invite, role change)
  use `orgId`; the credential upsert in `setUserPassword` touches Class B
  `UserCredential`/`User` — handle per §3.**
- `domains/org/service.ts` (×5) — **`createOrg` writes the control-plane `Org`
  row (no `orgId`, not RLS-enabled) PLUS the first `User`; sequence so the
  org-scoped writes are pinned, the control-plane write is not.**
- `domains/compliance/service.ts` (×2)
- `domains/territory/service.ts` (×4)
- `domains/lead/service.ts` (×4)
- `domains/marketing/service.ts` (×4)
- `domains/webhook/service.ts` (×3)

> Each swap must keep the existing `orgId` stamping in the `data`/`where` — the
> GUC is the floor _underneath_ that, not a replacement. Run
> `pnpm --filter api test` after each domain; keep the suite green at every step
> (same discipline as the conversion exemplar).

A standing `rls-belt.test.ts`-style probe per critical domain (run as `d2d_app`)
is the proof each wrap actually bites — add one for any domain whose isolation
you must be able to demonstrate to an auditor.

---

## 5. Cutover sequence (staging → canary → prod)

**Preconditions (all must be green):**

- [ ] All §4 Class A mutation paths wrapped in `tenantTx`; `pnpm --filter api test` green.
- [ ] Class B remediation chosen + migration written (NOT yet applied to prod).
- [ ] `d2d_app` role bootstrapped in the target DB (`psql … -f prisma/rls/bootstrap-app-role.sql -v app_password=…`); `D2D_APP_PASSWORD` stored in the secret manager (NEVER committed).
- [ ] `rls-belt.test.ts` passing against the target DB shape.
- [ ] Rollback secret value (the current owner `DATABASE_URL`) saved somewhere you can paste in < 60s.

**Staging:**

1. Apply the Class B remediation migration (as owner).
2. Flip staging `DATABASE_URL` → `d2d_app`. Redeploy.
3. Smoke: login, refresh, create a lead, create a conversion, run the
   cross-tenant probe. Watch logs for `permission denied` / `row-level security`
   / zero-row anomalies. Let it bake ≥ 24h with synthetic traffic.

**Production canary:**

4. Apply the Class B remediation migration to prod (as owner).
5. Flip ONE prod API replica/task to the `d2d_app` `DATABASE_URL` (or a 5%
   weighted target group). Keep the rest on owner.
6. Watch SLOs (login success rate, 5xx rate, the `app.current_org_id`-missing
   error signature) for 30–60 min.

**Production full:**

7. Roll the remaining replicas to `d2d_app`. Confirm migrations job still uses
   the owner `DATABASE_URL` (CI/CD `db:migrate` step must NOT inherit the app
   secret).

---

## 6. Verification (post-cutover)

- [ ] `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname='d2d_app';` → `f, f`.
- [ ] Login + refresh + logout succeed end-to-end (Class B intact).
- [ ] Create lead → knock → conversion succeed (Class A through the belt).
- [ ] Cross-tenant probe: an authenticated org-A request cannot read/write org-B
      rows — and now the DB (not just the app) refuses. Capture the audit row.
- [ ] App logs show **no** `new row violates row-level security policy` and **no**
      unexpected zero-row reads on Class A tables.
- [ ] `rls-belt.test.ts` still green in CI.

---

## 7. Rollback (fast, reversible)

The cutover is a config flip, so rollback is a config flip:

1. Set `DATABASE_URL` back to the owner (`d2d`) value. Redeploy.
2. RLS goes dormant again instantly (owner bypass). App behaves exactly as
   pre-cutover. No data migration to undo.
3. The Class B `DISABLE ROW LEVEL SECURITY` statements are harmless to leave in
   place under the owner (owner bypassed RLS anyway); re-enable later when you
   resume the cutover. Do **not** re-`ENABLE` mid-incident.

> Because rollback is just the owner secret, the only true point of no return is
> a _destructive_ schema change — and there is none here. The belt is additive.

---

## 8. What this runbook deliberately does NOT do

- It does **not** apply the Class B remediation migration (gated — that is a
  Phase B production action requiring Brodie's explicit go).
- It does **not** flip any `DATABASE_URL`.
- It does **not** wrap all 22 Class A domains — only the conversion exemplar is
  done; §4 is the remaining backlog, intentionally incremental so the suite
  stays green at every step.
