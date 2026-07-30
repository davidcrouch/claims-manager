-- Internal (direct) job types for Create Job drawer — not Crunchwork-constrained.
INSERT INTO lookup_values (id, tenant_id, domain, provider_code, name, external_reference, metadata, is_active)
SELECT gen_random_uuid(), o.id, 'job_type', 'direct', v.name, v.ext_ref, '{}'::jsonb, true
FROM organizations o
CROSS JOIN (
  VALUES
    ('Builder Assessment', 'direct-job-type-builder-assessment'),
    ('Builder Make Safe', 'direct-job-type-builder-make-safe'),
    ('Builder - Scope of Works', 'direct-job-type-builder-scope'),
    ('Contents', 'direct-job-type-contents'),
    ('Temporary Accommodation', 'direct-job-type-temporary-accommodation'),
    ('Specialist', 'direct-job-type-specialist'),
    ('Rectification Assessment', 'direct-job-type-rectification-assessment'),
    ('Builder Rectification Work', 'direct-job-type-builder-rectification'),
    ('Internal Audit', 'direct-job-type-internal-audit'),
    ('Inspection', 'direct-job-type-inspection'),
    ('Repair', 'direct-job-type-repair'),
    ('General', 'direct-job-type-general')
) AS v(name, ext_ref)
WHERE NOT EXISTS (
  SELECT 1
  FROM lookup_values lv
  WHERE lv.tenant_id = o.id
    AND lv.domain = 'job_type'
    AND lv.provider_code = 'direct'
    AND lv.external_reference = v.ext_ref
);
