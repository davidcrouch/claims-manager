-- Align Internal vs Crunchwork job_type catalogs.
-- Internal (direct): General, Repair, Remodel, New Construction only.
-- Crunchwork: keep Builder Assessment / Make Safe / Works; drop seeded CW extras.
-- Future CW webhook auto-creates may still add more crunchwork job types.

-- 1) Deactivate obsolete Internal (direct) job types
UPDATE lookup_values
SET is_active = false
WHERE domain = 'job_type'
  AND provider_code = 'direct'
  AND name NOT IN ('General', 'Repair', 'Remodel', 'New Construction');

-- 2) Ensure the four Internal types exist and are active
INSERT INTO lookup_values (id, tenant_id, domain, provider_code, name, external_reference, metadata, is_active)
SELECT gen_random_uuid(), o.id, 'job_type', 'direct', v.name, v.ext_ref, '{}'::jsonb, true
FROM organizations o
CROSS JOIN (
  VALUES
    ('General', 'direct-job-type-general'),
    ('Repair', 'direct-job-type-repair'),
    ('Remodel', 'direct-job-type-remodel'),
    ('New Construction', 'direct-job-type-new-construction')
) AS v(name, ext_ref)
WHERE NOT EXISTS (
  SELECT 1
  FROM lookup_values lv
  WHERE lv.tenant_id = o.id
    AND lv.domain = 'job_type'
    AND lv.provider_code = 'direct'
    AND (
      lv.external_reference = v.ext_ref
      OR lower(lv.name) = lower(v.name)
    )
);

UPDATE lookup_values
SET is_active = true
WHERE domain = 'job_type'
  AND provider_code = 'direct'
  AND name IN ('General', 'Repair', 'Remodel', 'New Construction');

-- 3) Deactivate seeded Crunchwork extras (not BA / MS / BW)
UPDATE lookup_values
SET is_active = false
WHERE domain = 'job_type'
  AND provider_code = 'crunchwork'
  AND name NOT IN ('Builder Assessment', 'Builder Make Safe', 'Builder Works');

-- 4) Ensure core Crunchwork types exist (idempotent; sync may already have BA/MS/BW)
INSERT INTO lookup_values (id, tenant_id, domain, provider_code, name, external_reference, metadata, is_active)
SELECT gen_random_uuid(), o.id, 'job_type', 'crunchwork', v.name, v.ext_ref, '{}'::jsonb, true
FROM organizations o
CROSS JOIN (
  VALUES
    ('Builder Assessment', 'BA'),
    ('Builder Make Safe', 'MS'),
    ('Builder Works', 'BW')
) AS v(name, ext_ref)
WHERE NOT EXISTS (
  SELECT 1
  FROM lookup_values lv
  WHERE lv.tenant_id = o.id
    AND lv.domain = 'job_type'
    AND lv.provider_code = 'crunchwork'
    AND (
      lv.external_reference = v.ext_ref
      OR lower(lv.name) = lower(v.name)
    )
);

UPDATE lookup_values
SET is_active = true
WHERE domain = 'job_type'
  AND provider_code = 'crunchwork'
  AND name IN ('Builder Assessment', 'Builder Make Safe', 'Builder Works');
