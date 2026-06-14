-- PII-vault for Knock.notes (ADR-0011 envelope encryption).
--
-- Knock.notes stores free-text observations a knocker writes at the door —
-- occupation guesses, dog-at-home, "seems interested in solar", etc. This is
-- PII under every regime the platform operates in (Privacy Act APP 3, CCPA,
-- PDPA) because it is a direct personal observation tied to a named individual
-- at a home address.
--
-- On new writes the service layer:
--   1. Encrypts the plaintext into notesVault (AES-256-GCM, DEK wrapped with
--      region KMS key, AAD = 'Knock:{id}').
--   2. Writes the sentinel string '[vaulted]' into the notes TEXT column so
--      the column is never empty but never contains real PII.
--
-- Existing rows with real plaintext in notes are NOT touched by this migration;
-- they will be migrated lazily on next write or via a future backfill job.
-- The service's toPublic() already returns notes: null on all read paths, so
-- existing plaintext rows do not leak through the API.

ALTER TABLE "Knock" ADD COLUMN "notesVault" TEXT;
