ALTER TABLE "capability_pack_install"
  ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'builtin',
  ADD COLUMN IF NOT EXISTS "display_name" text,
  ADD COLUMN IF NOT EXISTS "error_message" text,
  ADD COLUMN IF NOT EXISTS "upload_id" uuid;

DO $$ BEGIN
  ALTER TABLE "capability_pack_install"
    ADD CONSTRAINT "capability_pack_install_source_check"
    CHECK (source IN ('builtin', 'upload'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "capability_pack_install_tenant_pack_active_uidx"
  ON "capability_pack_install" ("tenant_id", "pack_id")
  WHERE status IN ('active', 'upgrading');

ALTER TABLE "capability_pack_artefact"
  ADD COLUMN IF NOT EXISTS "source_key" text;

CREATE TABLE IF NOT EXISTS "capability_pack_upload" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "pack_id" text NOT NULL,
  "pack_version" text NOT NULL,
  "display_name" text,
  "description" text,
  "bundle_json" jsonb NOT NULL,
  "manifest_json" jsonb NOT NULL,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "capability_pack_upload_tenant_idx"
  ON "capability_pack_upload" ("tenant_id");

CREATE INDEX IF NOT EXISTS "capability_pack_upload_pack_idx"
  ON "capability_pack_upload" ("tenant_id", "pack_id");
