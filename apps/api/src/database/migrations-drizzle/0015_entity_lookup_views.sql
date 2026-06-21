-- Entity views that pre-join lookup_values for status/type display names.
-- These are read-only views; writes target the base tables directly.

CREATE OR REPLACE VIEW jobs_view AS
SELECT
  j.*,
  js.name                  AS status_name,
  js.external_reference    AS status_external_reference,
  jt.name                  AS job_type_name,
  jt.external_reference    AS job_type_external_reference,
  v.name                   AS vendor_name,
  v.external_reference     AS vendor_external_reference
FROM jobs j
LEFT JOIN lookup_values js ON js.id = j.status_lookup_id
LEFT JOIN lookup_values jt ON jt.id = j.job_type_lookup_id
LEFT JOIN vendors v        ON v.id  = j.vendor_id;

CREATE OR REPLACE VIEW claims_view AS
SELECT
  c.*,
  cs.name                  AS status_name,
  cs.external_reference    AS status_external_reference,
  ca.name                  AS account_name,
  ca.external_reference    AS account_external_reference
FROM claims c
LEFT JOIN lookup_values cs ON cs.id = c.status_lookup_id
LEFT JOIN lookup_values ca ON ca.id = c.account_lookup_id;
