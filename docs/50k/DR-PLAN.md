# Disaster Recovery Plan — D2D Platform

> **Owner:** Brodie · **Updated:** 2026-06-05
> **Targets:** RPO 5 minutes / RTO 1 hour
> **Scope:** US production (us-east-1) — Phase 1. AU (ap-southeast-2) + SG (ap-southeast-1) added at Phase 2/3 respectively.
> **GATED sections:** Anything marked [GATED — AWS] requires the AWS infrastructure to be provisioned. Real DR drills require a real AWS account. The architecture is designed for these targets; the game-day that validates them cannot run until the account exists.

---

## 1. Recovery targets

| Target                             | Value         | Basis                                                                                                                     |
| ---------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **RPO** (Recovery Point Objective) | **5 minutes** | Aurora Serverless v2 continuous backup + PITR; maximum data loss = the 5-min lag from last PITR snapshot to failure point |
| **RTO** (Recovery Time Objective)  | **1 hour**    | Time to restore PITR, re-point application, verify chain, validate service health                                         |

**What RPO 5 minutes means in practice:** If the Aurora cluster is destroyed at T=0, the most data we can lose is everything written between T-5min and T=0. Conversions, knocks, and audit events from that window may need to be re-entered or sourced from mobile app offline queues.

**What RTO 1 hour means in practice:** From declaring a disaster to having authenticated users able to make requests and BullMQ processing again — 1 hour. This is a design target; the first game-day will produce an actual measured RTO.

---

## 2. What gets backed up and where

### Aurora PostgreSQL (primary data store)

| Parameter           | Value                                                                           | Terraform source                                |
| ------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------- |
| Backup type         | Continuous PITR (Aurora automatic backups)                                      | `aurora` module: `backup_retention_period = 35` |
| Backup window       | 03:00–04:00 UTC                                                                 | `preferred_backup_window = "03:00-04:00"`       |
| Retention           | 35 days                                                                         | `backup_retention_period`                       |
| Encryption          | KMS CMK `alias/d2d-prod-us-east-1-rds`                                          | `kms_key_id = module.kms_rds.key_arn`           |
| Storage location    | In-region only (us-east-1 for US, ap-southeast-2 for AU, ap-southeast-1 for SG) | Per-region cluster, no cross-region replication |
| Cross-region backup | NOT configured — data residency constraint prevents this                        | Deliberate; see §2.1                            |

**Aurora PITR granularity:** Restore to any second within the retention window. Not just nightly snapshots — continuous. This is how RPO 5 minutes is achievable.

#### 2.1 Why no cross-region backup

AU PII must never leave ap-southeast-2. SG PII must never leave ap-southeast-1. Cross-region backup of these clusters would violate the Privacy Act APP 8 (AU) and PDPA s.26 (SG). Each region's backup stays in that region, encrypted with that region's CMK.

For US data (us-east-1): there is no equivalent legal prohibition, but the D2D architecture uses a single-region-per-jurisdiction model and cross-region backup would complicate the compliance story for SOC 2. Decision: keep US backup in us-east-1 as well. If the entire us-east-1 region is lost permanently (extremely rare AWS scenario), the loss is bounded by the 35-day retention window in the region's last available snapshot.

### Audit chain — S3 Object Lock COMPLIANCE

| Parameter  | Value                                                            | Terraform source                            |
| ---------- | ---------------------------------------------------------------- | ------------------------------------------- |
| Bucket     | `d2d-prod-audit-<account_id>`                                    | `s3-bucket` module                          |
| Lock mode  | COMPLIANCE (root account cannot delete before retention expires) | `object_lock_mode = "COMPLIANCE"`           |
| Retention  | 7 years (2555 days)                                              | `object_lock_default_retention_days = 2555` |
| Encryption | KMS CMK `alias/d2d-prod-us-east-1-s3-audit`                      | `kms_key_arn = module.kms_s3_audit.key_arn` |
| Versioning | Enabled                                                          | `aws_s3_bucket_versioning`                  |

The S3 audit bucket is the DR source of truth for audit events. Even if Aurora is fully lost, the S3 archive persists. The hash chain in S3 can be used to prove what events occurred before the disaster.

### Redis (ElastiCache)

| Parameter          | Value                                                   |
| ------------------ | ------------------------------------------------------- |
| Snapshot retention | `snapshot_retention_limit = 7` days (7 daily snapshots) |
| Backup window      | 05:00–06:00 UTC (maintenance window: tue:05:00-06:00)   |
| Encryption         | KMS CMK `alias/d2d-prod-us-east-1-redis-secrets`        |

