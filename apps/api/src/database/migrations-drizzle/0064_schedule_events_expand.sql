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

-- Messages: created_at point events
SELECT
  m.id,
  m.tenant_id,
  'message'::text         AS event_type,
  COALESCE(m.subject, 'Message') AS title,
  m.created_at            AS starts_at,
  m.created_at            AS ends_at,
  NULL::text              AS status,
  NULL::text              AS priority,
  COALESCE(m.from_job_id, m.to_job_id) AS job_id,
  COALESCE(m.from_claim_id, m.to_claim_id) AS claim_id
FROM messages m

UNION ALL

-- Claims: date of loss / lodgement
SELECT
  c.id,
  c.tenant_id,
  'claim'::text           AS event_type,
  COALESCE(c.claim_number, 'Claim') AS title,
  COALESCE(c.date_of_loss, c.lodgement_date::timestamptz) AS starts_at,
  COALESCE(c.date_of_loss, c.lodgement_date::timestamptz) AS ends_at,
  lv_c.name               AS status,
  NULL::text              AS priority,
  NULL::uuid              AS job_id,
  c.id                    AS claim_id
FROM claims c
LEFT JOIN lookup_values lv_c ON lv_c.id = c.status_lookup_id
WHERE c.deleted_at IS NULL
  AND (c.date_of_loss IS NOT NULL OR c.lodgement_date IS NOT NULL)

UNION ALL

-- Jobs: request_date point events
SELECT
  j.id,
  j.tenant_id,
  'job'::text             AS event_type,
  COALESCE(j.name, j.external_reference, 'Job') AS title,
  j.request_date::timestamptz AS starts_at,
  j.request_date::timestamptz AS ends_at,
  lv_j.name               AS status,
  NULL::text              AS priority,
  j.id                    AS job_id,
  j.claim_id
FROM jobs j
LEFT JOIN lookup_values lv_j ON lv_j.id = j.status_lookup_id
WHERE j.deleted_at IS NULL
  AND j.request_date IS NOT NULL

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
  AND (q.estimated_start_date IS NOT NULL OR q.estimated_completion_date IS NOT NULL)

UNION ALL

-- Invoices: issue / received date
SELECT
  i.id,
  i.tenant_id,
  'invoice'::text         AS event_type,
  COALESCE(i.invoice_number, 'Invoice') AS title,
  COALESCE(i.issue_date, i.received_date) AS starts_at,
  COALESCE(i.issue_date, i.received_date) AS ends_at,
  lv_i.name               AS status,
  NULL::text              AS priority,
  i.job_id,
  i.claim_id
FROM invoices i
LEFT JOIN lookup_values lv_i ON lv_i.id = i.status_lookup_id
WHERE i.is_deleted = false
  AND (i.issue_date IS NOT NULL OR i.received_date IS NOT NULL)

UNION ALL

-- Journals: created_at point events
SELECT
  jn.id,
  jn.tenant_id,
  'journal'::text         AS event_type,
  jn.name                 AS title,
  jn.created_at           AS starts_at,
  jn.created_at           AS ends_at,
  jn.status,
  NULL::text              AS priority,
  NULL::uuid              AS job_id,
  NULL::uuid              AS claim_id
FROM journals jn
WHERE jn.deleted_at IS NULL

UNION ALL

-- Assessments: created_at point events
SELECT
  a.id,
  a.tenant_id,
  'assessment'::text      AS event_type,
  a.name                  AS title,
  a.created_at            AS starts_at,
  a.created_at            AS ends_at,
  a.status,
  NULL::text              AS priority,
  a.job_id,
  NULL::uuid              AS claim_id
FROM assessments a
WHERE a.deleted_at IS NULL

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

-- Proposals: proposal / received date
SELECT
  p.id,
  p.tenant_id,
  'proposal'::text        AS event_type,
  COALESCE(p.name, p.proposal_number, 'Proposal') AS title,
  COALESCE(p.proposal_date, p.received_date) AS starts_at,
  COALESCE(p.proposal_date, p.received_date) AS ends_at,
  lv_p.name               AS status,
  NULL::text              AS priority,
  p.job_id,
  p.claim_id
FROM proposals p
LEFT JOIN lookup_values lv_p ON lv_p.id = p.status_lookup_id
WHERE p.deleted_at IS NULL
  AND (p.proposal_date IS NOT NULL OR p.received_date IS NOT NULL)

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
WHERE b.due_date IS NOT NULL;
