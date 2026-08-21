-- Migration: webauthn_credential
-- Adds WebAuthnCredential table for hardware-key registration (ADR-0026).
-- Adds webAuthnCredentials relation back-reference to User (schema only — no DB change).

CREATE TABLE "WebAuthnCredential" (
    "id"           TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey"    TEXT NOT NULL,
    "counter"      BIGINT NOT NULL DEFAULT 0,
    "deviceName"   TEXT,
    "aaguid"       TEXT,
    "transports"   TEXT[] NOT NULL DEFAULT '{}',
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt"   TIMESTAMP(3),

    CONSTRAINT "WebAuthnCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebAuthnCredential_credentialId_key" ON "WebAuthnCredential"("credentialId");
CREATE INDEX "WebAuthnCredential_userId_idx" ON "WebAuthnCredential"("userId");

ALTER TABLE "WebAuthnCredential"
    ADD CONSTRAINT "WebAuthnCredential_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
