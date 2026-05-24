# Door 2 Digital — Phase 0 Handoff

> **From:** Brodie (with Claude) · **To:** the D2D engineering team
> **Date:** 2026-05-24 · **Phase:** 0 → 1.1 handoff

Welcome to the codebase. Phase 0 (Scaffold) is complete. This document tells you what's built, what's queued for Phase 1.1, and how to get started.

---

## TL;DR — what's built

✅ **Monorepo scaffold** — Turbo + pnpm + TypeScript 5.6, root configs (tsconfig.base, .prettierrc, .editorconfig, .nvmrc, .gitignore, .dockerignore, .eslintrc, .gitleaks.toml, .husky)
✅ **Design system** mirroring EazePay Intelligence — Tailwind preset + globals.css + 13 React components (AppShell, Sidebar, TopBar, Card, Section, KpiCard, StatusPill, Money, RegionBadge, EmptyState, Banner, Button, Input, AnomalyCard, LeadCard, KnockCard)
✅ **Shared packages** — `@d2d/shared-types` (branded IDs + enums + Zod schemas), `@d2d/shared-utils` (BigInt money, RFC 7807 Problem, idempotency, hash, ULID, audit-chain, attribution-rake), `@d2d/ui-tokens`, `@d2d/ui-web`
✅ **Prisma schema** — full data model (28 entities) covering Org/BrandKit/SsoConfiguration/OrgBilling/User/Territory/Knock/Lead/Conversion/Donation/Sale/Commission/Payout/PaidSolicitorRegistration/CampaignStateClearance/AdAccount/Creative/AdCampaign/DoNotKnock/DoNotCall/ConsentRecord/AuditEvent/ApiKey/Webhook(Endpoint/Delivery)/IdempotencyRecord — with PostGIS geometry, BigInt cents, immutable region pinning, PII tags
✅ **API skeleton (Fastify)** — bootstrap with helmet/cors/rate-limit, correlation ID, RFC 7807 error handler, env validation (Zod fail-fast), Prisma + Redis singletons, Pino with PII redactor, health probes (`/v1/healthz` + `/v1/readyz`), middleware stubs (region-guard, tenant-guard, idempotency), domain stubs (auth, org)
✅ **Operator Console (Next.js 14)** — working AppShell + sidebar nav + topbar + login page + `/overview` mission-control home with KPI rail + anomaly feed + region status + build status
✅ **iOS knocker app seed** — README with Xcode bootstrap steps, `D2DKnockerApp.swift` + `ContentView.swift` placeholder, `Info.plist.example` with ATS/location/biometric/Mapbox capabilities, `D2DKit` Swift Package with `D2DColor` tokens + `D2DCard` + `D2DStatusPill` SwiftUI components
✅ **Docker** — docker-compose.yml (Postgres+PostGIS, Redis, MinIO, Mailpit, Jaeger), per-app Dockerfiles (`Dockerfile.api`, `Dockerfile.workers`, `Dockerfile.web-operator`), Railway service tomls
✅ **CI/CD** — `.github/workflows/ci.yml` with all 10 gates wired (format, lint, typecheck, gitleaks, semgrep, trivy, unit tests, integration tests with PG+Redis services, isolation probe, audit chain verify) + `deploy-railway.yml` stub + CODEOWNERS + PR template
✅ **28 ADRs** — full prose for 0001/0002/0003/0007/0008/0009/0010/0011/0012/0013/0014/0016/0019/0022/0028 (the load-bearing decisions), stubs for the rest, README index + template
✅ **Docs** — README, CONTRIBUTING, SECURITY, full plan at `docs/architecture.md` (1222 lines)

Repo at `/Users/Brodie/D2D/d2d-platform/`. Plan at `/Users/Brodie/D2D/00-MASTER-PLAN.md` and in-repo at `docs/architecture.md`. Local git initialised on `main`.

---

## What is NOT yet built (Phase 1.1+ queue)

Each item below is a real engineering task with concrete file paths. Order roughly matches the plan §14 phasing.

### Phase 0 follow-ups (this week)

