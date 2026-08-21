-- PII-vault for User.givenName + familyName + phone (ADR-0011).
--
-- User PII at rest situation after this migration:
--   - email:      still plaintext (notification service sends invite emails
--                 and needs the real address; vault pending a decrypt-at-send
--                 wiring in the notification service — tracked separately).
--   - givenName:  masked sentinel in TEXT col, encrypted in givenNameVault.
--   - familyName: masked sentinel in TEXT col, encrypted in familyNameVault.
--   - phone:      masked sentinel in TEXT col, encrypted in phoneVault.
--
-- Write path (createUser / updateUser in user/service.ts):
--   1. Encrypts each field with PiiVaultService.encryptForRow('User', id, value).
--   2. Writes masked form to the TEXT column (first letter of givenName,
--      'F.' for familyName, '••• ••• NNNN' for phone).
--   3. toPublic() already masks all three — no API surface change needed.
--
-- Existing rows with plaintext are not backfilled; a future backfill job
-- will need to re-encrypt them in batches.

ALTER TABLE "User"
  ADD COLUMN "givenNameVault"  TEXT,
  ADD COLUMN "familyNameVault" TEXT,
  ADD COLUMN "phoneVault"      TEXT;
