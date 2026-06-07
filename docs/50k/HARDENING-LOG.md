# Door 2 Digital — Hardening Log

Source: autonomous audit fleet (security-auditor + pen-tester + performance-reviewer) on `fix/soc2-security-floor`, 2026-06-05. This is the backlog the 3-hour hardening cron works through. Mark items DONE as fixed.

## FIXED — this session (on `fix/soc2-security-floor` → PR #1)

- **[P0] F-001 / SEC-001** — `POST /v1/users` invite had NO role guard; any authenticated user (knocker/viewer) could invite themselves a `super_admin`. Found independently by BOTH security-auditor and pen-tester. Fix: `requireActorRole(actor, USER_ADMIN_ROLES)` + super_admin-only-invites-super_admin in `inviteUser()`; route now passes `actor.role`. `apps/api/src/domains/user/{service,routes}.ts`. tsc clean.
- **[P1] SEC-002 / F-002** — `PATCH /v1/users/:id` unguarded; any user could edit another user's name/phone/managerId. Fix: self-or-`requireActorRole` guard in `updateUser()`.

## QUEUED for Brodie — decision / breaking / human-only (see approval-queue/pending.md)

- **[P0-perf] AUDIT-CHAIN-SERIALIZATION** — every mutation calls `AuditService.recordEvent` inside its TX, which fetches the per-org chain head; this serialises ALL writes per org and will timeout under 50k concurrent. `audit/service.ts:73`. Fix is architectural (decouple to a BullMQ chain-writer, or `pg_try_advisory_xact_lock`). Needs a design decision — do not rush unattended.
- **[P1] DEP-NEXT15** — `next@14.2.35` → `>=15.5.16` (35 advisories incl. 1 critical/15 high). Breaking App Router changes (cookies/headers/params). Needs testing.
- **[P1] DEP-FASTIFY5** — `fastify@4.29.1` → `>=5.7.3` (GHSA-wq9c-q6j3-7h37). Breaking API. Zod `.parse()` at each route mitigates today.
- **[P1] SEC-006** — rotate `PII_KMS_KEY` + `PII_SIV_KEY` in non-prod `.env` (real-looking values on disk + in a worktree copy). Human: rotate + replace with placeholders. NOT in git (gitignored).
- **[P0-perf] SCRYPT-THREADPOOL** — login scrypt pins libuv threads; default `UV_THREADPOOL_SIZE=4` starves at 50k. Set `UV_THREADPOOL_SIZE=16` in the ECS task def (IaC) + login concurrency cap.

## TODO — autonomous (cron passes work these; additive + no new deps)

- **[P1-perf] PERF-INDEXES** — `schema.prisma`: add `Knock @@index([orgId, territoryId])` + `@@index([sessionId])`; `KnockSession @@index([orgId, startedAt])`; `Conversion @@index([orgId, leadId])` + `@@index([orgId, closerId, signedAt])`. (migration generates at first DB deploy)
- **[P0-perf] HEATMAP-N+1** — `territory/service.ts:393`: replace per-territory `knock.count` loop with one `groupBy`; add the territoryId index; cache 60s.
- **[P0-perf] VERIFYCHAIN-CAP** — `audit/service.ts:155`: `verifyChain` does an unbounded `findMany` (OOM at scale). Add a mandatory limit cap + cursor pagination.
- **[P1-perf] LEAD-ROUTING** — `lead/service.ts:106`: `pickInsideSalesRep` runs an unbounded `groupBy` on every lead create. Redis round-robin counter.
- **[P1] F-010 / SEC-005** — demo token: add `demo:true` claim + API-side rejection in `requireAuth`; add `NEXT_PUBLIC_API_URL` guard in `isDemoLoginEnabled()`; move the 5 hardcoded demo passwords to env; timing-safe compare. (prod gate already holds via NODE_ENV; this is defense-in-depth)
- **[P1] SEC-003** — per-route rate limit on `/v1/auth/login` (5/min) + per-account lockout after N failures.
- **[P1] SEC-004** — SAML `validateInResponseTo: never` → `ifPresent` + Redis InResponseTo cache (replay defense). `saml/config.ts:73`.
- **[P1-perf] MARKETING-ASYNC** — `marketing/service.ts:430`: external AI call is sync with no timeout; add `AbortSignal.timeout(30s)`, move generateText/Image to BullMQ 202-pattern.
- **[P1-perf] WEBHOOK-DNS** — `webhook/service.ts:152`: `dns.lookup` has no timeout; wrap in a 3s race.
- **[P1-perf] MARKETING-LISTJOBS** — `marketing/service.ts:711`: `orderBy id desc` doesn't match the index → filesort; switch to `createdAt desc`.
- **[P2] SEC-010** — remove hardcoded prod Railway URL from `CORS_ORIGINS` default; fail-fast if absent in prod. `env.ts:18`.
- **[P2] SEC-012** — truncate/hash IP in audit metadata + normalise `RefreshToken.userAgent`. `saml/service.ts:314`.
- **[P2] SEC-013** — validate `?next=` is a relative same-origin path (open-redirect). `middleware.ts:59`.
- **[P2] SEC-009 / SEC-011** — binary timing-safe relay-state compare; normalise accept-invite timing/path.
- **[P2] F-RECON-001** — auth-gate or relocate the unauthenticated `/_status` endpoints.
- **[P2] F-004** — `donorEmail` stored plaintext on `Donation` row (bypasses the PII vault); route through the vault. (noted as tech debt in code)
- **Regression tests** — add integration tests proving F-001 (knocker cannot invite super_admin → 403) and SEC-002 stay closed; run when a DB exists.

## VERIFIED HOLDING — no action (the security floor's claims that actually hold)

RBAC role-change mass-assignment (F-003) · PII unmask single-use replay (F-005) · SSO config cross-tenant IDOR (F-006) · unmask rowType guard (F-007) · token-revocation fail-closed on Redis down (F-008) · JWT alg pinning / `alg:none` (F-009). The pen-tester confirmed each of these fixes works.

## Cannot do without infra (honest)

A real 50k-concurrent **load test** needs the deployed stack (AWS account + DB). The static stress analysis above is the substitute; the live k6 run stays gated on infra.
