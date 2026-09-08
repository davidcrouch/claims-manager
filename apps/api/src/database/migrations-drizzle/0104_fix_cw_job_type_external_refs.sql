-- Remap seeded Crunchwork job-type refs (seed-job-type-ba/ms/bw) to the real
-- CW codes (BA / MS / BW). Seeded refs are rejected by outbound create
-- (isCwUsableLookupRef), so Create Make-Safe / CW job publish fails on tenants
-- that never received a synced MS/BA/BW row.
--
-- When both a seed row and a correct CW-code row exist: repoint jobs, then
-- deactivate the seed duplicate. When only the seed row exists: update its
-- external_reference in place.

-- 1) Repoint jobs from seed job-type lookups to the matching CW-code lookup
UPDATE jobs j
SET job_type_lookup_id = good.id
FROM lookup_values bad
JOIN lookup_values good
  ON good.tenant_id = bad.tenant_id
 AND good.domain = 'job_type'
 AND good.provider_code = 'crunchwork'
 AND lower(trim(good.name)) = lower(trim(bad.name))
 AND good.external_reference IN ('BA', 'MS', 'BW')
 AND good.id <> bad.id
WHERE j.job_type_lookup_id = bad.id
  AND bad.domain = 'job_type'
  AND bad.provider_code = 'crunchwork'
  AND (
    bad.external_reference IS NULL
    OR bad.external_reference = ''
    OR bad.external_reference ILIKE 'seed-%'
  )
  AND lower(trim(bad.name)) IN (
    'builder assessment',
    'builder make safe',
    'builder works'
  );

-- 2) Deactivate seed duplicates when a CW-code row already exists
UPDATE lookup_values bad
SET is_active = false
FROM lookup_values good
WHERE bad.domain = 'job_type'
  AND bad.provider_code = 'crunchwork'
  AND (
    bad.external_reference IS NULL
    OR bad.external_reference = ''
    OR bad.external_reference ILIKE 'seed-%'
  )
  AND lower(trim(bad.name)) IN (
    'builder assessment',
    'builder make safe',
    'builder works'
  )
  AND good.tenant_id = bad.tenant_id
  AND good.domain = 'job_type'
  AND good.provider_code = 'crunchwork'
  AND lower(trim(good.name)) = lower(trim(bad.name))
  AND good.external_reference IN ('BA', 'MS', 'BW')
  AND good.id <> bad.id;

-- 3) Remap remaining seed-only rows to CW codes (skip tenants that already
--    have BA/MS/BW — those seed duplicates were deactivated in step 2)
UPDATE lookup_values bad
SET external_reference = CASE lower(trim(bad.name))
  WHEN 'builder assessment' THEN 'BA'
  WHEN 'builder make safe' THEN 'MS'
  WHEN 'builder works' THEN 'BW'
  ELSE bad.external_reference
END,
is_active = true
WHERE bad.domain = 'job_type'
  AND bad.provider_code = 'crunchwork'
  AND (
    bad.external_reference IS NULL
    OR bad.external_reference = ''
    OR bad.external_reference ILIKE 'seed-%'
  )
  AND lower(trim(bad.name)) IN (
    'builder assessment',
    'builder make safe',
    'builder works'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM lookup_values good
    WHERE good.tenant_id = bad.tenant_id
      AND good.domain = 'job_type'
      AND good.provider_code = 'crunchwork'
      AND lower(trim(good.name)) = lower(trim(bad.name))
      AND good.external_reference IN ('BA', 'MS', 'BW')
      AND good.id <> bad.id
  );
