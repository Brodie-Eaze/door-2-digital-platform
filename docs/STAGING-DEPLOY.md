# Staging deploy runbook — Door 2 Digital on Railway

> Operator runbook for deploying the `staging` branch to a Railway **staging
> environment**. Deploy is a **gated, manual** action — nothing in this repo
> deploys itself. Follow top to bottom.
>
> Authoritative companions:
>
> - Env template: [`.env.staging.example`](../.env.staging.example) (real var
>   names, derived from `apps/api/src/config/env.ts`).
> - Per-service config-as-code: `infra/railway/staging/railway.api.toml`,
>   `infra/railway/staging/railway.web-operator.toml`.
>
> **Supersedes `docs/RAILWAY-ENV.md` for variable names.** That older doc lists
> `JWT_SECRET`, `WEBHOOK_SECRET_PEPPER`, `AUDIT_HASH_PEPPER` — those names are
> **stale** and the API will fail-fast at boot if you use them. The API actually
> requires `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_WS_TICKET_SECRET`,
> `PII_*`, `AUDIT_CHAIN_SECRET`, etc. Use the names in `.env.staging.example`.

---

## 0. The port contract (read first — this is why staging exists)

Locally the API and the operator console fought over **3010**. Staging fixes
this with a fixed, documented contract. Both apps read `PORT` from the
environment; Railway injects its own `PORT` at runtime, which overrides the
Dockerfile default. The defaults below govern local `docker run` and guarantee
the two services can never collide again.

| Service                    | App     | Deterministic port | Source of truth                                    |
| -------------------------- | ------- | ------------------ | -------------------------------------------------- |
| `d2d-api-staging`          | Fastify | **3010**           | `env.ts` Zod default `PORT=3010`; `Dockerfile.api` |
| `d2d-web-operator-staging` | Next.js | **3000**           | `Dockerfile.web-operator` `ENV PORT=3000`          |

Rules:

- **Never** set a `PORT` variable in the Railway dashboard. Railway injects it;
  a manual `PORT` will fight the injected value and the healthcheck will hang.
- The API binds `HOST=0.0.0.0`; web binds `HOSTNAME=0.0.0.0` (both set in their
  Dockerfiles) so Railway's edge can reach them.
- `web-operator` default moved from 3011 → **3000** in this work so it never
  defaults onto the API's 3010 again.

---

## 1. Staging service topology

Five Railway services live in one **staging environment** inside the D2D
Railway project:

```
                Railway project: door-2-digital   (environment: staging)
                ┌──────────────────────────────────────────────────────────┐
   internet ───▶│  d2d-web-operator-staging  (Next.js :3000)               │
                │      │  SSR ─────────────┐                                │
                │      │  /proxy/api/* ──┐ │                                │
                │      ▼                 │ │                                │
   internet ───▶│  d2d-api-staging  (Fastify :3010) ◀── CORS_ORIGINS       │
                │      │            │     │ │                                │
                │      ▼            ▼     ▼ ▼                                │
                │   Postgres     Redis   (both read by API; Postgres also   │
                │   (plugin)     (plugin) read by web-operator SSR)         │
                └──────────────────────────────────────────────────────────┘
   (optional)   d2d-workers-staging  (BullMQ; one service per WORKER_NAME)
```

| Service                    | Type             | Builds from               | Needs                                                                           |
| -------------------------- | ---------------- | ------------------------- | ------------------------------------------------------------------------------- |
| `d2d-api-staging`          | Dockerfile       | `Dockerfile.api`          | `DATABASE_URL`, `REDIS_URL`, all PII/JWT secrets, `S3_BUCKET_*`, `CORS_ORIGINS` |
| `d2d-web-operator-staging` | Dockerfile       | `Dockerfile.web-operator` | `NEXT_PUBLIC_*` (build), `DATABASE_URL` + 4 shared secrets (runtime)            |
| `Postgres`                 | Railway plugin   | —                         | **PostGIS extension enabled** (see §4)                                          |
| `Redis`                    | Railway plugin   | —                         | —                                                                               |
| `d2d-workers-staging`      | Dockerfile (opt) | `Dockerfile.workers`      | same secrets as API + `WORKER_NAME`, `CRON_LEADER=true` on one                  |

### Service-to-service references (Railway `${{ ... }}` reference variables)

Set these in the dashboard so URLs track the plugins/services automatically —
no copy-paste of hostnames:

