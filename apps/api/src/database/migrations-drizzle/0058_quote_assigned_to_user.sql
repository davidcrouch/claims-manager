ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "assigned_to_user_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_quotes_assigned" ON "quotes" ("tenant_id", "assigned_to_user_id");
