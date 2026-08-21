ALTER TABLE "quote_items" ADD COLUMN IF NOT EXISTS "publish_status" text;--> statement-breakpoint
ALTER TABLE "quote_combos" ADD COLUMN IF NOT EXISTS "publish_status" text;--> statement-breakpoint
COMMENT ON COLUMN "quote_items"."publish_status" IS 'null=not-published, sent=included in outbound, excluded=filtered by provider tag, rejected=CW dropped';--> statement-breakpoint
COMMENT ON COLUMN "quote_combos"."publish_status" IS 'null=not-published, sent=included in outbound, excluded=filtered by provider tag, rejected=CW dropped';
