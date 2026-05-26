-- CreateIndex
CREATE INDEX "AuditEvent_orgId_regionCode_id_idx" ON "AuditEvent"("orgId", "regionCode", "id" DESC);
