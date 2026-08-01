-- Point document_templates at filesystem documents; one mapping per scenario
ALTER TABLE "document_templates" ALTER COLUMN "s3_key" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "document_templates" ADD COLUMN IF NOT EXISTS "filesystem_document_id" uuid;
--> statement-breakpoint
ALTER TABLE "document_templates" DROP CONSTRAINT IF EXISTS "UQ_doc_template_tenant_type_name";
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "document_templates" ADD CONSTRAINT "UQ_doc_template_tenant_type" UNIQUE("tenant_id","document_type");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_doc_templates_filesystem_doc" ON "document_templates" USING btree ("filesystem_document_id");
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_filesystem_document_id_document_id_fk"
    FOREIGN KEY ("filesystem_document_id") REFERENCES "public"."document"("id") ON DELETE set null;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
