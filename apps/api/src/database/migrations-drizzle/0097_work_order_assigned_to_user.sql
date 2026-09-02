ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "assigned_to_user_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_wo_assigned" ON "work_orders" ("tenant_id", "assigned_to_user_id");
