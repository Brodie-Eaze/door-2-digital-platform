-- Two hot-path indexes for scale.
--
-- 1) AuditEvent: the audit-shipper worker polls
--       WHERE shippedToS3At IS NULL ORDER BY id ASC
--    every 60 seconds. AuditEvent is the highest-volume table (one row per
--    action). Once shipping is caught up almost every row is shipped, so the
--    NULL predicate is highly selective — leading with shippedToS3At turns the
--    poll into a small index range instead of a full table scan.
--
-- 2) Lead: the inbox query is
--       WHERE orgId = ? [status filter] ORDER BY createdAt DESC LIMIT 50.
--    An [orgId, createdAt] index returns the newest page straight off the
--    index instead of sorting the whole org's leads.
--
-- Both tables are small today, so plain CREATE INDEX (brief write-lock) is
-- fine; switch to CREATE INDEX CONCURRENTLY if either is large when this ships.
CREATE INDEX "AuditEvent_shippedToS3At_id_idx" ON "AuditEvent"("shippedToS3At", "id");
CREATE INDEX "Lead_orgId_createdAt_idx" ON "Lead"("orgId", "createdAt");
