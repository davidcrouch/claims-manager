-- Backfill sync_status and external_reference from legacy Crunchwork payload ids

UPDATE tasks
SET
  sync_status = 'synced',
  external_reference = COALESCE(
    NULLIF(btrim(external_reference), ''),
    NULLIF(btrim(task_payload->>'id'), '')
  )
WHERE sync_status IS NULL
  AND task_payload->>'id' IS NOT NULL
  AND btrim(task_payload->>'id') <> '';

UPDATE appointments
SET
  sync_status = 'synced',
  external_reference = COALESCE(
    NULLIF(btrim(external_reference), ''),
    NULLIF(btrim(appointment_payload->>'id'), '')
  )
WHERE sync_status IS NULL
  AND appointment_payload->>'id' IS NOT NULL
  AND btrim(appointment_payload->>'id') <> '';
