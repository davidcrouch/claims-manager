ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "task_type" text;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "start_date" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "reminder_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "estimated_hours" numeric(8, 2);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "notes" text;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "chk_task_status";
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "chk_task_status" CHECK (status IN ('Open','In Progress','On Hold','Completed','Failed','Cancelled'));
