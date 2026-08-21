# Runbook — Region Failover

> **Owner:** Brodie · **Updated:** 2026-06-05
> **Scope:** US (us-east-1 primary), AU (ap-southeast-2 — Phase 2+), SG (ap-southeast-1 — Phase 3+)
> **Phase 1 note:** Only us-east-1 is provisioned. This runbook applies to Phase 1 as a single-region degradation response and is the full multi-region procedure from Phase 2 onward.
> **GATED:** Steps marked [AWS] require the AWS infrastructure to be provisioned. Before Phase 4 (AWS prod migration), many of these steps apply only in the Railway topology. See Railway-specific notes where indicated.

---

## Data residency constraint

**AU PII must never leave ap-southeast-2. SG PII must never leave ap-southeast-1. US PII must never leave us-east-1.** This is a hard legal constraint (Privacy Act APP 8, PDPA s.26) and a DB-enforced invariant (`RegionGuard` middleware, `Org.regionCode` immutable). A failover that violates data residency is worse than an outage. Do not route AU/SG traffic to us-east-1 even under pressure.

---

## Region failure scenarios

### Scenario A — Full AWS region degraded (AWS)

**Trigger:** AWS Service Health Dashboard shows us-east-1 / ap-southeast-2 / ap-southeast-1 degraded or unavailable.

**Phase 1 (Railway topology) equivalent:** Railway platform or its underlying infra for a region is unreachable.

**Decision:** D2D has no active-active multi-region within a single jurisdiction (by design — residency constraint). A full region failure means the affected jurisdiction is in maintenance mode until the region recovers. There is no same-jurisdiction failover region.

**Actions:**

1. Post P0 status-page update: "We are experiencing a service disruption in [region] due to an infrastructure issue with our cloud provider. Services for [AU/US/SG] users are temporarily unavailable. We are monitoring and will update as soon as service is restored."
2. Do NOT attempt to serve affected region's traffic from another region. This violates data residency.
3. Monitor AWS Service Health Dashboard for recovery ETA.
4. When the region recovers, verify Aurora and Redis are healthy before restoring traffic (see §Recovery verification below).

### Scenario B — Aurora (RDS) cluster degraded

**Trigger:** Aurora alerts on `DatabaseConnections` at ceiling, `FreeStorageSpace` low, writer node failover in progress, or `FATAL: remaining connection slots reserved` in app logs.

#### Diagnosis

```
# Check cluster status [AWS]
aws rds describe-db-clusters \
  --db-cluster-identifier d2d-prod-us-east-1-aurora \
  --query 'DBClusters[0].{Status:Status,Members:DBClusterMembers}'

# Identify writer vs reader
# A failover-in-progress shows the former writer transitioning to reader role
```

In CloudWatch / Datadog: check `CPUUtilization`, `DatabaseConnections`, `FreeableMemory` for the Aurora cluster in the affected region.

#### Mitigation — connection exhaustion