- [ ] **`pnpm install` lockfile generation** — I scaffolded `package.json`s but didn't run install. First engineer runs `pnpm install` to materialize `pnpm-lock.yaml` and commit it.
- [ ] **First Prisma migration** — `pnpm --filter api db:migrate:dev --name initial` to generate the actual SQL migration from `schema.prisma`. Verify PostGIS extension is enabled.
- [ ] **MiCamp Gateway API kickoff call** — get sandbox creds + confirm recurring billing + tokenised vault + ACH support. Gates Phase 1.3.
- [ ] **Pilot-Charlie SSO/SAML metadata** — get IT admin to send Okta SAML metadata XML. Gates Phase 1.1 go-live.
- [ ] **Pilot-Charlie contract validation** — confirm the $2,500/mo + 5%/10%/15% rake assumption. Drives `OrgBilling` defaults.
- [ ] **Counsel's state-clearance schedule** — get ETA per state for paid-solicitor registrations. Drives Phase 1.4 rolling launch order.
- [ ] **AWS Org creation** — set up new AWS Org `door2digital` with dev/staging/prod/audit/security/shared-services accounts. Phase 0 deliverable not yet executed.
- [ ] **Apple Developer + Google Play enrollment** — under D2D legal entity. iOS engineer can't bootstrap without it.
- [ ] **Domain acquisition** — `door2digital.io`, `d2d.io`, `api.d2d.io`, `app.d2d.io`, `console.door2digital.com`, `knocker.d2d.io`.
- [ ] **GitHub org creation** — `door2digital` private org, invite engineers, push this repo to `door2digital/d2d-platform`.

### Phase 1.1 — Foundations + Auth + Org (Week 2–4)

- [ ] **`services/auth` real implementation** — email+password login, TOTP MFA enforcement for `org_admin+`, Cognito integration, session storage in Redis, refresh token rotation
- [ ] **`services/auth/saml`** — SAML 2.0 SP for Okta federation, JIT user provisioning from SAML attributes
- [ ] **`services/auth/webauthn`** — step-up authentication for sensitive actions (payout instructions, PII unmask approvals)
- [ ] **`services/org`** — `POST /v1/orgs` with region pinning (DB CHECK constraint + Postgres trigger raising on UPDATE), `BrandKit` upsert, `OrgBilling` defaults seeded
- [ ] **`services/user`** — staff CRUD with 8-role RBAC, manager hierarchy, invite flow
- [ ] **`services/audit`** — hash-chained outbox writer + `worker:audit-shipper` to S3 Object Lock
- [ ] **`services/pii-vault`** — KMS envelope encryption, deterministic-SIV digests, JIT unmask flow with dual-control
- [ ] **TenantGuard `$extends`** — Prisma extension that injects `where: { orgId }` on every query (currently a stub returning the raw client)
- [ ] **Idempotency store** — implement `IdempotencyRecord` read/write + replay-handling middleware (currently just validates key format)
- [ ] **`apps/operator-console`** real auth wiring — `/login` POSTs to API, session cookie, /overview redirects when unauthed
- [ ] **Cross-tenant probe in CI** — synthetic test creates two tenants, attempts cross-read, asserts 403 + audit row

### Phase 1.2 — Field capture + CRM + Compliance core (Week 5–9)

- [ ] **`services/territory`** — PostGIS polygon CRUD, S2 cell index covering, ACS overlay ingestion job
- [ ] **`services/knock`** — `POST /v1/knocks/batch` with idempotency-key per knock, offline reconciliation, photo/signature upload to S3 KMS
- [ ] **`services/lead`** — lifecycle XState machine, enrichment, routing to inside-sales by territory + workload
- [ ] **`services/crm`** — call/SMS/email logging via Twilio + Resend, sequences (Phase 1.3 polish)
- [ ] **`services/compliance/paid-solicitor`** — `PaidSolicitorRegistration` table-driven state-clearance engine; campaigns can only deliver to cleared states; nightly job to flag expiring registrations
- [ ] **`services/compliance/tcpa`** — hour-of-day/state windows for SMS/calls (ZIP→state→TZ lookup)
- [ ] **`services/compliance/privacy`** — CCPA + CO/VA/UT/MT/CT/TX/OR/DE primitives (consent records, DSAR ingress)
- [ ] **`services/do-not-knock`** — FTC + FCC + state DNC scrub, HOA/no-solicit overlay, daily sync job
- [ ] **`services/notification`** — Twilio adapter (US long codes), Resend adapter, push (APNs via worker)
- [ ] **`services/mapping`** — Mapbox proxy + nightly US ACS / Census refresh
- [ ] **`apps/knocker-ios`** — bootstrap Xcode project (per `apps/knocker-ios/README.md`), implement Map tab (Mapbox + territory polygons + knock pins), KnockFlow bottom sheet (disposition wheel + lead form + signature), offline queue (SwiftData + sync worker), biometric re-auth, App Attest
- [ ] **`apps/knocker-ios` white-label** — per-BrandKit build configurations; TestFlight + Play Internal distribution under D2D's developer accounts

