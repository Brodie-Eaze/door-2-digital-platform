-- F-004 completion — Donation.donorEmailVault stores the EncryptedField envelope
-- object (the same JSON shape as User.givenNameVault / phoneVault), not a string.
--
-- The Prisma schema previously declared this column `String?`, which made the
-- vault write path (PiiVaultService.encryptForRow returns an object) invalid and
-- the JIT-unmask reveal resolver could never round-trip a Donation email.
--
-- Convert TEXT -> JSONB. All existing rows are NULL (pre-vault sentinel rows),
-- so the USING clause is a safe no-op cast for the populated case.
ALTER TABLE "Donation"
  ALTER COLUMN "donorEmailVault" TYPE JSONB USING "donorEmailVault"::jsonb;
