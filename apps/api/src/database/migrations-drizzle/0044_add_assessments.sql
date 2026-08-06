CREATE TABLE IF NOT EXISTS assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',

  -- Building structure info
  claim_recommendation TEXT,
  make_safe BOOLEAN NOT NULL DEFAULT false,
  make_safe_type TEXT,
  design_type TEXT,
  construction TEXT,
  roof_type TEXT,
  building_type TEXT,
  squares NUMERIC(10, 2),
  building_age INTEGER,
  square_metres NUMERIC(10, 2),
  date_booked DATE,
  overall_condition_acceptable BOOLEAN NOT NULL DEFAULT false,
  iag_inspection_required BOOLEAN NOT NULL DEFAULT false,

  -- General checkbox questions
  make_safe_completion_date DATE,
  main_roof_damage BOOLEAN NOT NULL DEFAULT false,
  date_main_roof_repaired DATE,
  habitable BOOLEAN NOT NULL DEFAULT true,
  mould BOOLEAN NOT NULL DEFAULT false,
  asbestos_on_site BOOLEAN NOT NULL DEFAULT false,
  detached_garage BOOLEAN NOT NULL DEFAULT false,
  sheds BOOLEAN NOT NULL DEFAULT false,
  swimming_pool BOOLEAN NOT NULL DEFAULT false,
  detached_granny_flat BOOLEAN NOT NULL DEFAULT false,
  damage_caused_by_listed_event BOOLEAN NOT NULL DEFAULT false,

  -- Other hazards on site
  hazard_pool_fencing BOOLEAN NOT NULL DEFAULT false,
  hazard_pool_fencing_comment TEXT,
  hazard_electrical_gas BOOLEAN NOT NULL DEFAULT false,
  hazard_electrical_gas_comment TEXT,
  hazard_sewerage BOOLEAN NOT NULL DEFAULT false,
  hazard_sewerage_comment TEXT,
  hazard_structural BOOLEAN NOT NULL DEFAULT false,
  hazard_structural_comment TEXT,
  hazard_other TEXT,

  -- Temporary accommodation
  temp_accom_required_immediately BOOLEAN NOT NULL DEFAULT false,
  temp_accom_immediate_estimate_days INTEGER,
  temp_repairs_to_make_livable TEXT,
  temp_accom_required_during_repairs BOOLEAN NOT NULL DEFAULT false,
  temp_accom_repairs_estimate_days INTEGER,
  work_while_in_accommodation TEXT,

  -- Other
  client_discussion TEXT,
  resultant_damage TEXT,
  cause_of_damage TEXT,
  maintenance_related_issues TEXT,
  comments TEXT,
  variances_of_scope TEXT,

  created_by_user_id TEXT,
  updated_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_assessment_status CHECK (status IN ('draft', 'submitted', 'reviewed', 'archived'))
);

CREATE INDEX idx_assessments_tenant ON assessments(tenant_id, status);
CREATE INDEX idx_assessments_job ON assessments(tenant_id, job_id) WHERE job_id IS NOT NULL;
