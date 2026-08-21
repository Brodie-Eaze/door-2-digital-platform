# Runbook — Webhook DLQ (Dead Letter Queue)

> **Owner:** Brodie · **Updated:** 2026-06-05
> **Scope:** Outbound webhooks (`services/webhook`, BullMQ `webhook-deliver` queue) and inbound webhooks (`apps/webhooks`)
> **Severity:** P1 if DLQ is growing and partner integrations are affected; P2 if only non-critical endpoints are failing

---

## Webhook architecture overview

### Outbound (D2D → partner endpoint)

```
Domain event fires
    |
    v
services/webhook → BullMQ: webhook-deliver
    |
    v
Worker sends POST to registered endpoint
  with D2D-Signature: t=<ts>,v1=<HMAC-SHA256(secret, ts.body)>
    |
Retry schedule: 30s → 2m → 10m → 1h → 6h → 24h (6 attempts)
    |
After 6 failures → WebhookDelivery.status = 'dlq'
    |
DLQ alert fires if DLQ count > threshold
```

**Key invariant:** The webhook service signs with the raw decrypted secret (never the hash). The SSRF guard blocks 169.254.169.254 / RFC1918 / IPv6 ULA addresses. The idempotency key is per-event ULID; receivers MUST be idempotent on `event.id`.

### Inbound (partner → D2D)

```
POST /inbound/<provider>/<region>
    |
apps/webhooks validates signature per provider (Stripe-Signature, Twilio, etc.)
    |
Idempotency: Redis seen-set on event ID (7-day TTL) prevents duplicate processing
    |
Publishes to internal BullMQ queue for the relevant domain service
```

---

## Incident type 1 — Outbound DLQ growing

### Symptoms

