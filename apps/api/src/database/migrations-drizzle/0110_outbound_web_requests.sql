CREATE TABLE IF NOT EXISTS "outbound_web_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "connection_id" uuid NOT NULL,
  "http_method" text NOT NULL,
  "path" text NOT NULL,
  "url" text NOT NULL,
  "query_params" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "entity_type" text,
  "entity_id" text,
  "status_code" integer,
  "outcome" text NOT NULL,
  "duration_ms" integer NOT NULL,
  "request_body" jsonb,
  "response_body" jsonb,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "outbound_web_requests" ADD CONSTRAINT "outbound_web_requests_tenant_id_organizations_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id")
    ON DELETE restrict ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "outbound_web_requests" ADD CONSTRAINT "outbound_web_requests_connection_id_integration_connections_id_fk"
    FOREIGN KEY ("connection_id") REFERENCES "public"."integration_connections"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_outbound_web_requests_connection_created"
  ON "outbound_web_requests" USING btree ("connection_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_outbound_web_requests_connection_outcome"
  ON "outbound_web_requests" USING btree ("connection_id", "outcome");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_outbound_web_requests_connection_entity"
  ON "outbound_web_requests" USING btree ("connection_id", "entity_type");
