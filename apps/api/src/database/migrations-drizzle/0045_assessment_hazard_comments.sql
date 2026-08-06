ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS hazard_pool_fencing_comment TEXT,
  ADD COLUMN IF NOT EXISTS hazard_electrical_gas_comment TEXT,
  ADD COLUMN IF NOT EXISTS hazard_sewerage_comment TEXT,
  ADD COLUMN IF NOT EXISTS hazard_structural_comment TEXT;
