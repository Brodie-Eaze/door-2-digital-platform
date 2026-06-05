# Runbook — Payment Incident

> **Owner:** Brodie · **Updated:** 2026-06-05
> **Scope:** MiCamp Gateway API (US Phase 1), Stripe AU/SG (Phase 2/3), payout batch generation
> **Stack:** `services/payment`, `services/conversion`, `services/payout`, `services/donation`, BullMQ queue `conversion-finalise`
> **Criticality:** P0 if revenue processing is blocked; P1 if payout batch is stalled

---

## Payment stack overview

```
Mobile / Web
    |
    v
POST /v1/conversions          (services/conversion — idempotent, idempotency-key required)
    |
    v
BullMQ: conversion-finalise   (services/workers)
    |
    +--> MiCampAdapter         (US donations + sales — Phase 1)
    |    services/payment/micamp-adapter.ts
    |
    +--> StripeAdapter         (AU/SG — Phase 2/3)
    |    services/payment/stripe-adapter.ts
    |
    v
Conversion.status = 'finalised'
    |
    v
Commission accrual             (commission-calc queue, daily 02:00 local)
    |
    v
PayoutBatch generation         (payout-prepare queue, fortnightly/monthly)
    |
    v
Instruction file (NACHA/CSV)   (status = 'ready_to_pay')
    *** Brodie executes transfer manually — no auto-debit ***
```

**Key invariant:** The platform NEVER auto-debits or auto-credits. `services/payout` generates an instruction file only; Brodie executes every transfer manually in the banking app. This is per ADR-0019.

---

## Incident type 1 — Conversion finalisation failing (BullMQ `conversion-finalise` failures)

### Symptoms

- Datadog alert: `conversion_finalise_job_failure_rate > 5%` over 5 min
- BullMQ `conversion-finalise` queue: jobs in `failed` state accumulating
- `Conversion.status` rows stuck at `pending` or `error`
- Knockers or inside-sales reps see "payment processing" spinner that never resolves

### Diagnosis

1. Open Bull Board UI (or `redis-cli LRANGE bull:conversion-finalise:failed 0 -1`) — read the job data and error message from the most recent failed jobs.
2. Check `services/payment` logs: `level:error service:payment`. Look for the error type:
   - `MICAMP_GATEWAY_TIMEOUT` — MiCamp is slow or down
   - `MICAMP_INVALID_CARD` / `STRIPE_CARD_DECLINED` — upstream card rejection (not a platform bug; expected)
   - `MICAMP_API_ERROR` — MiCamp API returning 4xx/5xx
   - `DUPLICATE_CONVERSION` — idempotency key collision (check logic, not infrastructure)
   - `DB_WRITE_TIMEOUT` — Aurora under load; check `AUDIT-CHAIN-SERIALIZATION` known issue in `docs/50k/HARDENING-LOG.md`
3. Check MiCamp status page (bookmark URL from MiCamp account team docs).
4. If MiCamp-side: check if it affects all transactions or a subset (specific card type, specific state, specific amount range).

### Mitigation

- **Card decline / user error (expected):** No action needed. BullMQ retries with backoff. The conversion state machine transitions to `payment_failed` and notifies the knocker. No P0.
- **MiCamp outage:**
  1. Pause the `conversion-finalise` queue: jobs queue up safely, idempotency keys prevent double-charges when it recovers.
  2. Post P1 status-page update.
  3. Contact MiCamp account team (incident line from account docs).
  4. Monitor MiCamp status page for recovery.
  5. When MiCamp recovers, resume the queue: jobs drain automatically.
- **DB timeout (Aurora):**
  1. Check RDS metrics: CPU, connections, `FreeLocalStorage`.
  2. If the `AUDIT-CHAIN-SERIALIZATION` bottleneck is the cause (serialised writes under load), reduce `conversion-finalise` queue concurrency to 2 in the workers config as an emergency measure.
  3. Scale Aurora ACU max upward via Terraform if needed (requires apply — GATED on real infra).
- **Code bug (new deployment):** Rollback the workers service to the previous task definition revision.

### Recovery verification

