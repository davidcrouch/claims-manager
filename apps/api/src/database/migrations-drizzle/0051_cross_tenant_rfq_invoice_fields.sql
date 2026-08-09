-- 0051: Add cross-tenant fields to rfqs, jobs, invoices, and bills tables

-- RFQ cross-tenant columns
ALTER TABLE rfqs
  ADD COLUMN issuer_organisation_id UUID REFERENCES organizations(id),
  ADD COLUMN recipient_organisation_id UUID REFERENCES organizations(id),
  ADD COLUMN source_tenant_id UUID REFERENCES organizations(id),
  ADD COLUMN source_organisation_id UUID REFERENCES organizations(id),
  ADD COLUMN source_external_reference TEXT,
  ADD COLUMN custodian_tenant_id UUID REFERENCES organizations(id),
  ADD COLUMN capture_method TEXT,
  ADD COLUMN ownership_status TEXT,
  ADD COLUMN source_version_number INTEGER,
  ADD COLUMN latest_available_version INTEGER,
  ADD COLUMN version_acknowledged BOOLEAN DEFAULT TRUE;

CREATE INDEX idx_rfq_source_tenant ON rfqs (source_tenant_id);

-- Jobs cross-tenant columns
ALTER TABLE jobs
  ADD COLUMN source_tenant_id UUID REFERENCES organizations(id),
  ADD COLUMN source_organisation_id UUID REFERENCES organizations(id),
  ADD COLUMN source_external_reference TEXT;

CREATE INDEX idx_jobs_source_tenant ON jobs (source_tenant_id);

-- Invoice cross-tenant columns
ALTER TABLE invoices
  ADD COLUMN issuer_organisation_id UUID REFERENCES organizations(id),
  ADD COLUMN recipient_organisation_id UUID REFERENCES organizations(id),
  ADD COLUMN source_tenant_id UUID REFERENCES organizations(id),
  ADD COLUMN source_organisation_id UUID REFERENCES organizations(id),
  ADD COLUMN source_external_reference TEXT,
  ADD COLUMN custodian_tenant_id UUID REFERENCES organizations(id),
  ADD COLUMN capture_method TEXT,
  ADD COLUMN ownership_status TEXT,
  ADD COLUMN source_version_number INTEGER,
  ADD COLUMN latest_available_version INTEGER,
  ADD COLUMN version_acknowledged BOOLEAN DEFAULT TRUE;

CREATE INDEX idx_invoices_source_tenant ON invoices (source_tenant_id);

-- Bills cross-tenant columns
ALTER TABLE bills
  ADD COLUMN source_tenant_id UUID REFERENCES organizations(id),
  ADD COLUMN source_organisation_id UUID REFERENCES organizations(id),
  ADD COLUMN source_external_reference TEXT;

CREATE INDEX idx_bills_source_tenant ON bills (source_tenant_id);
