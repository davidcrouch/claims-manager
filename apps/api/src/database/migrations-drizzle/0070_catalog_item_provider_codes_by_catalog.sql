-- Correct provider tagging after 0069 over-applied both tags to every item.
-- Rules:
--   - kind = scope  → internal only (scopes are never Crunchwork)
--   - parent catalogue type = crunchwork (non-scope) → crunchwork
--   - otherwise → internal

UPDATE "catalog_items"
SET "provider_codes" = ARRAY['internal']
WHERE "deleted_at" IS NULL
  AND "kind" = 'scope';

UPDATE "catalog_items" AS ci
SET "provider_codes" = ARRAY['crunchwork']
FROM "catalogs" AS c
WHERE ci."catalog_id" = c."id"
  AND ci."deleted_at" IS NULL
  AND ci."kind" <> 'scope'
  AND c."type" = 'crunchwork';

UPDATE "catalog_items" AS ci
SET "provider_codes" = ARRAY['internal']
FROM "catalogs" AS c
WHERE ci."catalog_id" = c."id"
  AND ci."deleted_at" IS NULL
  AND ci."kind" <> 'scope'
  AND c."type" = 'internal';

UPDATE "catalog_items"
SET "provider_codes" = ARRAY['internal']
WHERE "deleted_at" IS NULL
  AND "catalog_id" IS NULL
  AND "kind" <> 'scope';
