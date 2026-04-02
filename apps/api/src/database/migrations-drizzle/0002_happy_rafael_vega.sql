CREATE TABLE "external_event_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"error_message" text,
	"error_stack" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"external_object_id" uuid NOT NULL,
	"internal_entity_type" text NOT NULL,
	"internal_entity_id" uuid NOT NULL,
	"link_role" text DEFAULT 'source' NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_object_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_object_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"payload_hash" text NOT NULL,
	"source_event_id" uuid,
	"changed_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"connection_id" uuid NOT NULL,
	"provider_code" text NOT NULL,
	"provider_entity_type" text NOT NULL,
	"provider_entity_id" text NOT NULL,
	"normalized_entity_type" text NOT NULL,
	"latest_payload" jsonb NOT NULL,
	"payload_hash" text,
	"fetch_status" text DEFAULT 'fetched' NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"last_fetch_event_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_processing_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"connection_id" uuid,
	"event_id" uuid,
	"workflow_run_id" text,
	"provider_entity_type" text NOT NULL,
	"provider_entity_id" text NOT NULL,
	"action" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"external_object_id" uuid,
	"error_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"provider_id" uuid NOT NULL,
	"environment" text NOT NULL,
	"base_url" text NOT NULL,
	"auth_url" text,
	"client_identifier" text,
	"provider_tenant_id" text,
	"credentials" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"webhook_secret" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_providers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"kinde_user_id" text NOT NULL,
	"email" text,
	"name" text,
	"role" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_kinde_user_id_unique" UNIQUE("kinde_user_id")
);
--> statement-breakpoint
ALTER TABLE "inbound_webhook_events" ADD COLUMN "connection_id" uuid;--> statement-breakpoint
ALTER TABLE "inbound_webhook_events" ADD COLUMN "provider_code" text;--> statement-breakpoint
ALTER TABLE "inbound_webhook_events" ADD COLUMN "retry_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "parent_job_id" uuid;--> statement-breakpoint
ALTER TABLE "external_event_attempts" ADD CONSTRAINT "external_event_attempts_event_id_inbound_webhook_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."inbound_webhook_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_links" ADD CONSTRAINT "external_links_external_object_id_external_objects_id_fk" FOREIGN KEY ("external_object_id") REFERENCES "public"."external_objects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_object_versions" ADD CONSTRAINT "external_object_versions_external_object_id_external_objects_id_fk" FOREIGN KEY ("external_object_id") REFERENCES "public"."external_objects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_objects" ADD CONSTRAINT "external_objects_connection_id_integration_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."integration_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_processing_log" ADD CONSTRAINT "external_processing_log_connection_id_integration_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."integration_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_provider_id_integration_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."integration_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_event_attempt" ON "external_event_attempts" USING btree ("event_id","attempt_number");--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_ext_link_obj_type_id_role" ON "external_links" USING btree ("external_object_id","internal_entity_type","internal_entity_id","link_role");--> statement-breakpoint
CREATE INDEX "idx_ext_link_internal" ON "external_links" USING btree ("internal_entity_type","internal_entity_id");--> statement-breakpoint
CREATE INDEX "idx_ext_link_external" ON "external_links" USING btree ("external_object_id");--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_ext_obj_ver_obj_version" ON "external_object_versions" USING btree ("external_object_id","version_number");--> statement-breakpoint
CREATE INDEX "idx_ext_obj_ver_obj_created" ON "external_object_versions" USING btree ("external_object_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_ext_obj_connection_type_id" ON "external_objects" USING btree ("connection_id","provider_entity_type","provider_entity_id");--> statement-breakpoint
CREATE INDEX "idx_ext_obj_tenant_type" ON "external_objects" USING btree ("tenant_id","normalized_entity_type");--> statement-breakpoint
CREATE INDEX "idx_ext_obj_provider_entity_id" ON "external_objects" USING btree ("provider_entity_id");--> statement-breakpoint
CREATE INDEX "idx_processing_log_status" ON "external_processing_log" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_processing_log_tenant_type" ON "external_processing_log" USING btree ("tenant_id","provider_entity_type");--> statement-breakpoint
CREATE INDEX "idx_processing_log_workflow" ON "external_processing_log" USING btree ("workflow_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_connection_tenant_provider_env" ON "integration_connections" USING btree ("tenant_id","provider_id","environment");--> statement-breakpoint
CREATE INDEX "idx_connections_tenant" ON "integration_connections" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_users_tenant" ON "users" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("tenant_id","email");--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_parent_job_id_jobs_id_fk" FOREIGN KEY ("parent_job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;