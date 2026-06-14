# Observability + SLO Design — D2D Platform

> **Owner:** Brodie · **Updated:** 2026-06-05
> **Stack:** Pino structured logs, OpenTelemetry traces, Datadog APM + logs + RUM (prod), Jaeger (local), Prometheus + Grafana metrics, PagerDuty alerts
> **Reference:** Architecture §11, `libs/observability/`, `docs/50k/HARDENING-LOG.md`

---

## 1. The four golden signals — required for every service

Every `apps/api`, `apps/workers`, `apps/webhooks` service tracks all four. Non-negotiable.

| Signal         | What we measure                                                                                        | Tool                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| **Traffic**    | Requests/second by route; BullMQ job intake rate by queue                                              | Pino request log → Datadog metric `d2d.http.requests` `d2d.queue.intake` |
| **Errors**     | HTTP 4xx/5xx rate by route + status code + error type; job failure rate by queue                       | Pino `level:error` → `d2d.http.errors`, `d2d.queue.errors`               |
| **Latency**    | p50/p95/p99 per route; job processing time per queue                                                   | OTel histogram → `d2d.http.duration_ms`, `d2d.queue.processing_ms`       |
| **Saturation** | CPU + memory per ECS task; Aurora connections / max; Redis memory % used; BullMQ queue depth per queue | CloudWatch → Datadog `d2d.infra.*`                                       |

### Cardinality rules

| Allowed label | Rationale                                                                                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `service`     | Bounded: api / workers / webhooks / operator-console / org-console                                                                                   |
| `region_code` | Bounded: us / au / sg                                                                                                                                |
| `route`       | Bounded: normalised route template (`/v1/knocks` not `/v1/knocks/01J…`)                                                                              |
| `status_code` | Bounded: HTTP status codes                                                                                                                           |
| `error_type`  | Bounded: application error enum from `shared-types`                                                                                                  |
| `queue`       | Bounded: queue names from architecture §12                                                                                                           |
| `org_id`      | Allowed only if the org count remains ≤500 and the label is behind a feature flag. **Default: OFF. Do not enable without cardinality budget check.** |

**Never use as a metric label:** `user_id`, `knock_id`, `conversion_id`, `lead_id`, `request_id`, `trace_id`. These are unbounded and will destroy the metrics store.

---

## 2. SLO definitions

### SLO 1 — Knock-sync success rate (mobile → API)

| Attribute        | Value                                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Service          | `POST /v1/knocks` and `POST /v1/knocks/batch`                                                                                                  |
| SLI              | Percentage of knock-sync requests that return HTTP 2xx over a 30-day rolling window                                                            |
| Target           | **≥ 99.5%**                                                                                                                                    |
| Error budget     | 0.5% = ~216 minutes of total failure-equivalent per 30 days                                                                                    |
| Rationale        | Knockers lose work if sync fails; but the mobile app queues offline, so a brief outage doesn't lose data — it delays it. 99.5% is appropriate. |
| Burn-rate alerts | Fast: 1h window, 14× burn rate → PagerDuty P1. Slow: 6h window, 6× burn rate → PagerDuty P1. Moderate: 24h window, 3× burn rate → Slack notify |

**Measurement:** `d2d.http.requests{route="/v1/knocks",status_code!~"2.."}.rate / d2d.http.requests{route="/v1/knocks"}.rate` over 30d rolling window.

**Known risk:** The `AUDIT-CHAIN-SERIALIZATION` issue can serialise knock writes per org, causing timeout 5xx under load. This directly impacts this SLO. Fix is queued in `HARDENING-LOG.md`.

---

### SLO 2 — Lead-capture latency P95

| Attribute        | Value                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| Service          | `POST /v1/leads`, `POST /v1/knocks` (knock creates or updates a lead)                                 |
| SLI              | 95th-percentile response latency for lead-creating requests                                           |
| Target           | **< 2 seconds**                                                                                       |
| Error budget     | 5% of lead-capture requests exceeding 2s per 30-day window is the alerting threshold                  |
| Rationale        | Knockers are standing at a door. A 2s tap-to-confirmation is the limit of acceptable UX in the field. |
| Burn-rate alerts | P95 sustained >2s for 10 min → PagerDuty P1. P95 sustained >4s for 5 min → PagerDuty P0.              |

