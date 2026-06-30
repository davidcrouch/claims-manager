CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "title" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "is_read" boolean DEFAULT false NOT NULL,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_tenant_id_organizations_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id")
  ON DELETE cascade ON UPDATE cascade;

CREATE INDEX IF NOT EXISTS "idx_notifications_tenant_unread"
  ON "notifications" ("tenant_id", "is_read");

CREATE INDEX IF NOT EXISTS "idx_notifications_entity"
  ON "notifications" ("tenant_id", "entity_type", "entity_id");
