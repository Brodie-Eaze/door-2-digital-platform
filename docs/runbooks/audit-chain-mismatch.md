# Runbook — Audit Chain Mismatch

> **Owner:** Brodie · **Updated:** 2026-06-05
> **Scope:** `services/audit`, `apps/workers` (audit-ship cron), S3 audit bucket (Object Lock COMPLIANCE), `docs/audits/merkle-roots/`
> **Severity:** P0 — a hash chain break means either data tampering or a software defect. Both require immediate investigation before the weekly Merkle root is committed.
> **Alert source:** CI weekly job `audit-verify` fails; or Datadog alert `audit_chain_integrity` = 0; or manual spot-check

---

## What the audit chain is

Every write to the platform produces an `AuditEvent` row. Each row carries:

- `prevHash` — SHA-256 of the immediately preceding event's `rowHash` (or a known genesis constant for the first event)
- `rowHash` — SHA-256 of `prevHash + CONCAT(id, orgId, action, resourceType, resourceId, beforeJson, afterJson, occurredAt)`

This forms a hash chain: any insertion, deletion, or modification of a historical row breaks the chain at that point. The chain is per-region (US, AU, SG). Weekly, the chain is verified and a Merkle root committed to `docs/audits/merkle-roots/<region>/<YYYY>-W<NN>.json`. The CI weekly job re-verifies the chain and fails the run if the recomputed root does not match the committed one.

**For SOC 2 CC7 (System Operations) and CC9 (Risk Mitigation):** A clean weekly Merkle root is evidence that audit data has not been tampered with since the last verification. A mismatch is a control failure and must be investigated and documented.

---

## Step 1 — Detect + triage (≤15 min)

**Alert triggers:**

- CI `audit-verify` job exit code non-zero
- Datadog metric `d2d.audit.chain_valid{region}` = 0
- Manual: `pnpm --filter workers exec ts-node tools/scripts/verify-audit-chain.ts --region us` outputs `CHAIN BREAK at row <id>`

**Immediate questions:**

1. Which region (US / AU / SG)?
2. At which `AuditEvent.id` does the chain break?
3. What is the `occurredAt` timestamp of the break point?
4. Is the break in the hot store (Aurora `AuditEvent` table) or the cold store (S3 Object Lock archive)?
5. Was any deployment, migration, or data operation performed around the break point?

---

## Step 2 — Diagnose

### Check the hot store (Aurora)

```sql
-- Find the break: walk the chain from the break point
SELECT id, "prevHash", "rowHash", "occurredAt", action, "resourceType"
FROM "AuditEvent"
WHERE "orgId" = '<org_id>'  -- or cross all orgs
ORDER BY id ASC
LIMIT 200 OFFSET <break_point_offset>;

-- Recompute rowHash for the suspect row (use the same algorithm as audit/service.ts)
-- If recomputed hash != stored rowHash → the row was modified
-- If stored prevHash != predecessor rowHash → a row was inserted or deleted before this one
```

### Check the cold store (S3)

S3 audit bucket has Object Lock COMPLIANCE. A locked object cannot be deleted or modified before its retention expires (7 years). If the S3 copy shows the chain intact but Aurora does not, the problem is in the hot store only — a row was deleted or modified in Aurora after it was shipped to S3.

```
# Download the S3 audit archive for the affected time window [AWS]
aws s3 cp s3://d2d-prod-audit-<account>/us-east-1/<YYYY>/<MM>/<DD>/ \
  /tmp/audit-restore/ --recursive

# Verify the S3 chain matches the pre-break Merkle root in docs/audits/merkle-roots/
pnpm --filter workers exec ts-node tools/scripts/verify-audit-chain.ts \
  --source /tmp/audit-restore/ --region us
```

### Classify the mismatch type

| Observation                                                        | Classification                                    | Severity                                      |
| ------------------------------------------------------------------ | ------------------------------------------------- | --------------------------------------------- |
| Row hash does not match recomputed hash                            | Row was modified after write                      | Potential tampering — P0                      |
| prevHash does not match predecessor rowHash                        | Row deleted or inserted before this point         | Potential tampering or bug — P0               |
| S3 chain intact but Aurora chain broken                            | Row deleted from Aurora after S3 ship             | Investigate deletion path — P0                |
| S3 chain also broken at same point                                 | Problem occurred before S3 ship                   | Bug in audit service logic or data corruption |
| Break only in rows newer than the last S3 ship (within 60s window) | Likely a race condition in the ship cron — benign | Investigate audit-ship job timing             |
| Break correlates exactly with a known migration                    | Migration touched AuditEvent table                | Review migration SQL — was it destructive?    |

---

## Step 3 — Contain

- If tampering is suspected: treat this as a data breach (see `data-breach-72h.md`). Do not announce externally yet, but begin the breach response protocol in parallel.
- Immediately pause the `audit-ship` cron (do not ship more events until the chain state is understood): set the `AUDIT_SHIP_PAUSED=true` feature flag or stop the workers ECS task.
- Preserve all evidence: download the affected Aurora rows and the S3 archive before any repair is attempted.
- Do not modify the `AuditEvent` table to "fix" the chain. This would make things worse. The chain must be investigated as-is.

---

## Step 4 — Remediate

### If it is a software bug (most likely cause — e.g. AUDIT-CHAIN-SERIALIZATION race)

The known `AUDIT-CHAIN-SERIALIZATION` issue (see `docs/50k/HARDENING-LOG.md`) can cause write ordering anomalies under concurrent load. If the break correlates with a high-traffic period:

1. Review the gap in `prevHash` sequences — are any IDs missing from the Aurora chain?
2. If missing: they were either never written (a bug), or written to S3 but not Aurora (shipping duplicated without hot-store write — a different bug). Check the `shippedToS3At` column.
3. Fix the bug. The chain cannot be repaired retroactively without invalidating the Merkle root. Instead: document the gap as a known software defect in the incident record, commit a new `broken-chain-note` file to `docs/audits/merkle-roots/<region>/` explaining the gap, and re-establish a new chain genesis from the next valid row.
4. Update the weekly CI job to note the documented break range as exempted until the fix is deployed.

### If tampering is confirmed

This is a security incident. The audit chain is your evidence trail — preserve it entirely. Do not repair the chain. Engage external forensics. File the data breach report per `data-breach-72h.md`.

### Resuming the audit-ship cron

Only resume after the root cause is documented. Resume by clearing the `AUDIT_SHIP_PAUSED` flag. Verify the first post-resume ship produces a valid chain link against the last known-good hash.

---

## Step 5 — SOC 2 documentation

Any audit chain mismatch, even if caused by a software bug with no tampering, is a SOC 2 control exception. Document it in the incident register:

- Date range of the mismatch
- Root cause (bug / tampering / other)
- Rows affected (count and time range)
- Whether data in S3 Object Lock archive was affected
- Remediation steps and date closed
- Whether the next weekly Merkle root verification passed cleanly

Provide this documentation to the SOC 2 auditor if the incident falls within the Type II observation window.

---

## Escalation

| Condition                                              | Action                                                                  |
| ------------------------------------------------------ | ----------------------------------------------------------------------- |
| Root cause unknown after 2 hours                       | Engage external security firm                                           |
| S3 Object Lock archive also shows break                | P0 security incident — contact US counsel                               |
| Break correlates with a partner integration write path | Review that partner's write permissions immediately                     |
| Break on the `AuditEvent` table owner-role path        | The audit service itself may be compromised — rotate all DB credentials |
