-- Add provider_code to lookup_values so external references can be scoped per vendor
ALTER TABLE "lookup_values" ADD COLUMN "provider_code" text;
--> statement-breakpoint

-- Backfill existing rows: all current lookups originate from Crunchwork
UPDATE "lookup_values" SET "provider_code" = 'crunchwork' WHERE "provider_code" IS NULL;
--> statement-breakpoint

-- Replace the old unique index with one that includes provider_code
DROP INDEX IF EXISTS "UQ_lookup_tenant_domain_extref";
--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_lookup_tenant_domain_provider_extref"
  ON "lookup_values" ("tenant_id", "domain", "provider_code", "external_reference");
