# Railway environment variables — D2D services

> Reference for the variables each Railway service expects.
> Set these in the Railway dashboard (Variables tab) or via `railway variables --set`.

---

## `d2d-web-operator` (Next.js operator console)

Required for build:

| Variable              | Value (example)                  | Notes                                                                                                           |
| --------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `NODE_VERSION`        | `20.10.0`                        | Pinned in `Dockerfile.web-operator` (`ARG NODE_VERSION`).                                                       |
| `NEXT_PUBLIC_API_URL` | `https://d2d-api.up.railway.app` | Set this AFTER the API service has a URL. The CSP `connect-src` reads it at build time. Burned into the bundle. |
| `NEXT_PUBLIC_WS_URL`  | `wss://d2d-api.up.railway.app`   | Mirrors the API URL but with `wss://`.                                                                          |
| `NEXT_PUBLIC_ENV`     | `production`                     | Toggles env banner.                                                                                             |

Required at runtime:

| Variable   | Value                 | Notes                                                                |
| ---------- | --------------------- | -------------------------------------------------------------------- |
| `PORT`     | (auto-set by Railway) | The Dockerfile defaults to `3011`. Railway will inject its own port. |
| `HOSTNAME` | `0.0.0.0`             | Already set in the Dockerfile.                                       |

**Phase 0 demo path:** if the API isn't deployed yet, leave `NEXT_PUBLIC_API_URL` unset.
Every page renders from fixture data — the operator console works standalone.

---

## `d2d-api` (Fastify backend) — defer until web is live

Required:

| Variable                | Value                        | Notes                                                                                                                                                               |
| ----------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | `postgresql://...`           | Add the **Postgres** add-on in Railway → reference its connection string. Must have PostGIS — Railway's vanilla PG plugin does NOT. See "Postgres + PostGIS" below. |
| `REDIS_URL`             | `redis://...`                | Add the **Redis** add-on in Railway → reference its connection string.                                                                                              |
| `JWT_SECRET`            | 64-char hex                  | `openssl rand -hex 32`. Used to sign access + refresh tokens.                                                                                                       |
| `JWT_REFRESH_SECRET`    | 64-char hex                  | `openssl rand -hex 32`. Distinct from `JWT_SECRET`.                                                                                                                 |
| `PII_KMS_KEY`           | 32-byte base64               | `openssl rand -base64 32`. AES-256 wrapping key for the PII vault. Production: replace with a real AWS KMS key.                                                     |
| `PII_SIV_KEY`           | 32-byte base64               | `openssl rand -base64 32`. AES-SIV deterministic search key for blind-index lookups.                                                                                |
| `WEBHOOK_SECRET_PEPPER` | 32-char hex                  | `openssl rand -hex 16`. Adds entropy to per-endpoint HMAC secrets.                                                                                                  |
| `AUDIT_HASH_PEPPER`     | 32-char hex                  | `openssl rand -hex 16`. Mixed into the hash-chain so leaked rows can't be re-hashed by an attacker.                                                                 |
| `PORT`                  | (auto)                       | Defaults to `3010`.                                                                                                                                                 |
| `LOG_LEVEL`             | `info`                       | `trace`/`debug` are noisy in prod.                                                                                                                                  |
| `CORS_ORIGINS`          | `https://<web-operator URL>` | Comma-separated.                                                                                                                                                    |
| `NODE_ENV`              | `production`                 |                                                                                                                                                                     |

Phase 1.2+ (real integrations — add only when wiring real providers):

| Variable                                                                                         | Notes                                                |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_MESSAGING_SERVICE_SID`                      | SMS via Twilio.                                      |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`                                                    | Stripe AU/SG card-rail processor.                    |
| `MICAMP_API_KEY` / `MICAMP_MERCHANT_ID`                                                          | MiCamp gateway (US donations). Phase 0 prerequisite. |
| `GOOGLE_ADS_DEVELOPER_TOKEN` / `GOOGLE_ADS_CUSTOMER_ID`                                          | Marketing Studio Google Ads connector.               |
| `META_APP_ID` / `META_APP_SECRET` / `META_VERIFY_TOKEN`                                          | Marketing Studio Meta Ads connector + MCP.           |
| `TIKTOK_APP_ID` / `TIKTOK_APP_SECRET`                                                            | Marketing Studio TikTok connector.                   |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`                                                           | Content Studio copy generation.                      |
| `RUNWAY_API_KEY` / `HEYGEN_API_KEY` / `HIGGSFIELD_API_KEY` / `FLUX_API_KEY` / `IDEOGRAM_API_KEY` | Content Studio image/video generation.               |
| `S3_ENDPOINT` / `S3_BUCKET` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`                      | Creative asset storage.                              |

---

## Postgres + PostGIS on Railway

Railway's default Postgres add-on does NOT have PostGIS enabled. Options:

1. **Add the official Postgres plugin** in Railway → SSH into the instance → `psql $DATABASE_URL -c 'CREATE EXTENSION IF NOT EXISTS postgis;'`. Verify with `SELECT postgis_version();`.
2. **Self-host on a Railway "PostgreSQL" template** that ships with PostGIS — pick one from the templates marketplace tagged `postgis`.
3. **External Postgres** (Neon, Supabase, RDS) with PostGIS turned on — point `DATABASE_URL` at it.

After PostGIS is available:

```bash
railway run pnpm --filter api db:migrate
railway run pnpm --filter api db:seed   # optional — seeds the 4 demo accounts
```

---

## Generating secrets in one block (paste into terminal)

```bash
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"
echo "PII_KMS_KEY=$(openssl rand -base64 32)"
echo "PII_SIV_KEY=$(openssl rand -base64 32)"
echo "WEBHOOK_SECRET_PEPPER=$(openssl rand -hex 16)"
echo "AUDIT_HASH_PEPPER=$(openssl rand -hex 16)"
```

Pipe each line into `railway variables --set ...` or paste them into the dashboard.
