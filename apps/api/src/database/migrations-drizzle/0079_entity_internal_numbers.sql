ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "internal_number" text;
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "internal_number" text;
--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN IF NOT EXISTS "internal_number" text;
--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "internal_number" text;
--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "internal_number" text;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "internal_number" text;
--> statement-breakpoint
UPDATE "jobs"
SET "internal_number" = UPPER("external_reference")
WHERE "internal_number" IS NULL
  AND "external_reference" ~* '^job-[0-9]+$';
--> statement-breakpoint
UPDATE "quotes"
SET "internal_number" = UPPER("quote_number")
WHERE "internal_number" IS NULL
  AND "quote_number" ~* '^est-[0-9]+$';
--> statement-breakpoint
UPDATE "rfqs"
SET "internal_number" = UPPER("rfq_number")
WHERE "internal_number" IS NULL
  AND "rfq_number" ~* '^rfq-[0-9]+$';
--> statement-breakpoint
UPDATE "work_orders"
SET "internal_number" = UPPER("work_order_number")
WHERE "internal_number" IS NULL
  AND "work_order_number" ~* '^wo-[0-9]+$';
--> statement-breakpoint
UPDATE "purchase_orders"
SET "internal_number" = UPPER("purchase_order_number")
WHERE "internal_number" IS NULL
  AND "purchase_order_number" ~* '^po-[0-9]+$';
--> statement-breakpoint
UPDATE "invoices"
SET "internal_number" = UPPER("invoice_number")
WHERE "internal_number" IS NULL
  AND "invoice_number" ~* '^inv-[0-9]+$';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_jobs_tenant_internal_number"
  ON "jobs" USING btree ("tenant_id", "internal_number")
  WHERE internal_number IS NOT NULL AND deleted_at IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_quotes_tenant_internal_number"
  ON "quotes" USING btree ("tenant_id", "internal_number")
  WHERE internal_number IS NOT NULL AND deleted_at IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_rfqs_tenant_internal_number"
  ON "rfqs" USING btree ("tenant_id", "internal_number")
  WHERE internal_number IS NOT NULL AND deleted_at IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_work_orders_tenant_internal_number"
  ON "work_orders" USING btree ("tenant_id", "internal_number")
  WHERE internal_number IS NOT NULL AND deleted_at IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_purchase_orders_tenant_internal_number"
  ON "purchase_orders" USING btree ("tenant_id", "internal_number")
  WHERE internal_number IS NOT NULL AND deleted_at IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_invoices_tenant_internal_number"
  ON "invoices" USING btree ("tenant_id", "internal_number")
  WHERE internal_number IS NOT NULL;
