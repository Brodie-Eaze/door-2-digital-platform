# Runbook — Incident Response

> **Owner:** Brodie (solo on-call, Phase 1–2) · **Updated:** 2026-06-05
> **Stack:** NestJS/Fastify on Railway (prod) → ECS Fargate (Phase 4), Aurora PostgreSQL, ElastiCache Redis, BullMQ, Ably, Pino logs, OpenTelemetry traces
> **Pager:** PagerDuty · **Comms:** status page at `status.d2d.io`

---

## Severity levels

| Sev    | Definition                                                           | Response SLA                                              | Examples                                                                                        |
| ------ | -------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **P0** | Revenue loss, data breach in progress, or full platform outage       | Acknowledge ≤5 min, status page ≤15 min, mitigation ≤1 h  | Payment processing down, audit chain broken, PII exfiltration detected                          |
| **P1** | Degraded UX for production users; no data loss but measurable impact | Acknowledge ≤15 min, status page ≤30 min, mitigation ≤4 h | Knock-sync success rate below SLO, payout generation >60 s P95, Ably realtime feed stalled      |
| **P2** | Non-critical degradation; workaround exists                          | Acknowledge ≤1 h, fix next business day                   | Background job queue depth elevated, non-critical webhook delivery failures, slow admin console |
| **P3** | FYI / early warning; no user impact now                              | No page; Slack notify; fix next sprint                    | Elevated 4xx rate on a single route, SSL certificate expiry >30 days away                       |

---

## On-call roster

| Phase     | Primary                    | Secondary                    |
| --------- | -------------------------- | ---------------------------- |
| Phase 1–2 | Brodie (all severities)    | — (solo founder reality)     |
| Phase 3+  | Brodie P0, Backend lead P1 | Mobile eng P1 (field issues) |

**PagerDuty escalation path:** Direct page to Brodie → if unacknowledged 10 min, retry → if unacknowledged 20 min, call Brodie's mobile directly.

---

## Response sequence

### 1. Acknowledge (≤5 min for P0, ≤15 min for P1)

Acknowledge the PagerDuty alert. Do not silence without reading it.

### 2. Communicate — status page (P0/P1 only)

Post an initial status-page update within 15 min (P0) or 30 min (P1) using the **Investigating** template below. Do not wait until you know the cause.

### 3. Diagnose

Ordered sequence — stop when you find the cause:

1. **Dashboard** — golden signals (traffic, errors, latency, saturation) for the affected service region. Identify which signal crossed threshold.
2. **Logs** — Pino structured logs in Datadog / CloudWatch `/d2d/<service>`. Filter `level:error` + `service:<name>`. Look for `trace_id`, `org_id`, `request_id`.
3. **Traces** — OTel spans in Datadog APM / Jaeger. Find the trace from the error log. Identify the failing span (DB query, Redis call, external partner, BullMQ job).
4. **Hypothesis test** — reproduce in staging if safe; verify with a targeted query or API call.

### 4. Mitigate before fixing

Choose the fastest path to stopping user impact:

- **Rollback** — ECS: redeploy previous task-definition revision. Railway: `railway rollback`. Prefer rollback over a forward-fix under pressure.
- **Feature flag** — disable the failing feature via LaunchDarkly. Does not require a deploy.
- **Traffic divert** — if one region is affected, update Route 53 weighted routing to zero-weight that region.
- **Queue drain stop** — for BullMQ: pause the affected queue from the Bull Board UI or via `queue.pause()` in a REPL. Jobs stay queued; no data loss.
- **Rate limit tighten** — if a downstream partner is overwhelmed, reduce concurrency in the relevant BullMQ queue config.

### 5. Fix

Apply a targeted fix. If it requires a code change, deploy to staging first, validate, then prod. No untested code directly to prod under incident pressure.

### 6. Verify + close

- Golden signals return to baseline (traffic normal, errors <SLO, latency <SLO target).
- BullMQ queue depth returns to near zero.
- No new error signatures in logs.
- Post **Resolved** status-page update.
- Acknowledge PagerDuty.

### 7. Postmortem

For every P0 and P1: file postmortem within 7 days. See template in `docs/runbooks/` directory convention. Blameless. Five whys. Action items with owner + date.

---

## Communication templates

### Status page — Investigating (P0/P1)

```
[Incident title — e.g. "Knock sync degraded"]

We are investigating reports of [symptom description — e.g. "delayed knock
synchronisation from the mobile app"]. Some users may experience [user-visible
impact]. Our team is actively working on a resolution. Next update in 30 minutes.

Started: [ISO 8601 UTC time]
Severity: [P0 / P1]
```

### Status page — Identified

```
We have identified the cause of [incident title]: [one sentence cause]. We are
implementing a fix. Estimated resolution: [time or "unknown — monitoring"].
Next update in [15 / 30] minutes.
```

### Status page — Resolved

```
[Incident title] has been resolved as of [ISO 8601 UTC]. All systems are
operating normally. We will publish a postmortem within 7 days.

Duration: [X h Y min]
Impact: [description of what was affected and for which tenants]
```

### Pilot-Charlie direct comms (P0 only)

```
Subject: D2D Platform — Service Disruption Notice

Hi [contact name],

We are currently experiencing [brief description] affecting [what they see].
We identified the issue at [time] and are actively working on a fix.

Current status: [investigating / fix in progress / resolved]
Next update: [time]

We will follow up with a full incident report.

— Brodie
Door 2 Digital
```

---

## Quick-reference: which runbook for which incident

| Symptom                                | Go to                                                   |
| -------------------------------------- | ------------------------------------------------------- |
| Knock sync success rate <99.5%         | This runbook + payment-incident if conversions affected |
| Payment processing failure             | `payment-incident.md`                                   |
| Suspected data exposure                | `data-breach-72h.md` — start immediately                |
| Audit chain hash mismatch              | `audit-chain-mismatch.md`                               |
| Webhook delivery stalled / DLQ growing | `webhook-dlq.md`                                        |
| Redis unreachable                      | `redis-outage.md`                                       |
| AWS region degraded                    | `region-failover.md`                                    |
| Payout batch stalled                   | `payment-incident.md`                                   |