| On service             | Variable              | Reference value                                                 |
| ---------------------- | --------------------- | --------------------------------------------------------------- |
| api                    | `DATABASE_URL`        | `${{ Postgres.DATABASE_URL }}`                                  |
| api                    | `REDIS_URL`           | `${{ Redis.REDIS_URL }}`                                        |
| api                    | `CORS_ORIGINS`        | `https://${{ d2d-web-operator-staging.RAILWAY_PUBLIC_DOMAIN }}` |
| api                    | `API_BASE_URL`        | `https://${{ RAILWAY_PUBLIC_DOMAIN }}`                          |
| api                    | `SAML_SP_BASE_URL`    | `https://${{ RAILWAY_PUBLIC_DOMAIN }}`                          |
| web-operator (build)   | `NEXT_PUBLIC_API_URL` | `https://${{ d2d-api-staging.RAILWAY_PUBLIC_DOMAIN }}`          |
| web-operator (build)   | `NEXT_PUBLIC_WS_URL`  | `wss://${{ d2d-api-staging.RAILWAY_PUBLIC_DOMAIN }}`            |
| web-operator (runtime) | `DATABASE_URL`        | `${{ Postgres.DATABASE_URL }}`                                  |

> **web-operator is NOT just a thin client.** It renders pages server-side
> directly against Postgres via `@d2d/database`, and `db-helpers.ts` throws at
> runtime if `AUDIT_CHAIN_SECRET` is missing/short. So the web service needs
> `DATABASE_URL` + `JWT_ACCESS_SECRET` (or `SESSION_COOKIE_SECRET`) +
> `AUDIT_CHAIN_SECRET` + `PII_SEARCH_KEY` at runtime — all the **same values**
> as the API. See `.env.staging.example` (web section).

> **`NEXT_PUBLIC_*` are build-time.** They are burned into the Next bundle and
> read by the CSP `connect-src` and the `/proxy/api/*` rewrite. Set them as
> Railway **build** variables before the image builds. Changing them needs a
> **rebuild**, not just a redeploy.

---

## 2. One-time setup (first staging bring-up)

```bash
# 0. Auth + link the project (run from repo root)
railway login
railway link                 # pick the door-2-digital project

# 1. Create / select the staging environment
railway environment new staging   # or: railway environment staging  (if it exists)

# 2. Add managed plugins to the staging environment (dashboard is fine too)
railway add --plugin postgresql
railway add --plugin redis

# 3. Create the two app services pointed at this repo + branch `staging`.
#    Easiest in the dashboard: New Service → GitHub repo → branch=staging.
#    Then, per service: Settings → Config-as-Code → set the path:
#      d2d-api-staging          -> infra/railway/staging/railway.api.toml
#      d2d-web-operator-staging -> infra/railway/staging/railway.web-operator.toml
#    (Each toml pins the Dockerfile, start command, and healthcheck.)
```

---

## 3. Set environment variables

Generate the secret block once and paste into Railway (dashboard Variables, or
the CLI below). **Web-operator must reuse the SAME values** for the four shared
secrets.

```bash
# Generate secrets (DO NOT commit the output)
echo "PII_ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo "KMS_DEV_SECRET=$(openssl rand -hex 32)"
echo "PII_HASH_SECRET=$(openssl rand -hex 32)"
echo "PII_SEARCH_KEY=$(openssl rand -hex 32)"
echo "AUDIT_CHAIN_SECRET=$(openssl rand -hex 32)"
echo "PII_KMS_KEY=$(openssl rand -base64 32)"
echo "PII_SIV_KEY=$(openssl rand -base64 32)"
echo "JWT_ACCESS_SECRET=$(openssl rand -hex 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"
echo "JWT_WS_TICKET_SECRET=$(openssl rand -hex 32)"
echo "CSRF_SIGNING_SECRET=$(openssl rand -hex 32)"
echo "OAUTH_STATE_SECRET=$(openssl rand -hex 32)"
echo "MFA_STEP_UP_SECRET=$(openssl rand -hex 32)"
echo "API_TOKEN_HASH_SECRET=$(openssl rand -hex 32)"
```

Set them per service (example for the API; `--set` repeatable):

```bash
railway variables --service d2d-api-staging \
  --set "NODE_ENV=production" \
  --set "LOG_LEVEL=info" \
  --set "AWS_REGION=us-east-1" \
  --set "DATABASE_URL=\${{ Postgres.DATABASE_URL }}" \
  --set "REDIS_URL=\${{ Redis.REDIS_URL }}" \
  --set "CORS_ORIGINS=https://\${{ d2d-web-operator-staging.RAILWAY_PUBLIC_DOMAIN }}" \
  --set "API_BASE_URL=https://\${{ RAILWAY_PUBLIC_DOMAIN }}" \
  --set "SAML_SP_BASE_URL=https://\${{ RAILWAY_PUBLIC_DOMAIN }}" \
  --set "S3_BUCKET_AUDIT=d2d-audit-us-east-1-staging" \
  --set "S3_BUCKET_ASSETS=d2d-assets-us-east-1-staging" \
  --set "S3_BUCKET_EXPORTS=d2d-exports-us-east-1-staging" \
  --set "D2D_PAYMENT_SANDBOX=true"
  # ...plus every secret from the openssl block above.
```