1. Reduce ECS task desired count for `apps/api` to free connections. Scale from e.g. 4 → 2 tasks as an emergency measure.
2. Check for connection leaks: look for long-running idle connections via `SELECT pid, state, query_start, query FROM pg_stat_activity WHERE state != 'active' ORDER BY query_start` (run via a bastion or the `db:psql` make target).
3. Kill idle connections: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND query_start < now() - interval '10 minutes'`.
4. The `AUDIT-CHAIN-SERIALIZATION` known issue in `HARDENING-LOG.md` serialises all writes per org under load. Under extreme load this is a contributing cause. Emergency mitigation: set `AUDIT_ASYNC_MODE=true` feature flag (if implemented) to decouple audit writes from the request TX.

#### Mitigation — Aurora automatic failover (multi-AZ)

Aurora Serverless v2 automatically promotes a reader to writer within ~30s. During this window:

- App will see connection errors. Prisma's connection pool will retry.
- BullMQ workers will pause-retry on Redis-side (Redis is independent).
- Expect ~60s of elevated 5xx during the failover.
- **No manual action needed** during the failover itself. Monitor and confirm recovery.

#### Mitigation — storage full

[AWS] Increase Aurora storage (it auto-scales with Serverless v2 — this is usually a misconfiguration alarm). Check actual free storage. If genuine: identify and delete old `exports` S3 objects (90-day TTL should handle this automatically) or run the archival job manually.

### Scenario C — Redis (ElastiCache) cluster degraded

See `redis-outage.md` for the full procedure.

### Scenario D — ECS service failing to deploy or tasks crashing

**Trigger:** ECS deployment circuit breaker triggered (`deployment_circuit_breaker = true` in Terraform), new tasks failing health checks and rolling back.

#### Diagnosis

1. Check ECS service events in AWS Console or:
   ```
   aws ecs describe-services \
     --cluster d2d-prod-us-east-1 \
     --services d2d-api d2d-workers d2d-webhooks \
     --query 'services[*].{Name:serviceName,Running:runningCount,Desired:desiredCount,Events:events[0:3]}'
   ```
2. Check CloudWatch Logs `/d2d/api` for crash reason.
3. Common causes: bad environment variable (Secrets Manager key missing/renamed), code bug introduced in last deploy, Prisma migration failed before service start.

#### Mitigation — ECS deployment rollback

The `deployment_circuit_breaker` with `rollback = true` should auto-rollback. If it does not:

```
# [AWS] Manual rollback to previous task definition
aws ecs update-service \
  --cluster d2d-prod-us-east-1 \
  --service d2d-api \
  --task-definition d2d-api:<PREVIOUS_REVISION>
```

For Railway (Phase 1): `railway rollback --service api`

#### Mitigation — failed Prisma migration

Prisma migration runs as a one-off task before the service tasks start (`aws ecs run-task` with the migration task definition). If the migration failed:

1. Check the migration task logs in CloudWatch `/d2d/api-migrate`.
2. Do not force-start the service with an incomplete migration — it will crash on startup.
3. Fix the migration, rebuild the image, re-run.

---

## Recovery verification (all scenarios)

After any region-affecting incident, verify these before declaring recovery:

- [ ] `GET https://api-us.d2d.io/v1/healthz` (or equivalent regional endpoint) returns HTTP 200
- [ ] Aurora cluster shows `available` status; writer node confirmed
- [ ] Redis cluster shows `available`; no `LOADING` state
- [ ] BullMQ queues processing: `bull:conversion-finalise:waiting` depth returning to baseline
- [ ] Audit chain integrity: run `tools/scripts/verify-audit-chain.ts` for the incident time window — confirm no gaps
- [ ] Synthetic knock submission test: submit a test knock via the mobile app staging env against the recovered prod DB (if safe) or staging DB; confirm it syncs
- [ ] No `RegionGuard` 403 errors in logs indicating misrouted requests
- [ ] Ably realtime channels reconnected: live knock feed updating in the org console

---

## Disaster recovery (full region loss — Phase 4+)

For full DR procedure including RPO/RTO targets, backup restore steps, and game-day drill sequence, see `docs/50k/DR-PLAN.md`.

**Summary:** RPO 5 min (Aurora PITR) / RTO 1 h. A full region loss in Phase 4 requires restoring from PITR to a new cluster in the same region (or waiting for the region to recover). Cross-region restore would violate data residency and is not an option.

---

## What is GATED on real infra

- [AWS] All `aws rds`, `aws ecs`, `aws elasticache` CLI commands require the AWS account to exist and the caller to have IAM permissions.
- [AWS] ECS task definition rollback requires the ECR image and task definition revision to exist.
- [AWS] Aurora PITR restore requires the backup window to have run at least once (first backup window is 03:00–04:00 UTC per Terraform config).
- The Railway topology (Phase 1–3) uses Railway's managed Postgres and Redis for dev/staging only; prod uses real RDS from Day 1 per the architecture. Verify which tier a given environment is on before executing RDS commands.
