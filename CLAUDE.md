# CLAUDE.md — Door 2 Digital Platform

> Project context for Claude Code. Read this first. Last updated 2026-06-07.

## What this is

**Door 2 Digital Platform (D2D)** — the operating system for door-to-door sales, both **charity fundraising** and **commercial D2D** (solar, pest, energy, telecom). It closes the loop from the knock to the converted customer:

**Market the area → Knock → Capture at the door → Call-centre follow-up → AI retargeting → Convert → Commission → Payout** — with audit-grade engineering, multi-region data residency, and a compliance spine.

Operator-first (D2D's own knocker team runs campaigns for client orgs), SaaS-self-serve later. The real strategic prize is the **Intelligence Layer** (see `docs/intelligence/INTELLIGENCE-LAYER-STRATEGY.md`) — a compounding proprietary dataset (door outcome + recorded conversation + household context) that no competitor can replicate.

## Where the code lives

- **Repo: `/Users/Brodie/D2D/door-2-digital-platform`** (this directory). Local folder `~/D2D/d2d-platform` was the old name — now `door-2-digital-platform`.
- GitHub: `Brodie-Eaze/door-2-digital-platform`

## Stack (locked)

- **Monorepo**: pnpm 9 + Turbo. TypeScript 5.5 **ESM-only, strict, `noUncheckedIndexedAccess`**.
- **API** (`apps/api`): NestJS-style on **Fastify** + **Prisma** + **Postgres 16 + PostGIS**. Domain-driven (`src/domains/*/{routes,service,schemas}.ts`).
- **Web** (`apps/web-operator` = Command Centre, `apps/web-org`, `apps/public-site`, `apps/partner-portal`): **Next.js 16** (App Router, RSC). `web-operator` is the main operator surface.
- **Mobile**: native iOS (Swift/SwiftUI) — `apps/knocker-ios` (real app on the recovery branch: 55 Swift files, Keychain auth, offline sync, 21 wired endpoints).
- **Infra**: Redis 7 + BullMQ; AWS (ECS Fargate, Aurora Serverless v2, RDS Proxy, ElastiCache, ALB, CloudFront, WAF) via Terraform in `infra/terraform`. Railway for current demo deploys.
- **Money is always `BigInt` cents.** Use `<Money>` / `libs/shared-utils/money.ts`. Never floats.

## Design DNA (locked — mirrors EazePay)

- Palette: paper `#F7F8FA` · surface `#FFFFFF` · ink `#0F172A` · accent `#3B82F6` · accentSoft `#DBEAFE`. Navy + light-blue. **No glass-pane. No aurora-green.**
- Fonts: Inter + JetBrains Mono. 256px sidebar, 14px topbar.

## Conventions (hard rules)

- **Never push to `main` / merge / deploy without explicit per-turn authorization.** Always branch + PR.
- **Never commit unless explicitly asked.** When staging, add files **by name** (not `git add -A`/`.`).
- Commit messages end with the `Co-Authored-By` trailer. No emojis.
- **No new dependencies** without flagging first.
- Pre-commit hook = lint-staged (eslint --fix + prettier --write) + **gitleaks**. `tsc --noEmit` must be clean before commit.
- **PII-first**: classify before write, envelope-encrypt at rest (the PII vault), tenant-scope, audit access, RTBF capability. Default on every model.
- **Multi-tenant**: every regulated row carries `orgId`, `regionCode`, `brandCode`. Postgres RLS belt enforces tenant isolation.
- Money / regulator / customer comms = **human-only**, queued, never autonomous.

## Current state (2026-08-21)

- **History warning: main was reset after 14 Jun 2026.** GitHub shows PRs #2/#3/#5/#7/#10 as merged, but their merge commits are NOT in main's history; #4/#6/#8 were closed unmerged. Their content was stranded on local branches until recovered.
- **PR #12 (`recover/hardening-stack`) is the recovery** — PR #9's green base + the local `staging` lineage merged in: 9 additional API domains (roster, catalog, field-signup, photo, voice, propensity, satellite, analytics, payment — 35 total, 15 workers), the real 10k-LOC Knocker iOS app, login lockout + unlock, Next 16 (web-operator), k6 load tests, M5 screen wiring, SEC blocker fixes. **Merge #12 (supersedes #9).** All previously local-only branches are backed up on origin: `staging`, `elevate/knocker-app`, `fix/soc2-security-floor-local`, `experiment/next15-upgrade`.
- **Security floor** (on the recovery branch): RLS belt + tenant-scoped Prisma (`tenantPrismaTx`/`tenantTx` — never raw `prisma()` for tenant data), token-revocation epoch, invite/role guards, demo-token rejection, SAML replay defence, login lockout + admin unlock, SEC-010 IP-only rate keying, SEC-006 trustProxy=1, voice consent gate (`D2D_VOICE_ENABLED` + `consentObtained`, default off).
- **Knocker iOS** (`apps/knocker-ios` on the recovery branch): real app, builds via `BUILD.md` xcodebuild runbook. Known Tier-0 gaps in `elevate/knocker-elevation.md` (fake commission display, consentGiven hardcoded false, sign-out deletes unsynced queue, placebo Sync-now). No CI for iOS yet.
- **Backend wiring**: web-operator ~65 of 93 routes still on fixtures (`src/lib/seed/*`, `account-*.ts`, `fixtures.ts`); web-org has zero backend contact; partner-portal 100% `portal-data.ts`. The full route-by-route inventory is in the mock-data audit (see PR #12 description / docs/FABLE-TAKEOVER.md).
- **AWS**: IaC `terraform validate`-clean, **not applied** (no AWS account yet). Runbook: `infra/terraform/README.md` + 6 human-only clicks.
- **Gate gotchas**: PATCH routes never take `withIdempotency` (RFC 5789); Next 16 removed `next lint` (web-operator lints via direct eslint, eslint-config-next pinned 14.x while workspace is eslint 8); `_`-prefix doesn't silence no-unused-vars for args unless configured; vitest packages with no tests need `--passWithNoTests`; Semgrep blocks TLS < 1.2 in Terraform.
- **Not done (human-gated)**: merge PR #12, AWS account + apply, MiCamp creds, domain, PII key rotation, external pen-test, SOC 2 auditor, lawyer, live 50k load test.

## Key docs

- `docs/architecture.md` — the master architecture (also `/Users/Brodie/.claude/plans/question-im-about-to-greedy-cascade.md` = CTO master plan v0.3)
- `docs/PRD.md` — product requirements (this project's PRD)
- `docs/intelligence/INTELLIGENCE-LAYER-STRATEGY.md` — the "Gotham for Doors" moat strategy
- `docs/50k/` — the road-to-50k backlog, HARDENING-LOG, runbooks, SLO, DR, operating agreement
- `docs/adr/` — ADRs 0001–0030
- `infra/terraform/README.md` — AWS deploy runbook

## Live URLs (current demo — pre-hardening build)

- Public site: https://public-site-production-8e0b.up.railway.app (+ `/platform`)
- Operator Command Centre (demo login): https://d2d-production-1fab.up.railway.app
- These run the OLD build; the PR-stack changes are not deployed.

## What NOT to do

- Don't treat this as EazePay (separate project; D2D mirrors its DNA + cribs its patterns, but is its own repo).
- Don't drift to other projects when working D2D.
- Don't put unverified vendor marketing numbers anywhere (the deep-research pass refuted every parcel-data coverage claim — validate with a POC).
- Don't deploy/merge/move-money autonomously — queue it.