```bash
railway variables --service d2d-web-operator-staging \
  --set "NODE_ENV=production" \
  --set "NEXT_PUBLIC_API_URL=https://\${{ d2d-api-staging.RAILWAY_PUBLIC_DOMAIN }}" \
  --set "NEXT_PUBLIC_WS_URL=wss://\${{ d2d-api-staging.RAILWAY_PUBLIC_DOMAIN }}" \
  --set "NEXT_PUBLIC_ENV=staging" \
  --set "DATABASE_URL=\${{ Postgres.DATABASE_URL }}"
  # ...plus JWT_ACCESS_SECRET, AUDIT_CHAIN_SECRET, PII_SEARCH_KEY
  #    set to the SAME values you used on the API service.
```

Full list (required vs optional, with length rules) is in
[`.env.staging.example`](../.env.staging.example). The OPTIONAL block (MiCamp,
Stripe, Snowflake, Planet, SSO, ad-networks) can stay blank in staging — the
API boots without them.

---

## 4. PostGIS extension (required before migrate)

Railway's vanilla Postgres plugin does **not** ship PostGIS. The schema needs
it (territory polygons / geo). Enable it once:

```bash
# Connect to the staging Postgres and enable the extension
railway connect Postgres        # opens psql against the plugin
# then in psql:
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT postgis_version();        # verify — should print a version, not error
\q
```

If the plugin image lacks PostGIS entirely, point `DATABASE_URL` at an external
Postgres that has it (Neon / Supabase / RDS) instead of the Railway plugin.

---

## 5. Deploy the `staging` branch

```bash
# from repo root, on branch `staging`, working tree clean
git status                       # confirm you're on staging

# Deploy each service (build from the linked Dockerfile + config-as-code)
railway up --service d2d-api-staging --detach
railway up --service d2d-web-operator-staging --detach
```

Deploy **API first**, confirm it is healthy (§7), then web-operator — because
the web build bakes in `NEXT_PUBLIC_API_URL` and its SSR/runtime needs the API

- DB reachable.

> If you connected the services to GitHub with branch=`staging`, a push to
> `staging` auto-builds. `railway up` is the manual/gated path and is preferred
> for a controlled staging cut.

---

## 6. Migrate + seed

```bash
# Run migrations against staging Postgres (deploy = no schema drift, prod-safe)
railway run --service d2d-api-staging pnpm --filter api db:migrate
# (db:migrate -> prisma migrate deploy)

# Seed the demo tenants/users so login works. NOTE: the api `db:seed` script
# points at a non-existent prisma/seed.ts — run the REAL seed scripts directly.
# Passwords are supplied at runtime and never written to disk.
TENANT_SEED_PASSWORD='<choose-a-staging-password>' \
  railway run --service d2d-api-staging pnpm --filter api exec tsx prisma/seed-tenants.ts

# (optional) extra demo orgs/users + leads for a fuller console:
railway run --service d2d-api-staging pnpm --filter api exec tsx prisma/seed-demo.ts
railway run --service d2d-api-staging pnpm --filter api exec tsx prisma/seed-demo-leads.ts

# (optional) the iOS Knocker login user (knocker@d2d.io):
KNOCKER_SEED_PASSWORD='<choose-a-staging-password>' \
  railway run --service d2d-api-staging pnpm --filter api exec tsx prisma/seed-knocker.ts
```

Seeded login identities (from `prisma/seed-tenants.ts`):

- `mgr-hope@d2d.io` (manager, org `hope-forward`)
- `rep-hope@d2d.io` (knocker, org `hope-forward`)
- `mgr-pest@d2d.io`, `rep-pest@d2d.io` (org `pestmax`)
- `knocker@d2d.io` (from `seed-knocker.ts`, used by the iOS app)

All use the password you passed in `TENANT_SEED_PASSWORD` /
`KNOCKER_SEED_PASSWORD`.

---

## 7. Smoke test

```bash
API=https://<d2d-api-staging public domain>
WEB=https://<d2d-web-operator-staging public domain>

# 7a. API liveness (no DB) — expect 200 {"status":"ok","service":"d2d-api"}
curl -fsS "$API/v1/healthz" | jq .

# 7b. API readiness (DB + Redis) — expect 200 {"status":"ready","checks":{db:ok,redis:ok}}
curl -fsS "$API/v1/readyz" | jq .

# 7c. Login round-trip (uses a seeded user)
curl -fsS -X POST "$API/v1/auth/login" \
  -H 'content-type: application/json' \
  -d '{"email":"mgr-hope@d2d.io","password":"<the-seed-password>"}' -i | head -20
#    Expect 200 + a Set-Cookie / access token. 401 = wrong password or not seeded.

# 7d. Web operator console renders + can reach the API
curl -fsS "$WEB/login" -o /dev/null -w "%{http_code}\n"    # expect 200
#    Then in a browser: log in at $WEB/login with a seeded user. A successful
#    login proves NEXT_PUBLIC_API_URL + CORS_ORIGINS + the /proxy/api rewrite
#    are all wired correctly.
```

