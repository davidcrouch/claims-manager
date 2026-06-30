-- Make purchase_order_id nullable on work_orders so external POs can be
-- projected directly into work_orders without a parent purchase_orders row.

ALTER TABLE "work_orders" ALTER COLUMN "purchase_order_id" DROP NOT NULL;
