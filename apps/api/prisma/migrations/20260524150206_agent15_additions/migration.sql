-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "emailVault" JSONB,
ADD COLUMN     "notesVault" JSONB,
ADD COLUMN     "phoneVault" JSONB;

-- CreateTable
CREATE TABLE "PiiUnmaskRequest" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "regionCode" "RegionCode" NOT NULL,
    "requesterId" TEXT NOT NULL,
    "approverId" TEXT,
    "rowType" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "fields" TEXT[],
    "justification" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "grantTokenHash" TEXT,
    "grantExpiresAt" TIMESTAMP(3),
    "revealedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PiiUnmaskRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "regionCode" "RegionCode" NOT NULL,
    "channel" TEXT NOT NULL,
    "recipientHash" TEXT NOT NULL,
    "subject" TEXT,
    "bodyPreview" TEXT NOT NULL,
    "fromBrand" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "providerExternalId" TEXT,
    "providerError" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PiiUnmaskRequest_orgId_status_idx" ON "PiiUnmaskRequest"("orgId", "status");

-- CreateIndex
CREATE INDEX "PiiUnmaskRequest_rowType_rowId_idx" ON "PiiUnmaskRequest"("rowType", "rowId");

-- CreateIndex
CREATE INDEX "NotificationLog_orgId_channel_status_idx" ON "NotificationLog"("orgId", "channel", "status");

-- CreateIndex
CREATE INDEX "NotificationLog_orgId_createdAt_idx" ON "NotificationLog"("orgId", "createdAt");
