-- Ensure catalogue is type=internal (scopes live there) but its primitives
-- are Crunchwork-publishable line items and must carry the crunchwork tag.
UPDATE "catalog_items" AS ci
SET "provider_codes" = ARRAY['crunchwork']
FROM "catalogs" AS c
WHERE ci."catalog_id" = c."id"
  AND ci."deleted_at" IS NULL
  AND ci."kind" = 'primitive'
  AND lower(c."name") = 'ensure';
