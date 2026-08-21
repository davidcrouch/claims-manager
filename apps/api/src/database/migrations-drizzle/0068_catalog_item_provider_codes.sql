ALTER TABLE "catalog_items"
  ADD COLUMN IF NOT EXISTS "provider_codes" text[] DEFAULT '{}' NOT NULL;

-- Backfill from parent catalogue type; scopes are always internal; orphans → internal.
UPDATE "catalog_items" AS ci
SET "provider_codes" = ARRAY[
  CASE
    WHEN ci."kind" = 'scope' THEN 'internal'
    ELSE COALESCE(c."type", 'internal')
  END
]
FROM "catalogs" AS c
WHERE ci."catalog_id" = c."id"
  AND (ci."provider_codes" IS NULL OR ci."provider_codes" = '{}');

UPDATE "catalog_items"
SET "provider_codes" = ARRAY['internal']
WHERE "catalog_id" IS NULL
  AND ("provider_codes" IS NULL OR "provider_codes" = '{}');

CREATE INDEX IF NOT EXISTS "idx_catalog_items_provider_codes"
  ON "catalog_items" USING gin ("provider_codes");