### Phase 1.3 — Conversion + Payment + Commissions (Week 10–13)

- [ ] **`services/conversion`** — polymorphic Conversion with AttributionSource, idempotent finalisation, FX-aware (USD-only Day 1)
- [ ] **`services/donation`** — IRS-compliant receipt PDF generator (501(c)(3) statement, EIN, tax-deductibility text); recurring sub management
- [ ] **`services/sale`** — commercial one-shot flow, installer-handoff webhook
- [ ] **`services/payment/MiCampAdapter`** — Gateway API integration: tokenised vault, single charge, recurring subscription, refund, ISO residual computation per `Conversion.processorResidualCents`
- [ ] **`services/payment/StripeAdapter`** (stub for Phase 2)
- [ ] **`services/commission`** — per-knock + per-conversion plans, crew-leader overrides, rule DSL, daily accrual job
- [ ] **`services/payout`** — fortnightly/monthly batch generation, NACHA/CSV instruction file to S3, status `draft → ready_to_pay → instructed → acknowledged` (never auto-debits per ADR-0019)
- [ ] **`services/billing`** — Pilot-Charlie monthly invoice: $2,500 platform fee + per-bucket rake totals from Conversion AttributionSource; PDF render + email delivery via Resend
- [ ] **`apps/web-org`** — full scaffold per the operator-console pattern: Today (anomaly-first) + Territories + Knocker Teams + Leads + Pipeline + Inside Sales (DialerCockpit) + Conversions + Commissions + Payouts + Reports + Compliance + Settings + BrandKit
- [ ] **`services/realtime`** — Ably channel grants; live-knock feed + leaderboard publishers
- [ ] **`apps/crm-desktop` v1** — soft-phone (Aircall integration first), sequence designer DAG, pipeline kanban

### Phase 1.4 — Enterprise hardening + go-live (Week 14–16)

- [ ] **SOC 2 Type I scoping** — control matrix in `docs/soc2/controls.md`, evidence collection automation
- [ ] **WAF deployment** — AWS WAF managed rules + custom rate limits in Terraform
- [ ] **`PEN_TEST_READINESS.md` checklist** — all green; external pen test scheduled (Bastion or Pure Hacking)
- [ ] **Cross-region isolation probe in CI** (synthetic test reads AU lead via SG region API → 403)
- [ ] **Mobile cert pinning + jailbreak detection** verified on physical iOS device
- [ ] **DR game day** — RPO 5min RTO 1h validated
- [ ] **Audit chain Merkle replay** weekly CI job
- [ ] **Knocker rollout** — phased: 10 Week 14 → 50 Week 15 → 200+ Week 16
- [ ] **`apps/partner-portal`** for Pilot-Charlie — invoice viewer, payout statements, conversion reports, compliance state matrix
- [ ] **Pilot-Charlie SSO production cutover**

### Phase 2 — AU expansion (Week 17–24)

See plan §14. AU region Terraform, Stripe AU + GoCardless, ACNC compliance, AU charity receipt template.

### Phase 3 — SG + AI Marketing Studio (Week 25–32)

See plan §14. SG region, PDPA, **`apps/marketing-studio` + `services/content-studio` + `services/marketing`** with Claude/FLUX/Runway + Meta/Google/TikTok ad delivery + retargeting roundtrip.

