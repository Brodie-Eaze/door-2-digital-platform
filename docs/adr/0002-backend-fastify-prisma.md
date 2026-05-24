# ADR-0002 — Backend: Fastify + Prisma + Postgres

- **Status:** Accepted
- **Date:** 2026-05-24
- **Phase:** 0

## Context

We need an HTTP framework + ORM + DB for the API. Targets: low latency, strong typing, mature Postgres support, easy ESM/TS, simple worker model for BullMQ.

## Decision

- **HTTP:** Fastify 4 (mirrors EazePay Intelligence). Plugin model, fast, schema-first via Zod + `nestjs-zod`-style validators.
- **ORM:** Prisma 5 (type-safe, mature, great Postgres support, generated client).
- **DB:** PostgreSQL 16 + PostGIS 3.4 (territory polygons, heat-map indexing).

Domain folder pattern: `apps/api/src/domains/<name>/` contains `routes.ts`, `service.ts`, `repository.ts`. Cross-domain calls only via services, not direct DB.

## Consequences

- Fastify boots in <100ms; lower memory than NestJS+Fastify combo.
- Prisma generates types; `db:generate` runs in CI before typecheck.
- PostGIS adds extension dependency — `docker-compose.yml` uses `postgis/postgis:16-3.4`.
- We don't get NestJS's decorator dependency injection — use plain functions + factory pattern.

## Alternatives considered

- **NestJS + Fastify adapter** — extra ceremony for marginal benefit at our team size.
- **Drizzle** — leaner but less mature ecosystem.
- **Hono** — promising but unproven for production-grade BFF.
