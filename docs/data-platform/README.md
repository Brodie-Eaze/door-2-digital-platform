# Door 2 Digital — Data Platform (for Data Scientists & ML Engineers)

Door 2 Digital is a **data company**. The Knocker iOS app is the field capture device;
the platform maps areas, scores neighbourhoods, holds every artifact, and exposes
clean read/write surfaces so a DS/ML team can plug in without touching OLTP.

This guide is the contract: what's captured, where it lives, how to read it, how to
write models back, and where the honest scaffolding ends.

> Multi-tenant rule for everything below: every row carries `orgId` (a tenant =
> a charity or business). All app-facing reads/writes are scoped to the caller's
> org from the JWT. The warehouse export is per-org. There is **no cross-tenant
> read path** on any surface here.

---

## 1. The capture model — what lands, and from where

| Table                             | Purpose                            | Written by                            | Key columns                                                                           | PII           | Tenancy                 |
| --------------------------------- | ---------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------- | ------------- | ----------------------- |
| `Knock`                           | One door interaction               | App → `POST /v1/knocks/batch`         | `disposition`, `geo`, `capturedAt`, `territoryId`, `idempotencyKey`                   | `notes`       | `orgId`                 |
| `KnockSession`                    | A clock-in shift session           | App roster clock-in/out               | `startedAt`, `endedAt`, `territoryId`, `deviceId`, `attestationToken`                 | —             | `orgId`                 |
| `Lead`                            | A captured prospect                | App / inside-sales                    | `givenName/familyName/email/phone` (vaulted), `emailDigest`, `status`                 | yes (vault)   | `orgId`                 |
| `Conversion` (+`Donation`/`Sale`) | A signed donation/sale             | `POST /v1/field/signups`              | `amountCents`, `attributionSource`, `type`, `knockerId`                               | —             | `orgId`                 |
| `ConsentRecord`                   | Door-step consent proof            | field sign-up                         | `channel='door'`, `granted`, `proofKey` (signature)                                   | —             | `orgId`                 |
| **`KnockPhoto`**                  | Property photo per knock           | `POST /v1/photos`                     | `storageKey`, `capturedAt`, `lat/lng`, `clientKnockId`, **`mlLabels`**                | `addressLine` | `orgId`                 |
| **`PropensityScore`**             | Neighbourhood propensity           | **ML →** `POST /v1/propensity/scores` | `geoType/geoKey`, `centroidLat/Lng`, `score`, `band`, `modelName/Version`, `features` | —             | `orgId` (null = global) |
| **`VoiceRecording`**              | Door-conversation audio (scaffold) | `POST /v1/voice` (gated off)          | `storageKey`, `durationMs`, `consentObtained`, **`transcript`**, **`analysis`**       | `transcript`  | `orgId`                 |
| **`AnalyticsEvent`**              | Append-only warehouse outbox       | platform (backfill + future inline)   | `eventType`, `entityType/Id`, `occurredAt`, `payload` (flat), `shippedAt`             | —             | `orgId`                 |

Bold tables + columns are the new data-company layer; the bold columns
(`mlLabels`, `score`/`features`, `transcript`/`analysis`) are **written by you**.

---

## 2. ML I/O surfaces

### 2.1 Propensity — the read+write loop that powers the map

The manager sets a canvass **area** (polygon or center+radius) informed by
neighbourhood propensity. You produce that propensity.

- **Read context** to build features: `GET /v1/analytics/export` (knock outcomes,
  conversions — see §3), `GET /v1/photos` (+ `/:id/raw`).
- **Write scores back** (batch upsert, ≤1000/call):
  ```
  POST /v1/propensity/scores            # role: org_admin/super_admin (or an ml-service key in prod)
  Idempotency-Key: <uuid>
  { "modelName":"propensity-v1", "modelVersion":"2026.06", "global": false,
    "scores": [ { "geoType":"h3", "geoKey":"8a2a1072b59ffff",
                  "centroidLat":30.287, "centroidLng":-97.715,
                  "score":0.82, "band":"high", "features": { ... } } ] }
  ```
  Upsert key = `(orgId, geoType, geoKey)`. `band` is derived if omitted
  (≥0.66 high, ≥0.33 medium, else low). `global:true` (super_admin) writes
  `orgId=null` shared-model rows visible to every tenant.
- **Platform reads** them for the heatmap + area-setting:
  `GET /v1/propensity?bbox=minLng,minLat,maxLng,maxLat&geoType=h3&band=high`
  and the compact `GET /v1/propensity/heatmap?bbox=...` → `[{lat,lng,score,band}]`.
  Visibility = your org's rows **OR** global rows. Never another tenant's.

### 2.2 Photo annotation — computer vision on properties

- List/fetch: `GET /v1/photos?knockId=...` (metadata) → `GET /v1/photos/:id/raw` (bytes).
- Write annotations back to `KnockPhoto.mlLabels` (JSON — e.g.
  `{ "houseType":"single_family", "condition":"well_kept", "hasGate":true }`)
  and stamp `mlProcessedAt`. (Write path: a service/ML job against the DB or a
  future `PATCH /v1/photos/:id/labels` — currently DB-direct.)

### 2.3 Conversation intelligence — voice (SCAFFOLD, gated OFF)

