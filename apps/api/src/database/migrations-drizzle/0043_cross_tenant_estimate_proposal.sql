-- Phase 1: Cross-Tenant Estimate (Quote) / Proposal

-- 1.1 Quotes — issuer-side custody fields
ALTER TABLE "quotes" ADD COLUMN "issuer_organisation_id" UUID REFERENCES "organizations"("id");
ALTER TABLE "quotes" ADD COLUMN "recipient_organisation_id" UUID REFERENCES "organizations"("id");
ALTER TABLE "quotes" ADD COLUMN "custodian_tenant_id" UUID REFERENCES "organizations"("id");
ALTER TABLE "quotes" ADD COLUMN "capture_method" TEXT;
ALTER TABLE "quotes" ADD COLUMN "ownership_status" TEXT NOT NULL DEFAULT 'owned';

CREATE INDEX "idx_quotes_issuer_org" ON "quotes" ("issuer_organisation_id");
CREATE INDEX "idx_quotes_ownership" ON "quotes" ("ownership_status");

CREATE UNIQUE INDEX "UQ_quotes_issuer_org_number" ON "quotes" ("issuer_organisation_id", "quote_number")
  WHERE issuer_organisation_id IS NOT NULL
    AND quote_number IS NOT NULL
    AND deleted_at IS NULL;

-- 1.2 Proposals — source tracking fields
ALTER TABLE "proposals" ADD COLUMN "source_tenant_id" UUID;
ALTER TABLE "proposals" ADD COLUMN "source_organisation_id" UUID REFERENCES "organizations"("id");

CREATE INDEX "idx_proposal_source_org" ON "proposals" ("source_organisation_id");

-- 1.3 Quote custody transfers audit log
CREATE TABLE "quote_custody_transfers" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "quote_id" UUID NOT NULL REFERENCES "quotes"("id"),
  "from_tenant_id" UUID NOT NULL REFERENCES "organizations"("id"),
  "to_tenant_id" UUID NOT NULL REFERENCES "organizations"("id"),
  "organisation_claim_id" UUID REFERENCES "organisation_claims"("id"),
  "transferred_by_user_id" TEXT,
  "transferred_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "metadata" JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX "idx_custody_transfer_quote" ON "quote_custody_transfers" ("quote_id");

-- 1.4 Backfill existing quotes
UPDATE "quotes"
SET "ownership_status" = 'owned',
    "issuer_organisation_id" = "tenant_id"
WHERE "issuer_organisation_id" IS NULL;

-- 1.5 Backfill proposals from linked quotes where possible
UPDATE "proposals" p
SET "source_tenant_id" = q."tenant_id",
    "source_organisation_id" = COALESCE(q."issuer_organisation_id", q."tenant_id")
FROM "quotes" q
WHERE p."quote_id" = q."id"
  AND p."source_organisation_id" IS NULL;