**Important:** Redis holds ephemeral state (sessions, rate-limit counters, BullMQ queues, idempotency keys). A Redis restore from snapshot is a last resort. In most DR scenarios, Redis is recreated fresh:

- Sessions: users re-authenticate (JWT valid, re-issue refresh token)
- BullMQ queues: jobs re-queued from Aurora source records (see §4.2)
- Rate-limit counters: reset to zero (brief window without brute-force protection — acceptable for DR scenario)
- Idempotency keys: lost — means replay protection inactive for 7 days after restore. Monitor for double-submissions.

### Application images (ECR)

All container images are immutable, tagged with the Git commit SHA, and stored in ECR. Images are not "backed up" in the DR sense — they are rebuilt from source and the ECR repository retains the last N images. The Dockerfile and all build inputs are in the GitHub repository.

### Secrets (Secrets Manager)

Secrets Manager has automatic versioning and cross-region replication can be enabled. [GATED — AWS] Configure replication for the secrets needed to restore the application in a recovery scenario:

- `DATABASE_URL` (or its components)
- `REDIS_URL` / Redis auth token
- Application secrets (`JWT_SECRET`, `PII_KMS_KEY`, etc.)

KMS CMK keys do NOT replicate to other regions (by design — residency constraint). In a recovery scenario within the same region, the same CMK is used.

---

## 3. Failure scenarios and response

### Scenario 1 — Aurora cluster data corruption (highest-priority DR scenario)

**Trigger:** Data written to Aurora is corrupt or deleted due to a software bug, bad migration, or operator error. Aurora itself is healthy; the data is wrong.

**RPO:** 5 minutes before the first corrupt write.

**Restore procedure [GATED — AWS]:**

```bash
# Step 1: Identify the last-good point in time
# Check AuditEvent table for the last valid row before corruption started
# Check application logs for the first error that indicates corrupt data

# Step 2: Create a new Aurora cluster from PITR to that point
aws rds restore-db-cluster-to-point-in-time \
  --db-cluster-identifier d2d-prod-us-east-1-aurora-restore \
  --source-db-cluster-identifier d2d-prod-us-east-1-aurora \
  --restore-to-time "2026-06-05T09:55:00Z" \
  --db-subnet-group-name d2d-prod-us-east-1-aurora \
  --vpc-security-group-ids sg-xxx \
  --kms-key-id arn:aws:kms:us-east-1:xxx:key/xxx \
  --no-deletion-protection
# Note: This creates a NEW cluster. The original is untouched.
# Aurora PITR creates a new cluster; it does not modify the source.

# Step 3: Add a Serverless v2 writer instance to the restored cluster
aws rds create-db-instance \
  --db-instance-identifier d2d-prod-us-east-1-aurora-restore-writer \
  --db-cluster-identifier d2d-prod-us-east-1-aurora-restore \
  --db-instance-class db.serverless \
  --engine aurora-postgresql

# Step 4: Wait for cluster to be Available (typically 5–15 min)
aws rds wait db-cluster-available \
  --db-cluster-identifier d2d-prod-us-east-1-aurora-restore

# Step 5: Run Prisma migrations (if any were applied after the restore point)
# Determine: were any migrations applied between restore-time and now?
# If yes: apply them to the restored cluster
# DATABASE_URL=<restored_cluster_endpoint> pnpm --filter api exec prisma migrate deploy

# Step 6: Verify audit chain integrity on the restored cluster
pnpm --filter workers exec ts-node tools/scripts/verify-audit-chain.ts \
  --database-url postgresql://<restored_cluster_endpoint>/<db> \
  --region us

# Step 7: Update the DATABASE_URL secret in Secrets Manager to point to the restored cluster
aws secretsmanager update-secret \
  --secret-id d2d/prod/us-east-1/database-url \
  --secret-string '{"url":"postgresql://d2d_app:<pw>@<restored_endpoint>:5432/d2d"}'

# Step 8: Force ECS service redeploy to pick up the new DATABASE_URL
aws ecs update-service --cluster d2d-prod-us-east-1 --service d2d-api --force-new-deployment
aws ecs update-service --cluster d2d-prod-us-east-1 --service d2d-workers --force-new-deployment
aws ecs update-service --cluster d2d-prod-us-east-1 --service d2d-webhooks --force-new-deployment

# Step 9: Wait for tasks to stabilise (healthcheck green)
aws ecs wait services-stable --cluster d2d-prod-us-east-1 \
  --services d2d-api d2d-workers d2d-webhooks
```