**Measurement:** OTel span `services/knock:createKnock` + `services/lead:createLead` p95 duration, sampled at 100% for these routes. `d2d.http.duration_ms{route="/v1/knocks", quantile="0.95"}`.

**Known risk:** `HEATMAP-N+1` and `LEAD-ROUTING` unbounded query patterns can cause latency spikes. Both are fixed or queued in batch-2/batch-3 PRs.

---

### SLO 3 — Payout-instruction generation P95

| Attribute        | Value                                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Service          | BullMQ `payout-prepare` queue job duration                                                                                    |
| SLI              | 95th-percentile time from job enqueue to `PayoutBatch.status = 'ready_to_pay'`                                                |
| Target           | **< 60 seconds**                                                                                                              |
| Error budget     | 5% of payout batches taking >60s per 30-day window                                                                            |
| Rationale        | This is a background job run fortnightly/monthly; 60s is generous but the file must be ready within Brodie's working session. |
| Burn-rate alerts | P95 sustained >60s for 2 consecutive runs → Slack notify (P2). >60s for 3 consecutive runs → PagerDuty P1.                    |

**Measurement:** `d2d.queue.processing_ms{queue="payout-prepare", quantile="0.95"}`.

---

### SLO 4 — API availability (per region)

| Attribute        | Value                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| Service          | `apps/api` per-region healthcheck endpoint `GET /v1/healthz`                                                       |
| SLI              | Percentage of synthetic uptime probe checks returning HTTP 200 over 30 days                                        |
| Target           | **99.9%** per region                                                                                               |
| Error budget     | 0.1% = ~43 minutes per 30-day period                                                                               |
| Rationale        | Standard SaaS availability target. Revenue-critical operations (conversion finalisation) have their own SLO above. |
| Burn-rate alerts | Fast: 1h window, 14× burn → PagerDuty P0. Slow: 6h window, 6× burn → PagerDuty P0.                                 |
| Probe frequency  | Every 60s from Datadog Synthetics or CloudWatch Synthetics per region                                              |

---

### SLO 5 — Audit chain integrity

| Attribute    | Value                                                                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Service      | `services/audit`, `apps/workers` (audit-ship cron), S3 Object Lock audit bucket                                                           |
| SLI          | Binary: weekly Merkle root verification passes (1) or fails (0)                                                                           |
| Target       | **100%** — zero mismatches                                                                                                                |
| Error budget | Zero. Any mismatch pages immediately.                                                                                                     |
| Rationale    | SOC 2 CC7/CC9. A hash chain break is either a bug or tampering; both require immediate investigation.                                     |
| Alert        | CI `audit-verify` job failure → PagerDuty P0 within 5 min of job completion. Metric `d2d.audit.chain_valid{region}` = 0 → immediate page. |

---

## 3. Default dashboard per service

Every service exposes a Datadog dashboard with these panels. This is the "golden signals for every service" non-negotiable.

```
Panel row 1 — Traffic
  - Requests/sec by route (line chart, last 1h)
  - BullMQ job intake rate by queue (line chart)

Panel row 2 — Errors
  - HTTP error rate % by status code bucket (4xx, 5xx)
  - Queue job failure rate by queue
  - Error count by error_type (top 10 table)

Panel row 3 — Latency
  - P50 / P95 / P99 per route (line chart with threshold markers at SLO targets)
  - Queue processing time P95 by queue

Panel row 4 — Saturation
  - ECS CPU % per task (all replicas)
  - ECS memory % per task
  - Aurora: active connections / max connections
  - Aurora: CPU utilization
  - Redis: memory used %
  - Redis: connected clients
  - BullMQ: queue depth per queue (bar chart — spike = queue backlog)

Panel row 5 — SLO status
  - SLO burn rate for each of the 5 SLOs above
  - Error budget remaining (% and minutes)

Panel row 6 — Business signals
  - Knock sync success rate (last 1h, 24h)
  - Conversion finalisation success rate
  - Payout batches ready (count per day)
  - Audit chain verification: last result (green/red)
```

