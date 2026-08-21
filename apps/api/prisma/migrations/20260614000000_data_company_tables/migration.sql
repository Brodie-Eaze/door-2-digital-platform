-- Migration: data_company_tables
-- Adds: ServiceOffering, KnockPhoto, PropensityScore, VoiceRecording, AnalyticsEvent
-- Alters: Territory (areaType, radiusMeters), KnockerShift (userId, territoryId FKs)

-- AlterTable
ALTER TABLE "KnockerShift" ADD COLUMN "territoryId" TEXT,
                            ADD COLUMN "userId" TEXT;

-- AlterTable
ALTER TABLE "Territory" ADD COLUMN "areaType" TEXT NOT NULL DEFAULT 'polygon',
                         ADD COLUMN "radiusMeters" INTEGER;

-- CreateTable
CREATE TABLE "ServiceOffering" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "regionCode" "RegionCode" NOT NULL,
    "brandCode" TEXT NOT NULL DEFAULT 'd2d',
    "campaignId" TEXT,
    "name" TEXT NOT NULL,
    "blurb" TEXT NOT NULL DEFAULT '',
    "amountCents" BIGINT NOT NULL,
    "frequency" TEXT NOT NULL,
    "vertical" "Vertical" NOT NULL,
    "highlighted" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceOffering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnockPhoto" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "regionCode" "RegionCode" NOT NULL,
    "knockId" TEXT,
    "clientKnockId" TEXT,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "byteSize" INTEGER,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "addressLine" TEXT,
    "mlLabels" JSONB,
    "mlProcessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnockPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropensityScore" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "regionCode" "RegionCode" NOT NULL,
    "geoType" TEXT NOT NULL,
    "geoKey" TEXT NOT NULL,
    "centroidLat" DOUBLE PRECISION,
    "centroidLng" DOUBLE PRECISION,
    "score" DOUBLE PRECISION NOT NULL,
    "band" TEXT,
    "modelName" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "features" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropensityScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceRecording" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "regionCode" "RegionCode" NOT NULL,
    "knockId" TEXT,
    "clientKnockId" TEXT,
    "storageKey" TEXT NOT NULL,
    "durationMs" INTEGER,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "consentObtained" BOOLEAN NOT NULL DEFAULT false,
    "transcriptionStatus" TEXT NOT NULL DEFAULT 'pending',
    "transcript" TEXT,
    "analysis" JSONB,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceRecording_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "regionCode" "RegionCode" NOT NULL,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "shippedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceOffering_orgId_active_sortOrder_idx" ON "ServiceOffering"("orgId", "active", "sortOrder");

-- CreateIndex
CREATE INDEX "KnockPhoto_orgId_capturedAt_idx" ON "KnockPhoto"("orgId", "capturedAt");

-- CreateIndex
CREATE INDEX "KnockPhoto_knockId_idx" ON "KnockPhoto"("knockId");

-- CreateIndex
CREATE INDEX "KnockPhoto_clientKnockId_idx" ON "KnockPhoto"("clientKnockId");

-- CreateIndex
CREATE INDEX "KnockPhoto_mlProcessedAt_idx" ON "KnockPhoto"("mlProcessedAt");

-- CreateIndex
CREATE INDEX "PropensityScore_orgId_geoType_geoKey_idx" ON "PropensityScore"("orgId", "geoType", "geoKey");

-- CreateIndex
CREATE INDEX "PropensityScore_regionCode_band_idx" ON "PropensityScore"("regionCode", "band");

-- CreateIndex
CREATE INDEX "PropensityScore_geoType_geoKey_idx" ON "PropensityScore"("geoType", "geoKey");

-- CreateIndex
CREATE INDEX "VoiceRecording_orgId_transcriptionStatus_idx" ON "VoiceRecording"("orgId", "transcriptionStatus");

-- CreateIndex
CREATE INDEX "VoiceRecording_knockId_idx" ON "VoiceRecording"("knockId");

-- CreateIndex
CREATE INDEX "VoiceRecording_processedAt_idx" ON "VoiceRecording"("processedAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_orgId_eventType_occurredAt_idx" ON "AnalyticsEvent"("orgId", "eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_shippedAt_idx" ON "AnalyticsEvent"("shippedAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_eventType_occurredAt_idx" ON "AnalyticsEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "KnockerShift_userId_weekStart_idx" ON "KnockerShift"("userId", "weekStart");

-- AddForeignKey
ALTER TABLE "KnockerShift" ADD CONSTRAINT "KnockerShift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnockerShift" ADD CONSTRAINT "KnockerShift_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOffering" ADD CONSTRAINT "ServiceOffering_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnockPhoto" ADD CONSTRAINT "KnockPhoto_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnockPhoto" ADD CONSTRAINT "KnockPhoto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropensityScore" ADD CONSTRAINT "PropensityScore_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceRecording" ADD CONSTRAINT "VoiceRecording_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceRecording" ADD CONSTRAINT "VoiceRecording_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
