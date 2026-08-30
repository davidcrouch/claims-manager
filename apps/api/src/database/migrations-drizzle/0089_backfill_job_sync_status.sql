-- Backfill jobs.sync_status for rows that already exist in Crunchwork
-- (have an external id) but were stored before inbound projection set the column.

UPDATE jobs
SET sync_status = 'synced'
WHERE sync_status IS NULL
  AND (
    (external_reference IS NOT NULL AND btrim(external_reference) <> '')
    OR NULLIF(btrim(api_payload->>'id'), '') IS NOT NULL
  );
