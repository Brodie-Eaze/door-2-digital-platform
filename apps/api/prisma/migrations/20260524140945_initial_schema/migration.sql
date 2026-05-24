-- CreateExtension
-- PostGIS skipped in this initial migration: not available on local
-- postgresql@16 dev installs. Geography columns are TEXT placeholders;
-- a follow-up migration enables postgis + ALTERs columns to
-- geography(<type>, 4326) once the extension is available
-- (CI/staging/prod build that extension into the image).
-- CREATE EXTENSION IF NOT EXISTS "postgis" WITH VERSION "3.4";

-- CreateEnum
CREATE TYPE "RegionCode" AS ENUM ('AU', 'US', 'SG');

-- CreateEnum
CREATE TYPE "Vertical" AS ENUM ('charity', 'commercial');

-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('operator', 'client');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('super_admin', 'org_admin', 'manager', 'knocker', 'inside_sales', 'accountant', 'auditor', 'viewer');

-- CreateEnum
CREATE TYPE "KnockDisposition" AS ENUM ('no_answer', 'not_interested', 'callback', 'do_not_knock', 'appointment', 'converted_donation', 'converted_sale', 'hostile', 'invalid_address');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('new', 'contacted', 'qualified', 'appointment_set', 'converted', 'lost', 'do_not_contact');

-- CreateEnum
CREATE TYPE "ConversionType" AS ENUM ('donation_recurring', 'donation_oneoff', 'sale_commercial');

-- CreateEnum
CREATE TYPE "AttributionSource" AS ENUM ('door', 'inside_sales', 'retargeting', 'other');

-- CreateEnum
CREATE TYPE "DonationFrequency" AS ENUM ('weekly', 'fortnightly', 'monthly', 'annual');

-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('per_knock', 'per_appointment', 'per_conversion', 'override');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('draft', 'ready_to_pay', 'instructed', 'acknowledged', 'archived');

-- CreateEnum
CREATE TYPE "ConsentChannel" AS ENUM ('sms', 'email', 'phone', 'postal', 'door');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('pending', 'delivered', 'failed', 'dlq');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('micamp', 'stripe_au', 'stripe_sg');

-- CreateEnum
CREATE TYPE "SolicitorStatus" AS ENUM ('pending', 'submitted', 'approved', 'expired', 'rejected');

-- CreateEnum
CREATE TYPE "SsoProvider" AS ENUM ('okta', 'azuread', 'auth0', 'google_workspace', 'generic_saml');

