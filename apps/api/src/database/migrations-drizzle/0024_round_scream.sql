-- Missing tables/columns relative to current Drizzle schema (local DB drift after incomplete migration history).

CREATE TABLE IF NOT EXISTS "catalogs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'internal' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_catalogs_type" CHECK (type IN ('crunchwork', 'internal'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"document_type" text NOT NULL,
	"document_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"line_item_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"issued_by_user_id" text,
	"superseded_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "UQ_doc_version" UNIQUE("tenant_id","document_type","document_id","version_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "entity_workflow_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"workflow_name" text NOT NULL,
	"current_step" text NOT NULL,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"entered_by_user_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "UQ_workflow_state" UNIQUE("tenant_id","entity_type","entity_id","workflow_name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "item_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source_work_order_item_id" uuid NOT NULL,
	"target_purchase_order_item_id" uuid NOT NULL,
	"allocated_quantity" numeric(14, 4),
	"allocated_amount" numeric(14, 2),
	"allocation_type" text DEFAULT 'full' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_allocation_type" CHECK (allocation_type IN ('full', 'partial', 'split'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "journals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"address" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"address_postcode" text,
	"address_suburb" text,
	"address_state" text,
	"address_country" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"thumbnail_url" text,
	"thumbnail_storage_key" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_journal_status" CHECK (status IN ('active', 'archived', 'deleted'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "journal_entity_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"journal_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_journal_link_entity_type" CHECK (entity_type IN ('Job', 'Quote', 'Invoice'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "journal_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"journal_id" uuid NOT NULL,
	"body" text,
	"body_format" text DEFAULT 'plaintext' NOT NULL,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"location_accuracy" numeric(10, 2),
	"location_label" text,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sort_index" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_page_body_format" CHECK (body_format IN ('plaintext', 'markdown', 'html'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "journal_page_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"journal_page_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" bigint,
	"storage_provider" text DEFAULT 'r2' NOT NULL,
	"storage_key" text NOT NULL,
	"file_url" text,
	"caption" text,
	"sort_index" integer DEFAULT 0 NOT NULL,
	"width" integer,
	"height" integer,
	"duration_seconds" numeric(10, 2),
	"thumbnail_storage_key" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outbound_sync_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"last_error" text,
	"last_attempted_at" timestamp with time zone,
	"scheduled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"not_before" timestamp with time zone,
	"source_event" text,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "chk_outbound_status" CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "catalogs" ADD CONSTRAINT "catalogs_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "entity_workflow_state" ADD CONSTRAINT "entity_workflow_state_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "item_allocations" ADD CONSTRAINT "item_allocations_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "item_allocations" ADD CONSTRAINT "item_allocations_source_work_order_item_id_work_order_items_id_fk" FOREIGN KEY ("source_work_order_item_id") REFERENCES "public"."work_order_items"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "item_allocations" ADD CONSTRAINT "item_allocations_target_purchase_order_item_id_purchase_order_items_id_fk" FOREIGN KEY ("target_purchase_order_item_id") REFERENCES "public"."purchase_order_items"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "journals" ADD CONSTRAINT "journals_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "journal_entity_links" ADD CONSTRAINT "journal_entity_links_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "journal_entity_links" ADD CONSTRAINT "journal_entity_links_journal_id_journals_id_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."journals"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "journal_pages" ADD CONSTRAINT "journal_pages_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "journal_pages" ADD CONSTRAINT "journal_pages_journal_id_journals_id_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."journals"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "journal_page_attachments" ADD CONSTRAINT "journal_page_attachments_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "journal_page_attachments" ADD CONSTRAINT "journal_page_attachments_journal_page_id_journal_pages_id_fk" FOREIGN KEY ("journal_page_id") REFERENCES "public"."journal_pages"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "outbound_sync_queue" ADD CONSTRAINT "outbound_sync_queue_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "outbound_sync_queue" ADD CONSTRAINT "outbound_sync_queue_connection_id_integration_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."integration_connections"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "catalog_items" ADD COLUMN IF NOT EXISTS "catalog_id" uuid;
--> statement-breakpoint
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_catalog_id_catalogs_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "public"."catalogs"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "source_version_number" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "latest_available_version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN IF NOT EXISTS "version_acknowledged" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "claim_contacts" ADD COLUMN IF NOT EXISTS "visibility" text DEFAULT 'org' NOT NULL;
--> statement-breakpoint
ALTER TABLE "claim_contacts" ADD COLUMN IF NOT EXISTS "created_by_user_id" text;
--> statement-breakpoint
ALTER TABLE "job_contacts" ADD COLUMN IF NOT EXISTS "visibility" text DEFAULT 'org' NOT NULL;
--> statement-breakpoint
ALTER TABLE "job_contacts" ADD COLUMN IF NOT EXISTS "created_by_user_id" text;
--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "source_version_number" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "latest_available_version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "version_acknowledged" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "source_version_number" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "latest_available_version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "version_acknowledged" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "UQ_catalog_items_tenant_code";
--> statement-breakpoint
DROP INDEX IF EXISTS "UQ_catalog_items_tenant_extref";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_catalogs_tenant_name" ON "catalogs" USING btree ("tenant_id","name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_catalogs_tenant" ON "catalogs" USING btree ("tenant_id","is_active");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_catalog_items_catalog_code" ON "catalog_items" USING btree ("tenant_id","catalog_id","code");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_catalog_items_catalog_extref" ON "catalog_items" USING btree ("tenant_id","catalog_id","external_reference") WHERE external_reference IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_catalog_items_catalog" ON "catalog_items" USING btree ("tenant_id","catalog_id","is_active","deleted_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_doc_versions_doc" ON "document_versions" USING btree ("tenant_id","document_type","document_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_workflow_state_entity" ON "entity_workflow_state" USING btree ("tenant_id","entity_type","entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_workflow_state_step" ON "entity_workflow_state" USING btree ("tenant_id","entity_type","current_step");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_item_alloc_source" ON "item_allocations" USING btree ("tenant_id","source_work_order_item_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_item_alloc_target" ON "item_allocations" USING btree ("tenant_id","target_purchase_order_item_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_journal_entity_link" ON "journal_entity_links" USING btree ("journal_id","entity_type","entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_journal_links_entity" ON "journal_entity_links" USING btree ("tenant_id","entity_type","entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_journal_links_journal" ON "journal_entity_links" USING btree ("tenant_id","journal_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_journal_page_attachments_page" ON "journal_page_attachments" USING btree ("tenant_id","journal_page_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_journal_page_attachments_type" ON "journal_page_attachments" USING btree ("tenant_id","mime_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_journal_pages_journal" ON "journal_pages" USING btree ("tenant_id","journal_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_journal_pages_captured" ON "journal_pages" USING btree ("journal_id","captured_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_journal_pages_sort" ON "journal_pages" USING btree ("journal_id","sort_index");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_journals_tenant" ON "journals" USING btree ("tenant_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_outbound_poll" ON "outbound_sync_queue" USING btree ("status","scheduled_at","priority");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_outbound_entity" ON "outbound_sync_queue" USING btree ("tenant_id","entity_type","entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_outbound_connection" ON "outbound_sync_queue" USING btree ("connection_id","status");
