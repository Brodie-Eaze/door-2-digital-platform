-- SEC-003/SEC-007: per-account brute-force lockout on UserCredential.
--   failedLoginCount — increments on every bad password; only resets on successful login.
--   lockedUntil     — set when count crosses thresholds (10→15min, 20→1h, 30→24h).
ALTER TABLE "UserCredential"
  ADD COLUMN "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedUntil"      TIMESTAMPTZ;

-- PII-vault columns on Donation (ADR-0011 envelope encryption).
--   donorEmail        — retroactively given a default so new rows can omit the plaintext.
--   donorEmailVault   — AES-256-GCM encrypted email blob; AAD = 'Donation:{id}'.
--   donorEmailDigest  — deterministic SIV digest for indexed equality search.
ALTER TABLE "Donation"
  ALTER COLUMN "donorEmail" SET DEFAULT 'redacted@vaulted',
  ADD COLUMN "donorEmailVault"  TEXT,
  ADD COLUMN "donorEmailDigest" TEXT;

-- SEC-009: rename paymentMethodToken → paymentMethodTokenVault; make nullable so
-- existing rows are not broken and new vault-encrypted values can be stored.
ALTER TABLE "Donation"
  RENAME COLUMN "paymentMethodToken" TO "paymentMethodTokenVault";
ALTER TABLE "Donation"
  ALTER COLUMN "paymentMethodTokenVault" DROP NOT NULL;