- Datadog alert: `webhook_dlq_depth > 0` sustained for 5 min
- `WebhookDelivery` rows with `status='dlq'` visible in operator console
- Partner reports missing webhook deliveries (e.g. Pilot-Charlie's CRM not receiving conversion events)

### Diagnosis

1. Check `webhook-deliver` queue in Bull Board: are jobs in `failed` or `completed`? What is the error message on failed jobs?
2. Check `services/webhook` logs: `level:error service:webhook`. Common errors:
   - `ECONNREFUSED` / `ENOTFOUND` — partner endpoint is down or DNS has changed
   - `HTTP 4xx from endpoint` — partner endpoint rejecting the request (signature mismatch, schema mismatch, or partner has rotated their expected format)
   - `HTTP 5xx from endpoint` — partner endpoint is having its own incident
   - `SSRF_BLOCKED` — endpoint resolved to a private IP; partner misconfigured or malicious
   - `WEBHOOK_DNS_TIMEOUT` — DNS lookup for the endpoint timed out (known issue SEC-WEBHOOK-DNS in HARDENING-LOG.md; the 3s race wrapper should prevent this from stalling the queue but confirm the fix is deployed)
   - `HMAC_SIGN_FAILED` — signing failed, likely a KMS/Secrets Manager error for the webhook secret

3. Identify which `WebhookEndpoint` (partner org + URL) is failing. If it is one org's endpoint: likely the partner's issue. If all endpoints: likely a platform issue.

4. Check whether the partner endpoint URL resolves correctly:
   ```
   curl -v --max-time 10 -X POST https://<partner-endpoint> \
     -H "Content-Type: application/json" \
     -d '{"test":true}'
   # Expect: any response (even 4xx/5xx is fine — it proves connectivity)
   # Failure modes: ECONNREFUSED, DNS NXDOMAIN, timeout
   ```

### Mitigation

**Partner endpoint down (most common):**

- No platform action needed. Jobs sit in DLQ safely. The partner's events are preserved.
- Notify the partner that their webhook endpoint is unreachable.
- When the partner fixes their endpoint, use the replay procedure below to drain the DLQ.

**Signature mismatch (partner rotated their verification key):**

- The partner needs to update their HMAC verification to use the current `D2D-Signature` format.
- If D2D rotated the signing secret: go to `WebhookEndpoint`, rotate the secret, re-deliver. **Do not re-use the old secret.**

**HMAC_SIGN_FAILED (platform side):**

- Check Secrets Manager for the webhook signing secret. Verify the secret exists and is accessible to the workers ECS task role.
- If the KMS key is the problem: see `region-failover.md` KMS degradation section.

**All endpoints failing simultaneously:**

- This is a platform bug or infrastructure issue. Check the workers service health. Check Redis connectivity (the idempotency key for webhooks uses Redis — if Redis is down, see `redis-outage.md`).

### DLQ replay procedure

Once the root cause is fixed, replay the DLQ:

1. Query the DLQ jobs:

   ```
   # Via Bull Board UI: filter queue=webhook-deliver, status=failed, retry all

   # Or via Redis CLI:
   redis-cli LRANGE bull:webhook-deliver:failed 0 -1
   ```

2. Replay by re-adding failed jobs (use the D2D worker REPL or the replay script in `tools/scripts/replay-webhook-dlq.ts`). The ULID `event.id` on each event is the idempotency key — the partner's receiver should deduplicate if they already got a delivery before the failure.

3. Verify: watch `WebhookDelivery.status` transition from `dlq` → `delivered`.

4. Confirm with the partner that they received the replayed events and their systems are consistent.

---

## Incident type 2 — Inbound webhook delivery failing

### Symptoms

- Stripe payment webhooks not being processed (donations stuck at `pending`)
- Twilio inbound SMS not routed to CRM activities
- Meta lead-ads not syncing to `Lead` records

### Diagnosis

1. Check `apps/webhooks` logs: `level:error service:webhooks`. Filter by provider.
2. Common errors:
   - `STRIPE_SIGNATURE_INVALID` — Stripe webhook secret mismatch. Check `STRIPE_WEBHOOK_SECRET_<REGION>` in Secrets Manager.
   - `IDEMPOTENCY_REPLAY` — duplicate delivery from provider; this is handled (Redis seen-set); log is informational, not an error.
   - `QUEUE_PUBLISH_FAILED` — Redis is down and the inbound event could not be published to the internal queue. See `redis-outage.md`. Events are lost unless Stripe/Twilio retries.
   - `UNKNOWN_EVENT_TYPE` — provider added a new event type; the handler does not know it. Not a P1 unless it is a critical event type.

3. Check the provider's webhook delivery log:
   - Stripe: Dashboard → Developers → Webhooks → select endpoint → View event deliveries
   - Twilio: Console → Monitor → Logs → Errors

### Mitigation

**Signature validation failure:**

- Rotate the webhook secret in the provider's dashboard.
- Update `STRIPE_WEBHOOK_SECRET_<REGION>` in Secrets Manager.
- Redeploy `apps/webhooks` to pick up the new secret.
- Request the provider to replay failed deliveries for the affected window.

**Queue publish failure (Redis down):**

- See `redis-outage.md`.
- For Stripe: Stripe retries for up to 3 days. When Redis recovers, deliveries will succeed automatically.
- For Twilio: Twilio retries for 4 hours. If Redis was down longer, you need to pull missed events from the Twilio logs and manually re-trigger.
- For Meta: Meta does not retry reliably. Manually re-sync using the Meta Graph API lead-ad read endpoint for the affected time window.

---

## Escalation

| Condition                                           | Action                                                                                                                     |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| DLQ depth >100 for a single org                     | Notify that org's admin — their endpoint has been failing for >24h                                                         |
| Inbound Stripe webhook failure for >4h              | P0 — payment status updates are stale; check `payment-incident.md`                                                         |
| SSRF_BLOCKED alert on a registered partner endpoint | Investigate immediately — the partner may be attempting SSRF against D2D internal metadata; disable that `WebhookEndpoint` |
