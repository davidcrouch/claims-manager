ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "assigned_to_user_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_assigned" ON "jobs" ("tenant_id", "assigned_to_user_id");
