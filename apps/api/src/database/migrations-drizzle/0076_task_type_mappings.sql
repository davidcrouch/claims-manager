CREATE TABLE IF NOT EXISTS "task_type_mappings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "title_pattern" text NOT NULL,
  "match_mode" text DEFAULT 'normalized' NOT NULL,
  "task_type" text NOT NULL,
  "priority" integer DEFAULT 100 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chk_task_type_mapping_match_mode"
    CHECK (match_mode IN ('exact','normalized','prefix','contains'))
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "task_type_mappings"
    ADD CONSTRAINT "task_type_mappings_tenant_id_organizations_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id")
    ON DELETE cascade ON UPDATE cascade;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_task_type_mappings_tenant_pattern_mode"
  ON "task_type_mappings" ("tenant_id","title_pattern","match_mode");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_task_type_mappings_tenant_active"
  ON "task_type_mappings" ("tenant_id","is_active","priority");
