CREATE TABLE IF NOT EXISTS "job_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "job_id" uuid NOT NULL,
  "body" text NOT NULL,
  "created_by_user_id" text,
  "created_by_name" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "job_notes" ADD CONSTRAINT "job_notes_tenant_id_organizations_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id")
    ON DELETE restrict ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "job_notes" ADD CONSTRAINT "job_notes_job_id_jobs_id_fk"
    FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_notes_tenant_job" ON "job_notes" USING btree ("tenant_id", "job_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_notes_created_at" ON "job_notes" USING btree ("tenant_id", "created_at");
