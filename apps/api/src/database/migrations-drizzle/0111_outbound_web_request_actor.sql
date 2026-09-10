ALTER TABLE "outbound_web_requests"
  ADD COLUMN IF NOT EXISTS "initiated_by_user_id" text;
--> statement-breakpoint
ALTER TABLE "outbound_web_requests"
  ADD COLUMN IF NOT EXISTS "initiated_by_name" text;
--> statement-breakpoint
ALTER TABLE "outbound_sync_queue"
  ADD COLUMN IF NOT EXISTS "initiated_by_user_id" text;
--> statement-breakpoint
ALTER TABLE "outbound_sync_queue"
  ADD COLUMN IF NOT EXISTS "initiated_by_name" text;
