-- Add origin_type to core entity tables.
-- Values: 'user' (default), 'provider', 'tenant', 'capture', 'system'

ALTER TABLE "quotes"
  ADD COLUMN IF NOT EXISTS "origin_type" text NOT NULL DEFAULT 'user';
--> statement-breakpoint
ALTER TABLE "purchase_orders"
  ADD COLUMN IF NOT EXISTS "origin_type" text NOT NULL DEFAULT 'user';
--> statement-breakpoint
ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "origin_type" text NOT NULL DEFAULT 'user';
--> statement-breakpoint
ALTER TABLE "work_orders"
  ADD COLUMN IF NOT EXISTS "origin_type" text NOT NULL DEFAULT 'user';
--> statement-breakpoint
ALTER TABLE "rfqs"
  ADD COLUMN IF NOT EXISTS "origin_type" text NOT NULL DEFAULT 'user';
--> statement-breakpoint
ALTER TABLE "proposals"
  ADD COLUMN IF NOT EXISTS "origin_type" text NOT NULL DEFAULT 'user';
--> statement-breakpoint
ALTER TABLE "bills"
  ADD COLUMN IF NOT EXISTS "origin_type" text NOT NULL DEFAULT 'user';
--> statement-breakpoint
ALTER TABLE "reports"
  ADD COLUMN IF NOT EXISTS "origin_type" text NOT NULL DEFAULT 'user';
--> statement-breakpoint
ALTER TABLE "assessments"
  ADD COLUMN IF NOT EXISTS "origin_type" text NOT NULL DEFAULT 'user';
--> statement-breakpoint
ALTER TABLE "journals"
  ADD COLUMN IF NOT EXISTS "origin_type" text NOT NULL DEFAULT 'user';
--> statement-breakpoint
ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "origin_type" text NOT NULL DEFAULT 'user';
--> statement-breakpoint
ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "origin_type" text NOT NULL DEFAULT 'user';
--> statement-breakpoint
ALTER TABLE "attachments"
  ADD COLUMN IF NOT EXISTS "origin_type" text NOT NULL DEFAULT 'user';
