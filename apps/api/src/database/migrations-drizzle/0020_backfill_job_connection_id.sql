-- Backfill connection_id on jobs that were ingested from Crunchwork
-- before the projection code began setting it.
-- A job is deemed Crunchwork-originated if it has an external_reference
-- (CW UUID) but connection_id is NULL.

UPDATE jobs j
SET connection_id = ic.id
FROM integration_connections ic
WHERE j.connection_id IS NULL
  AND j.external_reference IS NOT NULL
  AND ic.tenant_id = j.tenant_id
  AND ic.provider_code = 'crunchwork'
  AND ic.is_active = true;