---

## 8. Verify the promotion actually landed (Railway stale-build gotcha)

> **Known Railway/Nixpacks trap:** a build can silently fail or a redeploy can
> keep serving the OLD image while still returning HTTP 200. **Do not** trust a
> 200 alone — verify the bytes changed.

For **web-operator** (Next.js), the deterministic signal is a **changed static
chunk hash**:

```bash
WEB=https://<d2d-web-operator-staging public domain>

# Before deploy: capture the current chunk fingerprint
curl -fsS "$WEB/login" | grep -oE '/_next/static/[^"]+\.js' | sort -u > /tmp/web_before.txt

# ...deploy...

# After deploy: capture again and diff. A real promotion = the set changed.
curl -fsS "$WEB/login" | grep -oE '/_next/static/[^"]+\.js' | sort -u > /tmp/web_after.txt
diff /tmp/web_before.txt /tmp/web_after.txt && echo "STALE — same chunks, promotion did NOT land" || echo "OK — chunks changed, new build is live"
```

For the **API**, verify the deploy id / commit rather than just health:

```bash
railway status --service d2d-api-staging        # confirm latest deployment is ACTIVE + matches your commit
railway logs --service d2d-api-staging | tail    # confirm boot logs are from this deploy (no env-validation crash loop)
```

If chunks did not change or `railway status` shows an older active deployment,
the promotion did not land — re-trigger `railway up`, check build logs, and
confirm no `tsconfig.tsbuildinfo` / stale-cache issue blocked the build.

---

## 9. Rollback

Railway keeps prior deployments. To roll back:

```bash
railway deployments --service d2d-api-staging        # list deploy ids
railway redeploy --service d2d-api-staging <previous-deployment-id>
# repeat for d2d-web-operator-staging if needed
```

Rollback is a **redeploy of a previous immutable build**, not a rebuild. After
rollback, re-run the §8 verification to confirm the chunk hashes match the
known-good build. If a migration was part of the bad deploy, assess whether it
is backward-compatible before rolling the API back — `prisma migrate deploy` is
forward-only; a destructive migration needs a manual down-path.

---

## 10. Quick reference — env vars by requirement

**REQUIRED for staging (API boots/crashes on these):** `DATABASE_URL`,
`REDIS_URL`, `PII_ENCRYPTION_KEY`, `PII_HASH_SECRET`, `PII_SEARCH_KEY`,
`AUDIT_CHAIN_SECRET`, `PII_KMS_KEY`, `PII_SIV_KEY`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `JWT_WS_TICKET_SECRET`, `CSRF_SIGNING_SECRET`,
`OAUTH_STATE_SECRET`, `MFA_STEP_UP_SECRET`, `API_TOKEN_HASH_SECRET`,
`S3_BUCKET_AUDIT`, `S3_BUCKET_ASSETS`, `S3_BUCKET_EXPORTS`, and
`CORS_ORIGINS` (must be a real https origin, not localhost, when
`NODE_ENV=production`).

**REQUIRED for web-operator:** `NEXT_PUBLIC_API_URL` + `NEXT_PUBLIC_WS_URL`
(build-time), `NEXT_PUBLIC_ENV`, `DATABASE_URL`, `JWT_ACCESS_SECRET` (or
`SESSION_COOKIE_SECRET`), `AUDIT_CHAIN_SECRET`, `PII_SEARCH_KEY` (runtime).

**Has a safe default — leave unset:** `NODE_ENV`, `LOG_LEVEL`, `AWS_REGION`,
`PORT` (Railway-injected), `HOST`/`HOSTNAME`, `COGNITO_REGION`,
`WEBAUTHN_RP_ID`/`WEBAUTHN_ORIGIN` (set to the staging host for real WebAuthn).

**OPTIONAL — needs real credentials before PROD (leave blank in staging):**
`AWS_KMS_KEY_ARN`, `MICAMP_*`, `STRIPE_*`, `TWILIO_*`, `RESEND_API_KEY`,
`MAPBOX_TOKEN`, `ABLY_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
`REPLICATE_API_TOKEN`, `RUNWAY_API_KEY`, `SNOWFLAKE_*`, `PLANET_*`,
`COGNITO_*`, `OKTA_SAML_METADATA_URL`, `SENTRY_DSN`, `DATADOG_API_KEY`,
`OTEL_EXPORTER_OTLP_ENDPOINT`, `PAGERDUTY_INTEGRATION_KEY`.
