# Runbook — Redis Outage

> **Owner:** Brodie · **Updated:** 2026-06-05
> **Scope:** ElastiCache Redis 7 (prod AWS Phase 4) / Railway Redis (Phase 1–3), BullMQ queues, session store, rate-limit counters, idempotency key cache, Ably JWT cache
> **Severity:** P0 immediately — auth, login rate-limiting, and session management all depend on Redis

---

## Fail-closed behaviour: what happens when Redis is down

This is documented as-built behaviour, not a target. Know it before responding.

| Feature                                     | Redis dependency             | Behaviour when Redis is down                                                                                                                                                               |
| ------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Token revocation / session invalidation** | Redis token-validity cache   | **Fails CLOSED** — all JWT validation fails; users cannot make authenticated requests. This is correct security behaviour (per F-008 in HARDENING-LOG.md, verified holding).               |
| **Login rate-limit**                        | Redis sliding-window counter | **Rate limiting is bypassed** — brute-force protection against login is inactive.                                                                                                          |
| **Login account lockout**                   | Redis lockout counter        | **Lockout is bypassed** — accounts cannot be locked. This is a security degradation.                                                                                                       |
| **BullMQ queues**                           | Redis as queue store         | **All background jobs stop processing** — conversion-finalise, webhook-deliver, audit-ship, commission-calc, payout-prepare queues all halt. Jobs are preserved in Redis when it recovers. |
| **Idempotency keys**                        | Redis idempotency cache      | **Idempotency replay protection is inactive** — duplicate POST requests may be processed.                                                                                                  |
| **OTP / MFA codes**                         | Redis OTP store              | **MFA login fails** — users cannot complete TOTP-based login (OTP store is Redis-backed).                                                                                                  |
| **AI budget burn-rate**                     | Redis sliding-window         | **Budget cap enforcement inactive** — AI generation jobs may exceed org budget caps.                                                                                                       |
| **Inbound webhook dedup**                   | Redis seen-set               | **Webhook dedup inactive** — Stripe/Twilio retries may be processed twice. Downstream operations should be idempotent but verify.                                                          |

**Summary:** A Redis outage means authenticated requests fail immediately (fail-closed), no background jobs run, and several security controls are degraded. This is a P0 incident.

---

## Step 1 — Confirm Redis is down (≤5 min)

### AWS (Phase 4)

```
# Check ElastiCache cluster status [AWS]
aws elasticache describe-replication-groups \
  --replication-group-id d2d-prod-us-east-1-redis \
  --query 'ReplicationGroups[0].{Status:Status,MemberClusters:MemberClusters}'

# Expected: Status = available
# If: Status = snapshotting / modifying / deleting → Redis is in a transient state, not fully down
# If: Status = unavailable → Redis is down
```

### Railway (Phase 1–3)

Check the Railway dashboard for the Redis service. Look for the service status indicator. If the service shows "Crashed" or "Restarting," Redis is down.

### Quick connectivity test from an app container

```
# If you have a bastion or can exec into a running ECS/Railway task:
redis-cli -h <redis_host> -p 6379 \
  --tls --no-auth-warning \
  -a <redis_auth_token> PING
# Expected: PONG
# If timeout or NOAUTH error: Redis is down or auth token is wrong
```

---

## Step 2 — Immediate actions

### Post P0 status page update immediately

```
We are experiencing a service disruption. All authenticated API requests are
currently failing while we work to restore the underlying cache service.
Background processing (payments, notifications, webhooks) is paused.
We are working to restore service as quickly as possible. Next update in 15 minutes.
```

### Notify Pilot-Charlie directly (P0 template in incident-response.md)

Do not wait. Knockers will see "Unable to sync" errors on the mobile app. Inside sales will see session failures. Notify the org admin immediately.

### Do NOT attempt workarounds that bypass the fail-closed behaviour

Do not configure the API to skip JWT validation during a Redis outage. The fail-closed behaviour exists specifically for this scenario. Accepting security degradation to keep the service up is the wrong trade-off for a fintech platform handling PII and payments.

---

## Step 3 — Diagnose root cause

### AWS ElastiCache failure modes

**Automatic failover in progress (multi-AZ):**

- Redis Cluster shows `Status: snapshotting` or replica promotion in progress.
- This is automatic and takes 30–60 seconds.
- **No manual action needed.** Wait for failover to complete.
- Monitor `EngineCPUUtilization` and `CurrConnections` in CloudWatch.

**Memory exhaustion (`OOM` error):**

