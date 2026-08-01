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
	CONSTRAINT "UQ_doc_template_tenant_type_name" UNIQUE("tenant_id","document_type","name"),
	CONSTRAINT "chk_doc_template_type" CHECK (document_type IN ('quote','invoice','purchase_order','work_order','proposal','report','bill','rfq'))
);
--> statement-breakpoint
CREATE TABLE "document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"filesystem_category_id" uuid,
	"related_record_type" text,
	"related_record_id" uuid,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size_bytes" bigint,
	"gcs_bucket" text NOT NULL,
	"gcs_object_path" text NOT NULL,
	"uri" text,
	"thumbnail_uri" text,
	"upload_status" text DEFAULT 'pending' NOT NULL,
	"source_system" text DEFAULT 'claims-manager' NOT NULL,
	"uploaded_by_user_id" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "filesystem_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filesystem_id" uuid NOT NULL,
	"parent_category_id" uuid,
	"display_name" text NOT NULL,
	"slug" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "filesystem_template_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"parent_category_id" uuid,
	"display_name" text NOT NULL,
	"slug" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "filesystem_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "filesystem" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text DEFAULT 'Documents' NOT NULL,
	"source_template_id" uuid,
	"copied_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "filesystem_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
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
DO $$ BEGIN
  ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_filesystem_category_id_filesystem_category_id_fk" FOREIGN KEY ("filesystem_category_id") REFERENCES "public"."filesystem_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filesystem_category" ADD CONSTRAINT "filesystem_category_filesystem_id_filesystem_id_fk" FOREIGN KEY ("filesystem_id") REFERENCES "public"."filesystem"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filesystem_category" ADD CONSTRAINT "filesystem_category_parent_category_id_filesystem_category_id_fk" FOREIGN KEY ("parent_category_id") REFERENCES "public"."filesystem_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filesystem_template_category" ADD CONSTRAINT "filesystem_template_category_template_id_filesystem_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."filesystem_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filesystem_template_category" ADD CONSTRAINT "filesystem_template_category_parent_category_id_filesystem_template_category_id_fk" FOREIGN KEY ("parent_category_id") REFERENCES "public"."filesystem_template_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filesystem_template" ADD CONSTRAINT "filesystem_template_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "filesystem" ADD CONSTRAINT "filesystem_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "filesystem" ADD CONSTRAINT "filesystem_source_template_id_filesystem_template_id_fk" FOREIGN KEY ("source_template_id") REFERENCES "public"."filesystem_template"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_template_id_document_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."document_templates"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_doc_templates_tenant_type" ON "document_templates" USING btree ("tenant_id","document_type");--> statement-breakpoint
CREATE INDEX "idx_document_tenant" ON "document" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_document_category" ON "document" USING btree ("filesystem_category_id");--> statement-breakpoint
CREATE INDEX "idx_document_related" ON "document" USING btree ("tenant_id","related_record_type","related_record_id");--> statement-breakpoint
CREATE INDEX "idx_document_status" ON "document" USING btree ("tenant_id","upload_status");--> statement-breakpoint
CREATE INDEX "idx_fs_category_filesystem" ON "filesystem_category" USING btree ("filesystem_id");--> statement-breakpoint
CREATE INDEX "idx_fs_category_parent" ON "filesystem_category" USING btree ("parent_category_id");--> statement-breakpoint
CREATE INDEX "idx_fs_template_category_template" ON "filesystem_template_category" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "idx_filesystem_template_tenant" ON "filesystem_template" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_filesystem_tenant" ON "filesystem" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_gen_docs_tenant_entity" ON "generated_documents" USING btree ("tenant_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_gen_docs_tenant_type" ON "generated_documents" USING btree ("tenant_id","document_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_gen_docs_template" ON "generated_documents" USING btree ("template_id");