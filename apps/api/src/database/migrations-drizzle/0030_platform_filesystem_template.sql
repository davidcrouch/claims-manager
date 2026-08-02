-- 0030: Allow platform-scoped filesystem templates (tenant_id NULL)

ALTER TABLE filesystem_template ALTER COLUMN tenant_id DROP NOT NULL;
