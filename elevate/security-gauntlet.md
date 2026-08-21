# D2D — Adversarial Security Gauntlet

> 4 arenas (tenant isolation / auth×role / OWASP siege / PII sweep) attacked the real code · 16 raw findings · session limit killed the auto-verify phase, so findings were verified + fixed by hand · both typechecks exit 0

## Why this ran

The correctness review found bugs; "does every button work" found dead controls. Neither can see **authorization holes or PII over-exposure** — those need an attacker's lens. This pass took the seat of a low-privilege (`viewer`/`knocker`) session and tried to break the real code.

## What it found — and the fix (all verified by reading the actual guard code)

### Privilege escalation — missing authz (authn ≠ authz) — FIXED

Seven privileged routes had `requireSession` (authn) + tenant-scope but **no role check** — so a `viewer` or `knocker` with a valid session could perform operator actions. Added a centralised `canOperate(session)` gate (super_admin / org_admin / manager) to all seven:
| Route | What a viewer could do |
|---|---|
| `POST /api/territories/assign` | reassign field coverage |
| `PATCH /api/pipeline` + `/pipeline/[id]` | move any/all CRM leads (bulk to 200) |
| `POST /api/broadcast` | push a message to the whole fleet + write audit rows |
| `POST /api/marketing/queue` | queue creatives |
| `POST /api/marketing/publish` | trigger ad publish |
| `POST /api/marketing/generate` | spend on AI generation (also used a dead `platform_admin` role that isn't in the enum) |

### PII over-exposure — FIXED (demo-reachable)

- `GET /api/orgs/[slug]/leads` and the `accounts/[slug]/leads` server page masked email/phone but returned **plaintext full names + full street address** to any role. Now: given name + family **initial**, masked email/phone, **coarse address** (locality + region — no street/postcode). Full PII for one lead is gated behind the lead-detail JIT-unmask path (audited).
- (Prior correctness pass already fixed the `/api/activity` street-address leak and `/api/fleet` exact-GPS leak.)

### Enumeration oracle — FIXED

`Problems.tenantMismatch` returned **403 + the victim org's id** in the body — distinguishing "wrong tenant" from "doesn't exist", a cross-tenant id oracle. Now returns a generic **404** with no orgId echoed (the id is retained server-side for the audit row only).

## Verification

`npx tsc --noEmit` clean in **shared-utils, api, AND web-operator** (all exit 0). Each authz gate confirmed by reading the route (the gate sits immediately after `requireSession`, before any DB work). PII fixes confirmed by reading the response mappers.

## Fastify service `toPublic()` PII — NOW CLOSED

Originally deferred (backend, not demo-reachable), then closed by hand on the "continue" pass. Every Fastify read boundary now masks by default; plaintext requires an audited JIT pii-vault unmask grant (the read/list path never returns it):

- `lead/service.ts` — family name → initial, email + phone masked
- `knock/service.ts` — geo coarsened to ~100m grid, free-text notes + photo/signature S3 keys redacted to null
- `conversion/service.ts` — signatureKey → null, nested donation.donorEmail masked
- `donation/service.ts` — donorEmail masked (a second leak the truncated PII arena missed, caught by a follow-up grep sweep)
- `user/service.ts` — staff email + phone masked, family name → initial, given name kept for team-management UI (also missed by the truncated arena, caught by the sweep)

`apps/api` `tsc --noEmit` exit 0 after all five. The grep sweep that found donation + user is why this matters: the arena agents were cut off by the session limit before completing the PII sweep, so a manual sweep was the only thing that caught the last two.

Lower residual: CRM routes (`/v1/crm/*`) lack `requireAuth` but are inert 501 stubs (no data access yet) — add the preHandler when they're implemented. Demo-login route has hardcoded creds but is hard-404'd in prod.

## Honest note on this run

The session usage limit was hit mid-run, which killed the workflow's automated verify+fix phase. Rather than trust the unverified `confirmed:0` (which would have been a dangerous false "all clear"), I extracted the 16 raw findings from the arena transcripts and verified + fixed the real ones by hand. The auto-pipeline failing did not become a silent pass.
