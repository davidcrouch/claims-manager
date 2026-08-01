-- Phase 1: Cross-Tenant PO/WO & Ghost Organisations

-- 1.1 Organizations — identity fields for ghost resolution
ALTER TABLE "organizations" ADD COLUMN "abn" TEXT;
ALTER TABLE "organizations" ADD COLUMN "legal_name" TEXT;
ALTER TABLE "organizations" ADD COLUMN "trading_name" TEXT;
ALTER TABLE "organizations" ADD COLUMN "primary_email" TEXT;
ALTER TABLE "organizations" ADD COLUMN "email_domain" TEXT;
ALTER TABLE "organizations" ADD COLUMN "phone" TEXT;
ALTER TABLE "organizations" ADD COLUMN "subscription_status" TEXT NOT NULL DEFAULT 'active';

CREATE UNIQUE INDEX "UQ_organizations_abn" ON "organizations" ("abn") WHERE abn IS NOT NULL;

-- 1.2 Purchase orders — ownership and custody fields
ALTER TABLE "purchase_orders" ADD COLUMN "issuer_organisation_id" UUID REFERENCES "organizations"("id");
ALTER TABLE "purchase_orders" ADD COLUMN "recipient_organisation_id" UUID REFERENCES "organizations"("id");
ALTER TABLE "purchase_orders" ADD COLUMN "custodian_tenant_id" UUID REFERENCES "organizations"("id");
ALTER TABLE "purchase_orders" ADD COLUMN "capture_method" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN "ownership_status" TEXT NOT NULL DEFAULT 'owned';
ALTER TABLE "purchase_orders" ADD COLUMN "scope_of_work" TEXT;

CREATE INDEX "idx_po_issuer_org" ON "purchase_orders" ("issuer_organisation_id");
CREATE INDEX "idx_po_ownership" ON "purchase_orders" ("ownership_status");

CREATE UNIQUE INDEX "UQ_po_issuer_org_number" ON "purchase_orders" ("issuer_organisation_id", "purchase_order_number")
  WHERE issuer_organisation_id IS NOT NULL
    AND purchase_order_number IS NOT NULL
    AND deleted_at IS NULL;

-- 1.3 Work orders — source organisation tracking
ALTER TABLE "work_orders" ADD COLUMN "source_organisation_id" UUID REFERENCES "organizations"("id");

-- 1.4 Organisation claims table
CREATE TABLE "organisation_claims" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ghost_organisation_id" UUID NOT NULL REFERENCES "organizations"("id"),
  "claiming_tenant_id" UUID NOT NULL REFERENCES "organizations"("id"),
  "status" TEXT NOT NULL DEFAULT 'pending',
  "verification_method" TEXT,
  "evidence" JSONB NOT NULL DEFAULT '{}',
  "reviewed_by_user_id" TEXT,
  "reviewed_at" TIMESTAMPTZ,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("ghost_organisation_id", "claiming_tenant_id")
);

CREATE INDEX "idx_org_claims_ghost" ON "organisation_claims" ("ghost_organisation_id");
CREATE INDEX "idx_org_claims_tenant" ON "organisation_claims" ("claiming_tenant_id");

-- 1.5 PO custody transfers table
CREATE TABLE "po_custody_transfers" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "purchase_order_id" UUID NOT NULL REFERENCES "purchase_orders"("id"),
  "from_tenant_id" UUID NOT NULL REFERENCES "organizations"("id"),
  "to_tenant_id" UUID NOT NULL REFERENCES "organizations"("id"),
  "organisation_claim_id" UUID REFERENCES "organisation_claims"("id"),
  "transferred_by_user_id" TEXT,
  "transferred_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "metadata" JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX "idx_custody_transfer_po" ON "po_custody_transfers" ("purchase_order_id");

-- 1.6 Backfill existing PO rows
UPDATE "purchase_orders"
SET "ownership_status" = 'owned',
    "issuer_organisation_id" = "tenant_id"
WHERE "issuer_organisation_id" IS NULL;
