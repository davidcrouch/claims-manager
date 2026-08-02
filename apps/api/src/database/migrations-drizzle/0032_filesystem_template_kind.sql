-- 0032: Distinguish company vs project filesystem templates

ALTER TABLE filesystem_template
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'company';

ALTER TABLE filesystem_template
  DROP CONSTRAINT IF EXISTS chk_filesystem_template_kind;

ALTER TABLE filesystem_template
  ADD CONSTRAINT chk_filesystem_template_kind
  CHECK (kind IN ('company', 'project'));

CREATE INDEX IF NOT EXISTS idx_filesystem_template_kind
  ON filesystem_template (kind);
