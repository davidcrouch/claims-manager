-- Prevent duplicate primary links from one external object to the same
-- internal entity type (e.g. two work_orders created from one purchase_order).
-- This is a safety net; the primary guard is pg_advisory_xact_lock in the
-- projection service.
--
-- Step 1: remove duplicate primary links (keep the oldest per group).
DELETE FROM "external_links"
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id",
           ROW_NUMBER() OVER (
             PARTITION BY "external_object_id", "internal_entity_type", "link_role"
             ORDER BY "created_at"
           ) AS rn
    FROM "external_links"
    WHERE "is_primary" = true
  ) ranked
  WHERE rn > 1
);

-- Step 2: create partial unique index.
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ext_link_primary_per_type"
  ON "external_links" ("external_object_id", "internal_entity_type", "link_role")
  WHERE "is_primary" = true;
