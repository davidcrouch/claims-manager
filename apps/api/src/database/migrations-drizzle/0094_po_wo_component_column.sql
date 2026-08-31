-- Add component text column to PO and WO item/combo tables (parity with quote_items/quote_combos)
ALTER TABLE "purchase_order_combos" ADD COLUMN IF NOT EXISTS "component" text;
ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "component" text;
ALTER TABLE "work_order_combos" ADD COLUMN IF NOT EXISTS "component" text;
ALTER TABLE "work_order_items" ADD COLUMN IF NOT EXISTS "component" text;
