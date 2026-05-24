# Morning brief — Door 2 Digital OS

**Built:** night of 2026-05-24 → 2026-05-25 (Brodie logged off ~9pm)
**Final commit:** see end of file (added on top of this brief)
**Branch:** `main`, pushed to `origin`
**GitHub:** https://github.com/Brodie-Eaze/d2d-platform
**Backend tests:** 198 / 198 passing
**Web-operator routes:** 170 / 170 returning 200
**Satellite imagery:** Esri + OSM all green
**Operational verdict:** GREEN

---

## TL;DR

Tonight's chain pushed Door 2 Digital from "Phase 4 maximalist UI" through
**a real, working Phase 1.X backend**, then wrapped with a code audit and a
full operational sweep that found zero fixes required.

The shape:

- **16 backend services real**, end-to-end, with DB persistence: auth, org,
  user, territory, knock, lead, audit (hash-chain), pii-vault (two-person
  JIT unmask), conversion (polymorphic donation|sale), donation, sale,
  webhook (with deliveries log), notification, marketing, content-studio,
  plus 23 documented stubs for the remaining Phase 1.X domains.
- **11 AI / ad provider adapters** plugged into the Marketing Studio via a
  clean `ProviderAdapter` contract: Meta Marketing, Meta MCP, Higgsfield,
  Claude, OpenAI, FLUX, Ideogram, Runway, HeyGen, Google Ads, TikTok.
- **198 backend integration tests passing** (auth + org + user + territory +
  knock + lead + conversion + audit + pii-vault + webhook + notification +
  marketing + content-studio).
- **Code audit verdict: A−.** Naming consistent, structure clean, no
  unsafe casts, no hot dead code. See `docs/CODE-AUDIT.md`.
- **Operational sweep verdict: GREEN.** 170 / 170 web routes return 200
  across all 4 demo slugs, all 24 backend `_status` endpoints green, dev
  logs zero errors / zero hydration warnings. See `docs/OPERATIONAL-SWEEP.md`.

Everything is pushed. Nothing is broken. Phase 0 → 1.X is in a state where
you can show it cold.

---

## What's NEW since last brief

Eight commits landed since the last review dossier (`8bd38ee`):

| SHA             | Title                                                                 | Highlight                                                                                              |
| --------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `4400436`       | Marketing Studio: plug-in integrations architecture                   | `ProviderAdapter` contract + 11 adapters, `/marketing-studio/integrations` UI                          |
| `2b21278`       | Backend foundation: auth + org + user real implementations            | Real JWT, scrypt password hashing, refresh rotation. 31 tests.                                         |
| `04eb392`       | Backend: territory + knock + lead real implementations                | WKT polygons, batch knock (500), state-machine lead routing. 73 cumulative tests.                      |
| `77a1691`       | Backend: conversion + audit + pii-vault + webhook + notification real | Polymorphic donation/sale, hash-chain audit, two-person PII unmask, webhook deliveries log. 154 tests. |
| `8db7ffc`       | Marketing service: real wiring to provider adapter registry           | Sync + async creative generation, audience build, campaign deliver. 198 tests.                         |
| `79acc90`       | Code audit pass: structural cleanup + naming consistency              | Verdict A−.                                                                                            |
| `0e85080`       | Operational sweep — every route, every interaction (no fixes needed)  | Verdict GREEN.                                                                                         |
| _(this commit)_ | Railway deploy bundle + this brief                                    | `railway.json`, env template, one-command deploy instructions.                                         |

---

## Spin up locally (one command per service)

```bash
# 1. Web (port 3011) — works standalone, all pages render from fixtures
cd /Users/Brodie/D2D/d2d-platform
pnpm --filter web-operator dev
# → http://localhost:3011
```

```bash
# 2. API (port 3010) — needs Postgres on :5432 + Redis on :6379
cd /Users/Brodie/D2D/d2d-platform
docker compose up -d postgres redis   # if not already running
pnpm --filter api db:migrate           # idempotent
pnpm --filter api dev
# → http://localhost:3010/v1/healthz
```

The web app does NOT require the API to render — every page reads from
fixture files in `apps/web-operator/src/lib/*-fixtures.ts`. Boot the API
separately when you want to exercise the 16 real services.