- `VoiceRecording` captures door audio → you transcribe into `transcript` and
  write `analysis` (sentiment, objections, outcome signals) + `processedAt`.
- ⚠️ **Disabled by default.** `POST /v1/voice` returns `403 voice-capture-disabled`
  unless `D2D_VOICE_ENABLED=true`, and `422 voice-consent-required` unless the
  request carries `consentObtained=true`. **Many US states require all-party
  consent to record — this needs counsel sign-off + per-state config before it is
  ever enabled.** Build your pipeline against the schema now; do not flip the flag
  without legal.

---

## 3. The warehouse path — `AnalyticsEvent` outbox

Every field action mirrors into one flat, append-only table so you can load a
warehouse (BigQuery / Snowflake) + model in dbt without reading OLTP.

- **Backfill existing data:** `pnpm tsx apps/api/prisma/backfill-analytics.ts`
  derives `knock` / `sale` / `session_start` / `session_end` events from
  `Knock` / `Conversion` / `KnockSession` (idempotent; safe to re-run).
- **Drain (at-least-once sink):**
  ```
  GET /v1/analytics/export            # role: super_admin/org_admin/manager/auditor
  → NDJSON, one event per line; marks each returned row shippedAt=now() in a tx
  ```
  Re-delivery is safe because warehouse loads should `MERGE`/upsert on `id`.
  A loader loops until the body is empty. Example row:
  ```json
  {
    "id": "aev_...",
    "orgId": "org_demo_hope_forward",
    "userId": "usr_...",
    "eventType": "sale",
    "entityType": "Conversion",
    "entityId": "cnv_...",
    "occurredAt": "2026-06-14T00:46:02Z",
    "payload": { "amountCents": 4000, "attributionSource": "door", "type": "donation_recurring" },
    "shippedAt": "..."
  }
  ```
- **Browse (no shipping):** `GET /v1/analytics/events?eventType=sale&since=...&limit=500`.

Suggested dbt staging model over the stream:

```sql
-- models/staging/stg_knock_events.sql
select
  id as event_id, org_id, user_id, event_type,
  entity_type, entity_id, occurred_at,
  (payload->>'amountCents')::bigint as amount_cents,
  payload->>'attributionSource'    as attribution_source,
  payload->>'disposition'          as disposition
from {{ source('d2d_raw', 'analytics_events') }}
```

---

## 4. The propensity loop (the flywheel)

```
   Knocks + outcomes (AnalyticsEvent)        Property photos (KnockPhoto)
   Conversions ($, attribution)              [+ future voice/analysis]
                 │                                      │
                 └──────────────┬───────────────────────┘
                                ▼
                     Feature engineering (your warehouse / feature store)
                                ▼
                     Propensity model  ──►  POST /v1/propensity/scores
                                ▼
              PropensityScore (orgId | global, geoKey, score, band)
                                ▼
        GET /v1/propensity/heatmap   ──►   Platform heatmap overlay
                                ▼
        Manager sets the canvass AREA (polygon | center+radius) informed by it
                                ▼
        Area pushed to the rep's Knocker iOS map  ──►  more knocks  ──►  (loop)
```

The app pushes the **area**, never individual house targets — D2D has no
per-house target data, and that is by design. Better areas come from better
scores; better scores come from more field data. That's the moat.

---

## 5. Honest gaps (what's scaffold vs production)

- **Blob storage** — photos/voice are written to a local `.blobstore/` dir in dev.
  Production swaps the `BlobStore`/`LocalBlobStore` seam to **S3 presigned PUT/GET**
  (keys are already `org/<orgId>/...`-prefixed). KMS-SSE + per-region buckets per
  the residency model.
- **RLS belt** — the new tables (`KnockPhoto`, `PropensityScore`, `VoiceRecording`,
  `AnalyticsEvent`, plus `ServiceOffering`) are isolated by **explicit app-layer
  `orgId` filters** (verified, no cross-tenant leak) but are **not yet in the
  Postgres RLS belt** (SEC-005). Add `tenant_isolation` policies + run reads inside
  `tenantTx` to get the DB-level second belt the rest of the platform has. Tracked.
- **`emitAnalyticsEvent`** exists but is **not yet wired inline** into knock /
  conversion / session / photo writes — the stream is populated via the backfill
  for now. Wiring the inline emits (inside each domain's `tenantTx`) makes the
  stream real-time. Assert `input.orgId === tx GUC org` when you wire it.
- **Voice** — capture path built but **flag-disabled pending legal**. No audio is
  collected until `D2D_VOICE_ENABLED=true` + per-state all-party-consent config.
- **PostGIS** — geometry columns are TEXT placeholders (WKT polygon / "lng lat"
  centroid) in dev; a follow-up migration enables PostGIS + real `geography` types
  for spatial queries + H3 covering.
- **Comment drift** — a few new service files say reads use the "tenant-scoped
  `prisma()` extension"; they actually use raw `prisma()` + an explicit `orgId`
  filter (correct, same as `catalog`). Don't drop the explicit filter trusting an
  auto-scope that isn't there until RLS lands.

---

_Generated as part of the data-company backend build. Every claim here is wired +
live-verified against the dev API except the items called out in §5._