**Estimated time:** Step 2–4 = 10–20 min. Steps 5–9 = 10–20 min. Total: ~30–40 min (within 1h RTO).

---

### Scenario 2 — Aurora cluster hardware failure / AZ loss

**Trigger:** The primary Aurora writer is on a failed hardware node or in a failed Availability Zone.

**Aurora Serverless v2 automatic behaviour:** Aurora automatically promotes the replica (in a different AZ) to writer. This takes 30–60 seconds. No manual intervention required.

**Manual action only if:** Automatic failover does not complete within 5 min.

```bash
# Force a manual failover [GATED — AWS]
aws rds failover-db-cluster \
  --db-cluster-identifier d2d-prod-us-east-1-aurora
```

---

### Scenario 3 — Redis cluster loss (see redis-outage.md for full procedure)

**DR-specific note:** If Redis is permanently lost (not just unavailable), create a new ElastiCache cluster. Do not restore from snapshot unless BullMQ job data is critical (jobs can be re-queued from Aurora source records instead — this is safer and avoids stale session data in a restored snapshot).

```bash
# Re-queue BullMQ jobs from Aurora source after Redis recreation [GATED — AWS]
# Conversions in 'pending' status: re-publish to conversion-finalise queue
# WebhookDelivery rows in 'failed' status: re-publish to webhook-deliver queue
# Commission-calc: runs automatically at 02:00 — no manual re-queue needed
# Audit-ship: audit-ship cron picks up any unshipped AuditEvent rows automatically
pnpm --filter workers exec ts-node tools/scripts/requeue-pending-jobs.ts --region us
```

---

### Scenario 4 — Full region loss (us-east-1 unavailable)

As noted in `region-failover.md`: D2D has no same-jurisdiction failover region. A full us-east-1 loss means US services are in maintenance mode. Post the status page. Wait for AWS to restore the region.

When the region recovers:

1. Verify Aurora and Redis are available and healthy.
2. Verify the audit chain is intact.
3. Re-deploy ECS services if tasks crashed during the event.
4. Resume BullMQ queues.
5. Post "Resolved" on status page.

---

## 4. Restore drill steps (game-day template)

**Purpose:** Validate RPO and RTO targets before they are needed in a real disaster. Run quarterly (per SOC 2 CC7 requirement and the PEN_TEST_READINESS.md checklist).

**GATED — AWS:** This drill requires the AWS infrastructure to be provisioned. The drill cannot be performed against the Railway topology.

### Pre-drill checklist

- [ ] Confirm drill is scheduled and Pilot-Charlie is notified (drill runs against a staging environment, not prod — but communicate anyway)
- [ ] Confirm the `d2d-staging-us-east-1-aurora` cluster has at least 1 day of PITR backup available
- [ ] Confirm the drill team has IAM permissions for `rds:RestoreDBClusterToPointInTime`, `ecs:UpdateService`, `secretsmanager:UpdateSecret`
- [ ] Start a stopwatch

### Drill sequence (staging environment)

1. **T+0** — Record the current timestamp. This is the simulated disaster time.
2. **T+2** — Take note of the most recent `AuditEvent.id` in staging Aurora. This is your restore validation target.
3. **T+5** — Initiate PITR restore to T+0 minus 5 minutes (simulating 5-min RPO window).
4. **T+15** — Verify the restored cluster is Available (watch the AWS console or poll `describe-db-clusters`).
5. **T+20** — Run `verify-audit-chain.ts` against the restored cluster.
6. **T+25** — Update the staging `DATABASE_URL` secret to point to the restored cluster.
7. **T+30** — Redeploy staging ECS services.
8. **T+40** — Wait for services to stabilise (healthcheck green).
9. **T+45** — Run the smoke test suite against staging: login, create a knock, sync, create a conversion, generate a payout batch.
10. **T+55** — Confirm all smoke tests pass.
11. **T+60** — Stop the stopwatch. Record actual RTO. Target: ≤60 min.

### Post-drill

- Record: actual RPO (data age of restored snapshot vs T+0), actual RTO (T+0 to smoke tests passing).
- If actual RTO > 60 min: file a gap report and identify what step overran.
- Commit the drill results to `docs/audits/dr-drills/<YYYY>-<MM>-<DD>.md`.
- Clean up the restored staging cluster (`aws rds delete-db-cluster --skip-final-snapshot`).
- Update this document with the measured RTO/RPO from the last drill run.