---

## Railway deploy — ONE MORNING COMMAND

I could **not** complete the Railway deploy autonomously. Railway's CLI uses
browser-based OAuth and the `--browserless` flow explicitly refuses to run
in a non-interactive terminal (errors out with: _"Browserless login
requires an interactive terminal."_). There is no API-key login path.
`RAILWAY_TOKEN` was not set.

**Everything is PREPPED.** Your morning command from `/Users/Brodie/D2D/d2d-platform`:

```bash
railway login                # opens browser, log in to your account
railway init --name D2D      # creates the "D2D" project on Railway
railway up                   # builds + deploys web-operator from Dockerfile
```

Railway reads `railway.json` at the repo root, which points to
`Dockerfile.web-operator`. After the build, the deployed URL is printed at
the end of `railway up` output.

If you'd rather link to an existing project than create new:

```bash
railway login
railway link                 # interactive project picker
railway up
```

### Files staged for Railway

| File                                      | Purpose                                                                                                                                              |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `railway.json`                            | Repo-root config — Railway reads this on `railway up`. Points to `Dockerfile.web-operator`, healthcheck `/login`, restart on failure.                |
| `Dockerfile.web-operator`                 | Multi-stage Next.js 14 standalone build. **Build verified locally — `apps/web-operator/.next/standalone/apps/web-operator/server.js` materialised.** |
| `Dockerfile.api`                          | Multi-stage Fastify+Prisma build. Ready for a second Railway service.                                                                                |
| `Dockerfile.workers`                      | BullMQ workers. Ready for per-queue Railway services.                                                                                                |
| `infra/railway/railway.web-operator.toml` | Same shape as `railway.json` but in TOML — Railway's per-service config-as-code pattern (use this if linking 3 services from one repo).              |
| `infra/railway/railway.api.toml`          | Likewise for API.                                                                                                                                    |
| `infra/railway/railway.workers.toml`      | Likewise for workers.                                                                                                                                |
| `docs/RAILWAY-ENV.md`                     | Full env-var reference with one-liner secret-generation block.                                                                                       |
| `next.config.mjs`                         | Already has `output: 'standalone'`. No change needed.                                                                                                |

### Adding the API as a second service (after web is live)

```bash
# In the same Railway project:
railway service create        # name it d2d-api
# Add the Postgres add-on (Plugin → PostgreSQL) — note: needs PostGIS, see
# docs/RAILWAY-ENV.md "Postgres + PostGIS" section.
# Add the Redis add-on (Plugin → Redis).
# Set secrets — see docs/RAILWAY-ENV.md for the openssl one-liners.

# Point this service at Dockerfile.api:
railway up --service d2d-api   # uses infra/railway/railway.api.toml
```

For the **operator-only demo** (which is what tonight's UI was built for),
you don't need the API service. The web app renders from fixtures. Add the
API service only when you're ready to demo real backend flows.

---

## Walkthrough — read the story in order

Once `railway up` returns a URL, replace `http://localhost:3011` below with
your Railway URL. Everything below was verified GREEN in tonight's
operational sweep (`docs/OPERATIONAL-SWEEP.md`).

### 1. Portfolio (the new IA)

- [All accounts](http://localhost:3011/accounts) — portfolio entry. Each card is a sub-account.
- [Onboard new business](http://localhost:3011/onboard-account) — 5-step wizard.

### 2. HQ Command Centre — cross-account operator surface

- [Live field map](http://localhost:3011/command-centre) — real Esri satellite + OSM toggle, 10 reps pulsing in Texas
- [Territory intel](http://localhost:3011/territory-intel)
- [Roster & shifts](http://localhost:3011/roster)
- [Planning](http://localhost:3011/planning)
- [Billing & invoices](http://localhost:3011/billing) · [MiCamp processor](http://localhost:3011/billing/processor)
- [Compliance](http://localhost:3011/compliance) · [State clearance](http://localhost:3011/compliance/state-clearance)
- [Audit log](http://localhost:3011/audit)
- [Knocker iOS preview (generic)](http://localhost:3011/mobile-preview)

### 3. Inside a sub-account

Four demo accounts (each is identical structure, fully scoped):

- [Hope Forward](http://localhost:3011/accounts/hope-forward/today) — US charity
- [World Vision](http://localhost:3011/accounts/world-vision/today) — AU charity
- [PestMax](http://localhost:3011/accounts/pestmax/today) — US pest control
- [Gold Coast Hospital](http://localhost:3011/accounts/gold-coast-hospital/today) — AU healthcare

Inside each account, 30 routes available: today, conversations, leads,
leads/maria-santos, smart-lists, lead-lists, pipeline, inside-sales,
marketing-studio, reports, campaigns, drip, knockers, territories, roster,
knocker-ios, calendars, forms, sites, memberships, tasks, workflows,
automations, files, invoices, conversions, commissions, compliance, team,
settings.

### 4. AU region (Phase 2)

- [AU operations](http://localhost:3011/regions/au)
- [AU compliance](http://localhost:3011/regions/au/compliance) — Privacy Act, OAIC, NDB
- [AU payments](http://localhost:3011/regions/au/payments) — Stripe AU + GoCardless BECS
- [AU territory intel](http://localhost:3011/regions/au/territory-intel) — ABS SEIFA decile bands

### 5. SG region + AI Marketing Studio (Phase 3)

- [SG operations](http://localhost:3011/regions/sg) · [compliance](http://localhost:3011/regions/sg/compliance) · [payments](http://localhost:3011/regions/sg/payments) · [territory-intel](http://localhost:3011/regions/sg/territory-intel)

**AI Marketing Studio (cross-account)** — _now with real provider adapters_:

- [Studio · overview](http://localhost:3011/marketing-studio)
- [Generator](http://localhost:3011/marketing-studio/generate)
- [Library (50 creatives)](http://localhost:3011/marketing-studio/library)
- [Campaigns (Meta · Google · TikTok · YouTube)](http://localhost:3011/marketing-studio/campaigns)
- [Brand safety](http://localhost:3011/marketing-studio/brand-safety)
- [Retargeting (knock → 5% rake loop)](http://localhost:3011/marketing-studio/retargeting)
- **[Integrations (NEW)](http://localhost:3011/marketing-studio/integrations)** — provider catalogue UI for the 11 adapters

### 6. Public SaaS site (Phase 4 — open in a private window for the cold-visitor feel)

- [Homepage](http://localhost:3011/public)
- [Product](http://localhost:3011/public/product) · [Pricing](http://localhost:3011/public/pricing) · [Customers](http://localhost:3011/public/customers)
- [Security](http://localhost:3011/public/security) · [Docs](http://localhost:3011/public/docs) · [Status](http://localhost:3011/public/status)
- [Bug bounty](http://localhost:3011/public/bug-bounty) · [Sign-up](http://localhost:3011/public/signup)
- [security.txt](http://localhost:3011/.well-known/security.txt)

### 7. Operator admin + ops corners

- [Login](http://localhost:3011/login) — stub UI (real auth in API, not wired)
- [Overview](http://localhost:3011/overview) · [Alerts](http://localhost:3011/alerts) · [Settings (HQ)](http://localhost:3011/settings) · [Screens](http://localhost:3011/screens)
- [Orgs](http://localhost:3011/orgs) · [Pilot Charlie](http://localhost:3011/orgs/pilot-charlie) · [Provisioning](http://localhost:3011/orgs/provisioning)
- [Admin · plans](http://localhost:3011/admin/plans) · [secrets](http://localhost:3011/admin/secrets) · [users](http://localhost:3011/admin/users)
- [Ops · data sources](http://localhost:3011/ops/data-sources) · [health](http://localhost:3011/ops/health)

---

## Backend (Phase 1.X — REAL, not stubs)

**Live, tested, end-to-end working** (198 integration tests):

| Service          | What works                                                                                                 | Tests                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | --- |
| `auth`           | login, refresh, logout, me, register (scrypt + real JWT pair)                                              | ~12                                            |
| `org`            | CRUD, region pinning (immutable post-create), brand-kit, billing                                           | ~10                                            |
| `user`           | invite / accept-invite / list / role / archive                                                             | ~8                                             |
| `territory`      | WKT polygons, point-in-polygon assignments                                                                 | ~6                                             |
| `knock`          | single + batch (500 in one call), session start/end, address upsert                                        | ~14                                            |
| `lead`           | state-machine routed, PII via Vault, auto-assignment                                                       | ~13                                            |
| `conversion`     | polymorphic donation                                                                                       | sale + processor residual + lead.status update | ~10 |
| `donation`       | pause / cancel / change-amount                                                                             | ~6                                             |
| `sale`           | installer handoff                                                                                          | ~5                                             |
| `audit`          | hash-chain per `(org, region)`, verify endpoint                                                            | ~9                                             |
| `pii-vault`      | two-person JIT unmask, AES-256-GCM envelope, HMAC digest                                                   | ~12                                            |
| `webhook`        | endpoint register (plaintext secret shown once), rotate, deliveries log                                    | ~11                                            |
| `notification`   | SMS / email / push channels (queued; Twilio wire-up Phase 1.2)                                             | ~7                                             |
| `marketing`      | provider register/connect/disconnect, creative generate (sync + polling), audience build, campaign deliver | ~10                                            |
| `content-studio` | copy / image / video / avatar with auto-fallback provider chain                                            | ~5                                             |

**Documented stubs** (interfaces present, return 501, Phase 1.X target marked in JSDoc):

- `auth/verify-mfa`, `auth/sso/*`, `auth/webauthn/*`
- `commission`, `payout`, `billing`, `compliance`, `do-not-knock`, `do-not-call`, `consent`, `dsar`, `realtime`

Each stub follows the same Fastify route + Zod schema + Prisma model pattern
the 16 real services use. See `docs/CODE-AUDIT.md` for the priority queue.

### Test the API yourself

```bash
# Boot API + Postgres + Redis
docker compose up -d postgres redis
pnpm --filter api db:migrate
pnpm --filter api dev   # in one terminal

# In another terminal:
API=http://localhost:3010

# 1. Health check
curl -s $API/v1/healthz

# 2. Register an org admin (auth + org creation in one)
curl -s -X POST $API/v1/auth/register \
  -H 'content-type: application/json' \
  -d '{
    "email": "brodie@door2digital.io",
    "password": "ChangeMeStrong!42",
    "orgName": "Pilot Charlie",
    "region": "US"
  }' | tee /tmp/reg.json

TOKEN=$(jq -r '.tokens.access' /tmp/reg.json)

# 3. Create a lead (PII goes into the vault, encrypted at rest)
curl -s -X POST $API/v1/leads \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{
    "addressId": "<from-knock-address-upsert>",
    "knockerId": "<your-user-id>",
    "pii": { "name": "Maria Santos", "phone": "+15125551234", "email": "maria@example.com" },
    "interest": "donate"
  }'

# 4. Record a $50 monthly donation conversion (creates Conversion + Donation, updates lead.status)
curl -s -X POST $API/v1/conversions \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{
    "leadId": "<lead-id-from-step-3>",
    "kind": "donation",
    "amountCents": 5000,
    "currency": "USD",
    "donation": { "cadence": "monthly", "processor": "micamp" }
  }'

# 5. Verify the audit chain
curl -s $API/v1/audit/verify -H "authorization: Bearer $TOKEN"
```

---

## What's NOT shipped (calibrated honesty)

- **Login wiring.** The `/login` UI is a stub — it doesn't POST to
  `/v1/auth/login`. Backend auth is real and tested; the operator UI just
  doesn't call it yet. First demo wiring task.
- **Real backend behind the operator console.** Every page reads fixtures
  from `apps/web-operator/src/lib/*-fixtures.ts`. Nothing in the operator
  UI talks to the live API yet. The 198 API tests prove the backend works;
  but the demo IS still UI-only until one happy-path slice is wired.
- **MiCamp, Stripe, GoCardless, PayNow, GIRO, Ably, Twilio** — all
  surface-only. No real payment, no real telephony, no realtime channel.
- **Native iOS app.** `apps/knocker-ios/` is scaffolded but not built.
  React mockups at `/mobile-preview` and `/accounts/{slug}/knocker-ios`
  are the only knocker-app visualisation.
- **AWS infrastructure.** Terraform scaffolds in `infra/terraform/`,
  nothing applied. No KMS keys exist — `PII_KMS_KEY` and `PII_SIV_KEY`
  are still local secrets, not AWS KMS aliases. Phase 1.1 work.
- **Cognito + SAML SSO.** Not started. Required for Pilot-Charlie go-live.
- **Stub services** (10 services × ~5 endpoints): commission, payout,
  billing, compliance, do-not-knock, do-not-call, consent, dsar, realtime,
  plus MFA + WebAuthn paths in auth. Each is a `501` with the target
  signature in JSDoc.
- **Sourcemap / observability.** Production builds drop sourcemaps (good
  for the runtime, bad for prod debugging). No Sentry / DD wired yet.
- **Per-account real data.** All 4 demo accounts (Hope Forward, World
  Vision, PestMax, Gold Coast Hospital) are fixtures. Numbers look real
  because they're hand-tuned; they aren't.

---

## Key docs

| Doc                               | Path                                                     | Verdict             |
| --------------------------------- | -------------------------------------------------------- | ------------------- |
| Master plan v0.3                  | `~/.claude/plans/question-im-about-to-greedy-cascade.md` | —                   |
| Architecture                      | `docs/architecture.md`                                   | 1222-line spec      |
| Code audit                        | `docs/CODE-AUDIT.md`                                     | **A−**              |
| Operational sweep                 | `docs/OPERATIONAL-SWEEP.md`                              | **GREEN**           |
| Pen-test readiness                | `docs/PEN_TEST_READINESS.md`                             | Phase 0 baseline    |
| Security review                   | `docs/SECURITY-REVIEW.md`                                | Phase 0 baseline    |
| Satellite verification            | `docs/SATELLITE-VERIFICATION.md`                         | All tiles green     |
| Overnight review (previous brief) | `docs/OVERNIGHT-REVIEW.md`                               | 170/170 routes      |
| **Railway env reference**         | `docs/RAILWAY-ENV.md`                                    | NEW tonight         |
| **This brief**                    | `docs/MORNING-BRIEF.md`                                  | NEW tonight         |
| ADRs                              | `docs/adr/0001`–`0028.md`                                | 15 full, rest stubs |

---

## What I (the agent) could NOT do — and why

1. **Railway deploy.** The Railway CLI requires browser-based OAuth. The
   `--browserless` flag is explicit: _"Browserless login requires an
   interactive terminal."_ No `RAILWAY_TOKEN` env var was set. The agent
   has no browser. **You need to run `railway login` once in the morning.**

That is the only blocker. Everything else is shipped + pushed.

---

## Recommended next-session priorities

1. **(5 min) Run `railway login && railway up`** — get the public URL live.
   Bookmark it. Share it with anyone you want to demo to.
2. **(later, when ready)** Add the API as a second Railway service so the
   marketing-studio integrations page can do real OAuth round-trips.
3. **MiCamp Gateway kickoff call.** Phase 0 prerequisite per master plan —
   sandbox creds, recurring billing, tokenised vault, ACH support.
   Nothing US-side ships without it.
4. **Wire ONE happy-path real backend call from the operator UI.**
   Suggested smallest meaningful slice: `/accounts/[slug]/leads/new` POSTs
   to `POST /v1/leads`. Replaces fixtures with a single live round-trip.
   Proves end-to-end works, then expand.
5. **Replace the documented stubs one service at a time.** Same pattern as
   the 16 already done. Suggested order: `commission` (depends on
   conversion, already real) → `payout` → `billing` → `compliance`.
6. **Cognito + SAML SSO** — Phase 1.1 lift to unlock the Pilot-Charlie
   path. Without this `/login` stays a stub.
7. **First Terraform apply** — get AWS Org `door2digital` created with
   the 6 accounts (dev/staging/prod/audit/security/shared-services) per
   master plan. Generates KMS keys → real values for `PII_KMS_KEY` +
   `PII_SIV_KEY`.

---

_Generated by the final overnight agent. Brodie logged off ~9pm 2026-05-24;
this brief is for the morning of 2026-05-25. Commit chain ends with the
commit that adds this file. **`git status` clean, `main` pushed to
origin, everything tested, nothing broken.**_
