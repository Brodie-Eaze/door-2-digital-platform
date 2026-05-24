-- CreateTable
CREATE TABLE "ProviderConnection" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "credentialsVault" JSONB,
    "accountLabel" TEXT,
    "accountId" TEXT,
    "webhookSecretHash" TEXT,
    "lastPingAt" TIMESTAMP(3),
    "lastPingStatus" TEXT,
    "lastPingError" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMP(3),

    CONSTRAINT "ProviderConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentGenerationJob" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "providerConnectionId" TEXT NOT NULL,
    "providerKind" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "inputJson" JSONB NOT NULL,
    "outputJson" JSONB,
    "costCents" BIGINT NOT NULL DEFAULT 0,
    "modelId" TEXT,
    "promptHash" TEXT,
    "safetyScanResult" TEXT,
    "c2paManifestId" TEXT,
    "externalJobId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,

    CONSTRAINT "ContentGenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderWebhookEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "providerConnectionId" TEXT,
    "providerKind" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "verifiedSignature" BOOLEAN NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "ProviderWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProviderConnection_orgId_status_idx" ON "ProviderConnection"("orgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderConnection_orgId_kind_key" ON "ProviderConnection"("orgId", "kind");

-- CreateIndex
CREATE INDEX "ContentGenerationJob_orgId_status_createdAt_idx" ON "ContentGenerationJob"("orgId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ContentGenerationJob_orgId_providerKind_createdAt_idx" ON "ContentGenerationJob"("orgId", "providerKind", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ContentGenerationJob_externalJobId_idx" ON "ContentGenerationJob"("externalJobId");

-- CreateIndex
CREATE INDEX "ProviderWebhookEvent_orgId_providerKind_receivedAt_idx" ON "ProviderWebhookEvent"("orgId", "providerKind", "receivedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderWebhookEvent_providerKind_externalId_key" ON "ProviderWebhookEvent"("providerKind", "externalId");

-- AddForeignKey
ALTER TABLE "ProviderConnection" ADD CONSTRAINT "ProviderConnection_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentGenerationJob" ADD CONSTRAINT "ContentGenerationJob_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentGenerationJob" ADD CONSTRAINT "ContentGenerationJob_providerConnectionId_fkey" FOREIGN KEY ("providerConnectionId") REFERENCES "ProviderConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderWebhookEvent" ADD CONSTRAINT "ProviderWebhookEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderWebhookEvent" ADD CONSTRAINT "ProviderWebhookEvent_providerConnectionId_fkey" FOREIGN KEY ("providerConnectionId") REFERENCES "ProviderConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
