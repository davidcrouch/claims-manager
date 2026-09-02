-- Add component text column to group tables (parity with item/combo component fields)
ALTER TABLE "quote_groups" ADD COLUMN IF NOT EXISTS "component" text;
ALTER TABLE "purchase_order_groups" ADD COLUMN IF NOT EXISTS "component" text;
ALTER TABLE "work_order_groups" ADD COLUMN IF NOT EXISTS "component" text;
ALTER TABLE "rfq_groups" ADD COLUMN IF NOT EXISTS "component" text;
ALTER TABLE "proposal_groups" ADD COLUMN IF NOT EXISTS "component" text;
