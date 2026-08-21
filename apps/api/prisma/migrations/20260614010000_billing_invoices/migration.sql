-- AddTable: Invoice + InvoiceLineItem (Phase 1.3 billing)
-- Idempotent per (orgId, periodStart) via unique idempotencyKey.

CREATE TABLE "Invoice" (
    "id"                    TEXT NOT NULL,
    "orgId"                 TEXT NOT NULL,
    "regionCode"            "RegionCode" NOT NULL,
    "periodStart"           TIMESTAMP(3) NOT NULL,
    "periodEnd"             TIMESTAMP(3) NOT NULL,
    "status"                TEXT NOT NULL DEFAULT 'draft',
    "platformFeeCents"      BIGINT NOT NULL DEFAULT 0,
    "doorRakeCents"         BIGINT NOT NULL DEFAULT 0,
    "insideSalesRakeCents"  BIGINT NOT NULL DEFAULT 0,
    "retargetingRakeCents"  BIGINT NOT NULL DEFAULT 0,
    "additionalCents"       BIGINT NOT NULL DEFAULT 0,
    "totalCents"            BIGINT NOT NULL,
    "currency"              TEXT NOT NULL DEFAULT 'USD',
    "idempotencyKey"        TEXT NOT NULL,
    "sentAt"                TIMESTAMP(3),
    "paidAt"                TIMESTAMP(3),
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceLineItem" (
    "id"              TEXT NOT NULL,
    "invoiceId"       TEXT NOT NULL,
    "kind"            TEXT NOT NULL,
    "description"     TEXT NOT NULL,
    "amountCents"     BIGINT NOT NULL,
    "currency"        TEXT NOT NULL DEFAULT 'USD',
    "conversionCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

-- Unique idempotency key (one invoice per org+period)
CREATE UNIQUE INDEX "Invoice_idempotencyKey_key" ON "Invoice"("idempotencyKey");

-- Query indexes
CREATE INDEX "Invoice_orgId_periodStart_idx" ON "Invoice"("orgId", "periodStart");
CREATE INDEX "Invoice_orgId_status_idx"      ON "Invoice"("orgId", "status");
CREATE INDEX "InvoiceLineItem_invoiceId_idx" ON "InvoiceLineItem"("invoiceId");

-- FK
ALTER TABLE "Invoice"         ADD CONSTRAINT "Invoice_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
