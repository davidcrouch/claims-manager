-- 0071 only matched lower(name) = 'ensure'. The IAG seed creates
-- 'Ensure Catalogue', so those primitives stayed tagged internal and
-- could not be published to Crunchwork.
UPDATE "catalog_items" AS ci
SET "provider_codes" = ARRAY['crunchwork']
FROM "catalogs" AS c
WHERE ci."catalog_id" = c."id"
  AND ci."deleted_at" IS NULL
  AND ci."kind" = 'primitive'
  AND lower(c."name") IN ('ensure', 'ensure catalogue')
  AND ci."provider_codes" IS DISTINCT FROM ARRAY['crunchwork']::text[];