-- CreateTable
CREATE TABLE "Org" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradingName" TEXT NOT NULL,
    "vertical" "Vertical" NOT NULL,
    "type" "OrgType" NOT NULL,
    "regionCode" "RegionCode" NOT NULL,
    "brandCode" TEXT NOT NULL DEFAULT 'd2d',
    "abnAcnUen" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "aiBudgetCents" BIGINT NOT NULL DEFAULT 0,
    "aiRetargetingOptOut" BOOLEAN NOT NULL DEFAULT false,
    "dedicatedDb" BOOLEAN NOT NULL DEFAULT false,
    "ssoProvider" "SsoProvider",
    "ssoMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Org_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandKit" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "logoLightKey" TEXT,
    "logoDarkKey" TEXT,
    "iconKey" TEXT,
    "faviconKey" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#0F172A',
    "accentColor" TEXT NOT NULL DEFAULT '#3B82F6',
    "customDomain" TEXT,
    "appBundleId" TEXT,
    "appPackageName" TEXT,
    "supportEmail" TEXT,
    "supportPhone" TEXT,
    "privacyPolicyUrl" TEXT,
    "termsUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandKit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgBilling" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "platformFeeMonthlyCents" BIGINT NOT NULL DEFAULT 250000,
    "doorRakePercent" DECIMAL(5,2) NOT NULL DEFAULT 15.00,
    "insideSalesRakePercent" DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    "retargetingRakePercent" DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    "billingDay" INTEGER NOT NULL DEFAULT 1,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "micampMerchantId" TEXT,
    "stripeCustomerId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgBilling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SsoConfiguration" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "provider" "SsoProvider" NOT NULL,
    "entityId" TEXT NOT NULL,
    "ssoUrl" TEXT NOT NULL,
    "certificateKey" TEXT NOT NULL,
    "attributeMappingJson" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastValidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailDigest" TEXT NOT NULL,
    "phone" TEXT,
    "phoneDigest" TEXT,
    "givenName" TEXT NOT NULL,
    "familyName" TEXT NOT NULL,
    "role" "PlatformRole" NOT NULL,
    "managerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "regionCode" "RegionCode" NOT NULL,
    "brandCode" TEXT NOT NULL DEFAULT 'd2d',
    "cognitoSub" TEXT,
    "webauthnRequired" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Territory" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "regionCode" "RegionCode" NOT NULL,
    "brandCode" TEXT NOT NULL DEFAULT 'd2d',
    "name" TEXT NOT NULL,
    "vertical" "Vertical" NOT NULL,
    "polygon" TEXT,
    "centroid" TEXT,
    "s2CellIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "campaignId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Territory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerritoryAssignment" (
    "id" TEXT NOT NULL,
    "territoryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "TerritoryAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "regionCode" "RegionCode" NOT NULL,
    "brandCode" TEXT NOT NULL DEFAULT 'd2d',
    "name" TEXT NOT NULL,
    "vertical" "Vertical" NOT NULL,
    "charityRegistrationNumber" TEXT,
    "pitchScriptMd" TEXT,
    "budgetCents" BIGINT NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaidSolicitorRegistration" (
    "id" TEXT NOT NULL,
    "regionCode" "RegionCode" NOT NULL,
    "state" TEXT NOT NULL,
    "entityOrgId" TEXT NOT NULL,
    "clientOrgId" TEXT NOT NULL,
    "status" "SolicitorStatus" NOT NULL DEFAULT 'pending',
    "filedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "bondAmountCents" BIGINT NOT NULL DEFAULT 0,
    "registrationNumber" TEXT,
    "evidenceKey" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaidSolicitorRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignStateClearance" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "clearedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidSolicitorRegistrationId" TEXT NOT NULL,

    CONSTRAINT "CampaignStateClearance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "regionCode" "RegionCode" NOT NULL,
    "formatted" TEXT NOT NULL,
    "unit" TEXT,
    "street" TEXT NOT NULL,
    "locality" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "geo" TEXT,
    "s2CellId" TEXT,
    "hashKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnockSession" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "territoryId" TEXT NOT NULL,
    "regionCode" "RegionCode" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "startGeo" TEXT,
    "deviceId" TEXT NOT NULL,
    "appVersion" TEXT,
    "osVersion" TEXT,
    "attestationToken" TEXT,

    CONSTRAINT "KnockSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Knock" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "territoryId" TEXT NOT NULL,
    "addressId" TEXT NOT NULL,
    "regionCode" "RegionCode" NOT NULL,
    "brandCode" TEXT NOT NULL DEFAULT 'd2d',
    "disposition" "KnockDisposition" NOT NULL,
    "geo" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "serverReceivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientOffsetMs" INTEGER,
    "photoKey" TEXT,
    "signatureKey" TEXT,
    "notes" TEXT,
    "leadId" TEXT,
    "syncBatchId" TEXT,
    "idempotencyKey" TEXT NOT NULL,

    CONSTRAINT "Knock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "regionCode" "RegionCode" NOT NULL,
    "brandCode" TEXT NOT NULL DEFAULT 'd2d',
    "sourceKnockId" TEXT,
    "addressId" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'new',
    "assignedToId" TEXT,
    "vertical" "Vertical" NOT NULL,
    "campaignId" TEXT,
    "givenName" TEXT NOT NULL,
    "familyName" TEXT NOT NULL,
    "email" TEXT,
    "emailDigest" TEXT,
    "phone" TEXT,
    "phoneDigest" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadActivity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "outcome" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversion" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "regionCode" "RegionCode" NOT NULL,
    "brandCode" TEXT NOT NULL DEFAULT 'd2d',
    "leadId" TEXT NOT NULL,
    "knockId" TEXT,
    "campaignId" TEXT,
    "knockerId" TEXT,
    "closerId" TEXT,
    "type" "ConversionType" NOT NULL,
    "attributionSource" "AttributionSource" NOT NULL,
    "retargetingCampaignId" TEXT,
    "amountCents" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "signedAt" TIMESTAMP(3) NOT NULL,
    "signatureKey" TEXT,
    "paymentProvider" "PaymentProvider" NOT NULL,
    "paymentExternalId" TEXT,
    "processorResidualCents" BIGINT NOT NULL DEFAULT 0,
    "d2dRakeCents" BIGINT NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT NOT NULL,

    CONSTRAINT "Conversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL,
    "conversionId" TEXT NOT NULL,
    "donorEmail" TEXT NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "frequency" "DonationFrequency",
    "paymentMethodToken" TEXT NOT NULL,
    "externalSubscriptionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "receiptNumber" TEXT,
    "deductibleGiftRecipientNo" TEXT,
    "einOrEquivalent" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "conversionId" TEXT NOT NULL,
    "productSku" TEXT NOT NULL,
    "installerOrgId" TEXT,
    "scheduledInstallAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending_install',

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionPlan" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vertical" "Vertical" NOT NULL,
    "rules" JSONB NOT NULL,
    "rulesVersion" TEXT NOT NULL DEFAULT 'v0.1',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),

    CONSTRAINT "CommissionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commission" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "type" "CommissionType" NOT NULL,
    "conversionId" TEXT,
    "knockId" TEXT,
    "amountCents" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "payoutBatchId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'accrued',

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutBatch" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "regionCode" "RegionCode" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "PayoutStatus" NOT NULL,
    "totalCents" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "instructionFileKey" TEXT,
    "instructedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),

    CONSTRAINT "PayoutBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdAccount" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "tokenVaultRef" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Creative" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "assetKey" TEXT NOT NULL,
    "prompt" TEXT,
    "model" TEXT,
    "modelVersion" TEXT,
    "costCents" BIGINT NOT NULL DEFAULT 0,
    "safetyScanResult" JSONB NOT NULL DEFAULT '{}',
    "c2paManifestId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Creative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdCampaign" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "campaignId" TEXT,
    "adAccountId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "audienceJson" JSONB NOT NULL,
    "budgetCents" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "externalCampaignId" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoNotKnock" (
    "id" TEXT NOT NULL,
    "regionCode" "RegionCode" NOT NULL,
    "addressId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "loadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoNotKnock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoNotCall" (
    "id" TEXT NOT NULL,
    "regionCode" "RegionCode" NOT NULL,
    "phoneDigest" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "loadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoNotCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "channel" "ConsentChannel" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "text" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "ip" TEXT,
    "geo" TEXT,
    "proofKey" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" BIGSERIAL NOT NULL,
    "ulid" TEXT NOT NULL,
    "orgId" TEXT,
    "regionCode" "RegionCode" NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "prevHash" TEXT NOT NULL,
    "rowHash" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shippedToS3At" TIMESTAMP(3),

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "scopes" TEXT[],
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secretCipher" TEXT NOT NULL,
    "eventTypes" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" "WebhookStatus" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3),
    "payloadKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "key" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "bodyHash" TEXT NOT NULL,
    "responseStatus" INTEGER NOT NULL,
    "responseBodyKey" TEXT NOT NULL,
    "responseBody" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "UserCredential" (
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "inviteTokenHash" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCredential_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "rotatedToId" TEXT,
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AdCampaignToCreative" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "Org_regionCode_status_idx" ON "Org"("regionCode", "status");

-- CreateIndex
CREATE INDEX "Org_type_status_idx" ON "Org"("type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BrandKit_orgId_key" ON "BrandKit"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandKit_customDomain_key" ON "BrandKit"("customDomain");

-- CreateIndex
CREATE UNIQUE INDEX "OrgBilling_orgId_key" ON "OrgBilling"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "SsoConfiguration_orgId_key" ON "SsoConfiguration"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailDigest_key" ON "User"("emailDigest");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneDigest_key" ON "User"("phoneDigest");

-- CreateIndex
CREATE UNIQUE INDEX "User_cognitoSub_key" ON "User"("cognitoSub");

-- CreateIndex
CREATE INDEX "User_orgId_role_idx" ON "User"("orgId", "role");

-- CreateIndex
CREATE INDEX "User_orgId_managerId_idx" ON "User"("orgId", "managerId");

-- CreateIndex
CREATE INDEX "User_orgId_status_idx" ON "User"("orgId", "status");

-- CreateIndex
CREATE INDEX "Territory_orgId_status_idx" ON "Territory"("orgId", "status");

-- CreateIndex
CREATE INDEX "Territory_campaignId_idx" ON "Territory"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "TerritoryAssignment_territoryId_userId_assignedAt_key" ON "TerritoryAssignment"("territoryId", "userId", "assignedAt");

-- CreateIndex
CREATE INDEX "Campaign_orgId_status_idx" ON "Campaign"("orgId", "status");

-- CreateIndex
CREATE INDEX "PaidSolicitorRegistration_state_status_idx" ON "PaidSolicitorRegistration"("state", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PaidSolicitorRegistration_entityOrgId_clientOrgId_state_reg_key" ON "PaidSolicitorRegistration"("entityOrgId", "clientOrgId", "state", "regionCode");

-- CreateIndex
CREATE INDEX "CampaignStateClearance_state_idx" ON "CampaignStateClearance"("state");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignStateClearance_campaignId_state_key" ON "CampaignStateClearance"("campaignId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "Address_hashKey_key" ON "Address"("hashKey");

-- CreateIndex
CREATE INDEX "Address_regionCode_locality_idx" ON "Address"("regionCode", "locality");

-- CreateIndex
CREATE INDEX "Address_s2CellId_idx" ON "Address"("s2CellId");

-- CreateIndex
CREATE INDEX "KnockSession_userId_startedAt_idx" ON "KnockSession"("userId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Knock_idempotencyKey_key" ON "Knock"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Knock_orgId_capturedAt_idx" ON "Knock"("orgId", "capturedAt");

-- CreateIndex
CREATE INDEX "Knock_addressId_idx" ON "Knock"("addressId");

-- CreateIndex
CREATE INDEX "Knock_userId_capturedAt_idx" ON "Knock"("userId", "capturedAt");

-- CreateIndex
CREATE INDEX "Lead_orgId_status_assignedToId_idx" ON "Lead"("orgId", "status", "assignedToId");

-- CreateIndex
CREATE INDEX "Lead_phoneDigest_idx" ON "Lead"("phoneDigest");

-- CreateIndex
CREATE INDEX "Lead_emailDigest_idx" ON "Lead"("emailDigest");

-- CreateIndex
CREATE INDEX "LeadActivity_leadId_createdAt_idx" ON "LeadActivity"("leadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversion_idempotencyKey_key" ON "Conversion"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Conversion_orgId_signedAt_idx" ON "Conversion"("orgId", "signedAt");

-- CreateIndex
CREATE INDEX "Conversion_campaignId_attributionSource_idx" ON "Conversion"("campaignId", "attributionSource");

-- CreateIndex
CREATE INDEX "Conversion_knockerId_signedAt_idx" ON "Conversion"("knockerId", "signedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_conversionId_key" ON "Donation"("conversionId");

-- CreateIndex
CREATE INDEX "Donation_externalSubscriptionId_idx" ON "Donation"("externalSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_conversionId_key" ON "Sale"("conversionId");

-- CreateIndex
CREATE INDEX "Commission_userId_periodStart_idx" ON "Commission"("userId", "periodStart");

-- CreateIndex
CREATE INDEX "Commission_payoutBatchId_idx" ON "Commission"("payoutBatchId");

-- CreateIndex
CREATE INDEX "PayoutBatch_orgId_status_idx" ON "PayoutBatch"("orgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DoNotKnock_regionCode_addressId_key" ON "DoNotKnock"("regionCode", "addressId");

-- CreateIndex
CREATE UNIQUE INDEX "DoNotCall_regionCode_phoneDigest_key" ON "DoNotCall"("regionCode", "phoneDigest");

-- CreateIndex
CREATE INDEX "ConsentRecord_leadId_capturedAt_idx" ON "ConsentRecord"("leadId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_ulid_key" ON "AuditEvent"("ulid");

-- CreateIndex
CREATE INDEX "AuditEvent_orgId_occurredAt_idx" ON "AuditEvent"("orgId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_resourceType_resourceId_idx" ON "AuditEvent"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "AuditEvent_occurredAt_idx" ON "AuditEvent"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_prefix_key" ON "ApiKey"("prefix");

-- CreateIndex
CREATE INDEX "WebhookDelivery_endpointId_status_idx" ON "WebhookDelivery"("endpointId", "status");

-- CreateIndex
CREATE INDEX "WebhookDelivery_status_nextAttemptAt_idx" ON "WebhookDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserCredential_inviteTokenHash_key" ON "UserCredential"("inviteTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_revokedAt_idx" ON "RefreshToken"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "_AdCampaignToCreative_AB_unique" ON "_AdCampaignToCreative"("A", "B");

-- CreateIndex
CREATE INDEX "_AdCampaignToCreative_B_index" ON "_AdCampaignToCreative"("B");

-- AddForeignKey
ALTER TABLE "BrandKit" ADD CONSTRAINT "BrandKit_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgBilling" ADD CONSTRAINT "OrgBilling_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoConfiguration" ADD CONSTRAINT "SsoConfiguration_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Territory" ADD CONSTRAINT "Territory_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Territory" ADD CONSTRAINT "Territory_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerritoryAssignment" ADD CONSTRAINT "TerritoryAssignment_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerritoryAssignment" ADD CONSTRAINT "TerritoryAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaidSolicitorRegistration" ADD CONSTRAINT "PaidSolicitorRegistration_entityOrgId_fkey" FOREIGN KEY ("entityOrgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignStateClearance" ADD CONSTRAINT "CampaignStateClearance_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignStateClearance" ADD CONSTRAINT "CampaignStateClearance_paidSolicitorRegistrationId_fkey" FOREIGN KEY ("paidSolicitorRegistrationId") REFERENCES "PaidSolicitorRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnockSession" ADD CONSTRAINT "KnockSession_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnockSession" ADD CONSTRAINT "KnockSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnockSession" ADD CONSTRAINT "KnockSession_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Knock" ADD CONSTRAINT "Knock_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "KnockSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Knock" ADD CONSTRAINT "Knock_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Knock" ADD CONSTRAINT "Knock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Knock" ADD CONSTRAINT "Knock_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Knock" ADD CONSTRAINT "Knock_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Knock" ADD CONSTRAINT "Knock_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_knockId_fkey" FOREIGN KEY ("knockId") REFERENCES "Knock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_knockerId_fkey" FOREIGN KEY ("knockerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_closerId_fkey" FOREIGN KEY ("closerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_conversionId_fkey" FOREIGN KEY ("conversionId") REFERENCES "Conversion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_conversionId_fkey" FOREIGN KEY ("conversionId") REFERENCES "Conversion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionPlan" ADD CONSTRAINT "CommissionPlan_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CommissionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_payoutBatchId_fkey" FOREIGN KEY ("payoutBatchId") REFERENCES "PayoutBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutBatch" ADD CONSTRAINT "PayoutBatch_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdAccount" ADD CONSTRAINT "AdAccount_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creative" ADD CONSTRAINT "Creative_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCredential" ADD CONSTRAINT "UserCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AdCampaignToCreative" ADD CONSTRAINT "_AdCampaignToCreative_A_fkey" FOREIGN KEY ("A") REFERENCES "AdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AdCampaignToCreative" ADD CONSTRAINT "_AdCampaignToCreative_B_fkey" FOREIGN KEY ("B") REFERENCES "Creative"("id") ON DELETE CASCADE ON UPDATE CASCADE;
