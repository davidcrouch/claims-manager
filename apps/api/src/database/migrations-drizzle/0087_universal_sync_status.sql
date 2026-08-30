-- Add sync_status and external_reference columns for universal outbound sync

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS sync_status TEXT,
  ADD COLUMN IF NOT EXISTS external_reference TEXT;

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS sync_status TEXT,
  ADD COLUMN IF NOT EXISTS external_reference TEXT;

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS sync_status TEXT;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS sync_status TEXT;

-- Check constraints
ALTER TABLE tasks ADD CONSTRAINT chk_task_sync_status
  CHECK (sync_status IS NULL OR sync_status IN ('pending', 'synced', 'failed'));
ALTER TABLE appointments ADD CONSTRAINT chk_appt_sync_status
  CHECK (sync_status IS NULL OR sync_status IN ('pending', 'synced', 'failed'));
ALTER TABLE quotes ADD CONSTRAINT chk_quote_sync_status
  CHECK (sync_status IS NULL OR sync_status IN ('pending', 'synced', 'failed'));
ALTER TABLE invoices ADD CONSTRAINT chk_invoice_sync_status
  CHECK (sync_status IS NULL OR sync_status IN ('pending', 'synced', 'failed'));

-- Partial indexes for efficient "find failed/pending" queries
CREATE INDEX IF NOT EXISTS idx_tasks_sync_status ON tasks(tenant_id, sync_status) WHERE sync_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_sync_status ON appointments(tenant_id, sync_status) WHERE sync_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_sync_status ON quotes(tenant_id, sync_status) WHERE sync_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_sync_status ON invoices(tenant_id, sync_status) WHERE sync_status IS NOT NULL;
