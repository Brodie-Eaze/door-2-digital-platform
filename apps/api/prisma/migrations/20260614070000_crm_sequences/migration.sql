-- CRM Sequences — multi-touch campaign templates + lead enrollments.
--
-- CrmSequence: stores the template (name, description, stepsJson).
-- CrmSequenceEnrollment: links Lead → CrmSequence, tracks execution state.
-- BullMQ workers (lead-sequence queue) read enrollments and dispatch each
-- step at the scheduled delayHours offset.

-- ─────────────────────────────────────────────────────────────────────────────
-- CrmSequence
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "CrmSequence" (
    "id"          TEXT NOT NULL,
    "orgId"       TEXT NOT NULL,
    "regionCode"  TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "stepsJson"   JSONB NOT NULL DEFAULT '[]',
    "status"      TEXT NOT NULL DEFAULT 'active',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmSequence_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CrmSequence"
    ADD CONSTRAINT "CrmSequence_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "CrmSequence_orgId_status_idx" ON "CrmSequence"("orgId", "status");
CREATE INDEX "CrmSequence_orgId_createdAt_idx" ON "CrmSequence"("orgId", "createdAt" DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- CrmSequenceEnrollment
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "CrmSequenceEnrollment" (
    "id"          TEXT NOT NULL,
    "sequenceId"  TEXT NOT NULL,
    "leadId"      TEXT NOT NULL,
    "orgId"       TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "status"      TEXT NOT NULL DEFAULT 'active',
    "startAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmSequenceEnrollment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CrmSequenceEnrollment"
    ADD CONSTRAINT "CrmSequenceEnrollment_sequenceId_fkey"
    FOREIGN KEY ("sequenceId") REFERENCES "CrmSequence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CrmSequenceEnrollment"
    ADD CONSTRAINT "CrmSequenceEnrollment_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CrmSequenceEnrollment"
    ADD CONSTRAINT "CrmSequenceEnrollment_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One active enrollment per lead per sequence
CREATE UNIQUE INDEX "CrmSequenceEnrollment_sequenceId_leadId_key"
    ON "CrmSequenceEnrollment"("sequenceId", "leadId");

CREATE INDEX "CrmSequenceEnrollment_orgId_status_idx"   ON "CrmSequenceEnrollment"("orgId", "status");
CREATE INDEX "CrmSequenceEnrollment_sequenceId_status_idx" ON "CrmSequenceEnrollment"("sequenceId", "status");
CREATE INDEX "CrmSequenceEnrollment_leadId_idx"         ON "CrmSequenceEnrollment"("leadId");

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS belt — same pattern as prior belt migrations
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "CrmSequence" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "CrmSequence";
CREATE POLICY tenant_isolation ON "CrmSequence"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

ALTER TABLE "CrmSequenceEnrollment" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "CrmSequenceEnrollment";
CREATE POLICY tenant_isolation ON "CrmSequenceEnrollment"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));
