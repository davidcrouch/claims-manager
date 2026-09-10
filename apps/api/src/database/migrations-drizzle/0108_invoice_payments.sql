CREATE TABLE IF NOT EXISTS "invoice_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "invoice_id" uuid NOT NULL,
  "amount" numeric(14, 2) NOT NULL,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by_user_id" text,
  "created_by_name" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_tenant_id_organizations_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id")
    ON DELETE restrict ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_invoices_id_fk"
    FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invoice_payments_tenant_invoice" ON "invoice_payments" USING btree ("tenant_id", "invoice_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invoice_payments_received_at" ON "invoice_payments" USING btree ("tenant_id", "received_at");
--> statement-breakpoint
INSERT INTO invoice_payments (tenant_id, invoice_id, amount, received_at, created_by_user_id)
SELECT i.tenant_id, i.id, i.amount_received, COALESCE(i.received_date, i.updated_at, now()), i.updated_by_user_id
FROM invoices i
WHERE i.amount_received IS NOT NULL
  AND i.amount_received::numeric > 0
  AND NOT EXISTS (
    SELECT 1 FROM invoice_payments p WHERE p.invoice_id = i.id
  );
