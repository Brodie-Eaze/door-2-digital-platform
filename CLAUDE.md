# CLAUDE.md — Door 2 Digital (D2D)

> Project context for Claude Code. Read this first. Last updated 2026-06-05.

## What this is

**Door 2 Digital (D2D)** — the operating system for door-to-door sales, both **charity fundraising** and **commercial D2D** (solar, pest, energy, telecom). It closes the loop from the knock to the converted customer:

**Market the area → Knock → Capture at the door → Call-centre follow-up → AI retargeting → Convert → Commission → Payout** — with audit-grade engineering, multi-region data residency, and a compliance spine.

Operator-first (D2D's own knocker team runs campaigns for client orgs), SaaS-self-serve later. The real strategic prize is the **Intelligence Layer** (see `docs/intelligence/INTELLIGENCE-LAYER-STRATEGY.md`) — a compounding proprietary dataset (door outcome + recorded conversation + household context) that no competitor can replicate.

## Where the code lives

- **Repo: `/Users/Brodie/D2D/d2d-platform`** (this directory). Note: `~/HQ/INDEX.md` lists `~/code/d2d-platform` — that path is stale; the live repo is here.
- GitHub: `Brodie-Eaze/d2d-platform`

## Stack (locked)

- **Monorepo**: pnpm 9 + Turbo. TypeScript 5.5 **ESM-only, strict, `noUncheckedIndexedAccess`**.
- **API** (`apps/api`): NestJS-style on **Fastify** + **Prisma** + **Postgres 16 + PostGIS**. Domain-driven (`src/domains/*/{routes,service,schemas}.ts`).
- **Web** (`apps/web-operator` = Command Centre, `apps/web-org`, `apps/public-site`, `apps/partner-portal`): **Next.js 16** (App Router, RSC). `web-operator` is the main operator surface.
- **Mobile**: native iOS (Swift/SwiftUI) — `knocker-ios` (scaffold).
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

## Current state (2026-06-05)

- **10 stacked PRs open (`Brodie-Eaze/d2d-platform/pulls`), NONE merged**: PR #9 (independent: menu fix + M2 IaC + M3 scale) → PR #1 (SOC2 floor) → #2…#8 (hardening) → #10 (final WARNs + SEC-010 + Next 16). Merge **#9 first**, then #1→#10 in order. One 2-line `apps/api/src/index.ts` conflict to hand-resolve at #10.
- **Security**: ~25 audit findings closed + a final adversarial review caught + fixed 4 BLOCKERs. Floor = RLS + token-revocation epoch + invite/role guards + demo-token rejection + SAML replay defence + login lockout + rate limits.
- **AWS**: IaC is `terraform validate`-clean but **not applied** (no AWS account yet). Deploy steps in `infra/terraform/README.md` + the 6 human-only clicks.
- **Backend wiring**: ~20% end-to-end. Many web-operator screens still on mock/seed data; M5 wired ~10 to live Prisma. Real production needs: AWS account → apply → MiCamp creds → domain → load test.
- **Not done (human-gated)**: merge the PRs, AWS apply, MiCamp creds, domain, PII key rotation, external pen-test, SOC 2 auditor, lawyer, live 50k load test.

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
