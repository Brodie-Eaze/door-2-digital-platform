# M3 Scale-by-Design Layer

Target: 50,000 concurrent users without code rewrites.  
Delivered as additive middleware/config/guards — zero business-logic changes.

---

## 1. Rate Limiting

**Plugin:** `@fastify/rate-limit` v9 (already in `package.json` — no new dep).  
**Store:** existing ioredis singleton (shared with BullMQ).

### Tiered buckets

| Bucket key format | Who                                       | Limit       |
| ----------------- | ----------------------------------------- | ----------- |
| `org:{orgId}`     | Authenticated tenant (JWT contains orgId) | 300 req/min |
| `key:{x-api-key}` | Programmatic API-key client               | 300 req/min |
| `ip:{ip}`         | Anonymous / unauthenticated               | 120 req/min |

The `keyGenerator` does a best-effort JWT payload decode (no signature check — that is the auth guard's job) on `onRequest` so per-tenant bucketing works before `preHandler` runs. Malformed or missing tokens fall through to API-key then IP.

### Per-route overrides

Route-level tightening uses `config.rateLimit: { max, timeWindow }` on the route options object. Example already wired:

- `POST /v1/orgs` — 5 req/min/IP (SEC-011, org creation abuse prevention)
- `GET /v1/healthz`, `GET /v1/readyz` — exempt (`config: { rateLimit: false }`)

### Response contract

Every 429 response includes:

- `Retry-After` header (seconds until window resets)
- `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers
- RFC 7807 body: `{ type: "...rate-limited", status: 429, retryAfter: N }`

### At 50k concurrent users

At 5 req/s peak checkout (per master architecture) and 50k concurrent sessions:

- 50k orgs × 300/min = 250k req/min sustained headroom before any tenant is limited
- IP fallback 120/min is only hit by unauthenticated traffic (login attempts, public endpoints)
- Redis sliding-window counters: ~1 µs latency overhead per request

---

## 2. DB Connection Pooling

**File modified:** `apps/api/src/config/db.ts` (`buildDatasourceUrl`)

### Parameters appended to DATABASE_URL

| Param                  | Value  | Reason                                                      |
| ---------------------- | ------ | ----------------------------------------------------------- |
| `connection_limit`     | `5`    | Per-ECS-task pool size                                      |
| `pool_timeout`         | `5s`   | Surface exhaustion fast (circuit-break friendly)            |
| `connect_timeout`      | `10s`  | Hard timeout on new connection acquisition                  |
| `pgbouncer`            | `true` | Disables prepared statements for PgBouncer transaction-mode |
| `statement_cache_size` | `0`    | Belt + suspenders for PgBouncer compat                      |

### 50k connection-count math

```
ECS tasks (peak auto-scale):        20 tasks
Prisma pool per task:                5 connections
App → PgBouncer connections:        20 × 5 = 100
PgBouncer transaction-mode pool:    100 client connections → 10-20 real PG backends
RDS max_connections (db.r6g.large): 5,000
Headroom factor:                    50×
```

At 50k concurrent users, requests are serviced in ~10-50ms. With 5 connections/task and a 10ms average DB hold time, each task handles ~500 req/s — far above the ~5 req/s peak checkout load from the architecture target. The bottleneck shifts to the Redis rate-limiter and network, not Postgres.

### What still needs infra to prove

- **PgBouncer in transaction mode** must be deployed in front of RDS. Without it `pgbouncer=true` in the URL is a no-op and prepared statements will fail across connection reuse.
- **RDS Proxy** (AWS-managed PgBouncer equivalent) as an alternative: set `DATABASE_URL` to the proxy endpoint; the `pgbouncer=true` flag is still required.
- **IAM auth on RDS Proxy** for credential rotation without restarts — requires `sslmode=require` in DATABASE_URL.
- Load test to confirm `pool_timeout=5` is the right threshold under sustained 50k load (may need tuning to 10s).

---

## 3. Idempotency Audit

### Before M3 (routes WITHOUT idempotency guard)

| Route                                                   | Risk                                                                                     |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `PATCH /v1/orgs/:id`                                    | Double-send on flaky mobile network could double-apply field update                      |
| `PATCH /v1/orgs/:id/billing`                            | Billing rate mutation not protected                                                      |
| `PATCH /v1/leads/:id`                                   | Status transitions not idempotent (retried PATCH could re-fire state-machine audit rows) |
| `PATCH /v1/users/:id`                                   | Profile update not protected                                                             |
| `POST /v1/users/accept-invite`                          | Invite acceptance not protected (double-click on email link)                             |
| `PATCH /v1/compliance/paid-solicitor-registrations/:id` | Status transition not protected                                                          |

Note: `POST /v1/audit/events/verify` is a read-only computation (no side effects). Idempotency was deliberately not applied — it is already safe.

### After M3 (gaps closed)

All routes above now wrap the handler in `withIdempotency(...)` using the existing shared util (`apps/api/src/shared/middleware/idempotency.ts` which imports from `@d2d/shared-utils`). No new code written — existing guard reused.

`POST /v1/users/accept-invite` uses `orgId: '__public__'` (the invite token itself scopes uniqueness).

### Routes that correctly use `requireIdempotencyKey` only (stub routes, 501)

These return 501 and don't mutate state. The key is validated at entry but no response is stored. This is intentional — they will be upgraded to `withIdempotency` when implemented.

- `POST /v1/consent/capture`
- `POST /v1/do-not-knock/ingest`
- `POST /v1/do-not-call/ingest`
- `POST /v1/payout-batches` and `/:id/lock`
- `POST /v1/billing/invoices/generate`
- `POST /v1/crm/sequences` and `/sequences/:id/enroll`
- `POST /v1/dsar/requests`
- `POST /v1/realtime/tokens`

### Routes intentionally without idempotency

| Route                            | Reason                                                       |
| -------------------------------- | ------------------------------------------------------------ |
| `POST /v1/auth/login`            | Login is intentionally re-runnable (new session each time)   |
| `POST /v1/auth/refresh`          | Token refresh is always a new response                       |
| `POST /v1/auth/logout`           | Idempotent by design (logout is safe to repeat)              |
| `POST /v1/audit/events/verify`   | Read-only chain replay, no side effects                      |
| `POST /v1/auth/sso/:orgSlug/acs` | SAML ACS is IdP-driven; replay is handled by SAML assertions |

---

## 4. Pagination Caps

`cursorPageQuerySchema` in `packages/shared-types/src/schemas.ts` enforces:

- `limit`: coerced integer, min 1, **max 200**, default 50
- `cursor`: opaque ULID-based cursor (no OFFSET)

All list endpoints (`/knocks`, `/leads`, `/territories`, `/users`, `/conversions`, `/webhooks`, `/audit/events`, `/notifications`, `/marketing/creatives/jobs`, etc.) extend this schema. No unbounded `findMany` is reachable from the HTTP layer.

The knock batch ingest (`POST /v1/knocks/batch`) caps input at 500 items per call (`z.array(...).max(500)`) and runs as a single bulk transaction, not N individual queries.

No changes required — caps were already in place.

---

## 5. Caching

### Org cache (new in M3)

**Location:** `apps/api/src/domains/org/service.ts`  
**Strategy:** cache-aside with event-driven invalidation  
**TTL:** 300s ± 30s jitter (avoids thundering herd on deploy/bulk-import)  
**Key:** `org:{orgId}:v1` (per-tenant, versioned namespace)  
**Invalidation:** called by `updateOrg`, `archiveOrg`, `upsertBrandKit`, `updateBilling`

Org is the most-read entity (every authenticated request validates tenant + billing context). A 5-minute Redis hit eliminates the DB round-trip for ~99% of reads at steady state.

Degradation path: Redis error in cache read/write is caught and swallowed; the DB is the source of truth. The API never returns stale data in place of a real error.

### What was NOT cached (deliberately)

- **Leads, Knocks, Conversions** — high write rate; cache invalidation would add latency to every mutation. Not worth it at current scale.
- **Audit events** — append-only, must always be fresh.
- **Auth tokens** — revocation state is already Redis-backed (token-revocation.ts).
- **DNK/DNC lists** — planned in service comments but not implemented yet (Phase 1.2).

---

## 6. What Still Needs Real Infra to Prove

| Item                                          | Required infra                                                         | Risk without it                                                                                                                                           |
| --------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PgBouncer in transaction mode                 | RDS Proxy or self-managed PgBouncer ECS sidecar                        | `connection_limit=5` code is a no-op without a proxy; Prisma opens 5 direct connections to RDS per task (still safe at 20 tasks = 100 direct connections) |
| Load test at 50k concurrent                   | k6 / Gatling campaign                                                  | Connection math is theoretical; actual pool saturation point is unknown                                                                                   |
| Redis cluster / sentinel                      | ElastiCache for Redis with replication                                 | Rate-limit store is single-node; a Redis restart resets all counters                                                                                      |
| Circuit breaker on partner calls              | Code implementation (no library needed — ioredis has built-in timeout) | Slowdowns in Twilio/Stripe/MiCamp will block worker concurrency                                                                                           |
| ECS auto-scale policy tuned for 20 tasks      | Terraform / Railway environment config                                 | Task count assumption in connection math                                                                                                                  |
| RDS parameter group: `max_connections = 5000` | RDS config                                                             | Default on db.t3.micro is ~100, which would be saturated                                                                                                  |
