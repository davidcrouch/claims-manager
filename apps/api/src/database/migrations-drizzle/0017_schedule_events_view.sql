CREATE OR REPLACE VIEW schedule_events AS

-- Appointments: full time-range events
SELECT
  a.id,
  a.tenant_id,
  'appointment'::text     AS event_type,
  a.name                  AS title,
  a.start_date            AS starts_at,
  a.end_date              AS ends_at,
  a.status,
  NULL::text              AS priority,
  a.job_id,
  NULL::uuid              AS claim_id
FROM appointments a

UNION ALL

-- Tasks: point events on due_date
SELECT
  t.id,
  t.tenant_id,
  'task'::text            AS event_type,
  t.name                  AS title,
  t.due_date              AS starts_at,
  t.due_date              AS ends_at,
  t.status,
  t.priority,
  t.job_id,
  t.claim_id
FROM tasks t
WHERE t.due_date IS NOT NULL

UNION ALL

-- Work orders: date+time combined into timestamptz
SELECT
  wo.id,
  wo.tenant_id,
  'work_order'::text      AS event_type,
  COALESCE(wo.name, wo.work_order_number, 'Work Order') AS title,
  CASE WHEN wo.start_date IS NOT NULL
       THEN (wo.start_date || ' ' || COALESCE(wo.start_time::text, '00:00:00'))::timestamptz
       ELSE NULL END      AS starts_at,
  CASE WHEN wo.end_date IS NOT NULL
       THEN (wo.end_date || ' ' || COALESCE(wo.end_time::text, '23:59:59'))::timestamptz
       ELSE NULL END      AS ends_at,
  lv_wo.name              AS status,
  NULL::text              AS priority,
  wo.job_id,
  wo.claim_id
FROM work_orders wo
LEFT JOIN lookup_values lv_wo ON lv_wo.id = wo.status_lookup_id
WHERE wo.deleted_at IS NULL
  AND wo.start_date IS NOT NULL

UNION ALL

-- Purchase orders: date+time combined into timestamptz
SELECT
  po.id,
  po.tenant_id,
  'purchase_order'::text  AS event_type,
  COALESCE(po.name, po.purchase_order_number, 'Purchase Order') AS title,
  CASE WHEN po.start_date IS NOT NULL
       THEN (po.start_date || ' ' || COALESCE(po.start_time::text, '00:00:00'))::timestamptz
       ELSE NULL END      AS starts_at,
  CASE WHEN po.end_date IS NOT NULL
       THEN (po.end_date || ' ' || COALESCE(po.end_time::text, '23:59:59'))::timestamptz
       ELSE NULL END      AS ends_at,
  lv_po.name              AS status,
  NULL::text              AS priority,
  po.job_id,
  po.claim_id
FROM purchase_orders po
LEFT JOIN lookup_values lv_po ON lv_po.id = po.status_lookup_id
WHERE po.deleted_at IS NULL
  AND po.start_date IS NOT NULL

UNION ALL

-- RFQs: due_date point events
SELECT
  r.id,
  r.tenant_id,
  'rfq'::text             AS event_type,
  COALESCE(r.name, r.rfq_number, 'RFQ') AS title,
  r.due_date              AS starts_at,
  r.due_date              AS ends_at,
  lv_r.name               AS status,
  NULL::text              AS priority,
  r.job_id,
  r.claim_id
FROM rfqs r
LEFT JOIN lookup_values lv_r ON lv_r.id = r.status_lookup_id
WHERE r.deleted_at IS NULL
  AND r.due_date IS NOT NULL

UNION ALL

-- Bills: due_date point events
SELECT
  b.id,
  b.tenant_id,
  'bill'::text            AS event_type,
  COALESCE(b.bill_number, 'Bill') AS title,
  b.due_date              AS starts_at,
  b.due_date              AS ends_at,
  lv_b.name               AS status,
  NULL::text              AS priority,
  b.job_id,
  b.claim_id
FROM bills b
LEFT JOIN lookup_values lv_b ON lv_b.id = b.status_lookup_id
WHERE b.due_date IS NOT NULL

UNION ALL

-- Quotes: estimated work date range
SELECT
  q.id,
  q.tenant_id,
  'quote'::text           AS event_type,
  COALESCE(q.name, q.quote_number, 'Quote') AS title,
  q.estimated_start_date::timestamptz AS starts_at,
  q.estimated_completion_date::timestamptz AS ends_at,
  lv_q.name               AS status,
  NULL::text              AS priority,
  q.job_id,
  q.claim_id
FROM quotes q
LEFT JOIN lookup_values lv_q ON lv_q.id = q.status_lookup_id
WHERE q.deleted_at IS NULL
  AND (q.estimated_start_date IS NOT NULL OR q.estimated_completion_date IS NOT NULL);
