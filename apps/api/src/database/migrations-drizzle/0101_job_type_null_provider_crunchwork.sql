-- Tag unscoped job_type lookups as Crunchwork.
-- Historical CW seeds and webhook auto-creates left provider_code NULL, so they
-- leaked into Internal Create Job filters that treated null as "any provider".
UPDATE lookup_values
SET provider_code = 'crunchwork'
WHERE domain = 'job_type'
  AND provider_code IS NULL;
