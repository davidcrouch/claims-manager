CREATE TABLE IF NOT EXISTS "feedback_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "feedback_item_id" uuid NOT NULL,
  "body" text NOT NULL,
  "created_by_user_id" text,
  "created_by_name" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "feedback_notes" ADD CONSTRAINT "feedback_notes_tenant_id_organizations_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id")
    ON DELETE restrict ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "feedback_notes" ADD CONSTRAINT "feedback_notes_feedback_item_id_feedback_items_id_fk"
    FOREIGN KEY ("feedback_item_id") REFERENCES "public"."feedback_items"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_feedback_notes_tenant_item" ON "feedback_notes" USING btree ("tenant_id", "feedback_item_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_feedback_notes_created_at" ON "feedback_notes" USING btree ("tenant_id", "created_at");
--> statement-breakpoint
INSERT INTO "feedback_notes" (
  "tenant_id",
  "feedback_item_id",
  "body",
  "created_by_user_id",
  "created_by_name",
  "created_at",
  "updated_at"
)
SELECT
  fi."tenant_id",
  fi."id",
  fi."resolution",
  NULL,
  'Imported note',
  COALESCE(fi."updated_at", fi."created_at"),
  COALESCE(fi."updated_at", fi."created_at")
FROM "feedback_items" fi
WHERE fi."resolution" IS NOT NULL
  AND btrim(fi."resolution") <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM "feedback_notes" fn
    WHERE fn."feedback_item_id" = fi."id"
      AND fn."created_by_name" = 'Imported note'
      AND fn."body" = fi."resolution"
  );
