-- 0031: Filesystem category parity — descriptions, pipelines, document pipeline status

ALTER TABLE filesystem_template_category
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE filesystem_category
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE document
  ADD COLUMN IF NOT EXISTS pipeline_status text,
  ADD COLUMN IF NOT EXISTS pipeline_error text;

-- ── Document Pipelines ──

CREATE TABLE IF NOT EXISTS document_pipeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  filesystem_id uuid REFERENCES filesystem(id) ON DELETE CASCADE,
  category_id uuid REFERENCES filesystem_category(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  trigger_on text NOT NULL DEFAULT 'upload_complete',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_pipeline_tenant_idx
  ON document_pipeline (tenant_id);
CREATE INDEX IF NOT EXISTS document_pipeline_filesystem_idx
  ON document_pipeline (filesystem_id);
CREATE INDEX IF NOT EXISTS document_pipeline_category_idx
  ON document_pipeline (category_id);

CREATE TABLE IF NOT EXISTS document_pipeline_step (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES document_pipeline(id) ON DELETE CASCADE,
  agent_id text NOT NULL,
  step_order integer NOT NULL DEFAULT 0,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_pipeline_step_pipeline_idx
  ON document_pipeline_step (pipeline_id);
CREATE UNIQUE INDEX IF NOT EXISTS document_pipeline_step_order_unique
  ON document_pipeline_step (pipeline_id, step_order);

CREATE TABLE IF NOT EXISTS document_pipeline_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES document_pipeline(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_pipeline_run_document_idx
  ON document_pipeline_run (document_id);
CREATE INDEX IF NOT EXISTS document_pipeline_run_tenant_status_idx
  ON document_pipeline_run (tenant_id, status);

CREATE TABLE IF NOT EXISTS document_pipeline_run_step (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES document_pipeline_run(id) ON DELETE CASCADE,
  step_id uuid REFERENCES document_pipeline_step(id) ON DELETE SET NULL,
  agent_id text NOT NULL,
  step_order integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  input_context jsonb DEFAULT '{}'::jsonb,
  output_result jsonb DEFAULT '{}'::jsonb,
  error text,
  duration_ms integer
);

CREATE INDEX IF NOT EXISTS document_pipeline_run_step_run_idx
  ON document_pipeline_run_step (run_id);

-- ── Filesystem Template Pipelines ──

CREATE TABLE IF NOT EXISTS filesystem_template_pipeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES filesystem_template(id) ON DELETE CASCADE,
  template_category_id uuid REFERENCES filesystem_template_category(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  trigger_on text NOT NULL DEFAULT 'upload_complete',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS filesystem_template_pipeline_template_idx
  ON filesystem_template_pipeline (template_id);
CREATE INDEX IF NOT EXISTS filesystem_template_pipeline_category_idx
  ON filesystem_template_pipeline (template_category_id);

CREATE TABLE IF NOT EXISTS filesystem_template_pipeline_step (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES filesystem_template_pipeline(id) ON DELETE CASCADE,
  agent_id text NOT NULL,
  step_order integer NOT NULL DEFAULT 0,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS filesystem_template_pipeline_step_pipeline_idx
  ON filesystem_template_pipeline_step (pipeline_id);
CREATE UNIQUE INDEX IF NOT EXISTS filesystem_template_pipeline_step_order_unique
  ON filesystem_template_pipeline_step (pipeline_id, step_order);