- CloudWatch: `DatabaseMemoryUsagePercentage` at 100%.
- Redis eviction policy is `noeviction` (we do not lose data silently — Redis returns errors instead).
- Cause: BullMQ jobs accumulating faster than they are consumed; large idempotency key TTL; AI budget sliding windows accumulating.
- Mitigation: `redis-cli INFO memory` → identify the largest key categories. If BullMQ `failed` jobs are the culprit, clear the DLQ (after capturing the job data).

**Network partition / security group misconfiguration:**

- App logs show `ECONNREFUSED` or timeout to the Redis host.
- Verify the app security group allows egress to the Redis security group on port 6379. [AWS] Check `aws ec2 describe-security-groups`.
- Check for any recent Terraform changes to the `network` or `redis` module that might have changed security group rules.

**Auth token rotation:**

- If someone rotated the Redis auth token in Secrets Manager without updating the running task, the app will fail to authenticate to Redis.
- Fix: update the secret, force a new ECS task deployment to pick it up.

**Railway Redis crash:**

- Check Railway deployment logs for the Redis service.
- `railway restart --service redis` (if authorised; note this clears all in-memory data including active BullMQ jobs — use only if jobs are truly lost, not just paused).
- **Warning:** restarting Railway Redis permanently loses all in-flight BullMQ jobs and active sessions. Prefer to wait for Railway to auto-restart.

---

## Step 4 — Recovery verification

Once Redis is confirmed available (PING returns PONG):

1. **Session warm-up:** Sessions are JWT-based with Redis revocation cache. There is no warm-up needed. Once Redis is up, valid JWTs work again. Users who were mid-session need to refresh their token (they will see a 401; the web app retries automatically on 401).

2. **BullMQ queue drain:** Jobs queued in Redis during the outage will begin processing immediately. Monitor for queue depth returning to baseline:
   - `conversion-finalise`: any conversions submitted during the outage are queued and will process now. Monitor for double-processing if the inbound webhook dedup was bypassed.
   - `audit-ship`: audit events generated during the outage were stored in Aurora `AuditEvent` table (the outbox). They will be shipped to S3 now.
   - `webhook-deliver`: outbound webhooks paused during outage will drain now.

3. **Duplicate processing check:** If the outage lasted >30 seconds, some inbound Stripe webhooks may have been retried and processed twice. Query `Conversion` for rows with `idempotencyKey` appearing twice (should be impossible due to DB `UNIQUE` constraint — this is your proof the idempotency DB constraint held even when Redis was down).

4. **Rate-limit counter reset:** Login rate-limit and lockout counters in Redis were lost during the outage. They restart from zero. This is acceptable — it means a brief window without brute-force protection, but no data was lost.

5. **Confirm golden signals return to baseline:** Traffic recovering, error rate falling below SLO, latency returning to <2s P95 for key routes.

---

## Redis dependency map for SOC 2

This table supports CC7 control evidence (system availability monitoring):

| Redis keyspace       | TTL                 | Impact if lost                                          |
| -------------------- | ------------------- | ------------------------------------------------------- |
| `session:<userId>`   | JWT expiry (≤5 min) | Auth fails for that user; re-login required             |
| `otp:<userId>`       | 5 min               | MFA fails; user must re-initiate                        |
| `lockout:<userId>`   | 15 min              | Lockout state lost; brute-force window reopens          |
| `rl:login:<ip>`      | 1 min window        | Rate-limit counter reset                                |
| `idem:<key>`         | 7 days              | Idempotency replay protection inactive                  |
| `bull:*`             | Until consumed      | Jobs preserved (persist in Redis); pause until recovery |
| `seen:<eventId>`     | 7 days              | Inbound webhook dedup inactive                          |
| `ai-budget:<orgId>`  | Rolling window      | AI budget cap inactive                                  |
| `chain-head:<orgId>` | N/A (read-through)  | Audit chain serialization fallback to DB read           |

---

## Escalation

| Condition                                          | Action                                                                                                                                                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Redis down > 15 min                                | File P0 status page; notify Pilot-Charlie                                                                                                                                                                    |
| Redis down > 1 h                                   | Escalate to AWS Support (Enterprise) [Phase 4] or Railway support [Phase 1–3]                                                                                                                                |
| Memory exhaustion and can't clear                  | Consider ElastiCache node type scale-up via Terraform (requires apply — GATED on real infra)                                                                                                                 |
| Auth token mismatch persists after secret rotation | Force-redeploy all app tasks to pull fresh secret from Secrets Manager                                                                                                                                       |
| Railway Redis restart wipes BullMQ jobs            | Re-queue jobs from Aurora source records (conversions that are `pending` can be re-enqueued; commission-calc re-runs daily anyway; webhook-deliver replays from `WebhookDelivery` rows with `status=failed`) |