**Last drill:** Not yet run — GATED on AWS infrastructure provisioning.

---

## 5. KMS key management

Each data class has a dedicated CMK:

| CMK alias                                | Protects                                   | Rotation                                    |
| ---------------------------------------- | ------------------------------------------ | ------------------------------------------- |
| `alias/d2d-prod-us-east-1-rds`           | Aurora data at rest                        | Annual automatic rotation (AWS KMS managed) |
| `alias/d2d-prod-us-east-1-redis-secrets` | ElastiCache data + Secrets Manager secrets | Annual automatic rotation                   |
| `alias/d2d-prod-us-east-1-s3-audit`      | Audit S3 bucket + application secrets      | Annual automatic rotation                   |

**Key deletion policy:** 30-day scheduled deletion window. Terraform manages key lifecycle. Never delete a KMS key that protects existing encrypted data — the data becomes permanently unreadable.

**Key compromise response:** If a CMK is suspected compromised:

1. Create a new CMK immediately.
2. Re-encrypt Aurora (create a new cluster with the new CMK — Aurora does not support in-place re-encryption without a snapshot restore).
3. Re-encrypt affected S3 objects (S3 batch operations with new KMS key).
4. Update all Secrets Manager secrets to use the new CMK.
5. Treat as a P0 security incident (see `data-breach-72h.md`).

---

## 6. Rollback procedure (deploy-level, not DR-level)

For a bad application deployment (not a data disaster):

**ECS (Phase 4):**

```bash
# Get the previous task definition revision
aws ecs describe-task-definition --task-definition d2d-api --query 'taskDefinition.revision'
# Roll back to previous
aws ecs update-service --cluster d2d-prod-us-east-1 --service d2d-api \
  --task-definition d2d-api:<PREVIOUS_REVISION>
```

**Railway (Phase 1–3):**

```
railway rollback --service api
railway rollback --service workers
railway rollback --service webhooks
```

The deployment circuit breaker in Terraform (`rollback = true` on the ECS service) triggers automatic rollback if the new tasks fail health checks. Manual rollback is a fallback if the automatic circuit breaker does not fire.

---

## 7. Honest assessment: what requires real infra to validate

The following cannot be tested without the AWS infrastructure being provisioned:

| Capability                  | Status                                                | Prerequisite                                     |
| --------------------------- | ----------------------------------------------------- | ------------------------------------------------ |
| Aurora PITR restore         | Design complete; untested                             | AWS account + RDS cluster with backup window run |
| ECS task rollback           | Terraform configured; untested                        | AWS account + ECS cluster + ECR images           |
| KMS key rotation            | Terraform configured; untested                        | AWS account + KMS key creation                   |
| Actual RTO measurement      | No game-day run yet                                   | All of the above                                 |
| ElastiCache restore         | Design complete; untested                             | AWS account + ElastiCache cluster                |
| S3 Object Lock verification | Can test locally against MinIO; prod requires real S3 | AWS account + S3 bucket with Object Lock         |

**What can be tested today (Railway / local):**

- Backup restore logic for the `verify-audit-chain.ts` script (run against a local Postgres with test data)
- Rollback via `railway rollback` (requires Railway deploy to have run)
- The re-queue script logic (`requeue-pending-jobs.ts`) against local Redis + Postgres

**Recommendation:** Before Phase 1 go-live, provision the AWS staging environment and run at least one partial game-day (Aurora PITR restore to staging) to validate the restore scripts work as designed. This is in the Phase 1.4 checklist in `docs/architecture.md`.

---

## Drill log

| Date       | Drill                                                                                                                                                                                                                            | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-21 | Local restore procedure walk: `pg_dump -Fc` d2d_dev → fresh `d2d_drill` → `pg_restore` → row-count reconciliation (Org/User/Lead/Conversion/Commission/Knock/AuditEvent all MATCH) → audit-chain verify against the restored DB. | Restore + reconciliation PASS. Chain verify FAILED 5 of 7 scopes — root cause: historical rows written by web-operator's BFF under a drifted `AUDIT_CHAIN_SECRET` (the 2026-08-21 shared-secret incident), not restore corruption. Fix shipped: `writeAudit` now recomputes the previous row's hash before extending and refuses on mismatch (secret-drift tripwire), so drift fails loud at write time instead of silently poisoning evidence until the weekly verify. Dev DB's 5 poisoned scopes left in place deliberately as tripwire fixtures; reseed clears them. Aurora PITR drill itself remains blocked on the AWS account (human-gated). |
