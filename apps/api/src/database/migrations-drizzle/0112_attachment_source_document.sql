ALTER TABLE "attachments"
  ADD COLUMN IF NOT EXISTS "source_document_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "attachments"
    ADD CONSTRAINT "attachments_source_document_id_document_id_fk"
    FOREIGN KEY ("source_document_id") REFERENCES "public"."document"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_attachments_source_document"
  ON "attachments" ("source_document_id");
