-- CreateTable
CREATE TABLE "DsarRequest" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "regionCode" "RegionCode" NOT NULL,
    "kind" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "subjectEmail" TEXT,
    "subjectPhone" TEXT,
    "subjectLeadId" TEXT,
    "proofOfIdentityKey" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedByUserId" TEXT,
    "slaDueAt" TIMESTAMP(3) NOT NULL,
    "fulfilledAt" TIMESTAMP(3),
    "responsePackageKey" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DsarRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DsarRequest_orgId_status_idx" ON "DsarRequest"("orgId", "status");

-- CreateIndex
CREATE INDEX "DsarRequest_orgId_createdAt_idx" ON "DsarRequest"("orgId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DsarRequest_slaDueAt_status_idx" ON "DsarRequest"("slaDueAt", "status");

-- AddForeignKey
ALTER TABLE "DsarRequest" ADD CONSTRAINT "DsarRequest_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
