CREATE TABLE IF NOT EXISTS "document_template_data_contexts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "document_type" text NOT NULL,
  "enabled_slugs" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "document_template_data_contexts"
  ADD CONSTRAINT "document_template_data_contexts_tenant_id_organizations_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id")
  ON DELETE cascade ON UPDATE cascade;

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_doc_data_context_tenant_type"
  ON "document_template_data_contexts" USING btree ("tenant_id","document_type");

CREATE INDEX IF NOT EXISTS "idx_doc_data_contexts_tenant_type"
  ON "document_template_data_contexts" USING btree ("tenant_id","document_type");
