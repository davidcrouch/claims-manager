ALTER TABLE "bills" DROP CONSTRAINT IF EXISTS "bills_invoice_id_invoices_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "idx_bills_invoice";
--> statement-breakpoint
ALTER TABLE "bills" DROP COLUMN IF EXISTS "invoice_id";
