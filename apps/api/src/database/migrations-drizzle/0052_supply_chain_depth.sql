-- 0052: Add supply_chain_depth tracking to RFQs and Purchase Orders

ALTER TABLE rfqs
  ADD COLUMN supply_chain_depth INTEGER NOT NULL DEFAULT 0;

ALTER TABLE purchase_orders
  ADD COLUMN supply_chain_depth INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN rfqs.supply_chain_depth IS
  'How many sub-contracting levels deep this RFQ is. 0 = originated from a direct claim/job.';

COMMENT ON COLUMN purchase_orders.supply_chain_depth IS
  'How many sub-contracting levels deep this PO is. 0 = first-tier PO.';
