# Door 2 Digital Platform

> The operating system for door-to-door sales (charity + commercial).
> Field capture → CRM → AI marketing retargeting → conversion → commission → payout.
> Multi-region (US Phase 1 · AU Phase 2 · SG Phase 3). Operator-first → SaaS Phase 4.

## Status

**Phase 1 — US enterprise pilot, in build** (updated 2026-06-05).
Backend + security floor hardened across 10 stacked PRs (not yet merged); AWS IaC `validate`-clean (not yet applied). See `CLAUDE.md` for current state, `docs/PRD.md` for requirements, `docs/intelligence/INTELLIGENCE-LAYER-STRATEGY.md` for the moat.
Next human-gated unlocks: merge PRs → AWS account + `terraform apply` → MiCamp creds → domain → 50k load test.

## Quick start

```bash
# Prerequisites
node --version     # 20.10+
pnpm --version     # 9.12.0+
docker --version
# iOS engineer: Xcode 15.4+

# 1. Install deps
pnpm install

# 2. Bring up local stack (Postgres + PostGIS, Redis, MinIO, Mailpit, Jaeger)
docker compose up -d

# 3. Copy env template + generate secrets
cp .env.example .env.local
# Generate 32-byte hex secrets where the example says REPLACE_ME_32_BYTES_HEX:
#   openssl rand -hex 32

# 4. Generate Prisma client + apply schema
pnpm db:generate
pnpm db:migrate:dev --name initial

# 5. Run the API
pnpm --filter api dev
# → http://localhost:3010/v1/healthz

# 6. Run the operator console (separate terminal)
pnpm --filter web-operator dev
# → http://localhost:3011
```

## Repo layout

```
door-2-digital-platform/
├── apps/
│   ├── api/                  Fastify + Prisma backend (port 3010)
│   ├── web-operator/         Operator Console — Brodie's cross-tenant view (3011)
│   ├── web-org/              Org Console — per-tenant management (3012, Phase 1)
│   ├── crm-desktop/          Inside-sales workstation (Phase 1.3)
│   ├── marketing-studio/     AI ad gen + delivery (Phase 3)
│   ├── partner-portal/       Pilot-Charlie billing + reports (Phase 1.4)
│   ├── public-site/          d2d.io marketing (Phase 4)
│   └── knocker-ios/          Native iOS knocker app (Xcode / Swift / SwiftUI)
├── packages/
│   ├── shared-types/         Branded IDs, enums, Zod DTO schemas
│   ├── shared-utils/         BigInt money, RFC 7807, idempotency, hash, audit-chain
│   ├── api-client/           Generated typed fetch client (Phase 1.1)
│   ├── ui-tokens/            Tailwind preset + globals.css (EazePay Intelligence DNA)
│   └── ui-web/               Shared React components (AppShell, Sidebar, KpiCard, …)
├── infra/
│   ├── terraform/            Per-region IaC (us-east-1, ap-southeast-2, ap-southeast-1)
│   ├── railway/              Railway service configs (Day 1 deploy target)
│   └── runbooks/             On-call procedures
├── docs/
│   ├── architecture.md       Master plan v0.3 — read this first
│   ├── adr/                  28 architecture decision records
│   ├── compliance/           ACNC, state solicitation, PDPA, CCPA, TCPA artefacts
│   ├── runbooks/             Incident response, data-breach, region-failover, …
│   ├── audits/merkle-roots/  Weekly audit-chain Merkle roots (one per region)
│   ├── soc2/                 Control matrix + evidence
│   └── security/             Threat model, pen-test readiness
├── e2e/                      Playwright cross-app suites
├── .github/                  CI workflows + CODEOWNERS + PR template
├── Dockerfile.api            API container
├── Dockerfile.workers        BullMQ workers (one container per queue in prod)
├── Dockerfile.web-operator   Next.js operator console
├── docker-compose.yml        Local stack
├── turbo.json                Turbo task graph
├── pnpm-workspace.yaml       Workspace globs
└── tsconfig.base.json        Shared TS config + @d2d/* path aliases
```

## Engineering principles (read before your first PR)

1. **Money is BigInt cents.** Always. Display via `<Money cents={...} region={...} />`. See ADR-0007.
2. **Audit row in same TX** as every regulated mutation. See ADR-0008.
3. **Errors are RFC 7807 Problem Details.** Throw `ProblemError(Problems.x())`. See ADR-0009.
4. **POST mutations need an Idempotency-Key.** See ADR-0010.
5. **PII columns marked `/// PII`**, routed through `services/pii-vault`. JIT unmask is dual-control. See ADR-0011 + ADR-0012.
6. **Soft-delete only** (`status='archived'`); never DELETE regulated rows. See ADR-0013.
7. **Region pinning is immutable.** Every write asserts `org.regionCode === current region` via `RegionGuard`. See ADR-0016.
8. **D2D never auto-pays.** Payouts produce instruction files; humans execute. See ADR-0019.
9. **Architectural changes require an ADR** in `docs/adr/`. CODEOWNERS bounces missing ADRs.

## How to add a new domain

```bash
mkdir -p apps/api/src/domains/<name>
# create routes.ts, service.ts, repository.ts
# add Zod schema to packages/shared-types/src/schemas.ts
# add migration: pnpm --filter api db:migrate:dev --name <name>
# add integration test in apps/api/tests/integration/<name>.spec.ts
# register routes in apps/api/src/index.ts
# wire CODEOWNERS
```

## Design system

D2D uses **EazePay Intelligence's visual DNA** literally — strict navy + light-blue palette, Inter font with cv11/ss01, 256px sidebar, 14px topbar, `.card / .pill / .section / .tbl` class library.

Tokens: `packages/ui-tokens/` (Tailwind preset + globals.css).
Components: `packages/ui-web/` (AppShell, Sidebar, TopBar, KpiCard, StatusPill, Money, etc.).
iOS: `apps/knocker-ios/Packages/D2DKit/` (SwiftUI equivalents — `D2DCard`, `D2DStatusPill`, `D2DColor`).

**No glass effect. No aurora-green.** Consistent with EazePay App + EazePay Intelligence.

## Per-environment deploys

| Env     | Region(s)                                      | Target                               |
| ------- | ---------------------------------------------- | ------------------------------------ |
| dev     | us-east-1                                      | Railway (auto-deploy on `main`)      |
| staging | us-east-1 (+ ap-southeast-2/-1 mini Phase 2/3) | Railway (manual via `staging-*` tag) |
| prod    | us-east-1 Phase 1 → ECS Fargate Phase 4        | Railway → AWS migration Phase 4      |

## Pilot

Pilot-Charlie — US enterprise charity + commercial, 200+ knockers, 5K+ conversions/month. White-label, SSO/SAML, SOC 2 Type I, dedicated single-tenant DB. Phase 1 ships in 14–16 weeks.

## Conventions docs

- `CONTRIBUTING.md` — branching, commits, PR review etiquette
- `SECURITY.md` — vulnerability disclosure, threat model
- `docs/architecture.md` — full plan (v0.3, May 2026)
- `docs/adr/` — all 28 decision records

## Questions

Brodie · brodie@door2digital.io.
