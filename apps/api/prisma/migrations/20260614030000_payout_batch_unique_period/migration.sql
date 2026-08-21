-- C10: Prevent duplicate payout batches for the same org + period.
-- A unique constraint at the DB level ensures concurrent calls to
-- generatePayoutBatch for the same (orgId, periodStart, periodEnd) fail
-- with a unique violation rather than silently creating two batches.
CREATE UNIQUE INDEX "PayoutBatch_orgId_periodStart_periodEnd_key"
  ON "PayoutBatch"("orgId", "periodStart", "periodEnd");