- `Conversion` rows with `status='error'` from the incident window: re-enqueue them by setting `status='pending'` and re-publishing to the queue (use the idempotency-safe re-queue script in `tools/scripts/`).
- Confirm no double-charges: cross-reference `Conversion.paymentExternalId` against MiCamp portal or Stripe dashboard for the incident window.
- Confirm `processorResidualCents` is populated correctly for MiCamp transactions (ISO residual accuracy).

### Notification SLA

- MiCamp: immediate (they need to know about their own outage)
- Pilot-Charlie org admin: within 4 hours if conversions were lost or delayed
- Partner bank: within 24 hours if a payout instruction is affected

---

## Incident type 2 — Payout batch stalled or corrupt

### Symptoms

- `PayoutBatch.status` stuck at `draft` past the expected generation time
- Payout-prepare BullMQ job in `failed` state
- Brodie cannot download the instruction file

### Note on severity

This is P1 if payouts are just late. It is P0 only if payout data is corrupt (wrong amounts). The system never auto-pays, so a delayed batch causes no financial damage — only a delayed payroll for knockers.

### Diagnosis

1. Check `payout-prepare` queue in Bull Board. Read the error from the failed job.
2. Check `services/payout` logs: `level:error service:payout`. Common errors:
   - `COMMISSION_CALC_NOT_COMPLETE` — the daily `commission-calc` job for the period did not complete. Re-run it first.
   - `OPEN_CONVERSIONS_IN_PERIOD` — conversions in the payout period are still `pending` (payment not finalised). Resolve payment incident first.
   - `COOLING_OFF_WINDOW_OPEN` — a conversion in the batch is within its cooling-off window (AU: 10 business days; US: 3 days). This is correct behaviour, not a bug. Wait for the window to close or exclude that conversion with explicit waiver.
   - `DB_WRITE_ERROR` — infrastructure issue; check Aurora.
3. Validate instruction file format: NACHA (US) or CSV (AU). The file is at the S3 key in `PayoutBatch.instructionFileKey`. Spot-check 3–5 lines manually.

### Mitigation

- If `commission-calc` incomplete: manually trigger the commission calculation job for the affected period via the worker REPL or a one-off BullMQ job publish.
- If open conversions: run conversion-finalise for the outstanding records first.
- If instruction file format error: correct the payout service code (this is a code bug — do not manually edit the file; regenerate it).
- If Brodie finds arithmetic errors: DO NOT instruct the transfer. Rollback the `PayoutBatch.status` to `draft`, fix the commission plan data, regenerate.

### Recovery verification

- `PayoutBatch.status` transitions to `ready_to_pay`
- Instruction file total matches manual calculation of `Commission` rows for the period
- Spot-check 5 knocker commission totals against their individual statement view
- Brodie reviews and executes transfer manually

---

## Incident type 3 — Recurring donation charge failure (Stripe / MiCamp recurring)

### Symptoms

- `donation-recurring` BullMQ job failures
- `Donation.status` rows with `past_due` or `cancelled` that are unexpected
- Donor complaints about declined recurring charge

### Diagnosis

1. Check `donation-recurring` queue failed jobs. Note the `donationId` and `paymentExternalId`.
2. Check Stripe dashboard (AU/SG) or MiCamp portal (US) for the subscription / recurring charge status.
3. Common causes: expired card, insufficient funds, Stripe webhook delivery failure causing stale status.

### Mitigation

- Expired card / insufficient funds: Notify the donor via `services/notification` (Twilio + Resend). Trigger the dunning sequence. This is expected behaviour, not an incident unless it affects >1% of the recurring portfolio.
- Stripe webhook delivery failure: Check `apps/webhooks` `/inbound/stripe/<region>` logs. Verify `Stripe-Signature` validation passing. If Stripe is retrying and the endpoint is down, see `webhook-dlq.md`.
- Mass failure (Stripe / MiCamp outage): Pause the `donation-recurring` queue. Contact processor. Resume after recovery.

---

## Escalation contacts

| Contact                             | When                                                                         |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| MiCamp account team (incident line) | MiCamp API returning 5xx or timeout sustained >5 min                         |
| Stripe support                      | Stripe API degraded, webhook delivery failing at source                      |
| Twilio support                      | SMS delivery for payment notifications failing                               |
| D2D US legal counsel                | Any payment fraud allegation, chargebacks >1% in a month, regulatory inquiry |
| Brodie directly                     | Payout instruction file ready for review, any arithmetic discrepancy         |
