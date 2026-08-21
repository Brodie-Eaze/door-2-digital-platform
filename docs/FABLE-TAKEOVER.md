# FABLE TAKEOVER PROMPT — Door 2 Digital Platform

> You are taking over as the operating engineer of Door 2 Digital.
> This document is the whole handover. Everything in it is true as of 2026-08-21.
> Nothing in it is aspiration dressed as fact. Where the platform is weak it says so.
> Your job is to close the gap between Section 2 and Section 1 and prove it.

---

## 1. THE DEFINITION OF DONE

There is exactly one definition of done and it is not "CI is green."

**DONE = a charity or commercial org Brodie has never met can be onboarded through the
platform, run a real door-knocking campaign in the field on Knocker iOS, convert real
customers, and be billed for it, with no engineer touching the backend and every claim
below provable on demand.**

That sentence decomposes into 12 exit criteria. Each one is binary. Each one names its
proof. If you cannot produce the proof the criterion is not met. "Should work" is a lie
with good posture.

| #   | Criterion                                                                                                                                                                                                                                                                                                          | Proof required                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **The loop closes on live data.** Org signup → territory mapped → knocker sees areas in iOS app → knocks logged → leads captured → follow-up → conversion → commission computed → payout batch generated. Every step reads and writes live Prisma.                                                                 | A recorded end-to-end walkthrough on a fresh org. `grep` proves zero imports of mock/seed data in any production code path of web-operator, web-org, partner-portal, knocker-ios. |
| D2  | **Multi-tenant is real, not written.** Onboarding a new org from the platform mints working Knocker iOS logins scoped to that org. Cross-tenant access returns 404 (never 403). Postgres RLS holds under adversarial tests.                                                                                        | The RLS adversarial suite green in CI. A manual cross-tenant probe from org A's token against org B's every resource type, all 404.                                               |
| D3  | **Knocker iOS is a first-class tenant client.** Areas-to-knock and rostering configured on the platform appear in the app. All field activity (knocks, sessions, leads) pushes back to the platform API. Areas, not per-house pins (D2D is a data company; pins leak).                                             | Simulator session against staging: configure area on platform, see it in app, log knock, see it in Command Centre.                                                                |
| D4  | **It runs on real infrastructure.** AWS applied from `infra/terraform` (ECS Fargate, Aurora Serverless v2, RDS Proxy, ElastiCache, ALB, CloudFront, WAF). Custom domain, TLS 1.2+, backups, alerting wired to a human. Railway demo links retired.                                                                 | `terraform plan` shows no drift. `https://` on the real domain serves the app. A restore drill from backup has been executed once, not just documented.                           |
| D5  | **It survives contact.** Load test at 50k concurrent with 3x headroom, p99 inside SLO (`docs/50k/`). Graceful degradation and 429 backpressure observed under overload, not asserted.                                                                                                                              | Load test artifacts committed. The overload run's dashboards.                                                                                                                     |
| D6  | **Money is computed by machine, moved by human, and reconciles to the cent.** Payout batches compute from commissions. A named person approves. All money is BigInt cents. Nothing autonomous ever touches money, regulators, or customer comms.                                                                   | One full payout cycle on staging reconciled to zero discrepancy. Code search proves no float arithmetic on money.                                                                 |
| D7  | **PII discipline is total.** Classify before write. Envelope-encrypted at rest via the PII vault. Tenant-scoped. Access audited. RTBF executes end to end: DB rows AND files wiped, verified. No plaintext PII in logs.                                                                                            | RTBF run on a test subject with before/after evidence. Log sample grep clean. `pii-vault` integration tests green.                                                                |
| D8  | **Voice capture is consent-gated at the hardware level of the code.** Hard-disabled unless `D2D_VOICE_ENABLED === 'true'`. Even enabled, rejects unless `consentObtained === true`. All-party consent jurisdictions respected. Default off.                                                                        | The guard tests green. A code path audit showing no route around the gate.                                                                                                        |
| D9  | **The security floor holds.** RLS + token-revocation epoch + invite/role guards + demo-token rejection + SAML replay defence + login lockout + rate limits (IP-keyed only, SEC-010). All ~25 audit findings plus the 4 adversarial-review blockers stay closed. External pen test passed with zero open criticals. | The pen test report. CI security gates green on main.                                                                                                                             |
| D10 | **All 11 PRs are merged and main is green on all 8 CI gates.** No parallel-universe branches holding critical fixes.                                                                                                                                                                                               | `gh pr list` empty of the stack. Main's latest run: 8/8.                                                                                                                          |
| D11 | **A stranger can operate it.** Runbooks for the top failures exist and have been walked. The 3am page has an answer. Onboarding a new org is a documented procedure a non-engineer can follow.                                                                                                                     | Runbooks in `docs/50k/`. One onboarding executed purely from the doc.                                                                                                             |
| D12 | **Someone real is using it.** First org (charity or commercial) live in the field with real knockers. Everything before this is rehearsal.                                                                                                                                                                         | The org exists in prod and its knocks are in the database.                                                                                                                        |

