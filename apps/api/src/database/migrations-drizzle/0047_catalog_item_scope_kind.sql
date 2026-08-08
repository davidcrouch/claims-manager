-- 0047: Allow catalog item kind 'scope' alongside primitive and assembly

ALTER TABLE "catalog_items" DROP CONSTRAINT IF EXISTS "chk_catalog_items_kind";
--> statement-breakpoint
ALTER TABLE "catalog_items"
  ADD CONSTRAINT "chk_catalog_items_kind" CHECK (kind IN ('primitive', 'assembly', 'scope'));
--> statement-breakpoint

ALTER TABLE "catalog_items" DROP CONSTRAINT IF EXISTS "chk_catalog_items_primitive_unit";
--> statement-breakpoint
ALTER TABLE "catalog_items"
  ADD CONSTRAINT "chk_catalog_items_primitive_unit" CHECK (
    kind IN ('assembly', 'scope') OR unit_type_lookup_id IS NOT NULL
  );
