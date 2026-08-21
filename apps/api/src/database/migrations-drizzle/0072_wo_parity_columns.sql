-- Phase 1d: Add columns to work_orders / work_order_combos / work_order_items
-- that already exist on their purchase_order counterparts.

ALTER TABLE "work_orders"
  ADD COLUMN IF NOT EXISTS "quote_id" uuid REFERENCES "quotes"("id"),
  ADD COLUMN IF NOT EXISTS "adjusted_total_adjustment_amount" numeric(14,2),
  ADD COLUMN IF NOT EXISTS "adjustment_info" jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "allocation_context" jsonb NOT NULL DEFAULT '{}';

ALTER TABLE "work_order_combos"
  ADD COLUMN IF NOT EXISTS "quote_combo_id" uuid;

ALTER TABLE "work_order_items"
  ADD COLUMN IF NOT EXISTS "quote_line_item_id" uuid,
  ADD COLUMN IF NOT EXISTS "manual_allocation" boolean;
