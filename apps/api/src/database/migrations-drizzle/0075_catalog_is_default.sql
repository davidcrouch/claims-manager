-- One default catalogue per tenant
ALTER TABLE "catalogs"
  ADD COLUMN IF NOT EXISTS "is_default" boolean DEFAULT false NOT NULL;

-- Prefer an existing catalogue named "Default"
UPDATE "catalogs" AS c
SET "is_default" = true
FROM (
  SELECT DISTINCT ON ("tenant_id") "id"
  FROM "catalogs"
  WHERE lower("name") = 'default'
    AND "is_active" = true
  ORDER BY "tenant_id", "created_at" ASC
) AS d
WHERE c."id" = d."id"
  AND c."is_default" = false;

-- Otherwise pick the oldest active catalogue per tenant with no default yet
UPDATE "catalogs" AS c
SET "is_default" = true
FROM (
  SELECT DISTINCT ON ("tenant_id") "id"
  FROM "catalogs"
  WHERE "is_active" = true
    AND "tenant_id" NOT IN (
      SELECT "tenant_id" FROM "catalogs" WHERE "is_default" = true
    )
  ORDER BY "tenant_id", "created_at" ASC
) AS d
WHERE c."id" = d."id";

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_catalogs_tenant_default"
  ON "catalogs" ("tenant_id")
  WHERE "is_default" = true;
