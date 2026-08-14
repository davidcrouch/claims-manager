-- Allow invoices against work orders without an upstream purchase order.
-- Provider-origin WOs (e.g. Crunchwork) have no local purchase_orders row.

ALTER TABLE "invoices" ALTER COLUMN "purchase_order_id" DROP NOT NULL;

ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "work_order_id" uuid
  REFERENCES "work_orders"("id");

ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "chk_invoice_parent";
ALTER TABLE "invoices" ADD CONSTRAINT "chk_invoice_parent"
  CHECK (purchase_order_id IS NOT NULL OR work_order_id IS NOT NULL);

DROP INDEX IF EXISTS "UQ_invoices_tenant_po_number";
CREATE UNIQUE INDEX "UQ_invoices_tenant_po_number"
  ON "invoices" ("tenant_id", "purchase_order_id", "invoice_number")
  WHERE "purchase_order_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_invoices_tenant_wo_number"
  ON "invoices" ("tenant_id", "work_order_id", "invoice_number")
  WHERE "work_order_id" IS NOT NULL AND "invoice_number" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_invoices_work_order"
  ON "invoices" ("tenant_id", "work_order_id");
