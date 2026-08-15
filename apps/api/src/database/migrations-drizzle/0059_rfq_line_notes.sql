ALTER TABLE "rfq_groups" ADD COLUMN IF NOT EXISTS "note" text;
--> statement-breakpoint
ALTER TABLE "rfq_combos" ADD COLUMN IF NOT EXISTS "note" text;
