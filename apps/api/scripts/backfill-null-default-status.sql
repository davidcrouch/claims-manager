-- Idempotent: assign default statuses where status is null.
-- Safe to re-run.

-- purchase_orders → Active
INSERT INTO lookup_values (tenant_id, domain, name, external_reference, is_active)
SELECT DISTINCT po.tenant_id, 'purchase_order_status', 'Active', 'seed-po-status-active', true
FROM purchase_orders po
WHERE po.status_lookup_id IS NULL
  AND po.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM lookup_values lv
    WHERE lv.tenant_id = po.tenant_id
      AND lv.domain = 'purchase_order_status'
      AND lower(lv.name) = 'active'
  );

UPDATE purchase_orders po
SET status_lookup_id = lv.id, updated_at = NOW()
FROM (
  SELECT DISTINCT ON (tenant_id) tenant_id, id
  FROM lookup_values
  WHERE domain = 'purchase_order_status' AND lower(name) = 'active'
  ORDER BY tenant_id, created_at ASC NULLS LAST, id ASC
) lv
WHERE po.tenant_id = lv.tenant_id
  AND po.status_lookup_id IS NULL
  AND po.deleted_at IS NULL;

-- quotes → Draft
INSERT INTO lookup_values (tenant_id, domain, name, external_reference, is_active)
SELECT DISTINCT q.tenant_id, 'quote_status', 'Draft', 'seed-quote-status-draft', true
FROM quotes q
WHERE q.status_lookup_id IS NULL
  AND q.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM lookup_values lv
    WHERE lv.tenant_id = q.tenant_id
      AND lv.domain = 'quote_status'
      AND lower(lv.name) = 'draft'
  );

UPDATE quotes q
SET status_lookup_id = lv.id, updated_at = NOW()
FROM (
  SELECT DISTINCT ON (tenant_id) tenant_id, id
  FROM lookup_values
  WHERE domain = 'quote_status' AND lower(name) = 'draft'
  ORDER BY tenant_id, created_at ASC NULLS LAST, id ASC
) lv
WHERE q.tenant_id = lv.tenant_id
  AND q.status_lookup_id IS NULL
  AND q.deleted_at IS NULL;

-- work_orders → Draft
INSERT INTO lookup_values (tenant_id, domain, name, external_reference, is_active)
SELECT DISTINCT wo.tenant_id, 'work_order_status', 'Draft', 'seed-wo-status-draft', true
FROM work_orders wo
WHERE wo.status_lookup_id IS NULL
  AND wo.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM lookup_values lv
    WHERE lv.tenant_id = wo.tenant_id
      AND lv.domain = 'work_order_status'
      AND lower(lv.name) = 'draft'
  );

UPDATE work_orders wo
SET status_lookup_id = lv.id, updated_at = NOW()
FROM (
  SELECT DISTINCT ON (tenant_id) tenant_id, id
  FROM lookup_values
  WHERE domain = 'work_order_status' AND lower(name) = 'draft'
  ORDER BY tenant_id, created_at ASC NULLS LAST, id ASC
) lv
WHERE wo.tenant_id = lv.tenant_id
  AND wo.status_lookup_id IS NULL
  AND wo.deleted_at IS NULL;

-- invoices → Draft
INSERT INTO lookup_values (tenant_id, domain, name, external_reference, is_active)
SELECT DISTINCT inv.tenant_id, 'invoice_status', 'Draft', 'seed-invoice-status-draft', true
FROM invoices inv
WHERE inv.status_lookup_id IS NULL
  AND inv.is_deleted = false
  AND NOT EXISTS (
    SELECT 1 FROM lookup_values lv
    WHERE lv.tenant_id = inv.tenant_id
      AND lv.domain = 'invoice_status'
      AND lower(lv.name) = 'draft'
  );

UPDATE invoices inv
SET status_lookup_id = lv.id, updated_at = NOW()
FROM (
  SELECT DISTINCT ON (tenant_id) tenant_id, id
  FROM lookup_values
  WHERE domain = 'invoice_status' AND lower(name) = 'draft'
  ORDER BY tenant_id, created_at ASC NULLS LAST, id ASC
) lv
WHERE inv.tenant_id = lv.tenant_id
  AND inv.status_lookup_id IS NULL
  AND inv.is_deleted = false;

-- rfqs → Draft
INSERT INTO lookup_values (tenant_id, domain, name, external_reference, is_active)
SELECT DISTINCT r.tenant_id, 'rfq_status', 'Draft', 'seed-rfq-status-draft', true
FROM rfqs r
WHERE r.status_lookup_id IS NULL
  AND r.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM lookup_values lv
    WHERE lv.tenant_id = r.tenant_id
      AND lv.domain = 'rfq_status'
      AND lower(lv.name) = 'draft'
  );

UPDATE rfqs r
SET status_lookup_id = lv.id, updated_at = NOW()
FROM (
  SELECT DISTINCT ON (tenant_id) tenant_id, id
  FROM lookup_values
  WHERE domain = 'rfq_status' AND lower(name) = 'draft'
  ORDER BY tenant_id, created_at ASC NULLS LAST, id ASC
) lv
WHERE r.tenant_id = lv.tenant_id
  AND r.status_lookup_id IS NULL
  AND r.deleted_at IS NULL;

-- jobs → Pending
INSERT INTO lookup_values (tenant_id, domain, name, external_reference, is_active)
SELECT DISTINCT j.tenant_id, 'job_status', 'Pending', 'seed-job-status-pending', true
FROM jobs j
WHERE j.status_lookup_id IS NULL
  AND j.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM lookup_values lv
    WHERE lv.tenant_id = j.tenant_id
      AND lv.domain = 'job_status'
      AND lower(lv.name) = 'pending'
  );

UPDATE jobs j
SET status_lookup_id = lv.id, updated_at = NOW()
FROM (
  SELECT DISTINCT ON (tenant_id) tenant_id, id
  FROM lookup_values
  WHERE domain = 'job_status' AND lower(name) = 'pending'
  ORDER BY tenant_id, created_at ASC NULLS LAST, id ASC
) lv
WHERE j.tenant_id = lv.tenant_id
  AND j.status_lookup_id IS NULL
  AND j.deleted_at IS NULL;

-- bills → Received
INSERT INTO lookup_values (tenant_id, domain, name, external_reference, is_active)
SELECT DISTINCT b.tenant_id, 'bill_status', 'Received', 'seed-bill-status-received', true
FROM bills b
WHERE b.status_lookup_id IS NULL
  AND b.is_deleted = false
  AND NOT EXISTS (
    SELECT 1 FROM lookup_values lv
    WHERE lv.tenant_id = b.tenant_id
      AND lv.domain = 'bill_status'
      AND lower(lv.name) = 'received'
  );

UPDATE bills b
SET status_lookup_id = lv.id, updated_at = NOW()
FROM (
  SELECT DISTINCT ON (tenant_id) tenant_id, id
  FROM lookup_values
  WHERE domain = 'bill_status' AND lower(name) = 'received'
  ORDER BY tenant_id, created_at ASC NULLS LAST, id ASC
) lv
WHERE b.tenant_id = lv.tenant_id
  AND b.status_lookup_id IS NULL
  AND b.is_deleted = false;

-- assessments → draft (text column)
UPDATE assessments
SET status = 'draft', updated_at = NOW()
WHERE deleted_at IS NULL
  AND (status IS NULL OR btrim(status) = '');
