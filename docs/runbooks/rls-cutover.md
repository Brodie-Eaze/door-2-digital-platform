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
THREE things must be true or the app breaks:

1. **Every tenant-data _mutation_ path runs inside `tenantTx(orgId, …)`** so the
   `app.current_org_id` GUC is set; otherwise writes fail `WITH CHECK`.
   **STATUS: DONE.** All Class A `$transaction` write sites are wrapped (§4);
   `pnpm --filter api test` green at 282 tests.
2. **Every tenant-data _read_ path also sets the GUC.** The _mechanism_ for this
   is now **DONE** — `tenantPrismaTx(orgId)` (Option 2, §4b) is a drop-in for
   `prisma()` that GUC-pins each read, proven against `d2d_app` by
   `rls-belt.test.ts` §4b. **What remains is the call-site migration:** the WS1
   `tenantPrisma($extends)` injector adds `where:{orgId}` at the _app_ layer but
   does not set `app.current_org_id`. Under `d2d_app` a read with no GUC evaluates
   `"orgId" = current_setting(…, true)` → `= NULL` → **zero rows** (deny-by-default),
   so every org-scoped Class A read must route through `tenantPrismaTx(orgId)` (which
   opens a short GUC-pinned tx) before the secret is flipped. **STATUS: DONE** — all
   14 Class A read-side domains are migrated (the final `auth/saml` domain closed the
   set); a bare `prisma()` org-scoped read no longer exists outside the documented
   control-plane / no-`orgId` cases.
3. **The pre-auth identity lookups are handled.** login / refresh / acceptInvite
   resolve a `User`/credential _before_ any org context exists, so RLS
   deny-by-default would break them outright. **STATUS: DONE (§4b.3, Option C)** —
   each now routes through an owner-owned `SECURITY DEFINER` resolver that bypasses
   the belt for one keyed lookup and hands back the `orgId`, after which the caller
   re-enters the belt. The remaining Class B tables read pre-auth — `ApiKey`
   (partner auth by prefix) and `IdempotencyRecord` (replay by key) — are **not yet
   resolved**; they still ride the §3 decision (default: leave RLS OFF on those two,
   gated, applied at cutover).

This runbook is the checklist for making all three true, then cutting over
safely. (1) is complete; (2) is complete — the mechanism is proven AND every
Class A read-side call site is migrated (the last blocking code item, including
the final `auth/saml` domain); (3)'s identity resolvers (login / refresh /
acceptInvite) are complete — `ApiKey` + `IdempotencyRecord` remain under the §3
Class B decision.

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
authenticated, `actor.orgId` is known). There are **two** requirements, not one:

1. **Writes** — every mutation path that writes these must run inside
   `tenantTx(actor.orgId, …)` so the GUC is set for the `WITH CHECK`. **DONE
   (§4).**
2. **Reads** — every read path must ALSO set the GUC. This is the open gap. The
   WS1 `tenantPrisma($extends)` injector carries `where: { orgId }` at the _app_
   layer but opens no transaction and never calls
   `set_config('app.current_org_id', …)`. Under `d2d_app` a read with no GUC
   evaluates the policy `USING ("orgId" = current_setting('app.current_org_id', true))`
   as `"orgId" = NULL` → NULL → **zero rows**. So the belt is **not** a "second
   wall behind the app `where`" on reads — un-GUC'd, it is a _wall in front of
   the app entirely_ that returns empty result sets. See §4b.

> **Status of Class A migration:** **all Class A `$transaction` write sites are
> now wrapped in `tenantTx`** — `conversion`, `sale`, `donation`, `pii-vault`,
> `notification`, `user`, `org` (control-plane `Org` write sequenced outside the
> pin), `compliance`, `territory`, `lead`, `marketing`, `webhook`, plus `knock`
> and `auth/saml` (Class A, not in the original backlog list). Validated:
> `pnpm --filter api test` green at **282 tests**. The read-side GUC _mechanism_
> (§4b) is now shipped + proven (`tenantPrismaTx`); the remaining precondition is
> the **mechanical migration** of Class A reads onto it.

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

**Option 1 — only `IdempotencyRecord` leaves the belt; `User` + `RefreshToken`
STAY ON via the §4b.3 pre-auth resolvers (DEFAULT).**

The original form of this option — disable RLS on all four credential tables —
predates the §4b.3 `SECURITY DEFINER` resolvers and is now too broad: it would
strip the belt off the two most sensitive credential tables for no reason. The
resolvers (`app_resolve_user_by_email_digest`, `app_resolve_refresh_token`;
owner-owned, `SECURITY DEFINER`, so they bypass non-FORCE RLS for exactly one
keyed lookup) let the pre-auth identity bootstrap run WITHOUT taking those tables
off the belt: the caller gets the single row back, reads `orgId` from it, then
re-enters the belt with `tenantPrismaTx(orgId)` / `tenantTx(orgId)` for
everything after. Per-table resolution:

