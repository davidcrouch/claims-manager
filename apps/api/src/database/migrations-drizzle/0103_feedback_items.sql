CREATE TABLE IF NOT EXISTS "feedback_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "priority" text DEFAULT 'medium' NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "reported_by_user_id" text NOT NULL,
  "reported_by_name" text,
  "page_context" jsonb DEFAULT '{}'::jsonb,
  "related_entity_type" text,
  "related_entity_id" uuid,
  "conversation_id" uuid,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "resolution" text,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "feedback_items_type_check" CHECK ("type" IN ('bug', 'feature_request', 'enhancement', 'question', 'comment')),
  CONSTRAINT "feedback_items_priority_check" CHECK ("priority" IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT "feedback_items_status_check" CHECK ("status" IN ('open', 'in_progress', 'resolved', 'closed'))
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "feedback_items" ADD CONSTRAINT "feedback_items_tenant_id_organizations_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id")
    ON DELETE restrict ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_feedback_items_tenant_status" ON "feedback_items" USING btree ("tenant_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_feedback_items_tenant_type" ON "feedback_items" USING btree ("tenant_id", "type");
