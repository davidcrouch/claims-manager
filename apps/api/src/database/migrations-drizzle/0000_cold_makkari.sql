CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"status" text NOT NULL,
	"object" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"subdomain" text,
	"system_user_id" uuid,
	"organization_id" uuid
);
--> statement-breakpoint
CREATE TABLE "appointment_attendees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"appointment_id" uuid NOT NULL,
	"attendee_type" text NOT NULL,
	"user_id" text,
	"contact_id" uuid,
	"email" text,
	"attendee_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_attendee_type" CHECK (attendee_type IN ('CONTACT','USER'))
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"job_id" uuid NOT NULL,
	"appointment_type_lookup_id" uuid,
	"specialist_visit_type_lookup_id" uuid,
	"name" text NOT NULL,
	"location" text NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"status" text,
	"cancellation_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"appointment_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_appt_location" CHECK (location IN ('ONSITE', 'DIGITAL'))
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"related_record_type" text NOT NULL,
	"related_record_id" uuid NOT NULL,
	"document_type_lookup_id" uuid,
	"title" text,
	"description" text,
	"file_name" text,
	"mime_type" text,
	"file_size" bigint,
	"storage_provider" text,
	"storage_key" text,
	"file_url" text,
	"attachment_meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"api_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_attachment_record_type" CHECK (related_record_type IN ('Claim','Job','PurchaseOrder','Quote','Report','Tender','Invoice','Contact','Vendor','PulseJob'))
);
--> statement-breakpoint
CREATE TABLE "claim_assignees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"claim_id" uuid NOT NULL,
	"assignee_type_lookup_id" uuid,
	"user_id" text,
	"external_reference" text,
	"display_name" text,
	"email" text,
	"assignee_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claim_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"claim_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"sort_index" integer DEFAULT 0 NOT NULL,
	"source_payload" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"claim_number" text,
	"external_reference" text,
	"external_claim_id" text,
	"account_lookup_id" uuid,
	"status_lookup_id" uuid,
	"cat_code_lookup_id" uuid,
	"loss_type_lookup_id" uuid,
	"loss_subtype_lookup_id" uuid,
	"claim_decision_lookup_id" uuid,
	"priority_lookup_id" uuid,
	"policy_type_lookup_id" uuid,
	"line_of_business_lookup_id" uuid,
	"lodgement_date" date,
	"date_of_loss" timestamp with time zone,
	"address" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"policy_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"financial_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"vulnerability_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"contention_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"address_postcode" text,
	"address_suburb" text,
	"address_state" text,
	"address_country" text,
	"address_latitude" numeric(10, 7),
	"address_longitude" numeric(10, 7),
	"policy_number" text,
	"policy_name" text,
	"abn" text,
	"vulnerable_customer" boolean,
	"total_loss" boolean,
	"contentious_claim" boolean,
	"contentious_activity_flag" boolean,
	"auto_approval_applies" boolean,
	"contents_damaged" boolean,
	"incident_description" text,
	"postal_address" text,
	"custom_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"api_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"external_reference" text,
	"first_name" text,
	"last_name" text,
	"email" text,
	"mobile_phone" text,
	"home_phone" text,
	"work_phone" text,
	"type_lookup_id" uuid,
	"preferred_contact_method_lookup_id" uuid,
	"notes" text,
	"contact_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
	"change_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"connection_id" uuid NOT NULL,
	"provider_id" uuid,
	"provider_code" text NOT NULL,
	"provider_entity_type" text NOT NULL,
	"provider_entity_id" text NOT NULL,
	"normalized_entity_type" text NOT NULL,
	"external_parent_id" text,
	"latest_payload" jsonb NOT NULL,
	"payload_hash" text,
	"fetch_status" text DEFAULT 'fetched' NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"last_fetch_event_id" uuid,
	"latest_event_type" text,
	"latest_event_timestamp" timestamp with time zone,
	"external_created_at" timestamp with time zone,
	"external_updated_at" timestamp with time zone,
	"last_error_message" text,
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
CREATE TABLE "external_reference_resolution_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"domain" text NOT NULL,
	"external_reference" text NOT NULL,
	"source_entity" text,
	"source_entity_id" uuid,
	"resolution_action" text NOT NULL,
	"matched_lookup_id" uuid,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbound_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_event_id" text NOT NULL,
	"tenant_id" text,
	"event_type" text NOT NULL,
	"event_timestamp" timestamp with time zone NOT NULL,
	"payload_entity_id" text,
	"payload_team_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"payload_tenant_id" text,
	"payload_client" text,
	"payload_project_external_reference" text,
	"signature_header" text,
	"hmac_verified" boolean,
	"raw_headers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"raw_body_text" text NOT NULL,
	"raw_body_json" jsonb,
	"processing_status" text DEFAULT 'pending' NOT NULL,
	"processing_error" text,
	"processed_at" timestamp with time zone,
	"connection_id" uuid,
	"provider_id" uuid,
	"provider_code" text,
	"provider_entity_type" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbound_webhook_events_external_event_id_unique" UNIQUE("external_event_id")
);
--> statement-breakpoint
CREATE TABLE "integration_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"provider_id" uuid NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"environment" text NOT NULL,
	"auth_type" text DEFAULT 'client_credentials' NOT NULL,
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
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"claim_id" uuid,
	"job_id" uuid,
	"invoice_number" text,
	"issue_date" timestamp with time zone,
	"received_date" timestamp with time zone,
	"comments" text,
	"declined_reason" text,
	"status_lookup_id" uuid,
	"sub_total" numeric(14, 2),
	"total_tax" numeric(14, 2),
	"total_amount" numeric(14, 2),
	"excess_amount" numeric(14, 2),
	"is_deleted" boolean DEFAULT false NOT NULL,
	"invoice_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"job_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"sort_index" integer DEFAULT 0 NOT NULL,
	"source_payload" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"claim_id" uuid NOT NULL,
	"parent_claim_id" uuid,
	"vendor_id" uuid,
	"parent_job_id" uuid,
	"external_reference" text,
	"job_type_lookup_id" uuid NOT NULL,
	"status_lookup_id" uuid,
	"request_date" date,
	"collect_excess" boolean,
	"excess" numeric(14, 2),
	"make_safe_required" boolean,
	"address" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"vendor_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"temporary_accommodation_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"specialist_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rectification_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"audit_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"mobility_considerations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"address_postcode" text,
	"address_suburb" text,
	"address_state" text,
	"address_country" text,
	"job_instructions" text,
	"api_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"custom_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lookup_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"domain" text NOT NULL,
	"name" text,
	"external_reference" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"message_type_lookup_id" uuid,
	"from_claim_id" uuid,
	"from_job_id" uuid,
	"to_claim_id" uuid,
	"to_job_id" uuid,
	"to_assignee_type_lookup_id" uuid,
	"to_user_id" text,
	"subject" text,
	"body" text,
	"acknowledgement_required" boolean DEFAULT false NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by_user_id" text,
	"message_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_message_from" CHECK (from_claim_id IS NOT NULL OR from_job_id IS NOT NULL),
	CONSTRAINT "chk_message_to" CHECK (to_claim_id IS NOT NULL OR to_job_id IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "organization_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"role" text NOT NULL,
	"status" text NOT NULL,
	"object" text NOT NULL,
	"created" timestamp with time zone NOT NULL,
	"modified" timestamp with time zone NOT NULL,
	"created_by" uuid NOT NULL,
	"modified_by" uuid NOT NULL,
	"profile" jsonb,
	"config" jsonb,
	"ext" jsonb,
	CONSTRAINT "organization_users_user_organization_key" UNIQUE("user_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"status" text NOT NULL,
	"object" text NOT NULL,
	"created" timestamp with time zone NOT NULL,
	"modified" timestamp with time zone NOT NULL,
	"created_by" uuid NOT NULL,
	"modified_by" uuid NOT NULL,
	"org_code" text NOT NULL,
	"config" jsonb
);
--> statement-breakpoint
CREATE TABLE "purchase_order_combos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"purchase_order_group_id" uuid NOT NULL,
	"catalog_combo_id" uuid,
	"quote_combo_id" uuid,
	"name" text,
	"description" text,
	"category" text,
	"sub_category" text,
	"quantity" numeric(14, 4),
	"sort_index" integer DEFAULT 0 NOT NULL,
	"totals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"combo_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "purchase_order_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"group_label_lookup_id" uuid,
	"description" text,
	"dimensions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_index" integer DEFAULT 0 NOT NULL,
	"totals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"group_payload" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"purchase_order_group_id" uuid,
	"purchase_order_combo_id" uuid,
	"catalog_item_id" uuid,
	"quote_line_item_id" uuid,
	"unit_type_lookup_id" uuid,
	"name" text,
	"description" text,
	"category" text,
	"sub_category" text,
	"item_type" text,
	"quantity" numeric(14, 4),
	"tax" numeric(14, 4),
	"unit_cost" numeric(14, 4),
	"buy_cost" numeric(14, 4),
	"markup_type" text,
	"markup_value" numeric(14, 4),
	"reconciliation" numeric(14, 4),
	"manual_allocation" boolean,
	"sort_index" integer DEFAULT 0 NOT NULL,
	"note" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"totals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"item_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_po_item_parent" CHECK ((purchase_order_group_id IS NOT NULL AND purchase_order_combo_id IS NULL) OR (purchase_order_group_id IS NULL AND purchase_order_combo_id IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"claim_id" uuid,
	"job_id" uuid,
	"vendor_id" uuid,
	"quote_id" uuid,
	"external_id" text,
	"purchase_order_number" text,
	"name" text,
	"status_lookup_id" uuid,
	"purchase_order_type_lookup_id" uuid,
	"start_date" date,
	"end_date" date,
	"start_time" time,
	"end_time" time,
	"note" text,
	"po_to" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"po_for" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"po_from" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"service_window" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"adjustment_info" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"allocation_context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"po_to_email" text,
	"po_for_name" text,
	"total_amount" numeric(14, 2),
	"adjusted_total" numeric(14, 2),
	"adjusted_total_adjustment_amount" numeric(14, 2),
	"purchase_order_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_po_parent" CHECK (claim_id IS NOT NULL OR job_id IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "quote_combos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"quote_group_id" uuid NOT NULL,
	"catalog_combo_id" uuid,
	"line_scope_status_lookup_id" uuid,
	"name" text,
	"description" text,
	"category" text,
	"sub_category" text,
	"quantity" numeric(14, 4),
	"sort_index" integer DEFAULT 0 NOT NULL,
	"totals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"combo_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "quote_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"quote_id" uuid NOT NULL,
	"group_label_lookup_id" uuid,
	"description" text,
	"dimensions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_index" integer DEFAULT 0 NOT NULL,
	"totals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"group_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"quote_group_id" uuid,
	"quote_combo_id" uuid,
	"catalog_item_id" uuid,
	"line_scope_status_lookup_id" uuid,
	"unit_type_lookup_id" uuid,
	"name" text,
	"description" text,
	"category" text,
	"sub_category" text,
	"item_type" text,
	"quantity" numeric(14, 4),
	"tax" numeric(14, 4),
	"unit_cost" numeric(14, 4),
	"buy_cost" numeric(14, 4),
	"markup_type" text,
	"markup_value" numeric(14, 4),
	"allocated_cost" numeric(14, 4),
	"committed_cost" numeric(14, 4),
	"sort_index" integer DEFAULT 0 NOT NULL,
	"internal" boolean,
	"note" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mismatches" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"totals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"item_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_quote_item_parent" CHECK ((quote_group_id IS NOT NULL AND quote_combo_id IS NULL) OR (quote_group_id IS NULL AND quote_combo_id IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"claim_id" uuid,
	"job_id" uuid,
	"external_reference" text,
	"quote_number" text,
	"name" text,
	"reference" text,
	"note" text,
	"status_lookup_id" uuid,
	"quote_type_lookup_id" uuid,
	"quote_date" timestamp with time zone,
	"expires_in_days" integer,
	"sub_total" numeric(14, 2),
	"total_tax" numeric(14, 2),
	"total_amount" numeric(14, 2),
	"quote_to" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"quote_for" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"quote_from" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"schedule_info" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"approval_info" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"quote_to_email" text,
	"quote_to_name" text,
	"quote_for_name" text,
	"estimated_start_date" date,
	"estimated_completion_date" date,
	"is_auto_approved" boolean,
	"custom_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"api_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_quote_parent" CHECK (claim_id IS NOT NULL OR job_id IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"claim_id" uuid,
	"job_id" uuid,
	"report_type_lookup_id" uuid,
	"status_lookup_id" uuid,
	"title" text,
	"reference" text,
	"report_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"report_meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"api_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"task_type_lookup_id" uuid,
	"claim_id" uuid,
	"job_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"due_date" timestamp with time zone,
	"priority" text DEFAULT 'Low' NOT NULL,
	"status" text DEFAULT 'Open' NOT NULL,
	"task_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"assigned_to_user_id" text,
	"assigned_to_external_reference" text,
	"created_by_user_id" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_task_parent" CHECK (claim_id IS NOT NULL OR job_id IS NOT NULL),
	CONSTRAINT "chk_task_priority" CHECK (priority IN ('Low','Medium','High','Critical')),
	CONSTRAINT "chk_task_status" CHECK (status IN ('Open','Completed','Failed'))
);
--> statement-breakpoint
CREATE TABLE "user_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_subject" text NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"raw_profile" jsonb NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"name" text,
	"status" text DEFAULT 'active' NOT NULL,
	"object" text DEFAULT 'user' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"config" jsonb,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"external_reference" text,
	"address" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"contact_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"vendor_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"postcode" text,
	"state" text,
	"city" text,
	"country" text,
	"phone" text,
	"after_hours_phone" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointment_attendees" ADD CONSTRAINT "appointment_attendees_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_assignees" ADD CONSTRAINT "claim_assignees_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_contacts" ADD CONSTRAINT "claim_contacts_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_contacts" ADD CONSTRAINT "claim_contacts_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_account_lookup_id_lookup_values_id_fk" FOREIGN KEY ("account_lookup_id") REFERENCES "public"."lookup_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_status_lookup_id_lookup_values_id_fk" FOREIGN KEY ("status_lookup_id") REFERENCES "public"."lookup_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_cat_code_lookup_id_lookup_values_id_fk" FOREIGN KEY ("cat_code_lookup_id") REFERENCES "public"."lookup_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_loss_type_lookup_id_lookup_values_id_fk" FOREIGN KEY ("loss_type_lookup_id") REFERENCES "public"."lookup_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_loss_subtype_lookup_id_lookup_values_id_fk" FOREIGN KEY ("loss_subtype_lookup_id") REFERENCES "public"."lookup_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_type_lookup_id_lookup_values_id_fk" FOREIGN KEY ("type_lookup_id") REFERENCES "public"."lookup_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_preferred_contact_method_lookup_id_lookup_values_id_fk" FOREIGN KEY ("preferred_contact_method_lookup_id") REFERENCES "public"."lookup_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_event_attempts" ADD CONSTRAINT "external_event_attempts_event_id_inbound_webhook_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."inbound_webhook_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_links" ADD CONSTRAINT "external_links_external_object_id_external_objects_id_fk" FOREIGN KEY ("external_object_id") REFERENCES "public"."external_objects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_object_versions" ADD CONSTRAINT "external_object_versions_external_object_id_external_objects_id_fk" FOREIGN KEY ("external_object_id") REFERENCES "public"."external_objects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_objects" ADD CONSTRAINT "external_objects_connection_id_integration_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."integration_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_objects" ADD CONSTRAINT "external_objects_provider_id_integration_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."integration_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_processing_log" ADD CONSTRAINT "external_processing_log_connection_id_integration_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."integration_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_reference_resolution_log" ADD CONSTRAINT "external_reference_resolution_log_matched_lookup_id_lookup_values_id_fk" FOREIGN KEY ("matched_lookup_id") REFERENCES "public"."lookup_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_webhook_events" ADD CONSTRAINT "inbound_webhook_events_connection_id_integration_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."integration_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_webhook_events" ADD CONSTRAINT "inbound_webhook_events_provider_id_integration_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."integration_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_provider_id_integration_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."integration_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_contacts" ADD CONSTRAINT "job_contacts_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_contacts" ADD CONSTRAINT "job_contacts_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_parent_job_id_jobs_id_fk" FOREIGN KEY ("parent_job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_job_type_lookup_id_lookup_values_id_fk" FOREIGN KEY ("job_type_lookup_id") REFERENCES "public"."lookup_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_status_lookup_id_lookup_values_id_fk" FOREIGN KEY ("status_lookup_id") REFERENCES "public"."lookup_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_from_claim_id_claims_id_fk" FOREIGN KEY ("from_claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_from_job_id_jobs_id_fk" FOREIGN KEY ("from_job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_to_claim_id_claims_id_fk" FOREIGN KEY ("to_claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_to_job_id_jobs_id_fk" FOREIGN KEY ("to_job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_combos" ADD CONSTRAINT "purchase_order_combos_purchase_order_group_id_purchase_order_groups_id_fk" FOREIGN KEY ("purchase_order_group_id") REFERENCES "public"."purchase_order_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_groups" ADD CONSTRAINT "purchase_order_groups_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_group_id_purchase_order_groups_id_fk" FOREIGN KEY ("purchase_order_group_id") REFERENCES "public"."purchase_order_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_combo_id_purchase_order_combos_id_fk" FOREIGN KEY ("purchase_order_combo_id") REFERENCES "public"."purchase_order_combos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_combos" ADD CONSTRAINT "quote_combos_quote_group_id_quote_groups_id_fk" FOREIGN KEY ("quote_group_id") REFERENCES "public"."quote_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_groups" ADD CONSTRAINT "quote_groups_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_group_id_quote_groups_id_fk" FOREIGN KEY ("quote_group_id") REFERENCES "public"."quote_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_combo_id_quote_combos_id_fk" FOREIGN KEY ("quote_combo_id") REFERENCES "public"."quote_combos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_attachments_related" ON "attachments" USING btree ("tenant_id","related_record_type","related_record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_claim_contact" ON "claim_contacts" USING btree ("claim_id","contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_claims_tenant_number" ON "claims" USING btree ("tenant_id","claim_number");--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_claims_tenant_extref" ON "claims" USING btree ("tenant_id","external_reference");--> statement-breakpoint
CREATE INDEX "idx_claims_extref" ON "claims" USING btree ("tenant_id","external_reference");--> statement-breakpoint
CREATE INDEX "idx_claims_status" ON "claims" USING btree ("tenant_id","status_lookup_id");--> statement-breakpoint
CREATE INDEX "idx_claims_postcode" ON "claims" USING btree ("tenant_id","address_postcode");--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_contacts_tenant_extref" ON "contacts" USING btree ("tenant_id","external_reference");--> statement-breakpoint
CREATE INDEX "idx_contacts_email" ON "contacts" USING btree ("tenant_id","email");--> statement-breakpoint
CREATE INDEX "idx_contacts_mobile" ON "contacts" USING btree ("tenant_id","mobile_phone");--> statement-breakpoint
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
CREATE INDEX "idx_webhooks_status" ON "inbound_webhook_events" USING btree ("processing_status","created_at");--> statement-breakpoint
CREATE INDEX "idx_webhooks_connection_type_entity" ON "inbound_webhook_events" USING btree ("connection_id","event_type","payload_entity_id");--> statement-breakpoint
CREATE INDEX "idx_webhooks_provider_entity" ON "inbound_webhook_events" USING btree ("provider_id","provider_entity_type");--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_connection_tenant_provider_env" ON "integration_connections" USING btree ("tenant_id","provider_id","environment");--> statement-breakpoint
CREATE INDEX "idx_connections_tenant" ON "integration_connections" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_invoices_tenant_po_number" ON "invoices" USING btree ("tenant_id","purchase_order_id","invoice_number");--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_job_contact" ON "job_contacts" USING btree ("job_id","contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_jobs_tenant_extref" ON "jobs" USING btree ("tenant_id","external_reference");--> statement-breakpoint
CREATE INDEX "idx_jobs_claim" ON "jobs" USING btree ("tenant_id","claim_id");--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_lookup_tenant_domain_extref" ON "lookup_values" USING btree ("tenant_id","domain","external_reference");--> statement-breakpoint
CREATE INDEX "idx_lookup_values_domain" ON "lookup_values" USING btree ("tenant_id","domain");--> statement-breakpoint
CREATE INDEX "idx_po_job" ON "purchase_orders" USING btree ("tenant_id","job_id");--> statement-breakpoint
CREATE INDEX "idx_po_claim" ON "purchase_orders" USING btree ("tenant_id","claim_id");--> statement-breakpoint
CREATE INDEX "idx_po_vendor" ON "purchase_orders" USING btree ("tenant_id","vendor_id");--> statement-breakpoint
CREATE INDEX "idx_quotes_job" ON "quotes" USING btree ("tenant_id","job_id");--> statement-breakpoint
CREATE INDEX "idx_quotes_claim" ON "quotes" USING btree ("tenant_id","claim_id");--> statement-breakpoint
CREATE INDEX "idx_quotes_status" ON "quotes" USING btree ("tenant_id","status_lookup_id");--> statement-breakpoint
CREATE INDEX "idx_reports_job" ON "reports" USING btree ("tenant_id","job_id");--> statement-breakpoint
CREATE INDEX "idx_reports_claim" ON "reports" USING btree ("tenant_id","claim_id");--> statement-breakpoint
CREATE INDEX "idx_reports_type" ON "reports" USING btree ("tenant_id","report_type_lookup_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_claim" ON "tasks" USING btree ("tenant_id","claim_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_job" ON "tasks" USING btree ("tenant_id","job_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_status" ON "tasks" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_identities_provider_subject" ON "user_identities" USING btree ("provider","provider_subject");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_vendors_tenant_extref" ON "vendors" USING btree ("tenant_id","external_reference");--> statement-breakpoint
CREATE INDEX "idx_vendors_postcode" ON "vendors" USING btree ("tenant_id","postcode");