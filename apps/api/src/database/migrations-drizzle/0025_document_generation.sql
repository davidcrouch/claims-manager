-- Document Templates (per-tenant .docx template registry)
CREATE TABLE IF NOT EXISTS "document_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "document_type" text NOT NULL,
  "name" text NOT NULL,
  "s3_key" text NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chk_doc_template_type" CHECK (document_type IN ('quote','invoice','purchase_order','work_order','proposal','report','bill','rfq')),
  CONSTRAINT "UQ_doc_template_tenant_type_name" UNIQUE("tenant_id","document_type","name")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_doc_templates_tenant_type" ON "document_templates" USING btree ("tenant_id","document_type");
--> statement-breakpoint
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;

--> statement-breakpoint

-- Generated Documents (audit log of every generated PDF/DOCX)
CREATE TABLE IF NOT EXISTS "generated_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "document_type" text NOT NULL,
  "entity_id" uuid NOT NULL,
  "entity_type" text NOT NULL,
  "template_id" uuid,
  "s3_key_pdf" text NOT NULL,
  "s3_key_docx" text,
  "generated_by" uuid,
  "trigger" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chk_gen_doc_type" CHECK (document_type IN ('quote','invoice','purchase_order','work_order','proposal','report','bill','rfq')),
  CONSTRAINT "chk_gen_doc_trigger" CHECK (trigger IN ('manual','workflow')),
  CONSTRAINT "chk_gen_doc_status" CHECK (status IN ('pending','processing','completed','failed'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_gen_docs_tenant_entity" ON "generated_documents" USING btree ("tenant_id","entity_type","entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_gen_docs_tenant_type" ON "generated_documents" USING btree ("tenant_id","document_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_gen_docs_template" ON "generated_documents" USING btree ("template_id");
--> statement-breakpoint
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_template_id_document_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."document_templates"("id") ON DELETE set null;
