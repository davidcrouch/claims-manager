CREATE TABLE IF NOT EXISTS "document_template_transforms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "document_type" text NOT NULL,
  "jsonata_rules" text,
  "target_schema" jsonb,
  "test_data" jsonb,
  "version" integer NOT NULL DEFAULT 1,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by" uuid,
  CONSTRAINT "UQ_doc_transform_tenant_type" UNIQUE("tenant_id","document_type")
);
--> statement-breakpoint
ALTER TABLE "document_template_transforms"
  ADD CONSTRAINT "document_template_transforms_tenant_id_organizations_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id")
  ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_doc_transforms_tenant_type"
  ON "document_template_transforms" USING btree ("tenant_id","document_type");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_template_transform_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "transform_id" uuid NOT NULL,
  "version" integer NOT NULL,
  "jsonata_rules" text,
  "target_schema" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "document_template_transform_versions"
  ADD CONSTRAINT "document_template_transform_versions_transform_id_fk"
  FOREIGN KEY ("transform_id") REFERENCES "public"."document_template_transforms"("id")
  ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_doc_transform_versions_transform"
  ON "document_template_transform_versions" USING btree ("transform_id","version");
