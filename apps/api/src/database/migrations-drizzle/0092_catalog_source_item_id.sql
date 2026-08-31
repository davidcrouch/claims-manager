-- Add sourceItemId to catalog_items for tracking cross-catalogue copy provenance
ALTER TABLE catalog_items
  ADD COLUMN IF NOT EXISTS source_item_id uuid
    REFERENCES catalog_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_catalog_items_source
  ON catalog_items (tenant_id, source_item_id)
  WHERE source_item_id IS NOT NULL;
