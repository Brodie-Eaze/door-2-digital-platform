# apps/api

Door 2 Digital BFF — Fastify + Prisma + Postgres + Redis + BullMQ.

## Run locally

```bash
# 1. Bring up Postgres + Redis + Mailpit + Jaeger
docker compose up -d

# 2. Install deps + generate Prisma client
pnpm install
pnpm db:generate

# 3. Apply schema
pnpm db:migrate:dev

# 4. Seed (Phase 1.1+)
pnpm db:seed

# 5. Start API
pnpm dev
# → API at http://localhost:3010
# → Health at http://localhost:3010/v1/healthz
# → Ready at http://localhost:3010/v1/readyz
```

## Layout

```
src/
├── index.ts                 Fastify bootstrap
├── config/
│   ├── env.ts               Zod-validated env (fail-fast)
│   ├── db.ts                Prisma singleton + tenant-scoped client
│   ├── redis.ts             IORedis singleton
│   └── logger.ts            Pino with PII redactor
├── shared/
│   ├── health.ts            /v1/healthz + /v1/readyz
│   ├── errors/handler.ts    RFC 7807 unified handler
│   └── middleware/
│       ├── correlation.ts   X-Correlation-ID propagation
│       ├── region-guard.ts  Region pinning enforcement
│       ├── tenant-guard.ts  Tenant context extraction
│       └── idempotency.ts   Idempotency-Key validation
├── domains/                 One folder per bounded context (per plan §2)
│   ├── auth/                Login, MFA, SAML SSO, WebAuthn
│   ├── org/                 Tenant lifecycle, region pin, BrandKit, Billing
│   ├── user/                Staff CRUD, RBAC, hierarchy
│   ├── territory/           PostGIS polygons, S2 cell index, heat overlays
│   ├── knock/               Offline knock sync (batch endpoint)
│   ├── lead/                Lead lifecycle (XState), enrichment, routing
│   ├── conversion/          Polymorphic Conversion (donation | sale)
│   ├── donation/            Recurring + one-off; IRS receipts
│   ├── sale/                Commercial one-shot; installer handoff
│   ├── commission/          Per-knock/per-sale/hybrid; daily accrual
│   ├── payout/              Batch instruction file (never auto-debits)
│   ├── marketing/           Ad accounts, audience builds, delivery
│   ├── content-studio/      AI copy/image/video generation
│   ├── compliance/          State clearance, DNC, consent ledger
│   ├── do-not-knock/        Address-level DNK sync
│   ├── pii-vault/           Envelope encrypt + JIT unmask
│   ├── audit/               Hash-chained outbox writer
│   ├── webhook/             Outbound HMAC-signed delivery
│   ├── billing/             Per-bucket invoice generation
│   ├── integrations/        Inbound adapters (Stripe, Twilio, MiCamp, ...)
│   ├── notification/        SMS/email/push fan-out
│   ├── mapping/             Mapbox proxy + ACS/SEIFA/SingStat ingest
│   ├── realtime/            Ably grant + live channel publish
│   ├── risk/                Fraud signals on knocks, GPS spoof, dup conv
│   └── dsar/                Data-subject access/deletion request orchestration
├── workers/                 BullMQ worker processes (one per queue)
└── websocket/               WebSocket gateway (when needed beyond Ably)

prisma/
├── schema.prisma            Full data model — see plan §4
└── migrations/              Generated via `pnpm db:migrate:dev <name>`

tests/
├── unit/                    Vitest, no I/O
└── integration/             Vitest + testcontainers (PG + Redis)
```

## Workers

Each worker is a standalone Node process started via `pnpm worker:<name>`. In
production, one Railway/ECS service per worker so failures isolate.

Cron-style jobs run on exactly one replica via `CRON_LEADER=true` env var.

## Adding a new domain

1. Create `src/domains/<name>/` with `routes.ts`, `service.ts`, `repository.ts`
2. Add `await app.register(register<Name>, { prefix: '/v1/<name>' })` in `src/index.ts`
3. Add Zod schema(s) to `@d2d/shared-types/schemas.ts`
4. Add migration via `pnpm db:migrate:dev <name>`
5. Add integration test in `tests/integration/<name>.spec.ts`
6. Wire CODEOWNERS

## Conventions

- All mutations: idempotency-key required (`requireIdempotencyKey(req)`)
- All money: BigInt cents via `@d2d/shared-utils/money` — never Number
- All errors: throw `ProblemError(Problems.x())` — handler converts to RFC 7807
- All region-pinned writes: call `assertRegionMatches(org, req)` first
- All PII reads in admin context: JIT unmask flow + audit row