---

## 4. Structured logging — Pino configuration

**Format:** JSON only. No string log lines in production. Pino's `redact` plugin in `libs/observability/src/logger.ts` applies PII redaction before any log leaves the process.

### Required fields on every log line

```json
{
  "level": "info",
  "time": "2026-06-05T10:00:00.000Z",
  "service": "api",
  "region": "us",
  "message": "knock synced",
  "trace_id": "01J...",
  "request_id": "01J...",
  "org_id": "01J..."
}
```

### Business-context fields (add when available)

```json
{
  "user_id": "01J...",
  "knock_id": "01J...",
  "conversion_id": "01J...",
  "queue_name": "conversion-finalise",
  "job_id": "01J..."
}
```

### Log levels

| Level   | When to use                                                                                                                   |
| ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `ERROR` | A request or job failed in a way that requires human attention now. Must include `err.message`, `err.stack`, `trace_id`.      |
| `WARN`  | Recoverable condition; degraded path taken. Humans may care.                                                                  |
| `INFO`  | Audit trail. Every significant state change: knock synced, conversion finalised, payout batch generated, audit chain shipped. |
| `DEBUG` | Development only. `LOG_LEVEL=info` in production — debug lines never reach production logs.                                   |

### PII redaction rules (enforced by Pino `redact` in `libs/observability`)

Fields that must never appear in logs:

- `email`, `phone`, `givenName`, `familyName`, `address` (and nested variants)
- `password`, `token`, `secret`, `apiKey`, `authToken`
- `cardNumber`, `cvv`, `bankAccountNumber`, `routingNumber`
- `signatureKey`, `photoKey` (S3 key paths that could imply PII content)

If a field in this list appears in any log line (even in an error stack trace), the `redact` plugin replaces the value with `[REDACTED]`. Do not work around this in error handlers. If you need to log that an error involved a specific user, log the `user_id` (opaque identifier), never the plaintext PII field.

**Known open issue:** `Donation.donorEmail` is stored plaintext on the `Donation` row (F-004 in `HARDENING-LOG.md`). Until this is fixed, the PII redact covers `donorEmail` as a field name in logs. Any log that includes a `Donation` row dump will have `donorEmail` redacted.

---

## 5. OpenTelemetry tracing — configuration

**Tracer:** `@opentelemetry/sdk-node` configured in `libs/observability/src/tracer.ts`. Exporter: OTLP → Jaeger (local `docker-compose`), Datadog APM (prod via `dd-trace` OTLP receiver).

### Context propagation

| Transport                           | Propagation mechanism                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| HTTP (service-to-service, external) | W3C `traceparent` + `tracestate` headers                                                    |
| BullMQ job data                     | `traceContext` field in job data payload (deserialise with `context.extract` in the worker) |
| Webhook delivery                    | `X-Trace-Id` header on outbound; inbound `traceparent` from providers that support it       |
| Ably realtime                       | Not traced (fire-and-forget channel publish; only the publish call itself is spanned)       |

### Required spans

Every hot path must have spans:

| Operation                                                      | Span name                                                           | Key attributes                                                                               |
| -------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Every Aurora query                                             | `db.query` (auto via Prisma OTel plugin)                            | `db.statement` (truncated, no PII values), `db.operation`, `org_id`                          |
| Every Redis command                                            | `redis.command` (auto via `@opentelemetry/instrumentation-ioredis`) | `db.operation`, `net.peer.name`                                                              |
| Every BullMQ job                                               | `queue.job`                                                         | `queue.name`, `job.id`, `org_id`, `job.attempt_number`                                       |
| Every external API call (MiCamp, Stripe, Twilio, Meta, Claude) | `http.client` (auto via fetch instrumentation)                      | `http.url` (sanitised — no API keys in URL), `http.method`, `http.status_code`, `timeout_ms` |
| Every payout batch generation                                  | `payout.prepare`                                                    | `org_id`, `region_code`, `period_start`, `period_end`, `conversion_count`                    |
| Every audit chain verification                                 | `audit.verify`                                                      | `region_code`, `event_count`, `chain_valid` (bool)                                           |
| Lead capture (critical user path)                              | `knock.sync` + `lead.create`                                        | `org_id`, `territory_id`, `disposition`, `offline_queue_depth`                               |