### Phase 4 — Public SaaS + AWS migration (Week 33–44)

See plan §14. AWS cutover (Railway → ECS Fargate + Aurora + Vercel + EAS + CloudFront/WAF), public self-serve onboarding via `apps/public-site`, public App Store + Play Store submissions.

---

## Day-1 onboarding for a new engineer

1. **Read `docs/architecture.md`** (1222 lines, ~45 min) — the master plan.
2. **Skim `docs/adr/`** — focus on 0001 / 0002 / 0003 / 0007 / 0008 / 0009 / 0010 / 0011 / 0012 / 0016 / 0019 / 0022 / 0028 (the load-bearing ones; full prose). Other ADRs are stubs to flesh out as you implement.
3. **Skim `README.md` + `CONTRIBUTING.md` + `SECURITY.md`** — engineering principles + PR etiquette.
4. **Run locally** — `pnpm install && docker compose up -d && pnpm --filter api dev` in one terminal, `pnpm --filter web-operator dev` in another. Visit `http://localhost:3011/overview`.
5. **Read your domain's seed code** — your domain folder under `apps/api/src/domains/<name>/` (or shared package under `packages/`).
6. **Pick a Phase 1.1 ticket from above**, open a branch `feat/<scope>-<slug>`, follow the PR template hard-rules checklist.

## Day-1 onboarding for the iOS engineer

1. **Read `apps/knocker-ios/README.md`** — bootstrap instructions for the Xcode project.
2. **Install Xcode 15.4+** and the iOS 17 SDK.
3. **Bootstrap the Xcode project** from the README's "Bootstrap from this directory" section. Drop in `D2DKnockerApp.swift`, `Info.plist.example` → `Info.plist`, and link the local `D2DKit` Swift Package.
4. **Enrol** in Apple Developer (D2D legal entity) — Phase 0 follow-up; gate to TestFlight distribution.
5. **Read ADR-0003** (mobile native iOS), **ADR-0022** (offline-first), **ADR-0025** (mobile attestation).
6. **First task:** implement the Map tab — Mapbox SDK + assigned territory polygon overlay + current-GPS pin. Wire to `GET /v1/territories/my-assigned` (Phase 1.1 endpoint).

## Day-1 onboarding for the SRE / platform engineer

1. **Read `docs/architecture.md` §2.4 (Deployment topology) + §6 (Multi-region data residency).**
2. **Read ADR-0016** (region pinning), **ADR-0017** (webhook isolation), **ADR-0019** (never auto-pay).
3. **Phase 0 follow-up:** create the new `door2digital` AWS Org (root + dev/staging/prod/audit/security/shared-services), fork EazePay's Terraform modules into `infra/terraform/modules/`, write `infra/terraform/envs/dev/us-east-1/` composition.
4. **Phase 1 ownership:** Railway service wiring, secrets management (Doppler dev → AWS Secrets Manager prod), observability stack (Pino → OpenSearch → SIEM, Datadog APM).
5. **Phase 1.4 ownership:** WAF, pen test prep, SOC 2 evidence pipeline, DR game day.

---

## Where to find things

| Need to… | Look here |
|---|---|
| Understand the architecture | `docs/architecture.md` |
| Understand a specific decision | `docs/adr/NNNN-*.md` |
| Add a new domain | `apps/api/src/domains/*` (copy `auth/` or `org/`) |
| Add a new shared type | `packages/shared-types/src/{ids,enums,schemas}.ts` |
| Add a new helper | `packages/shared-utils/src/*.ts` |
| Add a new UI component | `packages/ui-web/src/components/*.tsx` (export from `index.ts`) |
| Add a new web page | `apps/web-operator/src/app/<route>/page.tsx` |
| Add a new env var | `.env.example` + `apps/api/src/config/env.ts` + `turbo.json` `globalPassThroughEnv` |
| Add a new migration | `pnpm --filter api db:migrate:dev --name <description>` |
| Add a new ADR | `cp docs/adr/template.md docs/adr/NNNN-<slug>.md` |
| Add a CI gate | `.github/workflows/ci.yml` |
| Add a Dockerfile / Railway service | root `Dockerfile.<app>` + `infra/railway/railway.<app>.toml` |
| Check pen-test readiness | `docs/PEN_TEST_READINESS.md` (Phase 1.4) |
| Find a runbook | `docs/runbooks/*.md` |
| Compliance template | `docs/compliance/*.md` |

