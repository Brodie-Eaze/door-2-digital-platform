-- Org.slug — additive, nullable, UNIQUE.
--
-- The web-operator UI routes use /accounts/[slug]/... rather than the raw
-- ULID. Slug is the primary external identifier exposed in URLs; the ULID
-- remains the immutable PK for foreign keys + audit chains.
--
-- Nullable for the additive migration: pre-existing rows survive, and the
-- backfill below populates the four demo orgs whose slugs already live in
-- the UI fixture. New orgs created through POST /api/orgs MUST set slug;
-- the service layer enforces that without relying on a NOT NULL constraint
-- (we want to grandfather any rows that pre-date this migration).

ALTER TABLE "Org" ADD COLUMN "slug" TEXT;
CREATE UNIQUE INDEX "Org_slug_key" ON "Org"("slug");

-- Backfill the four demo orgs to match the web-operator URL fixtures.
UPDATE "Org" SET "slug" = 'door2digital-platform' WHERE "id" = 'org_demo_platform';
UPDATE "Org" SET "slug" = 'hope-forward'         WHERE "id" = 'org_demo_hope_forward';
UPDATE "Org" SET "slug" = 'world-vision'         WHERE "id" = 'org_demo_world_vision';
UPDATE "Org" SET "slug" = 'pestmax'              WHERE "id" = 'org_demo_pestmax';
UPDATE "Org" SET "slug" = 'gold-coast-hospital'  WHERE "id" = 'org_demo_gch';