### Business attributes on spans

Add business context to spans so traces are searchable by business entity:

```ts
span.setAttribute('business.org_id', orgId);
span.setAttribute('business.knock_id', knockId);
span.setAttribute('business.conversion_id', conversionId);
span.setAttribute('business.queue_name', queueName);
// Never: span.setAttribute('business.email', email)
// Never: span.setAttribute('business.phone', phone)
```

### Sampling policy

| Environment                                          | Sampling                          |
| ---------------------------------------------------- | --------------------------------- |
| Local dev                                            | 100% (Jaeger)                     |
| Staging                                              | 100% (Datadog APM)                |
| Prod — knock-sync, conversion-finalise, payout paths | 100% (always trace revenue paths) |
| Prod — all other routes                              | 10% head-based sampling           |
| Prod — healthz                                       | 0% (noisy, useless)               |

---

## 6. Alert conditions and runbook links

Every alert links to a runbook. No runbook = no alert (downgrade to notification).

| Alert                            | Condition                                                      | Severity | Runbook                                                  |
| -------------------------------- | -------------------------------------------------------------- | -------- | -------------------------------------------------------- |
| Knock sync SLO fast burn         | 14× budget burn in 1h                                          | P1       | `incident-response.md`                                   |
| Knock sync SLO slow burn         | 6× budget burn in 6h                                           | P1       | `incident-response.md`                                   |
| Lead capture P95 latency         | >2s sustained 10 min                                           | P1       | `incident-response.md`                                   |
| Lead capture P95 critical        | >4s sustained 5 min                                            | P0       | `incident-response.md`                                   |
| API availability fast burn       | 14× budget burn in 1h                                          | P0       | `incident-response.md` → `region-failover.md`            |
| Audit chain integrity failure    | `d2d.audit.chain_valid` = 0                                    | P0       | `audit-chain-mismatch.md`                                |
| Webhook DLQ growing              | DLQ depth >0 sustained 5 min                                   | P1       | `webhook-dlq.md`                                         |
| Conversion finalise failure rate | >5% over 5 min                                                 | P0       | `payment-incident.md`                                    |
| Redis unavailable                | PING fails for 60s                                             | P0       | `redis-outage.md`                                        |
| Aurora connection pool           | Connections > 90% of max for 5 min                             | P1       | `region-failover.md`                                     |
| BullMQ queue depth spike         | Any queue depth >1000 sustained 10 min                         | P1       | `incident-response.md`                                   |
| Payout batch overdue             | `payout-prepare` job not completed within 2× expected duration | P2       | `payment-incident.md`                                    |
| AI budget overrun                | Org AI spend >100% cap                                         | P2       | (no page; block the job; log `PROBLEM_BUDGET_EXHAUSTED`) |
| Audit chain shipping lag         | `shippedToS3At` delay >10 min for new events                   | P2       | `audit-chain-mismatch.md`                                |

**Alert configuration location:** Datadog monitor definitions should be committed as Terraform in `infra/terraform/modules/datadog-monitors/` (not yet created — create before Phase 1 go-live). Until then, alerts are configured manually in the Datadog UI but must be documented here.

---

## 7. Error budget policy

| Budget consumed | Action                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------ |
| 0–25%           | Normal operations                                                                          |
| 25–50%          | Review the slowest p99 routes; check for latency regressions                               |
| 50–75%          | Freeze non-critical deploys to the affected service for the remainder of the 30-day window |
| 75–99%          | Freeze all deploys; incident response for the service; postmortem required                 |
| 100%            | Full freeze; P0 status page; postmortem mandatory within 7 days                            |

Budget resets on the rolling 30-day window, not on a calendar month.
