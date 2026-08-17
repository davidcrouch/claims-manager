-- Connection identifiers: maps multiple external tenant/platform IDs to a single connection
CREATE TABLE IF NOT EXISTS "connection_identifiers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "connection_id" uuid NOT NULL REFERENCES "integration_connections"("id") ON DELETE CASCADE,
  "identifier_type" text NOT NULL,
  "identifier_value" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_identifier_type_value"
  ON "connection_identifiers" ("identifier_type", "identifier_value");
CREATE INDEX IF NOT EXISTS "idx_identifier_connection"
  ON "connection_identifiers" ("connection_id");
CREATE INDEX IF NOT EXISTS "idx_identifier_value"
  ON "connection_identifiers" ("identifier_value");

-- Seed from existing integration_connections data
INSERT INTO "connection_identifiers" ("connection_id", "identifier_type", "identifier_value")
SELECT id, 'provider_tenant', provider_tenant_id
FROM "integration_connections"
WHERE provider_tenant_id IS NOT NULL
ON CONFLICT ("identifier_type", "identifier_value") DO NOTHING;

-- Seed insure tenant IDs from config JSONB
INSERT INTO "connection_identifiers" ("connection_id", "identifier_type", "identifier_value")
SELECT id, 'insure_tenant', config->>'insureTenantId'
FROM "integration_connections"
WHERE config->>'insureTenantId' IS NOT NULL
ON CONFLICT ("identifier_type", "identifier_value") DO NOTHING;
