-- 0050: Add organisation_id FK to vendors table for cross-tenant routing

ALTER TABLE vendors ADD COLUMN organisation_id UUID REFERENCES organizations(id);

CREATE INDEX idx_vendors_organisation ON vendors (organisation_id);
