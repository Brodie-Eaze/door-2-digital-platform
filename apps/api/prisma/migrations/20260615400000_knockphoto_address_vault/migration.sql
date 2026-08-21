-- PII-vault for KnockPhoto.addressLine (ADR-0011).
--
-- KnockPhoto.addressLine stores the street address string the mobile app
-- sends alongside each property photo ("captured address context"). This
-- is address PII at rest with no encryption. After this migration:
--   1. The capture service encrypts the address into addressLineVault
--      (AES-256-GCM, AAD = 'KnockPhoto:{id}').
--   2. The addressLine TEXT column stores the sentinel '[vaulted]'.
--   3. addressLine is already excluded from PhotoMetadataPublic (toPublic)
--      so no API changes are needed for the read path.
--
-- Existing rows with plaintext addresses are not backfilled here; they will
-- remain readable until a future backfill job runs.

ALTER TABLE "KnockPhoto" ADD COLUMN "addressLineVault" TEXT;
