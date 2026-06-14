# Door 2 Digital — CTO Master Plan v0.3

> **Owner:** Brodie · **Date:** 2026-05-24 · **Status:** Executing — Phase 0 COMPLETE
> **Versions:** Master at `/Users/Brodie/D2D/00-MASTER-PLAN.md`; in-repo at `d2d-platform/docs/architecture.md`
> **Engineer-ready:** every section is labelled, every file path is real, every decision is opinionated.

---

## v0.3 — what changed from v0.2 (2026-05-24)

- **Design DNA pivoted** from aurora-green + glass-effect to **mirror EazePay + EazePay Intelligence 1:1** — strict navy + light-blue palette (`paper / surface / ink / accent / line / line2`), Inter + JetBrains Mono fonts, 256px sidebar, 14px topbar, `.card / .pill / .section / .tbl` class library. **No glass effect. No aurora-green.** Sections §7.1, §7.2 in v0.2 are superseded; see actual implementation in `packages/ui-tokens/` and `packages/ui-web/`.
- **Stack simplified** from Nx + NestJS to **Turbo + Fastify + Prisma** matching the newer Eaze Intelligence convention. ADRs 0001 and 0002 updated.
- **Mobile pivoted** from Expo/React Native to **native iOS via Xcode** (Swift 5.10, SwiftUI, Swift Concurrency, SwiftData/GRDB). Android via Kotlin/Compose deferred to Phase 2. ADR-0003 updated.
- **MiCamp Gateway API** locked as US payment processor (Brodie's ISO). Stripe falls to AU + SG only. ADR-0028 added.
- **Plan-execution status:** Phase 0 scaffold COMPLETE in `/Users/Brodie/D2D/door-2-digital-platform/`. See repo `HANDOFF.md` for what's built and queued for Phase 1.1.

---

## v0.2 — what changed from v0.1 (read this first)

A second discovery round surfaced **major scope-shifting context** that flips Phase 1:

1. **Signed US enterprise pilot — 200+ knockers, 5K+ conversions/mo, charity + commercial both.** Phase 1 launches in the US first (not AU). AU + SG slide to Phase 2/3.
2. **MiCamp ISO agreement (US processor).** Replaces Stripe US in the payment stack. Brodie earns processor residuals on top of D2D's take rate. `services/payment` becomes adapter-pattern with MiCamp (US) + Stripe (AU, SG).
3. **Three-bucket conversion attribution** drives billing: door sales (15%), inside-sales-closed (10%), retargeting-attributed (5%), plus a **flat platform fee** (default $2,500/mo, configurable per pilot). Every `Conversion` carries `AttributionSource`.
4. **Enterprise table-stakes — all four required:** SSO/SAML/Okta, SOC 2 Type I, white-label (pilot's brand on the apps), dedicated single-tenant DB. Each adds 1–3 weeks; combined they push Phase 1 to **14–16 weeks**.
5. **Paid-solicitor registration is the longest-pole compliance work.** D2D's knockers solicit on the charity's behalf → D2D the entity must register as a paid solicitor in each state, 4–12 weeks per state plus bonds. Counsel is running parallel filings. Plan ships a **table-driven state-clearance engine** — campaigns only deliver to states marked "cleared" in `PaidSolicitorRegistration`.
6. **D2D operates the pilot's campaigns with D2D's own knocker team.** Tenancy model: D2D-as-operator is a tenant; pilot is a client whose campaigns D2D's team runs. Knockers belong to D2D's org, deployed against pilot-org campaigns.
7. **New AWS Org for D2D** (clean blast-radius, SOC 2-friendly). Reuse EazePay's Terraform modules + CI templates literally.
8. **Mobile distribution Day 1 = TestFlight + Play Internal Track** under D2D's developer accounts; white-label = pilot's brand baked into the build. Public store submissions deferred to Phase 4 (SaaS opening).
9. **AI-assisted brand identity in Phase 0** (~1 week with the aurora-green palette as starting point).
10. **Engineers already exist** — plan assumes 4–6 full-time engineers; sequencing fans services out in parallel from Phase 0 Week 2.

**Scope assumption to confirm before Phase 0 starts:**

- Engineering headcount actually available (plan defaults to 4–6)
- MiCamp Gateway API integration model finalized with MiCamp account team (recurring billing + tokenized cards + ACH)
- Pilot's contract terms (the % bucket rates I committed as defaults: $2,500/mo + 5% retargeting + 10% inside-sales + 15% door)
- Pilot's identity + go-live date (referenced as "Pilot-Charlie" throughout this plan; replace with real name when signed)
- Counsel's projected state-clearance schedule (drives Phase 1.5 rolling state launches)

---

## 0. Context — Why D2D, why now

Door-to-door sales — both **charity fundraising** (World Vision, Red Cross, ACFR/ACNC-registered orgs running street/door programs) and **commercial D2D** (pest control, solar, energy retailers, telecoms) — runs on clipboards, WhatsApp groups, and disposable lead lists. Reps capture interest at the door and **nothing is done with the data**: no retargeting, no follow-up sequence, no territory analytics, no conversion attribution back to the knocker. Incumbents (SalesRabbit, SPOTIO, Beest) each own a slice but none owns the **integrated OS** — Field capture → CRM → AI-generated retargeting → Programmatic delivery → Conversion → Commission, with full audit + compliance.

**Door 2 Digital (D2D)** is that OS. **Modernise door-to-door** by closing the loop from the knock to the converted donor/customer, with the same audit-grade engineering bar Brodie set for EazePay (pen-test-ready, SOC 2 mapped, multi-region residency, immutable audit chain). Operator-first (D2D's own knocker team runs campaigns for client charities + commercial customers) and SaaS-self-serve later.

**Pilot:** signed US enterprise charity+commercial customer ("Pilot-Charlie", real name TBD), 200+ knockers operating across multiple US states (rolling as paid-solicitor registrations clear), 5K+ conversions/mo expected. D2D's own knocker team — already in operation — runs Pilot-Charlie's campaigns. Pilot's contract: $2,500/mo platform fee + 5% on retargeting-attributed conversions + 10% on inside-sales-closed + 15% on door-closed sales/donations.

**MVP scope (locked, see §1):** US first (Phase 1, 14–16 weeks), AU second (Phase 2), SG third (Phase 3). Both verticals (charity + commercial) from Day 1. Native iOS + Android via Expo. White-label for the pilot. SSO/SAML. SOC 2 Type I scoping. Dedicated single-tenant DB for the pilot. We architect for the full multi-region multi-vertical SaaS Day 1 (no refactor later) — and **stage the GTM** (US pilot Phase 1 → AU expansion Phase 2 → SG expansion Phase 3 → public SaaS Phase 4).

---

## 1. Scope decisions (locked 2026-05-24, revised v0.2)

| #   | Decision                    | Choice                                                                                    | Implication                                                                                                                                                       |
| --- | --------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Operating model             | **Operator-first, SaaS later**                                                            | D2D's knocker team runs Pilot-Charlie's campaigns. Multi-tenant data model Day 1 (D2D-as-operator + Pilot-Charlie + future pilots). Self-serve onboarding Phase 4 |
| 2   | Markets — Phase 1           | **US only** (Pilot-Charlie's market)                                                      | US compliance + MiCamp + state-by-state cooling-off + TCPA Day 1. AU Phase 2, SG Phase 3                                                                          |
| 3   | Markets — Phase 2+          | **AU then SG**                                                                            | Multi-region residency primitives Day 1 (per-region clusters, region-pinned orgs) — but only US region provisioned in Phase 1                                     |
| 4   | Verticals                   | **Charity + Commercial both Day 1**                                                       | Polymorphic `Conversion` (donation \| sale) Day 1 + per-vertical compliance gates                                                                                 |
| 5   | Mobile strategy             | **Native Expo Day 1**                                                                     | iOS + Android; offline-first; biometric re-auth; encrypted SQLite; TestFlight + Play Internal distribution under D2D's developer accounts                         |
| 6   | Payment processor (US)      | **MiCamp Gateway API** (Brodie's ISO agreement)                                           | Brodie earns ISO residuals on top of D2D take rate. `services/payment` has MiCampAdapter + StripeAdapter (for AU, SG)                                             |
| 7   | Conversion attribution      | **3 buckets: door / inside-sales / retargeting**                                          | Every `Conversion.attributionSource` enum; billing rake differs per source                                                                                        |
| 8   | Take-rate (default)         | **$2,500/mo platform + 5%/10%/15%**                                                       | Configurable per pilot; billing service computes per-bucket rake monthly                                                                                          |
| 9   | Enterprise table-stakes     | **SSO/SAML + SOC 2 Type I + white-label + dedicated DB**                                  | All four required by Pilot-Charlie. Adds ~6 weeks to Phase 1. Pushes timeline to 14–16 weeks                                                                      |
| 10  | Paid-solicitor registration | **Counsel running parallel state filings; D2D ships table-driven state-clearance engine** | Campaigns only deliver to cleared states. Rolling launch as registrations land over Months 2–6                                                                    |
| 11  | Knocker team origin         | **D2D's own team (200+) runs Pilot-Charlie's campaigns**                                  | Tenancy: knockers belong to `Org{type=operator, slug=d2d-ops}`, deployed to campaigns owned by `Org{type=client, slug=pilot-charlie}`                             |
| 12  | Infrastructure              | **New AWS Org for D2D**                                                                   | Clean blast-radius; reuse EazePay's Terraform modules + CI workflows literally                                                                                    |
| 13  | Brand identity              | **AI-assisted in Phase 0**                                                                | Aurora-green palette I proposed as starting point; Mid-journey + Claude + Figma; ~1 week; Brodie signs off                                                        |
| 14  | Phase 1 timeline            | **14–16 weeks** (no scope compromise)                                                     | Both verticals + nationwide US (rolling per state-clearance) + native mobile + full enterprise stack                                                              |
| 15  | Engineering team            | **4–6 engineers, full-time, already exist** (assumption to confirm)                       | Fan-out across services possible from Phase 0 Week 2                                                                                                              |

**Cross-cutting principle:** _Build the platform for the whole ambition; stage the launches._ US enterprise pilot in Phase 1; AU expansion in Phase 2; SG + AI Marketing Studio in Phase 3; public SaaS opening in Phase 4.

---

## 2. Repo, monorepo & deployment topology

### 2.1 Single monorepo, private GitHub org

- **GitHub org:** `door2digital`
- **Repo:** `door2digital/d2d-platform`
- **Package scope:** `@d2d/*`
- **Stack baseline (locked Day 1):** pnpm 9.12.0 · Nx 20.0.0 · Node 20 LTS · TypeScript 5.5 (ESM-only) · NestJS 10 + Fastify · Prisma 5.22 · Postgres 16 + PostGIS 3.4 · Redis 7 · BullMQ 5 · XState v5

### 2.2 Directory tree

```
door-2-digital-platform/
├── apps/                            # Deployable units. One Dockerfile per app at repo root.
│   ├── api/                         # NestJS BFF — REST /v1/* + OpenAPI; owns Prisma schema
│   ├── webhooks/                    # Isolated inbound webhook receiver (Stripe, Twilio, Meta, ABS)
│   ├── workers/                     # BullMQ workers; CRON_LEADER=true on exactly one replica
│   ├── operator-console/            # Next.js 14 — Brodie's cross-tenant ops view (apps/operator-console)
│   ├── org-console/                 # Next.js 14 — per-org admin (managers, accountants, compliance)
│   ├── crm-desktop/                 # Next.js 14 — inside-sales dialer workstation
│   ├── marketing-studio/            # Next.js 14 — AI ad gen + Meta/Google/TikTok delivery UI
│   ├── partner-portal/              # Next.js 14 — client org self-service (reports, billing)
│   ├── public-site/                 # Next.js 14 — d2d.io marketing + pricing + lead capture
│   ├── public-api-docs/             # Next.js 14 — Redocly OpenAPI for /v1 + webhooks
│   ├── knocker-mobile/              # Expo SDK 51 — iOS + Android offline-first field app
│   ├── storybook-web/               # @d2d/ui-web Storybook
│   └── storybook-mobile/            # @d2d/ui-mobile Storybook (Expo)
│
├── services/                        # NestJS modules. One bounded context each. Importable as @d2d/service-*.
│   │                                # Boundary enforced by Nx project graph (NOT network).
│   ├── auth/                        # JWT issue/verify, MFA, sessions, RBAC, ApiKey + scopes
│   ├── org/                         # Tenant lifecycle, brand, REGION PINNING (immutable), billing seats
│   ├── user/                        # Staff/knocker accounts, role assignment, manager hierarchy
│   ├── territory/                   # PostGIS polygons, turf assignment, heat-map overlays, suggestions
│   ├── knock/                       # Knock events, disposition, geo+photo+signature, offline reconcile
│   ├── lead/                        # Lead lifecycle (XState), enrichment, routing to inside-sales
│   ├── crm/                         # Activities (call/SMS/email), pipeline stages, sequences
│   ├── conversion/                  # Polymorphic conversion (Donation | Sale), idempotent finalisation
│   ├── donation/                    # Recurring + one-off giving; Stripe AU/US/SG; ACNC receipts
│   ├── sale/                        # Commercial one-shot sale; installer scheduling handoff
│   ├── commission/                  # Per-knock/per-sale/hybrid plans; crew-leader override calc
│   ├── payout/                      # Fortnightly/monthly payout INSTRUCTION (never auto-pays)
│   ├── compliance/                  # ACNC, state charitable, DNC/TPS/PDPA, consent ledger
│   ├── do-not-knock/                # Address-level DNK list per region, nightly DNC sync
│   ├── marketing/                   # Ad account linking, audience builds, delivery to Meta/Google/TikTok
│   ├── content-studio/              # Claude/OpenAI copy, FLUX images, Runway/HeyGen video pipelines
│   ├── notification/                # SMS (Twilio), email (Resend), push (Expo); region-aware
│   ├── mapping/                     # Mapbox geocoding, ABS/ACS/SingStat ingestion + caching
│   ├── risk/                        # Fraud signals on knock fabrication, GPS spoofing, dup conversions
│   ├── pii-vault/                   # Envelope-encrypt PII; deterministic-SIV search; JIT unmask
│   ├── audit/                       # Hash-chained AuditEvent outbox → S3 Object Lock (7yr)
│   ├── webhook/                     # Outbound webhook registry, HMAC signing, retry+DLQ
│   ├── integrations/                # Inbound adapters (Stripe, Twilio, Resend, Meta, Mapbox)
│   ├── realtime/                    # Ably channel grants, live-knock feed, leaderboard publishers
│   └── dsar/                        # Data subject access/deletion request orchestration
│
├── libs/                            # Cross-cutting, non-deployable shared packages.
│   ├── shared-types/                # Branded primitives (OrgId, KnockId), enums, DTO Zod schemas
│   ├── shared-utils/                # money.ts (BigInt cents), problem.ts (RFC 7807), crypto, idempotent
│   ├── api-client/                  # Typed fetch client generated from OpenAPI
│   ├── mobile-client/               # Knocker-mobile API client + offline queue + delta sync
│   ├── ui-tokens/                   # Tailwind preset + tokens (color, type, spacing, glass)
│   ├── ui-web/                      # React web component lib (Radix + Tailwind)
│   ├── ui-native/                   # React Native component lib (Tamagui / NativeWind)
│   ├── ui-maps/                     # Mapbox GL JS / react-native-mapbox-gl wrappers
│   ├── geo/                         # PostGIS helpers, polygon ops, S2/H3 cell indexing
│   ├── state-machines/              # Shared XState v5 machines (lead, knock, conversion)
│   ├── feature-flags/               # OpenFeature client + provider adapters
│   ├── observability/               # Pino logger preset, OTel tracer, PII redactor
│   ├── intl/                        # next-intl + expo-localization shared catalogs
│   └── testing/                     # Testcontainers harness, factory-bot fixtures, msw handlers
│
├── tools/
│   ├── scripts/                     # seed.ts, migrate-region.ts, reindex-pii.ts
│   └── generators/                  # Nx generators (new-service, new-app, new-state-machine)
│
├── infra/
│   ├── terraform/
│   │   ├── modules/                 # aurora, ecs-service, kms, network, redis, s3-bucket, secrets, cloudfront-waf, ably-grant
│   │   └── envs/{dev,staging,prod}/
│   │       ├── us-east-1/           # Primary control plane + US data plane
│   │       ├── ap-southeast-2/      # AU data plane (Sydney) — residency
│   │       └── ap-southeast-1/      # SG data plane (Singapore) — residency
│   ├── railway/                     # Day-1 toml configs per app
│   └── runbooks/                    # On-call procedures
│
├── docs/
│   ├── adr/                         # 0001–0028 Day-1 ADRs (table in §13)
│   ├── architecture.md              # This document, versioned
│   ├── compliance/                  # ACNC, FundraisingNSW, state-by-state US, PDPA, data-classification.md
│   ├── runbooks/                    # incident-response.md, data-breach-72h.md, region-failover.md, ai-brand-safety-failure.md
│   ├── audits/merkle-roots/         # Weekly audit-chain Merkle roots per region
│   ├── api/                         # Hand-authored API guide
│   ├── PEN_TEST_READINESS.md        # Living checklist
│   └── SECURITY.md
│
├── e2e/                             # Playwright cross-app suites
├── .github/workflows/               # ci.yml, deploy-railway.yml, deploy-aws.yml, release.yml
├── .husky/                          # pre-commit (lint-staged: eslint --fix + prettier --write + gitleaks)
├── pnpm-workspace.yaml              # apps/* services/* libs/* tools/*
├── nx.json
├── tsconfig.base.json               # Path aliases @d2d/* → libs/*/src/index.ts
├── Dockerfile.api                   # Per-app dockerfiles at root (mirror EazePay pattern)
├── Dockerfile.workers
├── Dockerfile.webhooks
├── Dockerfile.<each-next-app>
└── docker-compose.yml               # Local Postgres+PostGIS, Redis, MinIO, Mailpit, Jaeger
```

### 2.3 Naming rules (enforced by `tools/generators/`)

| Element         | Pattern                              | Example                              |
| --------------- | ------------------------------------ | ------------------------------------ |
| Service package | `@d2d/service-<domain>`              | `@d2d/service-territory`             |
| Library package | `@d2d/<name>`                        | `@d2d/shared-utils`                  |
| App folder      | kebab-case noun                      | `apps/knocker-mobile`                |
| Controller file | `<resource>.controller.ts`           | `knock.controller.ts`                |
| Module file     | `<domain>.module.ts`                 | `territory.module.ts`                |
| State machine   | `state-machine.ts` (one per service) | `services/lead/src/state-machine.ts` |
| Nx project name | matches package name suffix          | `service-territory`                  |

### 2.4 Deployment topology

**Day 1 — Railway** (mirror EazePay's `partner-portal` pattern):

- One Railway service per app, configured via `railway.<app>.toml` at repo root.
- Railway-managed Postgres + Redis for **dev/staging only**.
- **Production uses real RDS from Day 1** even on Railway — no later migration drama.
- Mobile via EAS Build → TestFlight + Play Internal Track.

**Phase 4 — AWS**:

| Component                                   | Service                                               |
| ------------------------------------------- | ----------------------------------------------------- |
| `apps/api`, `apps/webhooks`, `apps/workers` | ECS Fargate (3 services), ALB, autoscaling            |
| Next.js apps                                | Vercel Enterprise (one project per app)               |
| `apps/knocker-mobile`                       | EAS Build → App Store / Play Store                    |
| Postgres                                    | Aurora PostgreSQL Serverless v2, per-region cluster   |
| Cache + queue                               | ElastiCache Redis 7, per-region                       |
| Object storage                              | S3 per region; audit bucket Object Lock COMPLIANCE 7y |
| CDN + WAF                                   | CloudFront + AWS WAF (managed + custom rules)         |
| Secrets                                     | Secrets Manager + Parameter Store (IRSA, no env vars) |
| DNS                                         | Route 53 (latency-based routing for `api.d2d.io`)     |
| KMS                                         | Customer-managed CMK per (region × datastore class)   |
| Observability                               | OTel collector → Datadog (APM + logs + RUM)           |
| Auth                                        | Cognito user pools per region                         |
| Email                                       | Resend primary, SES per-region fallback               |

### 2.5 Branching, CI gates, environments

- **Trunk:** `main`. Feature branches `feat/<scope>-<slug>`. Squash-merge only. Conventional Commits via commitlint.
- **PR gates (all required):**
  1. `pnpm install --frozen-lockfile`
  2. `nx format:check`
  3. `pnpm lint:check`
  4. `pnpm typecheck`
  5. `gitleaks detect`
  6. `semgrep --config=p/owasp-top-ten --config=p/typescript`
  7. `trivy fs --severity HIGH,CRITICAL`
  8. `nx affected -t test` (unit)
  9. `nx affected -t test:integration` (Testcontainers PG + Redis)
  10. `playwright test` against ephemeral preview (Vercel preview + Railway PR env)
- **Cross-tenant + cross-region isolation probe in CI** (synthetic test creates two tenants/regions and asserts 403 + audit row on attempted cross-access).
- **Audit Merkle replay test weekly in CI.**

| Env     | Regions                                            | DB                              | Notes             |
| ------- | -------------------------------------------------- | ------------------------------- | ----------------- |
| dev     | us-east-1 only                                     | shared Aurora Serverless v2     | reset weekly      |
| staging | us-east-1 + ap-southeast-2 + ap-southeast-1 (mini) | per-region Aurora t4g.medium    | residency drill   |
| prod    | us-east-1 + ap-southeast-2 + ap-southeast-1        | per-region Aurora Serverless v2 | full multi-region |

---

## 3. Tech stack (locked Day 1)

| Layer                       | Choice                                                                                                                                                                               | Region split                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| Language                    | TypeScript 5.5 ESM-only, `noUncheckedIndexedAccess`                                                                                                                                  | —                            |
| Runtime                     | Node 20 LTS                                                                                                                                                                          | —                            |
| Package mgr                 | pnpm 9.12.0                                                                                                                                                                          | —                            |
| Monorepo                    | Nx 20 + Nx Cloud (paid CI cache)                                                                                                                                                     | —                            |
| Backend                     | NestJS 10.4.22 + Fastify 4 (locked via `pnpm.overrides`)                                                                                                                             | —                            |
| HTTP validation             | Zod 3 + `nestjs-zod` (single source of truth for DTO + OpenAPI)                                                                                                                      | —                            |
| ORM                         | Prisma 5.22                                                                                                                                                                          | —                            |
| DB                          | Aurora PostgreSQL 16 + PostGIS 3.4                                                                                                                                                   | One cluster per region       |
| Cache + queue               | ElastiCache Redis 7 + BullMQ 5                                                                                                                                                       | Per region                   |
| Search                      | Postgres FTS Day 1; OpenSearch when >5M leads                                                                                                                                        | —                            |
| Object storage              | S3 + Object Lock (audit) + versioning + KMS-SSE                                                                                                                                      | Per region                   |
| Mapping                     | Mapbox (geocoding + tiles); ABS 2021 / US ACS 5-yr / SingStat (nightly refresh)                                                                                                      | Per region                   |
| Maps client                 | mapbox-gl-js (web), `@rnmapbox/maps` (RN)                                                                                                                                            | —                            |
| Mobile                      | Expo SDK 51 + EAS Build + EAS Update                                                                                                                                                 | —                            |
| Web                         | Next.js 14 App Router + React 18 + Tailwind                                                                                                                                          | —                            |
| Auth                        | AWS Cognito + first-party JWT (RS256), ≤5min lifetime                                                                                                                                | Per region Cognito           |
| MFA                         | TOTP (RFC 6238) + SMS fallback via Twilio Verify; **WebAuthn hardware key for admin**                                                                                                | —                            |
| Realtime                    | Ably (managed channels, JWT-scoped)                                                                                                                                                  | —                            |
| Payments — US **(Phase 1)** | **MiCamp Gateway API** (Brodie's ISO; cards + ACH + recurring + tokenized vault)                                                                                                     | US                           |
| Payments — AU **(Phase 2)** | Stripe AU (cards + recurring) + GoCardless (BPAY/PayTo)                                                                                                                              | AU                           |
| Payments — SG **(Phase 3)** | Stripe SG (cards) + PayNow via Stripe                                                                                                                                                | SG                           |
| Payment abstraction         | `services/payment` adapter pattern — `MiCampAdapter`, `StripeAdapter`; common `PaymentMethod`, `Charge`, `Subscription`, `Refund` interfaces; ISO residual tracking on MiCamp volume | —                            |
| SMS                         | Twilio (US long codes, AU dedicated, SG alphanumeric `D2D`)                                                                                                                          | Per region Messaging Service |
| Email                       | Resend primary + SES fallback (SPF/DKIM/DMARC per brand subdomain)                                                                                                                   | —                            |
| Push                        | Expo Push (Day 1) → APNs/FCM direct (Phase 4)                                                                                                                                        | —                            |
| AI text                     | Claude Opus 4.7 primary + GPT-4.1 fallback                                                                                                                                           | —                            |
| AI image                    | FLUX 1.1 Pro via Replicate; Ideogram for text-in-image                                                                                                                               | —                            |
| AI video                    | Runway Gen-3 (b-roll) + HeyGen (AI avatar UGC)                                                                                                                                       | —                            |
| Ad APIs                     | Meta Marketing v20, Google Ads v17, TikTok Marketing v1.3                                                                                                                            | —                            |
| Observability               | Pino + OpenTelemetry → Jaeger (local) / Datadog (prod)                                                                                                                               | —                            |
| Audit sink                  | S3 Object Lock COMPLIANCE 7y; hash-chained                                                                                                                                           | Per region                   |
| Secrets                     | AWS Secrets Manager (prod) / Doppler (dev)                                                                                                                                           | —                            |
| Feature flags               | OpenFeature + LaunchDarkly                                                                                                                                                           | —                            |
| IaC                         | Terraform 1.9 + Terragrunt                                                                                                                                                           | —                            |
| CI                          | GitHub Actions (gitleaks, semgrep, trivy, nx affected, prettier, eslint)                                                                                                             | —                            |
| CD Day 1                    | Railway (per-app `railway.<app>.toml`)                                                                                                                                               | —                            |
| CD Phase 4                  | ECS Fargate + Vercel + EAS Build + CloudFront/WAF                                                                                                                                    | —                            |

---

## 4. Data model — Prisma schema sketch

Path: `apps/api/prisma/schema.prisma`. **Every regulated table carries `orgId`, `regionCode`, `brandCode`.** PII columns marked `/// PII` and routed through `services/pii-vault`. Geometry uses `Unsupported("geography(Polygon,4326)")` / `Unsupported("geography(Point,4326)")`.

### 4.1 Enums (excerpt)

```prisma
enum RegionCode { AU US SG }
enum Vertical   { charity commercial }
enum OrgType    { operator client }                    // operator = D2D-internal; client = pilot/customer
enum PlatformRole {
  super_admin    // D2D ops; cross-tenant
  org_admin      // Client org admin
  manager        // Crew/team lead
  knocker        // Field
  inside_sales   // Call centre
  accountant     // Read finance + commissions
  auditor        // Read-only with full audit access
  viewer         // Read-only restricted
}
enum KnockDisposition {
  no_answer not_interested callback do_not_knock appointment
  converted_donation converted_sale hostile invalid_address
}
enum LeadStatus { new contacted qualified appointment_set converted lost do_not_contact }
enum ConversionType { donation_recurring donation_oneoff sale_commercial }
enum AttributionSource { door inside_sales retargeting other }   // drives billing rake bucket
enum DonationFrequency { weekly fortnightly monthly annual }
enum CommissionType { per_knock per_appointment per_conversion override }
enum PayoutStatus { draft ready_to_pay instructed acknowledged archived }
enum ConsentChannel { sms email phone postal door }
enum WebhookStatus { pending delivered failed dlq }
enum PaymentProvider { micamp stripe_au stripe_sg }     // adapter discriminator
enum SolicitorStatus { pending submitted approved expired rejected }
enum SsoProvider { okta azuread auth0 google_workspace generic_saml }
```

### 4.2 Core entities (sketch — full schema in `apps/api/prisma/schema.prisma`)

- **Org** — `id, legalName, tradingName, vertical, type (operator|client), regionCode (IMMUTABLE), brandCode, abnAcnUen, status, aiBudgetCents, aiRetargetingOptOut, dedicatedDb (bool for enterprise tenants like Pilot-Charlie), ssoProvider, ssoMetadata`. Region pinning is a CHECK constraint + Postgres trigger that raises on UPDATE.
- **BrandKit** (white-label) — `id, orgId (UNIQUE), displayName, logoLightKey, logoDarkKey, iconKey, faviconKey, primaryColor, accentColor, customDomain, appBundleId (iOS), appPackageName (Android), supportEmail, supportPhone, privacyPolicyUrl, termsUrl`. Drives mobile build variants + web tenant theming.
- **PaidSolicitorRegistration** — `id, regionCode, state (e.g. 'CA', 'NY'), entityId (D2D operator org), clientOrgId, status (SolicitorStatus), filedAt, approvedAt, expiresAt, bondAmountCents, registrationNumber, evidenceKey (S3)`. Compliance engine checks `status == 'approved' AND expiresAt > now()` before allowing campaign delivery to that state.
- **CampaignStateClearance** — `id, campaignId, state, clearedAt, paidSolicitorRegistrationId`. Many-to-many between campaigns and cleared states.
- **OrgBilling** — `id, orgId, platformFeeMonthlyCents, doorRakePercent, insideSalesRakePercent, retargetingRakePercent, billingDay, currency`. Drives invoice generation. Default for Pilot-Charlie: `$2500/mo + 15%/10%/5%`.
- **Invoice / InvoiceLineItem** — generated monthly by `services/billing` from conversions tagged with `AttributionSource`. Line items: platform fee + per-bucket rake totals.
- **SsoConfiguration** — `id, orgId, provider (SsoProvider), entityId, ssoUrl, certificateKey (S3 KMS), attributeMappingJson, status, lastValidatedAt`. SAML 2.0 service-provider metadata for the enterprise IdP.
- **User** — `id, orgId, email (PII vaulted), emailDigest (SIV unique), phone (PII), givenName/familyName (PII), role, managerId (hierarchy), regionCode, brandCode, status`.
- **Territory** — `id, orgId, regionCode, brandCode, name, vertical, polygon (PostGIS), centroid, s2CellIds[] (level-13 covering), campaignId, status, metadata (SEIFA decile / ACS median income / SingStat planning area)`.
- **TerritoryAssignment** — `id, territoryId, userId, assignedAt, expiresAt`.
- **KnockSession** — `id, orgId, userId, territoryId, regionCode, startedAt, endedAt, startGeo, deviceId`.
- **Address** — `id, regionCode, formatted, unit, street, locality, region, postcode, countryCode, geo, s2CellId, hashKey (SHA-256 unique)`.
- **Knock** — `id, sessionId, orgId, userId, territoryId, addressId, regionCode, brandCode, disposition, geo, capturedAt (device clock), serverReceivedAt, clientOffsetMs (fraud signal), photoKey (S3 KMS), signatureKey, notes (PII), leadId?, syncBatchId, idempotencyKey (UNIQUE)`.
- **Lead** — `id, orgId, regionCode, brandCode, sourceKnockId, addressId, status, assignedToId (inside-sales), vertical, campaignId, givenName/familyName/email/phone (PII), emailDigest/phoneDigest`.
- **LeadActivity** — `id, leadId, userId, type (call/sms/email/note/sequence_step), outcome, payload, createdAt`.
- **Conversion** — `id, orgId, regionCode, brandCode, leadId, knockId, knockerId (door attribution), closerId, type, attributionSource (door|inside_sales|retargeting|other), retargetingCampaignId? (FK to AdCampaign), donationId?, saleId?, amountCents (BigInt), currency, signedAt, signatureKey, paymentProvider (micamp|stripe_au|stripe_sg), paymentExternalId, processorResidualCents (computed for MiCamp ISO), idempotencyKey (UNIQUE)`. **The `attributionSource` enum directly drives the billing rake bucket — single source of truth for revenue calculation.**
- **Donation** — `id, conversionId (UNIQUE), donorEmail (PII), amountCents, currency, frequency, paymentMethodId, stripeSubId, status, receiptNumber, deductibleGiftRecipientNo, startedAt, cancelledAt`.
- **Sale** — `id, conversionId (UNIQUE), productSku, installerOrgId, scheduledInstallAt, status`.
- **CommissionPlan** — `id, orgId, name, vertical, rules (declarative DSL versioned in @d2d/shared-types), effectiveFrom/To`.
- **Commission** — `id, orgId, userId, planId, type, conversionId?, knockId?, amountCents, currency, periodStart/End, payoutBatchId, status`.
- **PayoutBatch** — `id, orgId, regionCode, periodStart/End, status, totalCents, currency, instructionFileKey (CSV/ABA/NACHA/PayNow), instructedAt`.
- **AdAccount / Creative / AdCampaign** — marketing.
- **DoNotKnock / DoNotCall / ConsentRecord** — compliance.
- **AuditEvent** — `id, orgId, regionCode, actorUserId, action, resourceType, resourceId, beforeJson, afterJson, metadata, prevHash, rowHash (SHA-256 chain), occurredAt, shippedToS3At`.
- **ApiKey / WebhookEndpoint / WebhookDelivery / IdempotencyRecord** — public API surface.

---

## 5. API surface

**Base:** `https://api.d2d.io/v1`. **Regional CNAMEs:** `api-au.d2d.io`, `api-us.d2d.io`, `api-sg.d2d.io`. CloudFront function inspects JWT/`X-Api-Key`, looks up `Org.regionCode` in the global control plane (cached), routes accordingly.

**Auth:** `Authorization: Bearer <jwt>` for user sessions; `X-Api-Key: d2d_live_<32>` + `X-Api-Key-Secret: <hmac>` for partner integrations. Scopes: `knock:read|write`, `lead:read|write|unmask`, `conversion:read|write`, `payout:instruct`, `marketing:publish`, `audit:read`.

**Standards:**

- **Errors:** RFC 7807 — `{ type, title, status, detail, instance, traceId }`. Subtypes namespaced at `https://docs.d2d.io/problems/<slug>`.
- **Idempotency:** `Idempotency-Key` header REQUIRED on every `POST`. Stored in `IdempotencyRecord` 24h; replay returns identical response.
- **Pagination:** cursor-only — `?cursor=&limit=` → `{ data, nextCursor }`.
- **Versioning:** URL `/v1`; breaking changes go to `/v2` with parallel run.
- **OpenAPI:** auto-generated from `nestjs-zod` schemas; published at `https://docs.d2d.io`; typed client `@d2d/api-client`.

**Namespaces:**

```
/v1/auth/*                          login, refresh, mfa, sessions
/v1/orgs                            POST creates org; regionCode locked at creation
/v1/users                           org-scoped staff CRUD
/v1/territories                     POST polygon; GET /heatmap?bbox=&layer=seifa
/v1/territories/:id/assignments
/v1/sessions                        knocker session start/end
/v1/knocks                          POST + POST /batch (offline sync); idempotency-key REQUIRED
/v1/addresses/lookup                Mapbox-proxied geocode; DNK precheck
/v1/leads                           list/filter/assign
/v1/leads/:id/activities            log calls/sms/notes
/v1/conversions                     POST creates polymorphic conversion
/v1/donations                       recurring management (pause, change amount, cancel)
/v1/sales                           commercial workflow
/v1/commissions                     accrued + projection
/v1/payout-batches                  generate, lock, download instruction file
/v1/consent                         capture + lookup
/v1/do-not-knock                    list ingest + check
/v1/marketing/ad-accounts           OAuth linking
/v1/marketing/creatives             generate via content-studio
/v1/marketing/campaigns             deliver to provider
/v1/webhooks/endpoints              register + rotate secret
/v1/api-keys                        org-scoped issue/revoke
/v1/audit/events                    org_admin+ only; cursor-paginated
/v1/dsar/requests                   data-subject access/deletion
```

**Webhook delivery contract:** `D2D-Signature: t=<ts>,v1=<HMAC-SHA256(secret, ts.body)>`, ±5min replay window, receiver MUST be idempotent on `event.id` (ULID), retry 30s→2m→10m→1h→6h→24h then DLQ.

**Realtime (Ably):** JWT issued by `services/realtime` with channel caps. Channels: `org:<id>:territory:<id>:knocks` (live knock feed), `org:<id>:leaderboard:<period>`, `org:<id>:user:<id>:calls` (soft-phone state). Publish-only from server.

---

## 6. Multi-region data residency

**Decision:** **Postgres-per-region**, NOT Aurora Global with tablespace pinning.

**Why:** Aurora Global replicates everything to every secondary — defeats residency for AU/SG donors. Logical-replication carve-outs are operationally fragile and auditors won't accept them. Per-region clusters give a clean compliance story: _"Australian donor PII never leaves ap-southeast-2."_

**Topology:**

- `d2d-au-syd` (Aurora, ap-southeast-2) + S3 + KMS for AU tenants
- `d2d-us-iad` (Aurora, us-east-1) + S3 + KMS for US tenants
- `d2d-sg-sin` (Aurora, ap-southeast-1) + S3 + KMS for SG tenants
- **Small global control-plane Aurora in us-east-1**, holds only: `Org` (with `regionCode`), `User.emailDigest → home-region` pointer, `ApiKey.prefix → home-region` pointer, billing/Stripe org records (no donor PII).

**Region pinning enforcement:**

- `POST /v1/orgs { regionCode }` → row written to control plane AND data-plane cluster for that region.
- `Org.regionCode` IMMUTABLE — DB CHECK constraint + Postgres trigger raises on UPDATE.
- Every regulated mutation passes through `RegionGuard` middleware that asserts `org.regionCode == process.env.AWS_REGION` → mismatch returns `403 PROBLEM_REGION_MISMATCH` + audit row.
- DB user per region with `pg_hba.conf` constrained to that region's subnet — no cross-region replication of OLTP data.
- Backups stay in-region (KMS-encrypted with region's CMK).
- Audit hash-chain per-region (`prevHash` chain restarted in each region) — verified daily by `audit-verify` cron in `apps/workers`.

**Cross-region prohibition:** **No PII** ever leaves its region. Operator Console aggregates KPIs via nightly signed (cosign-attested) cross-region rollups (counts, sums, P95 — never lead-level rows) to a central observability account in us-east-1. Every aggregate read writes an audit row in each touched region. **There is no global "god view" with PII.**

---

## 7. UI/UX — Design System on EazePay Foundation + Glass Layer

### 7.1 Brand & tokens

D2D forks EazePay's token file (`/Users/Brodie/EazePay App/libs/ui/src/styles/globals.css`) into `@d2d/ui-tokens/src/styles/globals.css`. Keep EazePay's RGB-triplet CSS variable convention, spacing scale (8/16/24/32/48), radius scale (8/10/12/16), Inter + JetBrains Mono. **Replace navy accent with aurora-green. Add glass sub-system.**

| Role                     | Token                      | Light hex                           | Dark hex  | Use                                                           |
| ------------------------ | -------------------------- | ----------------------------------- | --------- | ------------------------------------------------------------- |
| **Primary / Aurora**     | `--accent`                 | `#0EA66B`                           | `#22C786` | Primary buttons, active nav, knock-through CTAs, "won" states |
| **Primary strong**       | `--accent-strong`          | `#075E3D`                           | `#34D399` | Pressed/hover-deep, large-area fills                          |
| **Primary soft**         | `--accent-soft`            | `#E3F7EC`                           | `#0C2A1E` | Tinted backgrounds, badges                                    |
| **Secondary / Electric** | `--accent-2`               | `#5B5BF7`                           | `#7C7CFF` | Marketing Studio chrome, AI/creative surfaces                 |
| **Tertiary / Signal**    | `--accent-3`               | `#F59E0B`                           | `#FBBF24` | Heatmap warm pole, callbacks-overdue, "needs attention"       |
| **Ink (neutrals)**       | `--bg`, `--fg`, `--border` | inherit from EazePay light grey/ink | inherit   | All chrome, tables, body                                      |

**Rationale:** Aurora-green = the literal "knocking through" doors metaphor, and green = conversion/won in every sales-ops mental model. Electric-indigo gives the AI surfaces a distinct register. Amber is reserved for operational signal so it retains meaning. Disposition colors stay distinct: SALE green, LEAD aurora, NOT_HOME amber, CALLBACK indigo, REFUSED muted-red, DNC hatched.

### 7.2 Glass surface sub-system (NEW — not in EazePay)

```css
/* Light mode */
--glass-tint-thin: 255 255 255 / 0.55;
--glass-tint-regular: 255 255 255 / 0.68;
--glass-tint-thick: 255 255 255 / 0.8;
--glass-tint-chrome: 244 245 248 / 0.72;
--glass-border: 255 255 255 / 0.45;
--glass-shadow: 0 8px 32px rgb(18 24 47 / 0.08), inset 0 1px 0 rgb(255 255 255 / 0.5);

/* Dark mode */
--glass-tint-thin: 15 18 31 / 0.55;
--glass-tint-regular: 15 18 31 / 0.68;
--glass-tint-thick: 9 12 21 / 0.82;
--glass-tint-chrome: 9 12 21 / 0.72;
--glass-border: 255 255 255 / 0.08;
--glass-shadow: 0 8px 32px rgb(0 0 0 / 0.5), inset 0 1px 0 rgb(255 255 255 / 0.06);
```

**Blur scale (Apple material taxonomy):**

| Class       | `backdrop-filter`           | Used on                                        |
| ----------- | --------------------------- | ---------------------------------------------- |
| `.glass-sm` | `blur(8px) saturate(140%)`  | Tooltips, small popovers                       |
| `.glass-md` | `blur(16px) saturate(160%)` | Dropdowns, command palette, hover cards        |
| `.glass-lg` | `blur(24px) saturate(180%)` | Sidebars, mobile tab bar, side sheets          |
| `.glass-xl` | `blur(40px) saturate(180%)` | Modal scrims, full-screen sheets, map overlays |

**Hard rule — glass = chrome, solid = content:**

| Surface                                                                                                                   | Treatment                                          |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Sidebar nav, top bar, command palette, mobile tab bar, map info-panels, knock-card sheet, modal scrim, push notifications | **Glass**                                          |
| Data tables, KPI tiles, forms, dashboards, kanban columns, audit log, dialer cockpit, settings panels                     | **Solid** (contrast + scroll FPS)                  |
| Map canvas itself                                                                                                         | **Opaque vector tiles** + glass-md panels overlaid |

**Tailwind utilities added to `@d2d/ui-tokens/tailwind-preset.cjs`:**

```js
extend: {
  backdropBlur: { 'glass-sm': '8px', 'glass-md': '16px', 'glass-lg': '24px', 'glass-xl': '40px' },
  backdropSaturate: { 'glass': '180%' },
  backgroundColor: {
    'glass-thin':    'rgb(var(--glass-tint-thin))',
    'glass-regular': 'rgb(var(--glass-tint-regular))',
    'glass-thick':   'rgb(var(--glass-tint-thick))',
    'glass-chrome':  'rgb(var(--glass-tint-chrome))',
  },
  borderColor: { 'glass': 'rgb(var(--glass-border))' },
},
plugins: [
  plugin(function ({ addUtilities }) {
    addUtilities({
      '.glass-sm': { 'backdrop-filter': 'blur(8px) saturate(140%)',  '-webkit-backdrop-filter': 'blur(8px) saturate(140%)' },
      '.glass-md': { 'backdrop-filter': 'blur(16px) saturate(160%)', '-webkit-backdrop-filter': 'blur(16px) saturate(160%)' },
      '.glass-lg': { 'backdrop-filter': 'blur(24px) saturate(180%)', '-webkit-backdrop-filter': 'blur(24px) saturate(180%)' },
      '.glass-xl': { 'backdrop-filter': 'blur(40px) saturate(180%)', '-webkit-backdrop-filter': 'blur(40px) saturate(180%)' },
      '.glass-pane': {
        'background-color': 'rgb(var(--glass-tint-regular))',
        'border': '1px solid rgb(var(--glass-border))',
        'box-shadow': 'var(--glass-shadow)',
      },
    });
  }),
]
```

**Fallback:** `@supports not (backdrop-filter)` → solid `--bg-elevated`. Mobile: disable blur on scrolling content (perf); Android < API 31 → solid only.

### 7.3 Component library

**Reused unchanged from EazePay (`@eazepay/ui` peer dep):** Button, Input, Textarea, Select, Card family, StatusPill, Banner, KpiCard, Sparkline, BarChart, DataTable, EmptyState, Skeleton, Tabs, DisclosurePanel, Money, Apr, MaskedField, DataRow, CodeBlock, Stepper, DropdownMenu, Avatar, Dialog, Logo, Icon.

**Forked:** `AppShell` (apply glass-lg to sidebar + GlassNavBar to topbar; nav data model preserved).

**New components in `@d2d/ui-web`:** GlassPanel, GlassNavBar, GlassSheet, CommandPalette, OrgSwitcher, MapCanvas, TerritoryLayer, HeatmapLayer, KnockPinCluster, DNCOverlay, TerritoryDrawTool, MapPanel, KnockCard, LeadCard, DispositionPicker, PipelineKanban, PitchScriptViewer, CallControlBar, DialerCockpit, CreativeGenerator, AdPreview, CommissionLadder, Leaderboard, ConsentRecorder, SignatureCanvas, AnomalyCard, AuditDrawer, RegionBadge, OfflineBanner.

**New components in `@d2d/ui-native`:** GlassTabBar, GlassNavHeader, MapCanvasNative, KnockSheet (Expo BottomSheet 3 snap points), DispositionWheel (radial picker, haptic), LeadFormFast (3-field warm capture), SignaturePadNative, OfflineQueueBanner, GPSAccuracyBadge, PushCard.

### 7.4 Information Architecture per surface

**Operator Console (`console.door2digital.com`) — sidebar (glass-lg) + persistent org switcher topbar:**

- **Overview** — cross-org KPIs (MRR, active orgs, knocks/wk, conversion, ARR by region), anomaly feed, signups funnel
- **Orgs** — list + Detail (`/orgs/[id]`: plan, seats, usage, billing, owner, audit), Provisioning queue
- **Billing** — Invoices, Subscriptions, Plans, Dunning, Rev rec
- **Audit** — global audit stream, replay, export; filter by org/actor/entity/event
- **Compliance** — region matrix, DNC list sync, data-residency assertions, retention jobs
- **System** — feature flags, background jobs, webhook delivery, SLOs
- **Settings** — operator users, RBAC, API keys, secrets vault, white-label

Every page has `?` keyboard binding → `AuditDrawer` filtered to current entity. Cmd+K → CommandPalette.

**Org Console (`app.door2digital.com/{orgSlug}`):**

- **Today** — anomaly-first (DNC violations, missed callbacks, low-converting territories, idle knockers, leaderboard top-3, AI commentary)
- **Territories** — Map / List / Heatmap / Detail / Drafts (MapCanvas + TerritoryLayer + HeatmapLayer + DNCOverlay; right-side GlassSheet for selected; TerritoryDrawTool)
- **Campaigns** — list + Create wizard + Detail (territories, teams, materials, pitch script, schedule, performance)
- **Leads** — Inbox / All / By source / Detail (timeline, consent record, attached knocks/calls/emails, conversion path)
- **Pipeline** — Kanban + forecast + conversion analytics
- **Knocker Teams** — Roster / Schedules / Performance / Onboarding queue / Disciplinary
- **Inside Sales** — Queue / DialerCockpit (full-screen, pop-out window) / Sequences / Performance
- **Marketing Studio** — Creative library / Generator / Campaigns / Landing pages / Brand kit (electric-indigo chrome)
- **Conversions** — Donations (charity) / Sales (commercial), dual schema
- **Commissions** — Plans / Statements / Disputes / Payouts queue (CommissionLadder per statement)
- **Payouts** — Methods / Schedule / History / Reconciliation
- **Reports** — Saved / Builder / Scheduled exports
- **Integrations** — Mapbox / payment gateway per region / CRM exports / dialer providers / email/SMS
- **Settings** — Org profile, regions enabled, users + roles, branding, billing, data + privacy

**Knocker Mobile App (`D2D Knocker`) — Expo, 4 glass tabs:**

- **Map** — assigned territory polygon (aurora-shaded), GPS pin, clustered knock pins by disposition, floating "Knock here" FAB pinned to nearest address, OfflineBanner + GPSAccuracyBadge
- **Schedule** — today's callbacks (overdue amber at top), upcoming callbacks, pitch script of the day, shift clock-in/out
- **Inbox** — manager messages, push history, route changes, training nudges
- **Me** — stats (knocks today/week, conversion, $ commission preview), leaderboard rank, CommissionLadder, profile, training, settings

**Knock flow (≤4 taps from map to recorded knock):**

1. Tap address → KnockSheet peek (address, occupant guess)
2. Tap "Knock" → DispositionWheel (SALE / LEAD / NOT_HOME / CALLBACK / REFUSED / DNC, one-thumb radial, haptic)
3. If LEAD or SALE → LeadFormFast (3 fields: name, phone, best time; "Add more" expander)
4. If SALE or signed consent → SignaturePadNative + optional photo
5. Save → sheet collapses, pin updates color on map, optimistic local insert, sync icon spins

Offline-first via SQLite + FIFO queue. OfflineQueueBanner always visible when queue non-empty.

### 7.5 Mapping UX

| Concern            | Decision                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Library web        | **Mapbox GL JS v3** (vector, GPU, draw plugin, native heatmap)                                                                       |
| Library mobile     | **`@rnmapbox/maps`** (Expo dev-client required)                                                                                      |
| Base style         | Custom D2D fork of `mapbox/streets-v12`; desaturate 35%, lift contrast, mute label to `rgb(112 119 142)` so data overlays read first |
| Territory polygons | GeoJSON; fill `accent` alpha 0.18; stroke `accent-strong` 1.5px; selected gets pulse animation                                       |
| Heatmap            | Mapbox `heatmap` layer over H3 res-9 hex-bin aggregates from ACS/SEIFA/SingStat; green→amber→red ramp                                |
| Knock pins         | `circle` layer with `cluster: true` (radius 50, max-zoom 14); disposition-colored                                                    |
| DNC overlay        | `fill-pattern` diagonal-stripe SVG; danger tone; above territories, below pins                                                       |
| Drawing            | `@mapbox/mapbox-gl-draw` + snap-to-street via Mapbox Tilequery; live readouts: area, door count                                      |

### 7.6 Density, accessibility, i18n

- **Tabular-nums everywhere numbers appear.** All money goes through `<Money region={...} />` (extends EazePay's `Money.tsx` with `region` prop driving locale + currency code). All datetimes through `<DateTime tz={org.tz} format="local" />`.
- **Density toggle** — `data-density="comfortable|compact"` on `<body>`, CSS var `--row-height` swaps between 44px (comfortable) and 32px (compact). Persisted per-user.
- **WCAG 2.2 AA** target. Glass surfaces: when contrast against underlying canvas falls below 4.5:1, glass tint auto-thickens (`useGlassAdaptiveTint()` hook) — force `glass-thick` over MapCanvas.
- **Keyboard:** Cmd+K command palette everywhere; `?` opens audit drawer; `g t` leader keys (kbar-style); skip-to-main.
- **Touch targets:** mobile ≥ 44×44pt; DispositionWheel segments 88pt.
- **`prefers-reduced-motion`** respected — disables glass blur transitions, kanban animations, leaderboard reorder.
- **i18n** — `next-intl` (web), `expo-localization` + `i18n-js` (mobile). Locales Phase 1–4: `en-AU` (default), `en-US`, `en-SG`. Same language, region-specific number/date/currency/legal-copy variants. RTL deferred.
- **Locale-aware data** — `Intl.NumberFormat`, `libphonenumber-js`, postal-code regex per region — centralised in `@d2d/intl`.

### 7.7 Design tooling

- **Figma library** structured to mirror the codebase: 01 Tokens, 02 Foundations, 03 Web Components, 04 Mobile Components, 05 Patterns, 06 Operator Screens, 07 Org Screens, 08 Mobile Screens, 09 Marketing site.
- **Tokens Studio plugin** → JSON commit nightly via GitHub Action → Style Dictionary builds `globals.css` + `tokens.ts` + native `tokens.json`. **No drift between Figma and code.**
- **Storybook per package** (`apps/storybook-web`, `apps/storybook-mobile`) — every component documents states (loading, empty, error, success), themes (light, dark), surface variants (glass + solid).
- **Chromatic** visual regression on every PR. Glass stories get a fixed pseudo-background image (busy map screenshot) so blur output is deterministic.

---

## 8. Multi-jurisdiction compliance matrix

| Concern                              | **AU**                                                                                                       | **US**                                                                                                                                                                                                                                                                                                                     | **SG**                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Charity registration**             | ACNC + state regulators (NSW Dept Fair Trading, Consumer Affairs Vic, etc.)                                  | State-by-state ~40 states (Unified Reg Statement helps; NY, CA, FL, IL strictest)                                                                                                                                                                                                                                          | Commissioner of Charities under MCCY                                              |
| **Solicitor licensing**              | State-level paid fundraiser registration (NSW/VIC/QLD/WA/SA/TAS); written charity authority letter on-person | State paid-solicitor registration + bonding (NY, NJ); 3-day cooling-off disclosure at pledge in many states                                                                                                                                                                                                                | Commercial fundraiser written appointment + PLRD House-to-House Collection permit |
| **Paid solicitor (D2D as operator)** | n/a Phase 1                                                                                                  | **D2D the entity must register as a paid solicitor in EACH STATE** it knocks on charity's behalf. 4–12 weeks/state + bond ($10–25K typical, $50K+ in NY). Counsel running parallel filings. Plan enforces via `PaidSolicitorRegistration` table + `CampaignStateClearance` join → campaigns only deliver to cleared states | n/a Phase 1                                                                       |
| **Cooling-off**                      | ACL: **10 business days** (extends to 3/6 months if disclosure breach)                                       | FTC: **3 days** for sales ≥$25 at home; CA/NY 3 days; state-by-state                                                                                                                                                                                                                                                       | **5-day** under Consumer Protection (Fair Trading) Act                            |
| **Privacy law**                      | Privacy Act 1988 + 13 APPs; NDB scheme 72h                                                                   | **CCPA/CPRA** + CO/VA/UT/MT/CT/TX/OR/DE state laws; GLBA if financial                                                                                                                                                                                                                                                      | **PDPA**; 72h breach notification if significant harm or ≥500 affected            |
| **Do-not-knock**                     | CHOICE DNK sticker (knocking past = misleading/deceptive under ACL)                                          | No national; local ordinances vary; HOA rules                                                                                                                                                                                                                                                                              | No formal; PLRD permit conditions                                                 |
| **Do-not-call**                      | DNCR via ACMA (charity msgs partially exempt; courtesy compliance)                                           | **National DNC** (FTC+FCC) + state DNCs; **TCPA prior express written consent** for SMS/calls                                                                                                                                                                                                                              | DNC Registry via PDPC (charity exempt only if sent BY charity, not 3rd-party)     |
| **Spam/email law**                   | Spam Act 2003 — consent + identify + unsubscribe                                                             | CAN-SPAM (email) + TCPA (SMS) + TSR (telemarketing)                                                                                                                                                                                                                                                                        | Spam Control Act — opt-out for email/SMS                                          |
| **Payment regs**                     | PCI-DSS via tokenisation; AUSTRAC AML thresholds; PayTo/NPP                                                  | PCI-DSS; state money-transmitter exemption for charities varies; NACHA for ACH                                                                                                                                                                                                                                             | PCI-DSS; MAS Payment Services Act if held funds (avoid via tokenised passthrough) |
| **Data residency**                   | APP 8 cross-border with consent or comparable protection; norm = keep in AU                                  | No federal mandate; CCPA cross-border allowed; some contracts US-only                                                                                                                                                                                                                                                      | PDPA s.26 overseas with comparable protection or consent; norm = keep in SG       |

### Technical artifacts per jurisdiction (built into `services/compliance`)

| Artifact                                                | AU                                                                            | US                                                                                                       | SG                                                      |
| ------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Auto cancellation notice (PDF + email + SMS within 24h) | ACL plain-English template                                                    | State-specific (NY/CA stricter, bilingual CA/TX)                                                         | English + Mandarin                                      |
| Consent capture record                                  | Spam Act consent + timestamp + IP + signature, 5y retention                   | **Prior express written consent** with W3C-style signed token + full SMS transcript snapshot, 4y minimum | PDPA opt-in + charity-exemption flag at lead creation   |
| DNC/DNK scrubbing                                       | DNCR API + CHOICE DNK address-match before revisit task                       | FTC + FCC + state DNC scrub; geocode-blocked HOA/no-solicit overlay                                      | PDPC DNC scrub                                          |
| Solicitor proof on knocker                              | Auto-generated charity-signed authority letter PDF in mobile app              | State-registered solicitor ID embedded in mobile badge screen                                            | PLRD permit number + appointment letter in mobile badge |
| Cooling-off enforcement                                 | Block payout instruction until window closes OR explicit waiver where allowed | State-aware timer; block + FTC 3-day notice attached to signed agreement                                 | 5-day timer; block + cancellation notice attached       |

---

## 9. Security & hardening

### 9.1 RBAC + ABAC + SSO

8 roles (`super_admin, org_admin, manager, knocker, inside_sales, accountant, auditor, viewer`). Permission shape: `{ action, resource, orgScope, regionScope, requiresHardwareKey, requiresJustification, requiresSecondApprover }`. **WebAuthn hardware key REQUIRED** for: super_admin actions, org_admin payout instruction, lead.unmask_pii (with second approver), accountant payment-instrument read.

**SSO/SAML for enterprise tenants (Pilot-Charlie Day 1):**

- SAML 2.0 service provider in `services/auth/src/saml/` — supports Okta, Azure AD, Auth0, Google Workspace, and generic SAML IdPs
- `SsoConfiguration` per org (entityId, ssoUrl, certificate in S3 KMS, attribute mapping JSON, JIT user provisioning)
- Role mapping via SAML attribute → `PlatformRole`
- Per-tenant IdP — D2D-managed Cognito for non-enterprise; SAML federation for enterprise
- SCIM 2.0 deferred to Phase 2 (manual provisioning Day 1)

**SOC 2 Type I evidence collection (Phase 1.4 → Phase 3 Type II window):**

- Control matrix in `docs/soc2/controls.md` — CC1 (Control Environment), CC2 (Comms), CC3 (Risk Assessment), CC4 (Monitoring), CC5 (Activities), CC6 (Logical Access), CC7 (System Ops), CC8 (Change Management), CC9 (Risk Mitigation)
- Automated evidence: CI artifacts, audit chain merkle roots, access reviews quarterly, vendor assessments per-quarter, change-management via PR + approval log, encryption-at-rest config snapshots
- Manual evidence: pen test report, security awareness training records, BCDR/DR game day reports
- Type I report scope: Pilot-Charlie environment + supporting services
- Type II observation window: 90 days minimum starting Phase 3

**Enforcement layers (defence in depth):**

1. BFF route guard (Nest `@UseGuards`) — coarse RBAC
2. `TenantGuard` (Prisma `$extends` injecting `where: { orgId }`)
3. Postgres RLS — refuses even if app layer bypassed
4. `RegionGuard` — asserts org region matches process region
5. WebAuthn middleware — verifies fresh assertion (<5min) for sensitive actions

### 9.2 PII vault (mirror EazePay)

- Per-row DEK derived from KMS; AAD discriminator binds ciphertext to PK (prevents copy-paste swap attacks).
- Searchable fields use **deterministic AES-SIV** with separate region-pinned key (e.g. `User.emailDigest`).
- **JIT unmask** — operator request → second admin approves → 30min grant → every reveal click writes audit row. **WebAuthn required for approver.**
- Mobile knocker never gets plaintext PII for leads they didn't capture themselves; only territory aggregates.

### 9.3 Threat model — Day-1 mitigations

| Surface            | Key controls                                                                                                                                                                                                                                                                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Knocker mobile** | Biometric re-auth on resume (>60s background); device attestation (App Attest, Play Integrity) on every sync; cert pinning (SPKI hashes for API + auth + S3); jailbreak/root detection → refuse to run; encrypted SQLite (SQLCipher, key in Keychain/Keystore); photos/signatures per-blob DEK until sync; `FLAG_SECURE` + iOS overlay on PII screens |
| **Web consoles**   | WebAuthn for admin; Cognito MFA for users; CSRF via SameSite=Strict + double-submit; strict CSP; HttpOnly + `__Host-` cookies; bot detection                                                                                                                                                                                                          |
| **Public API**     | mTLS for partner integrations; OAuth2 client-credentials for SaaS callers; HMAC-signed bodies for sensitive ops; per-key tiered rate limits (5/s burst, 30/10s, 120/min); scoped JWTs ≤5min                                                                                                                                                           |
| **Webhooks in**    | HMAC-SHA256 per source + 5min replay window; idempotency keys user-bound; Redis seen-set for replay                                                                                                                                                                                                                                                   |
| **Webhooks out**   | Raw secret signing (envelope-decrypted at send, never the hash); egress SSRF guard blocks 169.254.169.254 / RFC1918 / IPv6 ULA; retry queue with attempt audit                                                                                                                                                                                        |

### 9.4 OWASP Top 10 mapping

| OWASP 2021                 | Mitigation                                                                      |
| -------------------------- | ------------------------------------------------------------------------------- |
| A01 Broken Access Control  | RBAC + ABAC + TenantGuard + RLS + RegionGuard quad                              |
| A02 Cryptographic Failures | TLS 1.3; KMS envelope; deterministic SIV searchable; no homebrew crypto         |
| A03 Injection              | Prisma parameterised; Zod input validation at BFF edge; strict CSP for XSS      |
| A04 Insecure Design        | Threat model living doc, quarterly review; ADR for every cross-cutting decision |
| A05 Security Misconfig     | IaC-only (Terraform); WAF managed + custom rules committed; Trivy IaC scan      |
| A06 Vulnerable Components  | Renovate + Trivy + Snyk + Dependabot; signed images; SBOM per release (Syft)    |
| A07 Identity & Auth        | Cognito + Okta workforce; WebAuthn hardware for admin; JWT ≤5min                |
| A08 Data Integrity         | Hash-chained audit; cosign-signed container images; SLSA L3 target              |
| A09 Logging/Monitoring     | Pino structured + redaction; OpenSearch per region; SIEM central; PagerDuty     |
| A10 SSRF                   | Egress allowlist + IPv4/IPv6 blocklist                                          |

### 9.5 Pen-test readiness checklist (`docs/PEN_TEST_READINESS.md`)

- [ ] All endpoints documented in OpenAPI; no shadow APIs (CI: every route has decorator + spec entry)
- [ ] AWS WAF deployed (managed: Core, Linux, SQLi, BotControl) + custom rate limits versioned in `infra/terraform/waf/`
- [ ] All secrets in Secrets Manager + Parameter Store; gitleaks clean pre-commit + CI
- [ ] Dependency scan green (Trivy + Snyk + Dependabot)
- [ ] SAST clean (Semgrep); DAST run before each release (OWASP ZAP automated)
- [ ] Threat model signed-off; quarterly review on calendar
- [ ] WebAuthn enforced on `super_admin`, `org_admin` payout, lead unmask approver, accountant payment-detail read
- [ ] mTLS internal service-to-service (Istio or AWS App Mesh)
- [ ] securityheaders.com **A+** every region
- [ ] CSP `default-src 'self'`, `frame-ancestors 'none'`, no `unsafe-inline` in prod
- [ ] HSTS 2y preload submitted to hstspreload.org
- [ ] Per-tenant data isolation — synthetic cross-tenant probe in CI (asserts 403 + audit row)
- [ ] Per-region data isolation — synthetic cross-region probe in CI (AU lead via SG region API → 403)
- [ ] Audit chain Merkle replay test weekly in CI
- [ ] Mobile cert pinning + jailbreak detection + biometric re-auth verified on physical iOS + Android each release
- [ ] PII vault + JIT unmask E2E tested per release
- [ ] DR: RPO 5min, RTO 1h, validated quarterly via game day
- [ ] SOC 2 Type I scoping locked in (`docs/soc2/`); Type II observation window starts Phase 3
- [ ] Independent pen test by AU firm (Bastion, Pure Hacking) before public SaaS launch (Phase 4)
- [ ] Bug bounty: invite-only Phase 3 → public Phase 4 (Bugcrowd or HackerOne)
- [ ] `security.txt` at `/.well-known/security.txt` on every web surface
- [ ] Subdomain takeover scan (`subjack`) before launch + weekly

---

## 10. AI Marketing Studio — `services/marketing-studio`

### 10.1 Pipeline

```
                   Lead capture (anonymised tract/SA1/subzone)
                                  +
                  Territory demographics (ACS/SEIFA/SingStat)
                                  +
                              Brand voice
                                  ↓
                   ┌──────────────────────────────────┐
                   │  Campaign-Compose Orchestrator   │ ← BullMQ
                   └──────────────────────────────────┘
                                  ↓
       ┌─────────────────┬─────────────────┬─────────────────┐
   Copy gen          Image gen          Video gen        Brand-safety
  (Claude 3.5 /     (FLUX, Ideogram)   (Runway, HeyGen)  scan + legal
   GPT-4.5 fb)                                           hold detector
       └─────────────────┴────────┬────────┴─────────────────┘
                                  ↓
                       Variation matrix exploder
                  (audience × message × format → 20–50 variants)
                                  ↓
                          Human-in-loop review queue
                          (`marketing.review` permission)
                                  ↓
              ┌───────────┬───────────┬───────────┬───────────┐
        Meta Marketing  Google Ads  TikTok      YouTube
              API         API        Marketing   Ads (via Google)
              └───────────┴───────────┴───────────┴───────────┘
                                  ↓
                   Conversion webhooks → ROAS dashboard
```

### 10.2 Brand-safety per vertical

| Vertical     | Pre-publish checks                                                                                        |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| Charity (AU) | ACNC fundraising standards; no "guaranteed impact"; tax-deductibility disclosure if DGR claim             |
| Charity (US) | State-specific disclosure boilerplate (NY's "A copy of the latest annual report..."); ACFR standards      |
| Charity (SG) | COC fundraising code; PLRD permit number on collection appeals                                            |
| Pest control | Block health claims; ACL substantiation; APVMA chemical name disclosure                                   |
| Solar        | Block "free solar"/"$0 down" without finance terms; Clean Energy Council code (AU); FTC Green Guides (US) |
| Energy/telco | Block locked-comparison without DMO/VDO; AER retail code (AU); FCC marketing rules (US)                   |

**Safety stack:**

1. Anthropic moderation API on every copy string before save
2. Custom rule engine (`services/marketing-studio/src/safety/`) — regex + LLM-as-judge per vertical/jurisdiction
3. Legal hold flag → route to `legal.review` queue, block publish
4. Image safety: Sightengine for NSFW/violence + brand-logo collision
5. Video safety: frame sampling + transcription check

### 10.3 Responsible-AI controls

- **Provenance audit row** per AI output: `model, version, prompt_hash, seed, temperature, cost_cents, safety_scan_result, c2pa_manifest_id`
- **C2PA manifests** on all images/videos; verified at publish
- **Prompt-injection defence** on lead-data-fed prompts (wrap in `<user_input>` delimiters, strip zero-width chars + base64 + known markers; output post-scan rejects if response leaks system prompt)
- **Disclosure** — "Sponsored / Created with AI assistance" where platform requires (Meta + TikTok)
- **Org-level opt-out** `Org.aiRetargetingOptOut` — never include those leads in AI retargeting prompts

### 10.4 Cost controls

- Per-org monthly cap `Org.aiBudgetCents`
- Redis sliding-window burn rate
- PagerDuty alert if hourly burn > 4× rolling 7-day median
- Hard stop at 100% cap → queue drains, new jobs rejected with `PROBLEM_BUDGET_EXHAUSTED`

---

## 11. Observability & incident response

| Layer    | Tool                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------- |
| Logs     | Pino structured + PII redact → OpenSearch per region → central SIEM in us-east-1 security account |
| Traces   | OpenTelemetry → X-Ray (prod), Jaeger (dev); `x-correlation-id` propagated                         |
| Metrics  | Prometheus → Grafana; CloudWatch for AWS-managed                                                  |
| Frontend | Sentry per region; source maps uploaded but not public                                            |

**Core SLOs:**

| SLO                               | Target               | Error budget                   |
| --------------------------------- | -------------------- | ------------------------------ |
| Knocker mobile sync success       | ≥99.5% / 30d         | 0.5%                           |
| Lead capture latency P95          | <2s                  | 5% over budget triggers freeze |
| Payout instruction generation P95 | <60s                 | 5%                             |
| AI generation job success         | ≥95% / 7d            | 5%                             |
| Audit chain integrity             | 100% verified weekly | 0 — pages immediately          |
| API availability                  | 99.9% per region     | 43min/month                    |

**Alerting:** PagerDuty SEV1/2/3. SEV1 = customer-impacting outage OR security incident. On-call: Brodie solo Day 1 → 2-person rotation by Phase 3. Runbooks under `docs/runbooks/`: incident-response, data-breach-72h, payment-incident, ai-brand-safety-failure, region-failover, audit-chain-mismatch.

**Audit chain:** per-region outbox + drain → DynamoDB hot 90d + S3 Object Lock cold 7y. Weekly Merkle root committed to `docs/audits/merkle-roots/<region>/<YYYY>-W<NN>.json`. CI replays + fails on mismatch.

**Incident SLAs:**

| Incident                | Notification SLA                                                                  |
| ----------------------- | --------------------------------------------------------------------------------- |
| Personal data breach AU | 72h to OAIC; affected individuals "as soon as practicable" if serious harm likely |
| Personal data breach US | Per-state: CA 60d, NY 30d, others vary                                            |
| Personal data breach SG | 72h to PDPC if significant harm or ≥500 individuals                               |
| Payment incident        | Stripe/processor immediate; org within 4h; partner bank within 24h                |
| AI brand-safety failure | Pause campaign within 15min of detection; org within 1h; postmortem within 7d     |

---

## 12. Background jobs & integrations

**BullMQ queues (`apps/workers`, one connection per region's Redis):**

| Queue                 | Producer                   | Examples                                           |
| --------------------- | -------------------------- | -------------------------------------------------- |
| `knock-sync`          | mobile via `apps/api`      | reconcile offline batch, dedupe by idempotency key |
| `lead-routing`        | `services/lead`            | assign to inside-sales by territory + workload     |
| `lead-sequence`       | `services/crm`             | step a multi-touch SMS/email sequence              |
| `conversion-finalise` | `services/conversion`      | charge Stripe, generate receipt PDF, fire webhook  |
| `donation-recurring`  | cron (per region)          | nightly Stripe sub reconciliation                  |
| `commission-calc`     | cron (daily 02:00 local)   | recompute accruals for prior day                   |
| `payout-prepare`      | cron (fortnightly/monthly) | build instruction file                             |
| `content-generate`    | `services/content-studio`  | Claude/FLUX/Runway long-running                    |
| `ad-deliver`          | `services/marketing`       | push audience to Meta/Google/TikTok                |
| `webhook-deliver`     | `services/webhook`         | HMAC sign + POST with retries                      |
| `audit-ship`          | cron (every 60s)           | flush AuditEvent rows to S3 Object Lock            |
| `dnk-sync`            | cron (daily)               | refresh DNK/DNC lists per region                   |
| `geo-refresh`         | cron (weekly)              | re-ingest ABS/ACS/SingStat slices                  |

Idempotency: every queue handler keyed on `(queueName, idempotencyKey)` in Redis with 7-day TTL. Cron leader: `CRON_LEADER=true` on exactly one `apps/workers` replica per region.

**Inbound integrations (`apps/webhooks`):**

| Provider             | Path                                                                       |
| -------------------- | -------------------------------------------------------------------------- |
| Stripe AU/US/SG      | `/inbound/stripe/<region>` (webhook secret per region; `Stripe-Signature`) |
| Twilio               | `/inbound/twilio/<region>` (inbound SMS, call status)                      |
| Resend               | `/inbound/resend` (bounce, complaint)                                      |
| Meta                 | `/inbound/meta` (lead-ad sync → Leads)                                     |
| ABS / ACS / SingStat | scheduled pull (nightly `geo-refresh` job)                                 |

---

## 13. Day-1 ADRs (`docs/adr/`)

Inherited from EazePay (re-numbered in D2D's sequence) **plus** D2D-specific:

| #    | Title                                                                                            |
| ---- | ------------------------------------------------------------------------------------------------ |
| 0001 | Monorepo: Nx + pnpm workspaces                                                                   |
| 0002 | Backend: NestJS 10 on Fastify, modular monolith                                                  |
| 0003 | Mobile: Expo + EAS Build                                                                         |
| 0004 | Database: Aurora PostgreSQL + PostGIS                                                            |
| 0005 | Auth: Cognito-backed + first-party JWT                                                           |
| 0006 | IaC: Terraform with per-env composition                                                          |
| 0007 | Money as BigInt cents                                                                            |
| 0008 | Audit row in same TX (transactional outbox)                                                      |
| 0009 | RFC 7807 Problem Details for all error responses                                                 |
| 0010 | Idempotency keys mandatory on all POST /v1 mutations                                             |
| 0011 | PII envelope encryption + KMS per-datastore                                                      |
| 0012 | JIT PII unmask: dual-control, 30min grant, per-read audit                                        |
| 0013 | Soft delete only (`status='archived'`); immutable history                                        |
| 0014 | XState v5 for lifecycle objects                                                                  |
| 0015 | Modular monolith with extractable services (Nx graph boundary)                                   |
| 0016 | Multi-region: region-pinned at org creation, immutable                                           |
| 0017 | Webhooks isolated in `apps/webhooks` for blast-radius                                            |
| 0018 | Real-time via Ably (managed channels, JWT-scoped)                                                |
| 0019 | Commission/payout: instruct-only, never auto-debit                                               |
| 0020 | Territory geometry: PostGIS polygons + S2 cell index for heatmaps                                |
| 0021 | Multi-vertical conversion polymorphism (Donation \| Sale)                                        |
| 0022 | Offline-first knocker mobile — last-write-wins with operator override                            |
| 0023 | AI-generated content provenance + brand-safety scan before publish                               |
| 0024 | Charity vs commercial pricing & contract polymorphism (`Org.vertical` drives compliance routing) |
| 0025 | Mobile attestation required (App Attest / Play Integrity) on every sync                          |
| 0026 | WebAuthn hardware-key required for payout instruction                                            |
| 0027 | Single-monorepo until Phase 4+ (no premature splitting)                                          |
| 0028 | Glass surfaces are chrome, not content (perf + legibility hard rule)                             |

---

## 14. Phasing — engineer-actionable (revised v0.2 around US enterprise pilot)

> **Timeline:** Phase 0 ≈ 1.5 weeks · Phase 1 ≈ 14–16 weeks (US pilot go-live) · Phase 2 ≈ 8 weeks (AU expansion) · Phase 3 ≈ 8 weeks (SG + AI Marketing Studio polish) · Phase 4 ≈ 12 weeks (public SaaS opening + AWS prod migration).
> **Assumed engineering capacity:** 4–6 full-time engineers (1 backend lead, 1 mobile, 1 frontend, 1 design-eng, 1 AI/integrations, ±1 SRE). Adjust if actual headcount differs.

### Phase 0 — Scaffold + brand + AWS Org (Week 1–1.5)

**Engineering deliverables:**

- `door2digital/d2d-platform` repo initialised in new `door2digital` GitHub org
- `.editorconfig`, `.nvmrc` (20), `.gitignore`, `.dockerignore`, ESLint/Prettier/Husky/lint-staged literally copied from EazePay
- `pnpm-workspace.yaml` + `nx.json` + `tsconfig.base.json` with `@d2d/*` path aliases
- Empty `apps/api` (NestJS), `apps/webhooks` (NestJS), `apps/workers` (NestJS standalone)
- `libs/shared-types`, `libs/shared-utils` (port `money.ts`, `problem.ts`, `idempotent.decorator.ts` from EazePay), `libs/observability`, `libs/ui-tokens` (with glass extensions + aurora-green palette)
- ADRs 0001–0028 drafted in `docs/adr/`
- `docker-compose.yml`: Postgres+PostGIS, Redis, MinIO, Mailpit, Jaeger
- `Dockerfile.api`, `Dockerfile.workers`, `Dockerfile.webhooks` at repo root
- `railway.api.toml`, `railway.workers.toml`, `railway.webhooks.toml`
- GitHub Actions `ci.yml` with all 10 gates (most no-op initially)
- First Railway deploy of empty Nest `apps/api` reachable at `https://api-dev.d2d.io/v1/healthz`
- `apps/knocker-mobile` Expo scaffold building to EAS dev client (under D2D's new Apple Developer + Google Play accounts)
- **Storybook web + mobile** scaffolds

**Brand + design deliverables (AI-assisted, ~5 days parallel to engineering):**

- Logo (Mid-journey + Claude prompting + Figma cleanup), favicon, wordmark
- Aurora-green palette refined with Brodie's sign-off
- Typography decision (default: Inter + JetBrains Mono mirroring EazePay)
- Figma library v0 — Tokens + Foundations pages
- Knocker app icon (iOS + Android)

**Infra + ops deliverables:**

- **New AWS Org** for `door2digital` (separate from EazePay/AUREAN): root + sub-accounts (dev, staging, prod, audit, security, shared-services)
- Route 53 zone for `d2d.io` + `door2digital.io`
- IAM Identity Center (SSO for engineers + Brodie)
- Terraform modules forked from EazePay into `infra/terraform/modules/*`
- Doppler / 1Password Secrets Automation set up for dev/staging
- AWS Secrets Manager scaffold for prod
- Apple Developer enrollment + Google Play developer account in D2D Inc / equivalent legal entity name
- MiCamp account team kickoff call to confirm Gateway API integration model

**Success criteria:**

- `pnpm i && pnpm build && pnpm test` green locally
- CI green on a noop PR (all 10 gates)
- `curl https://api-dev.d2d.io/v1/healthz` returns 200
- Empty Expo app installs on TestFlight + Play Internal Track
- Brodie has signed off on logo + palette
- MiCamp Gateway API docs + sandbox credentials in hand

### Phase 1 — US enterprise pilot go-live (Week 2–16, 14 weeks)

Single-tenant for Pilot-Charlie. Both verticals. White-label. SSO/SAML. SOC 2 Type I scoping. MiCamp Gateway API. Rolling state launch as paid-solicitor registrations clear.

**Phase 1 is split into 4 sub-phases for clean handoff:**

#### Phase 1.1 — Foundations + Auth + Org (Week 2–4)

- `services/auth` — email+password, MFA enforced for `org_admin+`, Cognito-backed
- `services/auth` SAML 2.0 SP — federate to Okta (Pilot-Charlie's IdP), attribute mapping → PlatformRole
- `services/org` — multi-tenant primitives, region pinning (US-only Day 1), `OrgType` (operator|client), `BrandKit` for white-label, `OrgBilling` config
- `services/user` — RBAC (8 roles), invite flow, manager hierarchy
- `services/audit` — hash-chained outbox + S3 Object Lock writer (US bucket)
- `services/pii-vault` — KMS envelope, deterministic-SIV digests (US KMS keys)
- `apps/operator-console` v0 — login, org switcher, list of tenants, audit drawer
- **Postgres single-tenant for Pilot-Charlie** — separate Aurora cluster `d2d-us-pilot-charlie` (per enterprise req)

**Success criteria:** Brodie + Pilot-Charlie's IT admin can both log in via SSO; audit row recorded; RBAC enforced.

#### Phase 1.2 — Field capture + CRM + Compliance core (Week 5–9)

- `services/territory` — PostGIS polygon CRUD, ACS overlay, S2/H3 cell index, draw tools
- `services/knock`, `services/lead` — offline-first knock capture, signature+photo to S3, idempotent batch sync endpoint, lead routing
- `apps/knocker-mobile` — Map / Schedule / Inbox / Me; draw territory, capture knock, signature pad, photo, offline queue, geo+device-clock-stamp, DNK precheck, biometric re-auth, App Attest/Play Integrity
- `apps/knocker-mobile` white-label — Pilot-Charlie-branded build under D2D's Apple Developer + Google Play accounts; TestFlight + Play Internal distribution
- `services/crm` v1 — call/SMS/email logging, manual lead assignment, basic sequences
- `services/compliance` — **PaidSolicitorRegistration** table + state-clearance engine (campaigns only deliver to cleared states); TCPA hour-of-day/state windows; CAN-SPAM headers; CCPA + CO/VA/UT/MT/CT/TX/OR/DE state privacy primitives
- `services/do-not-knock` — FTC + FCC + state DNC scrub + geocode-blocked HOA/no-solicit overlay
- `services/notification` — Twilio US long codes + Resend email per brand subdomain
- `services/mapping` — Mapbox proxy + nightly US ACS / Census refresh

**Success criteria:** 1 D2D knocker (Brodie's test rep) completes 50 knocks across 1 cleared state in real conditions; sync ≤2s P95 at 100 knocks; zero PII in logs; DNC scrub blocks the right addresses; offline → online sync deterministic.

#### Phase 1.3 — Conversion + Payment + Commissions (Week 10–13)

- `services/conversion` — polymorphic `Conversion` (donation|sale) with **AttributionSource** enum (door|inside_sales|retargeting)
- `services/donation` — recurring + one-off; IRS-compliant receipt PDF (501(c)(3) statement + EIN + tax-deductibility text)
- `services/sale` — commercial one-shot + installer-handoff webhook
- `services/payment` adapter pattern — **MiCampAdapter** (Gateway API + tokenized vault + recurring + ACH); ISO residual tracking captures `processorResidualCents` per conversion
- `services/commission` — per-knock + per-sale/per-conversion + hybrid plans; crew-leader overrides; daily accrual; rule DSL versioned
- `services/payout` — fortnightly/monthly batch generation; NACHA/CSV instruction file; **never auto-debits** (per ADR-0019)
- `services/billing` (new for Pilot-Charlie) — monthly invoice generation: $2500 platform + 5%/10%/15% per-bucket rake; PDF + email delivery; line items per AttributionSource
- `apps/org-console` for Pilot-Charlie — Today (anomaly-first), Territories, Knocker Teams, Leads, Pipeline, Inside Sales (DialerCockpit), Conversions, Commissions, Payouts, Reports, Compliance, Settings, BrandKit
- `services/realtime` (Ably) — live knock feed channel, live leaderboard channel
- `apps/crm-desktop` v1 — soft-phone (Aircall integration), sequences, pipeline kanban

**Success criteria:** First donation + first commercial sale flowed end-to-end through MiCamp; commission accrued; payout instruction file generated; Pilot-Charlie's first monthly invoice generated and matches manual calculation to the cent; live leaderboard updates within 2s of a knock.

#### Phase 1.4 — Enterprise hardening + SOC 2 Type I + go-live (Week 14–16)

- **SOC 2 Type I scoping locked** — control matrix in `docs/soc2/`, evidence collection automated (CI artifacts, audit chain merkle roots, access reviews, vendor assessments)
- **Pen test prep** — external pen test scheduled with Bastion or Pure Hacking; PEN_TEST_READINESS.md checklist all green
- **WAF** AWS WAF deployed with managed rules + custom rate limits
- **Cross-tenant probe** in CI — green
- **Mobile cert pinning + jailbreak detection** verified on physical iOS + Android devices
- **DR game day** — RPO 5min RTO 1h validated
- **Audit chain Merkle replay** weekly job green
- **Knocker rollout** for Pilot-Charlie — phased: 10 knockers Week 14 → 50 Week 15 → 200+ Week 16 across cleared states
- **`apps/partner-portal`** for Pilot-Charlie — invoice viewer, payout statements, conversion reports, compliance status per state
- Independent pen test executed; P0/P1 findings closed
- Pilot-Charlie SSO/SAML production-cutover
- White-label App Store / Play Store TestFlight builds tested at scale

**Success criteria:** Pilot-Charlie live across all cleared states with 200+ knockers; first month's invoice generated and approved; pen test passed with all P0/P1 closed; SOC 2 Type I evidence package complete; zero unplanned downtime in Week 16.

### Phase 2 — AU expansion + commercial polish (Week 17–24, 8 weeks)

- **AU region brought up:** Terraform `infra/terraform/envs/{staging,prod}/ap-southeast-2`, Aurora Sydney, Redis Sydney, Cognito AU
- `services/payment` — `StripeAdapter` (Stripe AU) wired; GoCardless for BPAY/PayTo
- `services/compliance` — ACNC + FundraisingNSW + Privacy Act/APP + Spam Act + ACL 10-day cooling-off
- `services/donation` — DGR-compliant AU receipt PDFs
- `services/notification` — Twilio AU dedicated sender
- `services/mapping` — ABS SEIFA + Mesh Block ingestion
- DNK list — CHOICE DNK + DNCR
- Sign first AU charity or commercial client
- Cross-region probe in CI — green (AU lead unreachable from US plane)
- 1 commercial pilot (AU) live + 1 charity pilot (AU) live or US pilot expanded

**Success criteria:** First AU client live; cross-region isolation verified; Stripe AU + GoCardless flowing end-to-end; ACNC receipt approved by external auditor.

### Phase 3 — SG expansion + AI Marketing Studio (Week 25–32, 8 weeks)

- **SG region brought up:** Terraform `infra/terraform/envs/{staging,prod}/ap-southeast-1`, Aurora Singapore, Redis Singapore, Cognito SG
- `services/payment` — `StripeAdapter` for Stripe SG + PayNow
- `services/compliance` — Commissioner of Charities + PDPA + DNC + Spam Control Act
- `services/notification` — Twilio SG alphanumeric `D2D` sender
- `services/mapping` — SingStat ingestion
- **`services/content-studio`** — Claude/OpenAI copy, FLUX images, Runway/HeyGen video; jobs queue with progress streaming; provenance + C2PA manifests + brand-safety stack
- **`services/marketing`** — Meta/Google/TikTok ad-account linking (OAuth, tokens in PII vault), audience build from `Lead` + lookalikes, programmatic delivery, performance webhook ingestion; **retargeting pipeline closes the attribution loop: knocked-not-converted → hashed custom audience → ad served → click → returns as `Lead{attributionSource=retargeting}` → conversion routes through 5% rake bucket**
- `apps/marketing-studio` — UI for brief → generate → preview → approve → deliver pipeline
- **SOC 2 Type II observation window opens** (90 days minimum before report)
- **Bug bounty invite-only** opens

**Success criteria:** Generate→approve→deliver loop <60s for static creative; first retargeting roundtrip closes attribution from knock to converted donation; first SG client live; SOC 2 Type II observation window started.

### Phase 4 — Public SaaS + AWS prod migration + public store launch (Week 33–44, 12 weeks)

- **AWS migration:** Railway → ECS Fargate + Aurora + Vercel + EAS + CloudFront/WAF, executed region-by-region (US first since most prod-load; then AU and SG cutover with 60min maintenance windows). Audit hash-chain continuity verified across the migration.
- **Public self-serve onboarding:** `apps/public-site` → `POST /v1/orgs` → Stripe Billing for plan selection → org_console. Multi-tenant for any new sign-up.
- **Public App Store + Play Store** submissions of generic `D2D Knocker` app (white-label still available for enterprise tenants who bring their own dev accounts).
- **Public API + sandbox keys** + `apps/public-api-docs` published.
- **Customer-facing webhooks GA** with delivery dashboard in `apps/partner-portal`.
- **SOC 2 Type II report issued** (assuming Phase 3 observation window started).
- **Bug bounty public** (Bugcrowd or HackerOne).
- 1099-K reporting export for US contractors in `services/payout`.

**Success criteria:** First self-serve US org provisioned without human intervention; AWS cutover with zero data loss; SOC 2 Type II report issued; public D2D Knocker app live in App Store + Play Store; first paying SaaS-self-serve client.

---

## 15. Engineer handoff & ownership

### 15.1 Team shape — engineers already exist

Plan assumes **4–6 full-time engineers** available from Phase 0 Week 2. Concrete responsibility allocation (adjust to actual headcount):

| Role                                                    | Owns                                                                                                                                      | Phase 0 task                                                         | Phase 1 ownership                                                               |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Backend lead** (full-stack TS)                        | `apps/api`, `apps/webhooks`, `services/auth/org/user/territory/audit/pii-vault`                                                           | Repo scaffold, Nest skeletons, Prisma schema, ADR drafts             | Phase 1.1 foundation + 1.2 territory/lead                                       |
| **Mobile engineer** (Expo/RN)                           | `apps/knocker-mobile`, `libs/mobile-client`, `libs/ui-native`                                                                             | Expo scaffold + EAS dev client + TestFlight pipeline                 | Phase 1.2 knocker app end-to-end (offline, biometric, attestation, white-label) |
| **Frontend engineer #1**                                | `apps/operator-console`, `apps/org-console`                                                                                               | Next.js scaffolds + Storybook web + glass primitives                 | Phase 1.1 operator-console v0 + 1.3 org-console for Pilot-Charlie               |
| **Frontend engineer #2 / Design engineer**              | `libs/ui-tokens`, `libs/ui-web`, `apps/storybook-web`, brand identity                                                                     | AI-assisted brand + Figma library v0 + token contract + glass system | Phase 1 component library buildout + AppShell + AnomalyCard + DialerCockpit     |
| **Integrations + AI engineer**                          | `services/payment`, `services/notification`, `services/integrations`, `services/marketing` (Phase 3), `services/content-studio` (Phase 3) | MiCamp account kickoff + sandbox creds                               | Phase 1.3 MiCamp Gateway integration + Twilio + Resend                          |
| **Platform/SRE** (full-time from Phase 1 OR fractional) | `infra/terraform`, CI gates, observability, region buildouts, AWS migration                                                               | New AWS Org + Terraform modules forked from EazePay + GitHub Actions | Phase 1 production hardening + WAF + pen-test prep                              |

**Compliance counsel** (existing US counsel) — reviews state paid-solicitor registrations, IRS receipt templates, TCPA scripts, ad copy held terms.

**Security engineer** (fractional, from Phase 1.4) — owns pen-test readiness, SOC 2 evidence collection, audit chain replay verification.

### 15.2 Handoff artifacts (what each engineer reads first)

| Engineer    | Read order                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Any**     | This doc → `docs/adr/0001–0028` → `docs/architecture.md` → `CONTRIBUTING.md` → service README they're touching                                    |
| **Backend** | `apps/api/prisma/schema.prisma` → `services/*/src/state-machine.ts` → `libs/shared-utils/src/money.ts` / `problem.ts` / `idempotent.decorator.ts` |
| **Mobile**  | `apps/knocker-mobile/README.md` → offline queue ADR-0022 → mobile attestation ADR-0025 → `libs/mobile-client`                                     |
| **Design**  | `libs/ui-tokens/src/styles/globals.css` → glass system ADR-0028 → Figma library 01 Tokens + 02 Foundations → `apps/storybook-web`                 |
| **SRE**     | `infra/terraform/modules/*` → region pinning ADR-0016 → `docs/runbooks/region-failover.md` → audit chain ADR-0008                                 |
| **AI**      | Marketing Studio §10 → brand-safety per vertical → ADR-0023                                                                                       |

### 15.3 Code review etiquette

- Every PR auto-assigns code-reviewer based on `CODEOWNERS` (Nx project ownership)
- Architectural changes (anything load-bearing) require an ADR — reviewer can block on missing ADR
- Security-sensitive PRs (auth, PII, audit, payment) require security-engineer approval
- Compliance-sensitive PRs (consent, DNC, cooling-off, charity-receipts) require compliance review (Brodie + counsel)

---

## 16. Critical files to reference (already in EazePay)

When implementing D2D, engineers should crib these EazePay files first:

- `/Users/Brodie/EazePay App/apps/api/prisma/schema.prisma` — Prisma multi-tenant + BigInt money pattern
- `/Users/Brodie/EazePay App/services/application/src/state-machine.ts` — XState v5 lifecycle pattern
- `/Users/Brodie/EazePay App/tsconfig.base.json` — path-alias setup
- `/Users/Brodie/EazePay App/pnpm-workspace.yaml` — workspace globs
- `/Users/Brodie/EazePay App/nx.json` — Nx project graph + caching config
- `/Users/Brodie/EazePay App/Dockerfile` + `Dockerfile.api` — per-app Dockerfile pattern
- `/Users/Brodie/EazePay App/railway.toml` — Railway service config
- `/Users/Brodie/EazePay App/.github/workflows/ci.yml` — CI pipeline
- `/Users/Brodie/EazePay App/.husky/` — pre-commit hooks
- `/Users/Brodie/EazePay App/libs/ui/src/styles/globals.css` — token foundation to fork
- `/Users/Brodie/EazePay App/libs/ui/src/styles/tailwind-preset.cjs` — Tailwind preset to extend with glass
- `/Users/Brodie/EazePay App/libs/ui/src/web/AppShell.tsx` — fork for glass-applied D2D shell
- `/Users/Brodie/EazePay App/libs/ui/src/web/Money.tsx` — extend with `region` prop for multi-currency
- `/Users/Brodie/EazePay App/libs/shared-utils/src/money.ts` — BigInt cents implementation
- `/Users/Brodie/EazePay App/libs/shared-utils/src/problem.ts` — RFC 7807 helper
- `/Users/Brodie/EazePay App/services/user/src/internal/pii-vault.service.ts` — envelope encryption pattern
- `/Users/Brodie/EazePay App/services/webhook/src/webhook.service.ts` — SSRF guard + HMAC signing
- `/Users/Brodie/EazePay App/docs/adr/0011-immutable-audit-via-outbox.md`
- `/Users/Brodie/EazePay App/docs/adr/0012-money-as-bigint-cents.md`
- `/Users/Brodie/EazePay App/docs/adr/0016-pii-vault-envelope-encryption.md`
- `/Users/Brodie/EazePay App/docs/adr/0017-jit-pii-unmask.md`
- `/Users/Brodie/EazePay App/docs/PEN_TEST_READINESS.md`
- `/Users/Brodie/EazePay App/docs/compliance/data-classification.md`
- `/Users/Brodie/EazePay App/SECURITY.md`
- `/Users/Brodie/AUREANOS_EAZEPAY_MASTER_ARCHITECTURE.md` — original master architecture doc (1797 lines)

And `amala-ops` for governance/operator philosophy:

- `/Users/Brodie/amala-ops/README.md` — "NASA mission control" north-star
- `/Users/Brodie/amala-ops/data-context/` — pattern for tribal-knowledge ingestion

---

## 17. Verification — how we prove this is built right

### 17.1 Per-phase verification

**Phase 0 (Scaffold):**

- `pnpm i && pnpm build && pnpm test` green locally
- CI green on a noop PR (all 10 gates)
- `curl https://api-dev.d2d.io/v1/healthz` returns 200
- Empty Expo app installs on TestFlight + Play Internal Track under D2D's developer accounts
- `docker-compose up` brings up local stack; Jaeger UI loads at `:16686`
- Brodie signed off on brand identity (logo + palette)
- MiCamp Gateway API sandbox credentials in hand

**Phase 1 (US enterprise pilot go-live):**

- **Phase 1.1:** Pilot-Charlie IT admin logs in via SAML SSO → role mapped correctly → audit row written
- **Phase 1.2:** 1 D2D knocker completes 50 knocks in 1 cleared state in real conditions; ≤2s P95 knock-batch sync at 100 knocks; zero PII in logs (Pino redaction smoke test); DNC scrub blocks expected addresses; offline → online sync deterministic with idempotency keys; mobile cert pinning + jailbreak detection + biometric re-auth verified on physical iOS + Android
- **Phase 1.3:** First donation + first commercial sale end-to-end through MiCamp Gateway; processor residual computed correctly; commission accrued; payout instruction file generated; Pilot-Charlie's first monthly invoice ($2500 + bucketed rake) matches manual recalc to the cent; live leaderboard updates within 2s
- **Phase 1.4:** SOC 2 Type I evidence package complete; pen test passed all P0/P1 closed; cross-tenant probe in CI green; audit chain Merkle replay weekly green; WAF deployed with A+ security headers; 200+ knockers live across cleared states; zero unplanned downtime in Week 16
- **State-clearance:** every campaign delivery attempt asserts `CampaignStateClearance` exists for the target state; un-cleared state attempts → 403 + audit row

**Phase 2 (AU expansion):**

- First AU client live (charity or commercial)
- Cross-region probe in CI: AU lead unreachable from US plane → 403
- Stripe AU + GoCardless end-to-end
- ACNC receipt approved by external auditor
- Audit chain Merkle replay green per region

**Phase 3 (SG + AI Marketing Studio):**

- First SG client live
- Brief → generate → preview → approve → deliver loop <60s for static creative
- Retargeting roundtrip: knock → hashed audience → Meta/Google/TikTok ad → click → returns as `Lead{attributionSource=retargeting}` → conversion → billing rake routes to 5% bucket
- Brand-safety gate: known prohibited phrase ("guaranteed impact") blocked + logged + routed to legal queue
- C2PA manifest on every generated image; verification passes
- SOC 2 Type II observation window opened

**Phase 4 (Public SaaS + AWS prod + public store):**

- Self-serve US org provisioned end-to-end with no human intervention (timed test)
- AWS cutover: audit hash-chain continuity verified across migration (chain doesn't break across Railway→ECS boundary)
- SOC 2 Type II report issued
- Public D2D Knocker app live in App Store + Play Store
- First paying SaaS self-serve client

### 17.2 Cross-cutting verification (every phase)

- `pnpm typecheck` clean (0 errors)
- `nx affected -t test` ≥80% coverage on changed code (100% on regulated state changes)
- Synthetic uptime monitor on every region's `/healthz`
- securityheaders.com **A+** on every web surface
- DR game-day quarterly: simulate region failure, measure RTO/RPO

---

## 18. Open risks & decisions to revisit (revised v0.2)

| Risk                                                                                                                                                              | Severity | Mitigation                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Paid-solicitor state registrations are the longest pole** — 4–12 weeks/state × 40+ states + bonds = potentially $400K–$1M in bond capital and 6 months calendar | **P0**   | Counsel running parallel filings (confirmed); **state-clearance table-driven** in code (`CampaignStateClearance`); campaigns only deliver to cleared states; Pilot-Charlie accepts rolling launch as registrations land |
| **Enterprise table-stakes compound** — SSO + SOC 2 + white-label + dedicated DB add ~6 weeks to Phase 1                                                           | **P0**   | Built into the 14–16 week Phase 1 timeline; SOC 2 Type I in Phase 1.4, Type II observation in Phase 3                                                                                                                   |
| **MiCamp Gateway API integration risk** — unknown sandbox quality, support response, recurring billing maturity vs Stripe                                         | **P1**   | Phase 0 kickoff call with MiCamp account team to confirm integration model; payment-adapter pattern means we can swap to Stripe US if MiCamp falls short                                                                |
| **MiCamp ISO residual accuracy** — Brodie's processor residuals must be calculated correctly per conversion or revenue leaks                                      | **P1**   | `Conversion.processorResidualCents` computed at conversion-finalize time using rate card; daily reconciliation job vs MiCamp portal export; CI test on rate-card edge cases                                             |
| **Both verticals at launch doubles compliance surface in Phase 1**                                                                                                | **P1**   | `Org.vertical` polymorphic routing — code path forks at compliance gate, not data model; vertical-specific gates in `services/compliance`                                                                               |
| **200+ knocker rollout could swamp launch** — change management for 200 field reps switching from existing process                                                | **P1**   | Phased rollout: 10 Week 14 → 50 Week 15 → 200+ Week 16; pilot training materials; dedicated SRE on-call during launch window                                                                                            |
| **AI Marketing Studio could leak PII into prompts** (Phase 3)                                                                                                     | **P1**   | Lead data anonymised to tract/SA1/subzone level; opt-out flag per org; provenance audit per output                                                                                                                      |
| **Mobile attestation breaks for power users**                                                                                                                     | P2       | Dev-build skips attestation; prod-build refuses; documented in mobile README                                                                                                                                            |
| **Multi-region Aurora cost** — three regions of serverless v2 ~$300+/mo from Day 1                                                                                | P2       | Acceptable for architecture; Phase 1 only US so Day 1 cost ~$150/mo                                                                                                                                                     |
| **Mapbox cost at scale** — geocoding + tile loads can hit $1K+/mo                                                                                                 | P2       | Cache geocoded addresses 30d; consider HERE for AU/SG if Mapbox costs blow up                                                                                                                                           |
| **On-call coverage for the pilot launch window**                                                                                                                  | **P1**   | Brodie + backend lead + mobile engineer on PagerDuty SEV1 rotation Weeks 14–16; SRE owns SEV2/3                                                                                                                         |
| **Glass effect performance on Android**                                                                                                                           | P3       | Solid fallback per ADR-0028; only chrome surfaces; not on scrolling content                                                                                                                                             |
| **White-label App Store / Play Store submission per pilot when SaaS opens** (Phase 4)                                                                             | P2       | Day 1 mobile is TestFlight + Play Internal only; per-tenant store submissions deferred until pilots demand                                                                                                              |
| **Engineering headcount assumption** — plan assumes 4–6 engineers, must confirm actual capacity before Phase 0 starts                                             | **P0**   | Confirm with Brodie before committing the 14–16 week timeline to Pilot-Charlie                                                                                                                                          |
| **Pilot-Charlie's contract structure** — assumed $2500/mo + 5/10/15% rakes; must confirm before billing service built                                             | **P0**   | Validate with pilot in Phase 0 kickoff; billing service designed to be config-driven so rates can change without redeploy                                                                                               |
| **Open question:** Consolidated `apps/org-console` for both managers and inside-sales, or split?                                                                  | P3       | Recommend consolidated with sidebar routing; pop-out dialer window for full-screen call work                                                                                                                            |

---

## 19. Definition of done — Phase 0 kickoff prerequisites

Before Phase 0 Week 1 can start, these must be confirmed/scheduled:

- [ ] Brodie confirms engineering headcount (plan assumes 4–6 full-time)
- [ ] MiCamp Gateway API kickoff call scheduled; sandbox credentials in hand
- [ ] Pilot-Charlie contract structure validated ($2,500/mo + 5/10/15% rakes assumed)
- [ ] Pilot-Charlie SSO/SAML IdP confirmed (Okta / Azure AD / etc.) + IT-side contact
- [ ] Counsel's projected state-clearance schedule received (drives rolling launch order)
- [ ] D2D legal entity registered (US LLC or Delaware C-corp recommended for US operations; separate from Amala/AUREAN)
- [ ] AWS Org root account created under D2D legal entity
- [ ] Apple Developer + Google Play developer accounts enrolled under D2D legal entity name
- [ ] Domains acquired: `door2digital.io` (primary), `d2d.io` (short), `app.d2d.io` (org-console), `api.d2d.io`, `console.door2digital.com` (operator)
- [ ] GitHub `door2digital` organisation created; engineers invited; CODEOWNERS drafted
- [ ] Plan copied to `/Users/Brodie/D2D/00-MASTER-PLAN.md` and committed to `door2digital/d2d-platform` `docs/architecture.md` once repo exists

---

**End of plan v0.2. Ready to execute Phase 0 Week 1.**
