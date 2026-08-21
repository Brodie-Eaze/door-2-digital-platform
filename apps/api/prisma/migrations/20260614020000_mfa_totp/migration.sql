-- C2: Add TOTP MFA fields to UserCredential
-- totpSecret stores AES-256-GCM encrypted base64 blob; mfaEnabledAt stamps first successful verify.
ALTER TABLE "UserCredential" ADD COLUMN "totpSecret" TEXT;
ALTER TABLE "UserCredential" ADD COLUMN "mfaEnabledAt" TIMESTAMP(3);
