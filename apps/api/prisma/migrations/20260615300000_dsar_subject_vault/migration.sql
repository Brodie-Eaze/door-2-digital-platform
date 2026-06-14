-- PII-vault for DsarRequest.subjectEmail + subjectPhone (ADR-0011).
--
-- DSAR (Data Subject Access Request) records the SUBJECT's contact info so an
-- operator can identify and locate their data for access, portability, or
-- deletion. Storing that identification info in plaintext is ironic and wrong:
-- the very record that exists to protect privacy was itself unprotected.
--
-- After this migration the service layer:
--   1. Encrypts subjectEmail + subjectPhone into vault columns (AES-256-GCM,
--      AAD = 'DsarRequest:{id}', DEK wrapped with region KMS key).
--   2. Writes masked forms (j•••@gmail.com, ••• ••• 1234) into the existing
--      TEXT columns so the record is identifiable without exposing plaintext.
--   3. toPublic() returns the masked form only; vault decryption is a
--      separate super_admin / auditor privileged operation.
--
-- Existing rows with plaintext are not backfilled by this migration; they will
-- continue to return plaintext until re-written or a future backfill job runs.

ALTER TABLE "DsarRequest"
  ADD COLUMN "subjectEmailVault" TEXT,
  ADD COLUMN "subjectPhoneVault" TEXT;
