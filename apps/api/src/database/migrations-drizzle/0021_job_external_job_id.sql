ALTER TABLE jobs ADD COLUMN external_job_id TEXT;

-- Backfill from api_payload->>'externalReference' (the cc:XXXXXXX values).
-- Also fix external_reference to the CW UUID where it currently holds a cc: value.
UPDATE jobs
SET external_job_id = api_payload->>'externalReference',
    external_reference = COALESCE(api_payload->>'id', external_reference)
WHERE api_payload->>'externalReference' IS NOT NULL;