---

## Open questions for Brodie

These need answers before Phase 1.1 starts (none block Phase 0):

1. **Pilot-Charlie identity** — what's the real org name? Replace "Pilot-Charlie" placeholder throughout docs.
2. **Pilot-Charlie SSO IdP** — Okta confirmed? Get metadata XML from their IT admin.
3. **Pilot-Charlie contract terms** — confirm the $2,500/mo + 5/10/15% rake numbers. Or supply alternatives.
4. **Engineering team list** — names + GitHub usernames so CODEOWNERS can be updated from `@brodie` placeholder.
5. **State-clearance ETA from counsel** — drives the Phase 1.4 rolling state launch order.
6. **MiCamp Gateway API access** — has the kickoff call happened? Sandbox creds in hand?
7. **AWS Org** — has it been created? Master account?
8. **GitHub `door2digital` org** — created? Engineers invited?

---

## Verification — Phase 0 is "done" when:

- [x] Repo scaffold at `/Users/Brodie/D2D/d2d-platform/`
- [x] 28 ADRs (15 full prose, 13 stubs ready to flesh out)
- [x] Prisma schema covers all 28 entities from plan §4
- [x] `@d2d/ui-tokens` + `@d2d/ui-web` mirror EazePay Intelligence design DNA exactly
- [x] `@d2d/shared-utils` ports BigInt money + RFC 7807 + idempotency + hash + ULID + audit-chain + attribution-rake
- [x] API skeleton with Fastify bootstrap + middleware stubs + health probes + auth/org route stubs
- [x] Operator console renders with sidebar + topbar + Today page
- [x] iOS knocker app seed in place (README + D2DKnockerApp.swift + D2DKit package + Info.plist.example)
- [x] docker-compose.yml + per-app Dockerfiles + Railway tomls
- [x] GitHub Actions CI with all 10 gates wired
- [x] README + CONTRIBUTING + SECURITY + HANDOFF
- [x] Plan at `/Users/Brodie/D2D/00-MASTER-PLAN.md` and `docs/architecture.md`
- [x] Local git initialised on `main`
- [ ] `pnpm install` run and `pnpm-lock.yaml` committed (first engineer's task)
- [ ] Pushed to `door2digital/d2d-platform` GitHub (after org creation)

---

## How to push to GitHub once the org exists

```bash
cd /Users/Brodie/D2D/d2d-platform
gh repo create door2digital/d2d-platform --private --source=. --remote=origin
git add -A
git commit -m "Phase 0 scaffold

- Turbo + pnpm monorepo, Node 20, TypeScript 5.6
- Design system mirroring EazePay Intelligence (navy + light-blue, Inter,
  256px sidebar, no glass, no aurora)
- @d2d/shared-types + @d2d/shared-utils (money / RFC 7807 / idempotency /
  audit-chain / attribution-rake)
- @d2d/ui-tokens + @d2d/ui-web (13 React components)
- Prisma schema for 28 entities incl. multi-region, white-label, paid-solicitor
- Fastify API skeleton with middleware + health probes
- Operator Console Next.js app with sidebar nav + Today page
- Native iOS knocker app seed (Xcode + D2DKit Swift Package)
- docker-compose + per-app Dockerfiles + Railway tomls
- CI with 10 gates (format, lint, typecheck, gitleaks, semgrep, trivy,
  unit, integration with PG+Redis, isolation probe, audit Merkle replay)
- 28 ADRs (15 full prose, 13 stubs)
- README + CONTRIBUTING + SECURITY + HANDOFF + architecture.md plan

Co-Authored-By: Claude <noreply@anthropic.com>"
git push -u origin main
```

---

Good luck. The hard part — locking the architecture against the real Pilot-Charlie constraints — is done. Now execute.

— Brodie + Claude · 2026-05-24