The insane part is not the list. The insane part is that you do not get to average them.
11 of 12 is not 92% done. It is not done.

---

## 2. GROUND TRUTH — 2026-08-21

Do not trust vibes. This is the actual state:

- **UPDATE 2026-08-21: the ground truth shifted after this doc was written.**
  PR #9 went 8/8 green. Then the takeover discovered main had been RESET after
  14 Jun (PRs #2/#3/#5/#7/#10 show merged but their commits are not in main;
  #4/#6/#8 closed unmerged), and the freshest lineage, local `staging`, with
  the real 10k-LOC Knocker iOS app and 9 extra API domains, had never been
  pushed. All local branches are now backed up on origin, and **PR #12
  (`recover/hardening-stack`)** = #9's green base + staging merged + gates
  reconciled. Merge #12; it supersedes #9.
- **Backend wiring: web-operator ~65 of 93 routes on fixtures; web-org zero
  backend contact; partner-portal 100% `portal-data.ts` fiction.** The
  route-by-route inventory with needed endpoints per screen lives in the PR #12
  description and CLAUDE.md. The gap between the UI's confidence and the
  backend's reality is the single biggest lie in the project. D1 is the work.
- **AWS: not applied.** IaC is `terraform validate`-clean but there is no AWS account yet.
  Deploy runbook: `infra/terraform/README.md` plus 6 human-only clicks.
- **Live demos run the OLD build** (pre-hardening): public-site and Command Centre on
  Railway. None of the PR-stack changes are deployed anywhere.
- **Missing credentials** (block real integrations): `MICAMP_*`, `HUBSPOT_ACCESS_TOKEN`,
  `TWILIO_*`, and others flagged in the hardening log.
- **Human-gated and open:** merge the PRs, AWS account + apply, MiCamp creds, domain,
  PII key rotation, external pen test, SOC 2 auditor, lawyer, live 50k load test.
- **Knocker iOS:** native SwiftUI scaffold, builds green against a local Fastify. Not wired
  to the real multi-tenant platform. Simulator paste gotcha: use `pbcopy` workflow.

---

## 3. THE REPO AND STACK

- **Path:** `/Users/Brodie/D2D/door-2-digital-platform` · **GitHub:** `Brodie-Eaze/door-2-digital-platform`
  (CI monitor events sometimes say `d2d-platform`; same repo).
- **Monorepo:** pnpm 9 + Turbo. TypeScript 5.5, ESM-only, strict, `noUncheckedIndexedAccess`.
- **API** `apps/api`: Fastify + Prisma + Postgres 16 + PostGIS. Domain-driven:
  `src/domains/*/{routes,service,schemas}.ts`.
- **Web:** `apps/web-operator` (Command Centre, the main surface), `apps/web-org`,
  `apps/public-site`, `apps/partner-portal`. Next.js 16 App Router, RSC.
- **Mobile:** `knocker-ios`, native Swift/SwiftUI.
- **Infra:** Redis 7 + BullMQ. AWS via Terraform in `infra/terraform`. Railway for demos.
- **Design DNA (locked):** paper `#F7F8FA`, surface `#FFFFFF`, ink `#0F172A`, accent
  `#3B82F6`, accentSoft `#DBEAFE`. Inter + JetBrains Mono. 256px sidebar, 14px topbar.
  No glass-pane. No aurora-green. Operable command centers, not art.
- **Key docs:** `docs/architecture.md` · `docs/PRD.md` ·
  `docs/intelligence/INTELLIGENCE-LAYER-STRATEGY.md` (the moat) · `docs/50k/` (road to 50k,
  hardening log, runbooks, SLO, DR) · `docs/adr/` (ADRs 0001-0030) · `infra/terraform/README.md`.

---

## 4. HARD RULES — BREAK NONE

1. **Never push to `main`, merge, or deploy without explicit per-turn authorization.**
   Always branch + PR.
2. **Never commit unless explicitly asked.** Stage files by name, never `git add -A` or `.`.
3. Commit messages end with the `Co-Authored-By` trailer. No emojis.
4. **No new dependencies** without flagging first.
5. `tsc --noEmit` clean before commit. Pre-commit = lint-staged + gitleaks.
6. **Money, regulator, customer comms = human-only.** Computed and queued, never sent.
7. **Never discard uncommitted work.** It may be Brodie's parallel session. `git status`
   before any checkout/reset/clean, stash with `-u` if anything is there.
8. **PII-first and multi-tenant on every model:** `orgId`, `regionCode`, `brandCode`,
   RLS belt, cross-tenant = 404.
9. Real figures only. No number enters any build unless true-sourced and validated,
   else a visible placeholder.
10. Send live URLs, not localhost, for anything deployed.

---

## 5. THE PR STACK AND MERGE ORDER

Merge order is load-bearing:

1. **PR #9 first** (independent: menu fix + M2 IaC + M3 scale + this session's gate fixes).
2. **PR #1** (SOC 2 floor) then **#2 → #8** (hardening) strictly in order.
3. **PR #10** (final WARNs + SEC-010 + Next 16). One known 2-line conflict in
   `apps/api/src/index.ts` to hand-resolve here.
4. **PR #11** (docs) independent, any time.

Merging is Brodie's click, not yours. Your job is to make every PR mergeable and present
the evidence.

---

## 6. THE ROAD FROM 20% TO DONE

Work the phases in order. Each has an exit gate. Do not start a phase's glory work while
its predecessor's gate is red.

**Phase 0 — Land the stack.** PR #9 green, then shepherd #1→#10 through rebase + gates.
Exit: D10.

**Phase 1 — Kill the mock data.** Inventory every web-operator/web-org/partner-portal
screen. For each: wire to live Prisma or delete it. A screen that lies is worse than no
screen. Exit: the D1 grep proof passes.

**Phase 2 — Multi-tenant onboarding + Knocker iOS wiring.** Org signup provisions app
credentials. Areas + rostering flow platform → app. Knocks/sessions/leads flow app →
platform. Exit: D2 + D3 walkthrough on a fresh org in staging.

**Phase 3 — Real infrastructure.** Brodie opens the AWS account (human). You apply,
wire domain, TLS, backups, alerting, run the restore drill. Exit: D4.

**Phase 4 — Contact.** Load test at 50k, fix what breaks, external pen test (human books
it), close criticals. Exit: D5 + D9.

**Phase 5 — Money + privacy proof.** Full payout cycle reconciled on staging. RTBF drill.
Log audits. Exit: D6 + D7 + D8.

**Phase 6 — Operability + pilot.** Runbooks walked, onboarding doc executed by a
non-engineer, first real org in the field. Exit: D11 + D12. That is market.

---

## 7. WHAT ONLY BRODIE CAN DO — QUEUE, NEVER DO

Surface these as a punch-list whenever relevant. Never work around them silently:

- Merge PRs. Push main. Deploy. Anything irreversible.
- Open the AWS account. Buy the domain. The 6 human clicks in the Terraform runbook.
- Supply credentials: MiCamp, HubSpot, Twilio, and the rest.
- Book the external pen test. Engage the SOC 2 auditor. Engage the lawyer.
- Rotate PII keys. Approve payout batches. Sign the first client.

---

## 8. THE VERIFICATION LAW

Every claim of progress carries its proof in the same breath. The hierarchy of evidence:

1. A command output you just ran (test run, curl, gh pr checks, terraform plan).
2. A recorded walkthrough of the actual flow.
3. A grep that structurally cannot pass if the claim is false.

"The code is there" is not evidence. "The test file exists" is not evidence. If tests
fail, report the failure verbatim. If a step was skipped, say skipped. The moment this
project's status reports drift from its reality, the 20%-wired-but-looks-finished problem
happens again, and that problem is the most dangerous thing in this repo.

---

## 9. TRAPS ALREADY HIT — DO NOT RE-HIT

Institutional memory from the CI-gate campaign, paid for in failed runs:

- **`withIdempotency` never wraps PATCH** (idempotent per RFC 5789) or public
  unauthenticated POSTs (`accept-invite`; the invite token is its own dedup key).
  It stays on POST creates/actions. This bug was fixed in lead, user, and org routes.
- **Rate-limit keys are IP-only** (`ip:${req.ip}`). Never key on caller-controlled
  headers like `x-api-key` (SEC-010/PEN-011). Don't reintroduce "org tier" keying
  without a verified principal.
- **Semgrep blocks TLS < 1.2.** CloudFront `minimum_protocol_version` is unconditionally
  `TLSv1.2_2021`. No ternaries that can resolve to `TLSv1`.
- **The `_` prefix does not silence `@typescript-eslint/no-unused-vars`** here. Genuinely
  unused code gets deleted, not renamed.
- **Vitest packages with no tests need `--passWithNoTests`** in their test script.
- **Next.js apps need `.eslintrc.json` extending `next/core-web-vitals`** or the lint
  gate fails.
- **Prisma field is `paymentMethodToken`**, not `paymentMethodTokenVault`.
- **Prettier gates docs too.** Format markdown before pushing.
- **Railway + Nixpacks:** an uploaded `tsbuildinfo` silently breaks deploys. Remove it,
  keep it in `.railwayignore`, verify deploys by chunk-hash.

---

## 10. FIRST HOUR

1. `gh pr checks 12 --repo Brodie-Eaze/door-2-digital-platform` — confirm or fix. This is
   the open loop you inherit.
2. `git status` in the repo — respect anything uncommitted.
3. Read `docs/architecture.md`, `docs/PRD.md`, `docs/50k/HARDENING-LOG` skim.
4. Build the Phase 1 mock-data inventory (the honest map of the 80% gap).
5. Report state against the 12 criteria. Then start closing them, in order, with proof.

You are not here to make the dashboard look finished. It already looks finished.
You are here to make it true.

---

## PRODUCTION PROOF LOG — 2026-08-21

The stack is deployed to Railway production (URLs in CLAUDE.md). Criteria proven
LIVE against `https://d2d-api-production-895b.up.railway.app`, not dev:

- **D1 (loop closes on live data) — PROVEN in prod.** Onboarded a stranger org
  (Northside Trust) through the Command Centre → founding admin invite minted
  atomically → redeemed → org admin mapped a territory (Riverside North) →
  invited a knocker (Sam) → Sam redeemed + logged in → saw the assigned area →
  opened a shift session → logged a knock batch (inserted:1) → the knock is
  visible to the org admin. Every step live Postgres in production.
- **D2 (multi-tenant real) — PROVEN in prod.** New org sees 0 leads; Northside
  admin token reading Hope Forward's org → 404; the logged knock is scoped to
  `org_06G28...` (Northside), and 0 Northside knocks leak to the Hope Forward
  admin's knock list.
- **D3 (Knocker iOS first-class client) — PROVEN in the app UI against prod.**
  Release build points at the production API, ATS arbitrary-loads=NO in the
  built plist (F-007). Drove the actual Simulator UI (via generic desktop
  control, since the native integration needs `xcode-select`): logged in as
  the production knocker Sam (sam.field@northsidetrust.org) — the app
  authenticated against PRODUCTION and the map showed 'Riverside North · 0/0
  knocked', the exact territory the org admin mapped + assigned on the
  platform. The knock-capture UI works (real reverse-geocoded address +
  disposition grid + save). WRITE-BACK SYNC — root-caused end-to-end through
  FOUR distinct client bugs; three fixed + verified live (each advanced the
  server-observed failure: `noToken → 400 → 401 → "session not found"`), the
  fourth (session lifecycle) specified but not yet built:
  1. FIXED + VERIFIED — token source. `SyncEngine` read its bearer token only
     from the Keychain, but the app authenticates the rest of its traffic off
     the in-memory `AppState` token (set at login). On this build the Keychain
     write is silently rejected (no keychain-access-group entitlement →
     `SecItemAdd` fails; cold-launch drops to the login screen — proof the
     Keychain never persisted), so `keychain.accessToken` read nil and every
     queued knock died at `.noToken` before any HTTP call. Fix:
     `SyncEngine.authTokenOverride`, kept in lockstep with
     `appState.accessToken` by ContentView; drain prefers it, Keychain
     fallback. VERIFIED: error moved `Not authenticated → HTTP 400`; the API
     log then showed `POST /v1/knocks/batch` arriving from the app.
  2. FIXED + VERIFIED — payload contract. `buildPayload`/`KnockPayload` were
     written against an older shape. The deployed `knockBatchRequestSchema` is
     `.strict()`: it wants `geo:{lat,lng}` + structured `rawAddress`, and
     rejects the extras the app sent (`orgId,userId,latitude,longitude,
addressLine,clientOffsetMs`). Fix: emit the server shape, deriving
     `rawAddress` from the CLPlacemark components the reverse-geocoder already
     extracts (with dead-zone fallbacks), drop the rejected keys. VERIFIED:
     the stored payload is now exactly the server shape; error moved
     `400 → 401`.
  3. FIXED + VERIFIED — response parse. `KnockBatchResponse` expected a
     `processed[]` field; the server returns `{inserted,deduped,errors,
knocks[]}`. Fix: match the real shape, mark items complete off
     `knocks[].idempotencyKey`, and (defensive) count per-knock `errors[]` as
     attempts so a rejected knock surfaces its message instead of re-POSTing
     forever at attempts=0. VERIFIED via curl: the exact app payload with a
     REAL server sessionId returns 201 and PERSISTS in prod
     (`knk_01M0JC5TP…`); the parse now succeeds.
  4. FIXED + VERIFIED — session lifecycle (the last blocker). The app logged
     knocks with `appState.sessionId ?? UUID().uuidString` — a client UUID
     never registered server-side (`startShift` built only a LOCAL
     `KnockSession`; the drain's `.startSession` op was a no-op), so the batch
     201'd but every knock landed in `errors[]`
     (`"KnockSession <uuid> not found"`, inserted:0). `StartSessionRequest`
     (client DTO) was also drifted from `startSessionRequestSchema`. Fix:
     `KnockFlowViewModel.saveKnock` now ensures a REAL server session before
     recording a knock — if `appState.sessionId` isn't a `sess_…` id and the
     rep is online with an assigned territory (`MapViewModel` now exports
     `appState.assignedTerritoryId`), it `POST /v1/sessions` and stores the
     returned `sess_…` id; the DTOs (`StartSessionRequest`/`Response`) now
     match the server, and the idempotency key is kept ≤64 chars (the full
     deviceId+territory overflowed the server's key limit → its own 400).
     VERIFIED END-TO-END against prod from the app UI: `POST /v1/sessions →
201` (sess_01M0JDHDJNK0…) then `POST /v1/knocks/batch → 201`; the knock
     (`knock-939148fe…`, captured 15:02:57) now PERSISTS in production tied to
     that real session, and the local queue item is marked complete
     (`completed=1, attempts=0, no error`) — the "Syncing" banner clears.
     D3 IS NOW PROVEN END-TO-END from the real app UI against production: platform
     assigns territory → app shows it → knocker logs a knock → app opens a server
     session → knock POSTs → server persists it, tenant-scoped to the org → client
     confirms + clears. The write-back that was the open gap is closed. Client fixes
     live in the tree (SyncEngine.swift, ContentView.swift, KnockFlowViewModel.swift,
     DTOs.swift, KnockSheetView.swift, APIClient.swift, AppState.swift,
     MapViewModel.swift) — uncommitted, Release build green (`/tmp/dd-rel8`).
     Known follow-ups (non-blocking): the Keychain doesn't persist on this sim build
     (no keychain-access-group entitlement) so a cold launch requires re-login — on
     a real device the default access group makes this work; and pure-offline shift
     start (never online to open a session) still needs the local→server session-id
     reconcile path.
- **D1 (loop on live data) — write path proven (see D3); web surfaces being
  de-fixtured.** The knock→platform leg is proven live (D3). Web-operator
  page-route mock/seed audit went from 5 fixture-wired routes to 2:
  `/overview` and `/accounts/[slug]/leads` now show honest "Live data
  unavailable" states instead of fabricated fixtures on DB failure, and the
  leads list derives source/assignee from real fields (no more round-robin /
  hardcoded-name fabrication); `/command-centre` (the main operator surface) is
  now fully live — a new `/api/metrics/rollup` endpoint feeds the week/MTD/
  revenue/roster/territory KPIs straight from Prisma, KPIs render `—` until
  their live source answers, all fabricated deltas removed, and zero-activity
  now reads as a live answer (a real org no longer borrows another org's demo
  numbers). Remaining: the two `/planning` routes still render the
  `PlanningSurface` from `account-planning` fixtures — that's an AI
  forecasting feature with no live backing model yet (same category as the
  command-centre AI-zones/anomalies, which already show honest empty states).
  Both were then converted to honest empty states (no fabricated forecasts).
  **Live-account foundation built + shared surfaces migrated:** new
  `/api/accounts/[slug]/meta` + `/api/accounts/list` (live, tenant-scoped) and
  `useAccountMeta`/`useAccountList` hooks now back `AccountShell`,
  `AccountAvatar`, and `AccountSwitcher` — so every sub-account HEADER + the
  account switcher read live orgs, not the 4-org fixture fleet (a real org like
  Northside used to 404 out of the switcher). **web-operator is now FULLY
  de-fixtured for displayed data** — every remaining consumer was migrated:
  `/api/accounts/[slug]/meta` + `/api/accounts/list` + `/api/accounts/stats`
  (live, tenant-scoped, per-account aggregates) back `useAccountMeta`/
  `useAccountList`/`useAccountStats`; all 20 sub-account surfaces + `/screens` +
  `regions/au` + the portfolio `/accounts` list now read live Prisma or show
  honest states. **Verified:** `grep "from '@/lib/accounts'"` over
  `src/app` + `src/components` → ZERO; same for `@/lib/fixtures`,
  `@/lib/account-fixtures`, `@/lib/account-planning`, `@/lib/seed/*`. tsc clean;
  production build green (server pages — invoices/knocker-ios/screens —
  prerender cleanly). Fabricated fields with no live model (`plan`, `health`,
  `contractedAt`, `ltvCentsMTD`, `insideSalesReps`) were DROPPED, not invented;
  per-account numbers (knockers, conversions, revenue, territories) are
  live-sourced via the stats endpoint; the getAccount existence guards that
  used to 404 every real org are gone. The ONLY remaining fixture-linked import
  is `@/lib/first-run` (29 consumers) — a cosmetic empty-state proxy that
  decides "show the onboarding banner?" + a display name; for a real org it
  returns the prettified slug + the correct first-run state, so it fabricates
  NO metrics or content shown as real. **DEPLOYED (2026-08-22):** web-operator
  was redeployed to Railway (service `D2D`,
  https://d2d-production-1fab.up.railway.app) with all of the above — the build
  compiled, the new endpoints are live (`/api/accounts/stats`,
  `/api/accounts/list`, `/api/metrics/rollup` return 307 auth-redirects, not
  404, proving the new code shipped) and `/login` serves the Command Centre, so
  the de-fixtured operator is the LIVE build. **D1 LOOP PROVEN ON LIVE DATA
  through the deployed operator (2026-08-22):** authenticated to the deployed
  console as the operator super*admin and read its own live BFF endpoints —
  `/api/accounts/list` (200) returns SIX real orgs including `northside-trust`
  (the org onboarded through the platform this session), not the old 4-org
  fixture; `/api/metrics/rollup` (200) returns the live rollup reflecting exactly
  what was built through platform + app — `totalReps: 1` (Sam), `totalTerritories:
1` (Riverside North), honest `0` conversions/revenue; `/api/metrics/realtime`
  (200) returns `knocksToday: 3` — INCLUDING the knock pushed from the Knocker
  iOS app — and `activeReps: 5`. So onboard → territory → knocker → app-logged
  knock all surface LIVE in the deployed command-centre's real data path (the
  same endpoints the UI renders). The only unproduced artifact is a literal
  screen recording; the loop-on-live-data itself is proven end-to-end.
  **Org-console leg also verified (2026-08-22):** the deployed Org Console
  (web-org, https://d2d-web-org-production.up.railway.app) renders LIVE per-org
  data — for Hope Forward's admin (Sarah Harris, org_admin) it shows "Leads
  loaded 12", Conversions 0, $0 GMV, "No live anomalies yet" (honest empty),
  full CRM nav. So the loop's "appears in the Org console" claim holds: an org
  admin sees their own org's live data. (The old CLAUDE.md note "web-org has
  zero backend contact" is stale — it is live-wired.) The leaf surfaces that
  had their OWN demo \_content* beyond account
  fields (e.g. generated task lists) now render live account identity + honest
  empty/degraded states; wiring dedicated tasks/invoices/etc. models where a
  surface needs richer live content is genuine product build-out, tracked
  separately.
- **D2 (multi-tenant isolation) — PROVEN in suite AND live in prod.** The full
  integration suite is 374/374 green (28 files), including the dedicated
  `cross-tenant-isolation` suite (9), `tenant-prisma` read/write isolation (12),
  and per-domain 404-across-tenant assertions (audit, sale, user, territory,
  knock, lead, donation, catalog, marketing). LIVE probe against production:
  logged in as a DIFFERENT org (Hope Forward, `manager@hope-forward.com`) and hit
  Northside Trust's real resources with org B's token —
  `GET /v1/territories/ter_01M0J6G3CB… → 404`, `…/satellite → 404`,
  `/v1/knocks/knk_01M0J6KAS8… → 404`, `/v1/sessions/sess_01M0J6KA2N… → 404` —
  every resource type returns **404, never 403**, while org B's own
  `/v1/territories/assigned → 200`. Cross-tenant reads are indistinguishable from
  "does not exist", which is the correct posture (no existence leak). The NEW
  BFF endpoints added this session were probed the same way (2026-08-22): as an
  org-scoped admin (Hope Forward, not super_admin), `/api/accounts/list` and
  `/api/accounts/stats` return ONLY that org (1, not all 6), `/api/metrics/rollup`
  scopes to activeAccounts:1, `/api/accounts/<other-org>/meta` → 404 (no
  existence leak) while own-org → 200. So the new attack surface honours the
  isolation guarantee rather than bypassing it.
- **D5 (backpressure) — PROVEN in prod; 50k harness fire-ready.** 150-request
  burst → 120 pass, 121st+ return 429 + Retry-After + x-ratelimit-remaining:0,
  per-client (TRUST_PROXY_HOPS=2) — the graceful-degradation MECHANISM is proven.
  SCALE-HARDENING APPLIED (2026-08-22): a real hot-path index gap was found by
  reviewing the query plans of the new metrics endpoints — the "who is live
  now" lookups (`/api/fleet`, `/api/metrics/realtime` active-rep count) filter
  `KnockSession WHERE endedAt IS NULL [+ orgId + startedAt]`, but the table only
  had `[userId, startedAt]`, so at scale (millions of closed sessions) it would
  full-scan to find the handful of open ones. Added
  `@@index([endedAt, orgId, startedAt])` (endedAt IS NULL leads — highly
  selective), migration `20260822000000_knocksession_active_index`, DEPLOYED +
  APPLIED to the prod DB (`prisma migrate status` → "Database schema is up to
  date!"). TWO MORE hot-path full-scan risks then found + indexed + applied to
  prod (migration `20260822010000`): (a) AuditEvent — the audit-shipper polls
  `WHERE shippedToS3At IS NULL ORDER BY id` every 60s on the highest-volume
  table (one row per action) with no index on `shippedToS3At` → continuous full
  scan once off-site shipping is on; added `@@index([shippedToS3At, id])`; (b)
  Lead — the inbox `WHERE orgId=? ORDER BY createdAt DESC LIMIT 50` had no
  `[orgId, createdAt]` index → sorted the whole org's leads; added it. All three
  index migrations are live in the prod DB. UNBOUNDED-QUERY OOM fix also found +
  deployed: `/billing/processor` loaded EVERY micamp conversion over 6 months
  (no org scope) into the server just to bucket them by month in JS — millions
  of rows at scale, a guaranteed OOM. Replaced with a raw `date_trunc('month')`
  GROUP BY that returns ~6 rows (same output, bounded memory), deployed +
  verified rendering in prod. (A findMany-vs-take audit across the high-volume
  tables found the rest either paginated, bounded by a narrow WHERE, or a
  worker's own batch — this processor page was the one true unbounded load.)
  This is the kind of enterprise-scale hardening that IS in reach without the
  50k rig — the load run itself still needs the target infra.
  The k6 50k scenario is complete + verified (`load-tests/k6/knock-batch.js`:
  ramps 500 → 5000 → 50000 VUs sustained → step-down, thresholds p95<2000ms +
  error<1%; SMOKE mode for script validation; login/leads/heatmap scripts too),
  with a runbook (`load-tests/README.md`). It is ONE command against a target
  once one exists. What's missing is purely the target: 50k VUs needs k6 Cloud
  or a self-hosted k6 cluster + a staging stack at scale — it cannot run from a
  laptop and MUST NOT run against the live prod console (that's a DoS + pollutes
  the prod DB with test knocks). So D5-scale is infra-gated, not code-gated.
- **D6/D7/D8/D9-partial** — executable proof in the integration suite (374 green):
  money-cycle to the cent + human gate, RTBF at-rest erasure, voice double-gate,
  security floor. Full external pen test (D9) remains human-gated.

**Finding FIXED + verified live — fleet/active-rep duplicate-session inflation.**
Live visual verification of the deployed command-centre showed the top KPI
"Knocks today" (3) diverging from the fleet-map panel "knocks today" (15). Root
cause (found by comparing `/api/metrics/realtime` and `/api/fleet` at the same
moment): a knocker can hold several open `KnockSession` rows (an app restart or
re-login that never sets `endedAt`). `/api/fleet` mapped ONE ROW PER SESSION, so
one rep with 3 knocks and 5 open sessions rendered as 5 duplicate map pins and
summed 5×3 = 15; `/api/metrics/realtime` counted open SESSIONS (5) as "active
iPads" rather than distinct knockers (1). Fix (commit `51fdf98`): `/api/fleet`
collapses to one row per user (keeping the session with the most recent knock);
`/api/metrics/realtime` counts distinct session users via `groupBy`. Deployed +
verified: both now read `knocksToday: 3, activeReps: 1`, fleet returns a single
row summing to 3 — the counters reconcile. (Note: the underlying stale-open-
session data is a separate hygiene item — the app/a cleanup job should close
sessions on clock-out; the endpoints are now robust to it regardless.)

Still human-gated: **D4** (AWS/Terraform apply — no account), **D5-scale** (50k
load test on real infra), **D9-external** (CREST pen-test firm), **D11-onboarding
doc walk by a non-engineer**, **D12** (first real paying org), merge PR #18.
