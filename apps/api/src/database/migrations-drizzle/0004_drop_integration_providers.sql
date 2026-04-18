-- Providers are now hardcoded in `src/modules/providers/provider-registry.ts`.
-- This migration removes the `integration_providers` table and all `provider_id`
-- FK columns, replacing them with stable string `provider_code` references.
--
-- Hand-authored (NOT drizzle-generated output) because the default generator
-- drops the `provider_id` columns without backfilling the new `provider_code`,
-- which would orphan existing connections.

-- Add provider_code to integration_connections (nullable for the backfill).
ALTER TABLE "integration_connections" ADD COLUMN "provider_code" text;--> statement-breakpoint

-- Backfill provider_code from the integration_providers row each connection points to.
UPDATE "integration_connections" ic
SET "provider_code" = ip."code"
FROM "integration_providers" ip
WHERE ip."id" = ic."provider_id";--> statement-breakpoint

-- Now that every row has a code, enforce NOT NULL.
ALTER TABLE "integration_connections" ALTER COLUMN "provider_code" SET NOT NULL;--> statement-breakpoint

-- Swap the uniqueness / lookup indexes onto provider_code.
DROP INDEX "UQ_connection_tenant_provider_env";--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_connection_tenant_provider_env" ON "integration_connections" USING btree ("tenant_id","provider_code","environment");--> statement-breakpoint
CREATE INDEX "idx_connections_provider_code" ON "integration_connections" USING btree ("provider_code");--> statement-breakpoint

-- Drop the FK + provider_id column on integration_connections.
ALTER TABLE "integration_connections" DROP CONSTRAINT "integration_connections_provider_id_integration_providers_id_fk";--> statement-breakpoint
ALTER TABLE "integration_connections" DROP COLUMN "provider_id";--> statement-breakpoint

-- external_objects already carries provider_code (NOT NULL); drop the redundant provider_id FK/col.
ALTER TABLE "external_objects" DROP CONSTRAINT "external_objects_provider_id_integration_providers_id_fk";--> statement-breakpoint
ALTER TABLE "external_objects" DROP COLUMN "provider_id";--> statement-breakpoint

-- inbound_webhook_events already carries provider_code (nullable); drop the redundant provider_id FK/col/index.
DROP INDEX "idx_webhooks_provider_entity";--> statement-breakpoint
ALTER TABLE "inbound_webhook_events" DROP CONSTRAINT "inbound_webhook_events_provider_id_integration_providers_id_fk";--> statement-breakpoint
ALTER TABLE "inbound_webhook_events" DROP COLUMN "provider_id";--> statement-breakpoint
CREATE INDEX "idx_webhooks_provider_code_entity" ON "inbound_webhook_events" USING btree ("provider_code","provider_entity_type");--> statement-breakpoint

-- Finally drop the providers table. CASCADE is safe: we've already dropped all inbound FKs.
ALTER TABLE "integration_providers" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "integration_providers" CASCADE;