| Table               | Pre-auth read                                 | Writes         | RLS at cutover                                                                                                                                      |
| ------------------- | --------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`              | `app_resolve_user_by_email_digest` (resolver) | all `tenantTx` | **STAYS ON** — resolver-covered; P2002 on the global-unique `emailDigest` is an extra floor                                                         |
| `RefreshToken`      | `app_resolve_refresh_token` (resolver)        | all `tenantTx` | **STAYS ON** — resolver-covered                                                                                                                     |
| `IdempotencyRecord` | bare `prisma()` (`key` may be `'__public__'`) | `upsert`       | **OFF** — the public branch has no org context, so no GUC can be set before the read                                                                |
| `ApiKey`            | partner-auth path **not yet wired**           | n/a            | **STAYS ON (deferred)** — leave enabled until the Phase-4 partner path exists, then resolve it the same way (`app_resolve_api_key`) or disable then |

So the cutover migration is a **single statement**, not four:

Apply at cutover time (NOT now — gated):

```sql
-- Phase B remediation migration (run as owner d2d, immediately BEFORE flipping
-- DATABASE_URL). IdempotencyRecord is the ONE pre-auth table with no resolver
-- path: its lookup key can be '__public__' (unauthenticated mutations), so no
-- app.current_org_id can be set before the read. User + RefreshToken keep the
-- belt (covered by the §4b.3 resolvers); ApiKey stays on until its path is wired.
ALTER TABLE "IdempotencyRecord" DISABLE ROW LEVEL SECURITY;
```

> Trade-off (be honest): after this, **`IdempotencyRecord` is the only credential
> table protected by the app layer alone** — not the four the old default named.
> Its compensating control is concrete and already in code: `loadCachedResponse`
> rejects any replay whose stored `record.orgId !== orgId` (or method/path
> differ) with a 409 **before** returning a cached body, and `key` is globally
> `@unique`, so a forged replay can only ever resolve to the original tenant's own
> row. `User` and `RefreshToken` keep BOTH belt and suspenders. Record exactly
> this — one table, named, with its compensating control — in the SOC 2 CC6
> (logical access) narrative; do **not** carry the old "all four are
> app-layer-only" wording, which is now false and overstates the exposure.

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
re-enabled on those tables. **All three are DONE:**

- `auth/service.ts` `issueTokens()` — `RefreshToken.create` + `User.update` +
  audit (has `user.orgId`). **DONE.** Also covers the audit row, which is
  Class A, so it must be pinned regardless of the Class B decision.
- `auth/service.ts` `login()` failed branch — failed-login audit (has
  `user.orgId` after the user lookup). **DONE.** (The audit row is Class A.)
- `auth/service.ts` `logout()` — when `args.orgId` is present. **DONE** via a
  branch: `tenantTx(args.orgId, body)` when the org is known (the logout audit
  is Class A), else `prisma().$transaction(body)` for the bare Class B
  `RefreshToken` revoke that runs pre-auth / by token alone.

---

## 4. Class A write-path wrapping — DONE

Reference swap (the original exemplar, `conversion/service.ts`):

```ts
// before
const result = await prisma().$transaction(async (tx) => { … });
// after
import { tenantTx } from '../../config/db';
const result = await tenantTx(actor.orgId, async (tx) => { … });
```

Every `prisma().$transaction` site that writes a Class A table is now wrapped in
`tenantTx(orgId, …)`, the existing `orgId` stamping in `data`/`where` preserved
(the GUC is the floor _underneath_ the app `where`, not a replacement). Suite
green at **282 tests** after the full batch.

- [x] `domains/conversion/service.ts` — original exemplar
- [x] `domains/sale/service.ts`
- [x] `domains/donation/service.ts` (×3)
- [x] `domains/pii-vault/service.ts` (×4) — `PiiUnmaskRequest`
- [x] `domains/notification/service.ts`
- [x] `domains/user/service.ts` (×4 of 4) — invite / update / archive wrapped in
      `tenantTx`; **`acceptInvite` now resolves identity via the §4b.3 `SECURITY
    DEFINER` resolver `app_resolve_invite(inviteTokenHash)`** (pre-auth, no org
      context to pin), then runs the credential update + user activation + audit
      inside `tenantTx(cred.orgId, …)`. The old `include:{user:true}` owner path is
      gone. The `setUserPassword` credential upsert (Class B) stays unpinned per §3.
- [x] `domains/org/service.ts` (×5) — control-plane `Org`/first-`User` write
      sequenced OUTSIDE the pin; org-scoped writes pinned
- [x] `domains/compliance/service.ts` (×2)
- [x] `domains/territory/service.ts` (×4)
- [x] `domains/lead/service.ts` (×4)
- [x] `domains/marketing/service.ts` (×4)
- [x] `domains/webhook/service.ts` (×3)
- [x] `domains/knock/service.ts` (×2) — **not in the original backlog**; `Knock` + `KnockSession` are Class A. Includes the perf-sensitive 500-knock batch
      (`{ timeout: 30_000 }` now passed through `tenantTx`'s options arg).
- [x] `domains/auth/saml/service.ts` (×2) — **not in the original backlog**;
      `SsoConfiguration` is Class A and both sites co-write an audit row.
- [x] `domains/auth/service.ts` (×3 Class B defense-in-depth, §3) — issueTokens,
      failed-login audit, logout-with-org. The bare token-only logout keeps a
      plain `$transaction` (Class B, runs pre-auth) — the one intentional
      unwrapped `$transaction` left in `src/domains`.

A standing `rls-belt.test.ts`-style probe per critical domain (run as `d2d_app`)
is the proof each wrap actually bites — add one for any domain whose isolation
you must be able to demonstrate to an auditor.

---

## 4b. Read-side GUC — mechanism SHIPPED (Option 2); call-site migration remaining

Wrapping writes makes the belt _safe to write through_. It does **not** make
reads work under `d2d_app`. As described in §3 Class A item 2: a Class A read
issued with no `app.current_org_id` GUC returns **zero rows** under the belt,
because the policy compares `"orgId" = NULL`. The WS1 `tenantPrisma($extends)`
injector does not set the GUC (it has no transaction to scope it to). So a read
issued through plain `prisma()` under `d2d_app` returns nothing — which is why
**flipping the secret before migrating reads would empty every authenticated
Class A list/detail view** — a silent correctness outage, not a security win.

This was a design change, not a mechanical swap. Three options were evaluated:

1. **Per-request transaction-scoped GUC.** A Fastify `preHandler` (after auth
   resolves `principal.orgId`) opens the request's DB work inside a transaction
   that first runs `set_config('app.current_org_id', orgId, true)`. Cleanest
   semantically; requires the request's reads to share one tx/connection —
   non-trivial with Prisma's per-call connection model. **Rejected** (hard to do
   reliably with Prisma).
2. **Connection-level `SET` via a pooled role-per-tenant or session GUC.** Set
   the GUC `SET` (session, not `set_config(..., true)`) once per checked-out
   connection bound to the request's org. Fast, but fragile with shared poolers
   (PgBouncer transaction mode) — a leaked GUC across tenants on a reused
   connection would be a cross-tenant read. **Rejected** (pooler mode is not
   provably session-pinned).
3. **`tenantPrisma` reads routed through `runTenantTx` (CHOSEN, SHIPPED).** A
   sibling `tenantPrismaTx(orgId)` client (`apps/api/src/config/db.ts`) whose
   `$extends.$allOperations` wraps each org-scoped op in a short
   GUC-pinned `runTenantTx` transaction. It is a drop-in for `prisma()` at the
   call site — `tenantPrismaTx(orgId).lead.findMany()` instead of
   `prisma().lead.findMany({ where: { orgId } })`. Per-op `findUnique` is
   rewritten to `findFirst` + the orgId predicate so a foreign PK simply
   resolves to `null` under RLS rather than erroring. The reshape logic
   (`reshapeForTenant`) is now the **single source of truth** shared with the
   no-tx WS1 belt (`buildTenantClient`), so the two cannot drift.

**Proven by a `d2d_app` read probe.** `tests/integration/rls-belt.test.ts`
§4b drives `tenantPrismaTxOn(app, orgId)` through the real non-owner,
NOBYPASSRLS `d2d_app` role and asserts: a standalone read returns exactly the
caller's tenant (no manual tx), a foreign-PK `findUnique` is invisible (→
`null`), `count` is tenant-scoped, and a write stamps the caller org while a
spoofed `orgId` is rejected before it reaches Postgres. 11/11 belt tests green;
the 12/12 `tenant-prisma.test.ts` regression confirms the shared-helper refactor
did not change the WS1 belt's behaviour. (Cost note: Option 2 adds one short tx
per read — acceptable for Class A list/detail; revisit if a hot read path shows
latency regression under load.)

**Remaining follow-up before cutover — read migration DONE; the §3 Class B call + the smoke remain.**
The mechanism is proven AND every Class A read call-site has been migrated from
`prisma().<model>.findX({ where: { orgId } })` to
`tenantPrismaTx(orgId).<model>.findX()` (tracked per domain, mirroring the §4 write
wrapping; the final `auth/saml` domain closed the set). The only code item left
before a flip is the §3 Class B decision for `IdempotencyRecord` (and `ApiKey` when
its partner-auth path is wired) — see §3. Do not cut over until that decision's
migration is staged AND a full-surface smoke under `d2d_app` shows no zero-row
anomalies.

> ⚠️ Do NOT call `tenantPrismaTx` _inside_ a `tenantTx`/`runTenantTx` callback —
> it would open a second, independent transaction. Use the handed `tx` delegate
> there. (Validation reads that precede a write tx are fine — they run before the
> tx opens. This is why the `lead` write paths could migrate cleanly.)

### 4b.1 The one semantics call: cross-tenant single-resource reads become 404, not 403

Migrating a read is mostly mechanical, but there is **one genuine API-behaviour
change** the belt forces, and it must be applied consistently as each domain
migrates:

- **Before (WS1 app-layer):** a single-resource read (`GET /v1/leads/:id`) fetched
  the row by PK with `prisma()`, found it, compared `row.orgId !== actor.orgId`,
  and returned **403 `tenantMismatch`**. The app _saw_ the foreign row in order to
  reject it.
- **After (RLS belt):** under `d2d_app` the foreign row is **invisible** — the
  read resolves to `null`. There is no row to compare an orgId against, so the
  handler can only return **404 `notFound`**.

This is **correct and intended**, not a regression. Withholding existence is the
_point_ of tenant isolation; a 403 ("you may not see this") itself discloses that
the resource exists, which is exactly the cross-tenant existence-oracle OWASP
warns against. So the migration **deliberately** flips cross-tenant single-GET
from 403 → 404. The dead `row.orgId !== actor.orgId` branch is removed (the row is
already gone), and the handler returns `Problems.notFound(...)` on `null`.

Two read shapes are **behaviour-preserving** and do _not_ change status codes:

- **List / aggregate reads** (`findMany`, `groupBy`, `count`) — already org-scoped;
  a foreign tenant's rows were never in the result set. Same output before/after.
- **Validation reads** (e.g. "is `assignedToId` a user in my org?") — the check
  collapses from `!u || u.orgId !== actor.orgId` to just `!u` (the foreign user is
  invisible → `null`), and still returns the same **400 `validation`**. Status
  unchanged; only the now-impossible second clause is dropped.

> **Platform-wide implication — surface to Brodie.** Every Class A domain that
> still has a cross-tenant **403** test on a single-resource GET will flip that
> assertion to **404** as it migrates. This is a public-API-contract change for
> any caller that distinguishes the two. It is the right call under RLS, but it is
> a _decision with blast radius_, not a silent refactor — track it in the cutover
> comms and the API changelog.

### 4b.2 Migration tracker (per Class A domain)

`lead` is the **reference implementation** — migrate the rest in its image
(list/detail/validation read shapes, 403→404 on cross-tenant GET, a `d2d_app`
scoping probe in `rls-belt.test.ts`, both-roles green).

| Class A domain                                                                 | Reads migrated                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 403→404 applied                                                                        | `d2d_app` probe                                                                   | Status           |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------- |
| **lead** (Lead, User, Campaign, Knock)                                         | ✅ 8/8 sites                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | ✅ `GET /leads/:id`                                                                    | ✅ User + Campaign                                                                | **DONE**         |
| **conversion** (Conversion)                                                    | ✅ 3/3 sites                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | ✅ `GET /conversions/:id` + create lead-validation                                     | ✅ Conversion                                                                     | **DONE**         |
| **donation** (Donation→Conversion)                                             | ✅ tenant guard                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | ✅ `GET /donations/:id`                                                                | rides Conversion probe                                                            | **DONE**         |
| **sale** (Sale→Conversion)                                                     | ✅ tenant guard                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | ✅ `GET /sales/:id` + handoff                                                          | rides Conversion probe                                                            | **DONE**         |
| **org** (Org)                                                                  | n/a — control-plane                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | n/a — route-guard 403                                                                  | n/a                                                                               | **N/A (no RLS)** |
| **user** (User)                                                                | ✅ list/get/update/archive + acceptInvite (via §4b.3 resolver)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | ✅ `GET /users/:id`                                                                    | ✅ emailDigest P2002 contract + rides lead User probe                             | **DONE**         |
| **auth** (login/refresh/acceptInvite — pre-auth)                               | ✅ via §4b.3 `SECURITY DEFINER` resolvers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | n/a — pre-auth, no single-GET                                                          | ✅ 3 resolver probes (user/refresh/invite)                                        | **DONE**         |
| **territory** (Territory, Campaign, Knock, User)                               | ✅ 8/8 sites                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | ✅ `GET /territories/:id` + addAssignment body-ref                                     | ✅ Territory                                                                      | **DONE**         |
| **knock** (Knock, KnockSession, Territory)                                     | ✅ 9/9 sites (Address stays on `prisma()`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | ✅ `GET /knocks/:id` + `POST /sessions` start                                          | ✅ Knock + KnockSession                                                           | **DONE**         |
| **compliance** (CampaignStateClearance→Campaign, PaidSolicitorRegistration)    | ✅ matrix read via `tenantTx` (CSC→Campaign relation join); `fileRegistration` Campaign-validation via `tenantPrismaTx`; `assertStateCleared` + `transitionRegistration` PSR reads stay on `prisma()` (no `orgId`)                                                                                                                                                                                                                                                                                                                                                       | ✅ `fileRegistration` foreign-campaign + `transitionRegistration` foreign-entity → 404 | ✅ CSC→Campaign relation-join (gated no-GUC / admitted orgA-GUC)                  | **DONE**         |
| **notification** (NotificationLog)                                             | ✅ 1/1 site (`listNotifications`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | n/a — no single-GET (list-only read)                                                   | ✅ NotificationLog                                                                | **DONE**         |
| **marketing** (ProviderConnection, ContentGenerationJob, ProviderWebhookEvent) | ✅ 17/17 sites — compound `orgId_kind` / `providerKind_externalId` `findUnique` rewritten to scalar `findFirst` (reshaper AND's `orgId` at top level; a compound-key name is not a valid `findFirst` filter); standalone audit-free writes via `tenantPrismaTx`; writes-with-audit stay in `tenantTx`; the global-unique webhook-replay read now returns null on a foreign collision (P2002 re-throws, no cross-org leak)                                                                                                                                                | ✅ `GET /marketing/creatives/jobs/:id` (`getJob`)                                      | ✅ ProviderConnection + ContentGenerationJob (incl. scoped `(orgId,kind)` lookup) | **DONE**         |
| **audit** (AuditEvent)                                                         | ✅ 2/2 sites (`listEvents` + `verifyChain` org-branch); platform chain (orgId NULL) stays on owner `prisma()`                                                                                                                                                                                                                                                                                                                                                                                                                                                            | n/a — no single-GET                                                                    | ✅ AuditEvent (org-scoped + NULL-org owner-only proof)                            | **DONE**         |
| **webhook** (WebhookEndpoint)                                                  | ✅ 4/4 sites — `listEndpoints` / `rotateSecret` / `softDeleteEndpoint` / `listDeliveries` endpoint read via `tenantPrismaTx`; writes-with-audit stay in `tenantTx`. `WebhookDelivery` carries **no `orgId`** (not RLS-enabled) → stays on bare `prisma()`, transitively scoped by the already-ownership-verified `endpointId` (the endpoint read gates it)                                                                                                                                                                                                               | ✅ `GET /webhooks/endpoints/:id/deliveries` (+ rotate/delete read paths)               | ✅ WebhookEndpoint (own-resolve / foreign-invisible / count=1)                    | **DONE**         |
| **pii-vault** (PiiUnmaskRequest; Lead + Donation→Conversion on decrypt)        | ✅ 5/5 sites — `requestUnmask` write via `tenantTx`; the three `PiiUnmaskRequest` reads (`approveUnmask` / `revealUnmask` / `getUnmaskRequest`) + the expired-status update via `tenantPrismaTx`; reveal/reject/approve writes stay in `tenantTx`. `fetchAndDecryptFields` now threads `orgId`: the `Lead` rowId read is belt-scoped (RLS-enabled → foreign rowId → null → 404), and `Donation` is scoped **transitively via its `Conversion`** (`conversionId` unique/non-null; Conversion carries `orgId`/RLS) — closing a pre-existing cross-tenant PII-reveal hole   | ✅ `GET /pii/unmask-grants/:id` + `POST /pii/unmask-approve/:id` (both foreign → 404)  | ✅ PiiUnmaskRequest (own-resolve / foreign-invisible / count=1)                   | **DONE**         |
| **auth/saml** (SsoConfiguration; User on JIT)                                  | ✅ 5/5 sites — `loadActiveConfig` / `getSsoConfigPublic` / `upsertSsoConfigurationBySlug` derive `org.id` from the public Org **slug** (control-plane, RLS-free — an `include: ssoConfiguration` would return null under `d2d_app`), then read/write SsoConfiguration via `tenantPrismaTx`/`tenantTx`; `consumeAcs` JIT identity lookup via the §4b.3 `app_resolve_user_by_email_digest` resolver (preserves the cross-org 403), provisioning + final `lastValidatedAt` update belt-scoped; `getCurrentUser(userId, orgId)` now reads `User` via `tenantPrismaTx(orgId)` | ✅ `consumeAcs` cross-org IdP-email → 403; single-config reads → null/404              | ✅ SsoConfiguration (own-resolve / foreign-invisible / count=1)                   | **DONE**         |

> Address and LeadActivity carry **no `orgId`** — RLS is disabled on them
> (`relrowsecurity=f`), they stay on plain `prisma()`. Confirm a model's
> `tenant_isolation` policy exists (`\d+ <table>` or the policy query in §2)
> before assuming it needs migration; an RLS-enabled-but-no-policy table is the
> silent zero-row trap.

> **Org is a control-plane table — do NOT migrate it (it looks like it needs it,
> it doesn't).** `Org` has no `orgId` column; its tenant key is its own primary key
> `id`. The `rls_belt` migration enables RLS on **26 child tables and Org is
> deliberately absent** (`OrgBilling` carries the tenant column instead). So a plain
> `prisma().org.findUnique({ where:{ id }})` is correct under `d2d_app` — there is no
> GUC to pin, and `tenantPrismaTx` would pass Org **straight through untouched**
> (the `$allOperations` wrapper only scopes models in `orgScopedModels`, derived from
> the presence of an `orgId` field — Org isn't in the set). Wrapping Org reads in
> `tenantPrismaTx` is therefore a **misleading no-op** that implies a DB belt that
> isn't there. Tenant isolation for Org lives **above** the data layer: every
> `/v1/orgs/:id` route asserts `req.params.id === ctx.orgId` (route-level 403, not a
> belt-level 404), backed by WS1 app-layer suspenders. The first-`User`/`Org` **write**
> sequence is still handled in §4 (write-side `tenantTx`), unchanged. Net: org needs
> **no §4b read migration and no 403→404 flip** — its cross-tenant 403 is thrown at
> the route before the service runs.

> **The no-RLS-child trap (Donation, Sale).** Donation and Sale also carry no
> `orgId` (RLS disabled) — their tenancy lives on the **parent Conversion**, which
> IS RLS-enabled. The old guard read `prisma().donation.findUnique({ include: {
conversion } })`. Under the belt (`d2d_app`, no GUC) the **required** `conversion`
> relation is RLS-invisible → Prisma throws _"inconsistent query result: Field
> conversion is required to return data, got null"_ — a **500 for every read**, own
> or foreign. Fix: never `include` a required relation across the RLS boundary —
> read the un-scoped child, then resolve its parent through `tenantPrismaTx(orgId)`
> as a **separate** scoped read (foreign parent → null → 404). Watch for this shape
> wherever a no-`orgId` model `include`s a required RLS-enabled parent.

**`lead` reference proof (2026-05-31):**

- Owner-role integration (`lead.test.ts`): **15/15** — behaviour-preserving, no
  regression under the current (pre-cutover) `d2d` owner role. The migrated reads
  inject `where:{orgId}` as a real SQL filter even under the owner, so a foreign
  id already resolves to `null` today → each read is correct both before _and_
  after the secret flip.
- `d2d_app` enforcing-role belt (`rls-belt.test.ts`): **13/13** — incl. the new
  §4b-mig User + Campaign scoping probes driven through the real NOBYPASSRLS role.
- Full integration suite: **263/263** — no cross-domain regression.
- Schema check (psql): Lead, User, Campaign, Knock each carry a GUC-reading
  `tenant_isolation` policy; Address + LeadActivity have RLS disabled.

**`user` proof (2026-05-31) — DONE:**

- Owner-role integration (`user.test.ts`): **8/8** — invite / update / archive
  writes now wrapped in `tenantTx`, all org-scoped reads on `tenantPrismaTx`,
  cross-tenant GET flipped 403→404. No regression under the owner role.
- `d2d_app` belt (`rls-belt.test.ts`): the §4b-mig probe proves the
  **`emailDigest` global-unique index bites under the belt** — an insert under
  orgA's GUC carrying a digest that collides with an RLS-**invisible** orgB user
  still throws **P2002** (not a silent cross-tenant duplicate). This is the crux
  of the `inviteUser` change: the dup pre-check on plain `prisma()` sees nothing
  under the belt, so the DB unique constraint is the real arbiter → mapped to
  **409**. User row-scoping itself is already proven by the lead-domain User probe.
- **`acceptInvite` (pre-auth) RESOLVED** via the §4b.3 `SECURITY DEFINER` resolver
  `app_resolve_invite` — proven by the `d2d_app` invite-resolver probe (returns the
  credential's owning `userId` + `orgId` while a direct `User` read returns 0 rows).
  `login` + `refresh` are likewise resolved in the **auth** domain (§4b.3). The
  pre-auth blocker that gated the whole cutover is closed.

### 4b.3 Pre-auth identity resolution — RESOLVED, implemented (Option C)

> **Status (2026-05-31): RESOLVED — no longer a cutover blocker.** The pre-auth
> flows that resolve a `User` (or its credential) with **no org context** — and so
> cannot pin `app.current_org_id` — are now served by owner-owned `SECURITY
DEFINER` resolver functions (Option C below). Each returns the minimal identity
> columns + `orgId`; the caller re-enters the belt with that `orgId`. The
> belt-bypass is confined to one indexed point-lookup per pre-auth request and
> nothing else widens.

**Three flows** run _before_ authentication, so there is nothing to pin the GUC to.
Under `d2d_app` with no GUC each previously broke at cutover; all three now route
through a resolver:

- **`auth/service.ts login()`** — keyed on `emailDigest` (the only thing the caller
  supplies). A direct RLS-enabled `User` read returns **zero rows** under `d2d_app`
  → every login would fail. Now calls `app_resolve_user_by_email_digest(digest)`
  (LEFT JOIN `UserCredential`, so a credential-less user returns one row with
  `passwordHash = NULL` → the same 401 as a bad password), then re-enters the belt
  via `tenantTx(user.orgId, …)` for the failed-login audit and `issueTokens`.
- **`auth/service.ts refresh()`** — keyed on `RefreshToken.tokenHash`. A direct read
  returns zero rows → every refresh would fail. Now calls
  `app_resolve_refresh_token(tokenHash)` (INNER JOIN `User`; **no `passwordHash`** —
  refresh never re-checks a password). The reuse / expiry / `status` checks and
  `issueTokens({ rotateFromId })` are unchanged — the flat resolver row is reshaped
  into the prior nested shape so downstream logic is byte-identical.
- **`user/service.ts acceptInvite()`** — keyed on `UserCredential.inviteTokenHash`.
  The old `include:{ user: true }` joined the RLS-enabled `User` with no GUC →
  "inconsistent query result" 500, and `tx.user.update` hit 0 rows → P2025. Now
  calls `app_resolve_invite(inviteTokenHash)` for `{ userId, orgId, regionCode,
inviteExpiresAt }`, then runs the credential update + user activation + audit
  inside `tenantTx(orgId, …)`. The dead owner-role `prisma().$transaction` path is
  gone.

**The resolvers** —
`prisma/migrations/20260531000000_preauth_resolvers/migration.sql`, owned by `d2d`,
`SECURITY DEFINER`, `LANGUAGE sql STABLE`,
`SET search_path = pg_catalog, public, pg_temp` (pg_temp LAST), every table
schema-qualified (`public."User"` …), typed text params (bound, never
concatenated), minimal projection (enums cast `::text`),
`REVOKE EXECUTE … FROM PUBLIC`:

| Resolver                                 | Key                              | Join                     | Returns                                                                                                      |
| ---------------------------------------- | -------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `app_resolve_user_by_email_digest(text)` | `User.emailDigest`               | LEFT JOIN UserCredential | id, orgId, role, regionCode, brandCode, email, givenName, familyName, status, passwordHash                   |
| `app_resolve_refresh_token(text)`        | `RefreshToken.tokenHash`         | INNER JOIN User          | rtId, userId, orgId, expiresAt, revokedAt, role, status, regionCode, brandCode, email, givenName, familyName |
| `app_resolve_invite(text)`               | `UserCredential.inviteTokenHash` | INNER JOIN User          | userId, orgId, regionCode, inviteExpiresAt                                                                   |

`d2d_app` is granted EXECUTE on **two surfaces** so both DB-provisioning orderings
are covered: the migration's conditional `GRANT` (fires when the role pre-exists,
e.g. a persistent DB) and the bootstrap's `GRANT EXECUTE ON ALL FUNCTIONS` (arms it
on a fresh DB where the role is created _after_ the migration runs).

**Proven by a `d2d_app` resolver probe.** `rls-belt.test.ts` §4b drives all three
resolvers through the real NOBYPASSRLS `d2d_app` role and asserts: a direct table
read of `User` by `emailDigest` with no GUC returns **0 rows** (the belt bites),
while `app_resolve_user_by_email_digest` returns exactly **1** identity row;
`passwordHash` is NULL for a credential-less user; an unknown digest returns 0 rows;
`app_resolve_refresh_token` + `app_resolve_invite` return the token/credential row +
owning `orgId`. **20/20 belt tests green; full integration suite 270/270.**

**The designs evaluated (kept for the record):**

| Option                      | Mechanism                                                                                                                                                    | Covers                         | Trade-off                                                                                                                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A                           | A pre-auth RLS policy allowing the row when the GUC is unset (`current_setting(..., true) IS NULL`)                                                          | login + refresh + acceptInvite | Widens the policy surface: an unset GUC _anywhere_ becomes a full-table read — re-opens the hole RLS exists to close. **Rejected on its face.**                                                                                             |
| B                           | A separate owner/bypass connection pool used only for the pre-auth lookups                                                                                   | login + refresh + acceptInvite | Two pools to operate; the bypass DSN must never leak to request handlers. Operationally heavy for a solo operator.                                                                                                                          |
| **C — CHOSEN, IMPLEMENTED** | `SECURITY DEFINER` SQL functions (owned by `d2d`, executable by `d2d_app`) returning **only** the minimal identity columns + `orgId` for a single unique key | login + refresh + acceptInvite | One tightly-scoped, auditable function per lookup; runs as definer so it bypasses RLS for _exactly_ those columns and no more. The caller then re-enters the belt with the returned `orgId`. Smallest blast radius. **Shipped 2026-05-31.** |
| D                           | Denormalise `orgId` onto the no-RLS `UserCredential` so acceptInvite never joins User                                                                        | acceptInvite **only**          | Does nothing for login/refresh (key off `User`, not the credential). Half a fix.                                                                                                                                                            |

---

## 5. Cutover sequence (staging → canary → prod)

**Preconditions (all must be green):**

- [x] All §4 Class A **write** paths wrapped in `tenantTx`; `pnpm --filter api test` green (282).
- [x] **§4b read-side GUC _mechanism_ shipped + proven by a `d2d_app` read probe.**
      `tenantPrismaTx` (Option 2) lives in `apps/api/src/config/db.ts`; proven by
      `rls-belt.test.ts` §4b (11/11) against the real `d2d_app` role, with the WS1
      belt regression still green (`tenant-prisma.test.ts` 12/12).
- [x] **§4b.3 pre-auth identity resolution — RESOLVED (Option C).** login,
      refresh, and acceptInvite now route through owner-owned `SECURITY DEFINER`
      resolvers (`app_resolve_user_by_email_digest` / `app_resolve_refresh_token` /
      `app_resolve_invite`) and re-enter the belt with the resolved `orgId`. Proven
      by the `d2d_app` resolver probe (`rls-belt.test.ts` §4b, 20/20; full suite
      270/270). The one wall that gated the whole cutover is closed.
- [x] **§4b read-side _call-site migration_ — ALL CLASS A READS MIGRATED (14 done +
      auth pre-auth done / 15, org N/A).** Every authenticated `prisma().<model>.findX({
    where: { orgId } })` read has moved to `tenantPrismaTx(orgId).<model>.findX()`
      (tracked per Class A domain in the §4b.2 tracker). **DONE: `lead` (reference — owner 15/15, `d2d_app` belt 13/13),
      `conversion`, `donation`, `sale`, `user` (incl. `acceptInvite` via the §4b.3
      resolver), the `auth` pre-auth flows (login/refresh via resolvers), `territory`,
      `knock`, `compliance`, `notification`, `marketing` (largest — 17/17 sites,
      compound-key reads rewritten to scalar `findFirst`), `audit`, `webhook`
      (4/4 read sites — `listEndpoints`/`rotateSecret`/`softDeleteEndpoint`/
      `listDeliveries` endpoint read onto `tenantPrismaTx`; `WebhookDelivery` carries
      no `orgId`, not RLS-enabled, stays on bare `prisma()` and is transitively scoped
      by the already-ownership-verified `endpointId`), and `pii-vault` (5/5 sites —
      the three `PiiUnmaskRequest` reads + the expired-status update onto
      `tenantPrismaTx`, request/approve/reveal/reject writes in `tenantTx`;
      `fetchAndDecryptFields` belt-scopes the `Lead` rowId and scopes `Donation`
      transitively via its `Conversion`, closing a pre-existing cross-tenant
      PII-reveal hole), and `auth/saml` (5/5 sites — `loadActiveConfig` /
      `getSsoConfigPublic` / `upsertSsoConfigurationBySlug` derive `org.id` from the
      control-plane Org **slug** then read/write `SsoConfiguration` via
      `tenantPrismaTx`/`tenantTx`; `consumeAcs` JIT identity via the §4b.3
      `app_resolve_user_by_email_digest` resolver; `getCurrentUser(userId, orgId)`
      reads `User` belt-scoped).** **`org` is
      N/A — control-plane table, no `orgId`, no RLS policy (see §4b.2 note); it stays
      on `prisma()`.** **No Class A domains remain** — the only pre-cutover code item
      left is the §3 Class B decision (`ApiKey` + `IdempotencyRecord` pre-auth reads,
      both RLS-enabled). Each
      migration of an RLS-belt-covered domain flips its cross-tenant single-GET
      403→404 (§4b.1 — public-API-contract change, surface in cutover comms). Until
      every Class A read is migrated, flipping the secret empties the un-migrated
      views. Confirm with a full-surface smoke under `d2d_app` showing no zero-row
      anomalies.
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
3. The single Class B `ALTER TABLE "IdempotencyRecord" DISABLE ROW LEVEL SECURITY`
   is harmless to leave in place under the owner (owner bypasses RLS anyway);
   re-enable later when you resume the cutover. Do **not** re-`ENABLE` mid-incident.

> Because rollback is just the owner secret, the only true point of no return is
> a _destructive_ schema change — and there is none here. The belt is additive.

---

## 8. What this runbook deliberately does NOT do

- It does **not** apply the Class B remediation migration (gated — that is a
  Phase B production action requiring Brodie's explicit go).
- It does **not** flip any `DATABASE_URL`.
- It does **not** migrate the remaining ~80 Class A read call-sites from `prisma()`
  to `tenantPrismaTx` (§4b). The read-side GUC _mechanism_ is shipped and proven
  (`tenantPrismaTx`, Option 2), as is the §4b.3 pre-auth identity resolution
  (`SECURITY DEFINER` resolvers for login / refresh / acceptInvite). Proof:
  `rls-belt.test.ts` 20/20 (incl. the §4b read-mechanism probes + the 3 §4b.3
  resolver probes) + `tenant-prisma` regression 12/12; full integration suite
  270/270. The mechanical call-site migration of the remaining ~9 domains is the
  gate that must close before cutover. The §4 _write_ wrapping is done across all
  Class A domains.
