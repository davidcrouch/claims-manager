CREATE TABLE "bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"purchase_order_id" uuid,
	"claim_id" uuid,
	"job_id" uuid,
	"vendor_id" uuid,
	"bill_number" text,
	"external_reference" text,
	"issue_date" timestamp with time zone,
	"received_date" timestamp with time zone,
	"due_date" timestamp with time zone,
	"payment_date" timestamp with time zone,
	"comments" text,
	"declined_reason" text,
	"status_lookup_id" uuid,
	"payment_status_lookup_id" uuid,
	"sub_total" numeric(14, 2),
	"total_tax" numeric(14, 2),
	"total_amount" numeric(14, 2),
	"is_deleted" boolean DEFAULT false NOT NULL,
	"bill_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "UQ_bills_tenant_number" UNIQUE("tenant_id","purchase_order_id","bill_number")
);
--> statement-breakpoint
CREATE TABLE "proposal_combos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"proposal_group_id" uuid NOT NULL,
	"source_rfq_combo_id" uuid,
	"name" text,
	"description" text,
	"category" text,
	"sub_category" text,
	"quantity" numeric(14, 4),
	"sort_index" integer DEFAULT 0 NOT NULL,
	"totals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"combo_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"proposal_id" uuid NOT NULL,
	"source_rfq_group_id" uuid,
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
CREATE TABLE "proposal_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"proposal_group_id" uuid,
	"proposal_combo_id" uuid,
	"source_rfq_item_id" uuid,
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
	"sort_index" integer DEFAULT 0 NOT NULL,
	"note" text,
	"totals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"item_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_proposal_item_parent" CHECK ((proposal_group_id IS NOT NULL AND proposal_combo_id IS NULL) OR (proposal_group_id IS NULL AND proposal_combo_id IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"claim_id" uuid,
	"job_id" uuid,
	"rfq_id" uuid,
	"vendor_id" uuid,
	"proposal_number" text,
	"name" text,
	"reference" text,
	"note" text,
	"status_lookup_id" uuid,
	"proposal_type_lookup_id" uuid,
	"received_date" timestamp with time zone,
	"proposal_date" timestamp with time zone,
	"expires_in_days" integer,
	"sub_total" numeric(14, 2),
	"total_tax" numeric(14, 2),
	"total_amount" numeric(14, 2),
	"proposal_to" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"proposal_for" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"proposal_from" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"proposal_to_email" text,
	"proposal_to_name" text,
	"proposal_from_name" text,
	"custom_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"proposal_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rfq_combos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"rfq_group_id" uuid NOT NULL,
	"source_quote_combo_id" uuid,
	"name" text,
	"description" text,
	"category" text,
	"sub_category" text,
	"quantity" numeric(14, 4),
	"sort_index" integer DEFAULT 0 NOT NULL,
	"totals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"combo_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfq_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"rfq_id" uuid NOT NULL,
	"source_quote_group_id" uuid,
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
CREATE TABLE "rfq_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"rfq_group_id" uuid,
	"rfq_combo_id" uuid,
	"source_quote_item_id" uuid,
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
	"sort_index" integer DEFAULT 0 NOT NULL,
	"note" text,
	"totals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"item_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_rfq_item_parent" CHECK ((rfq_group_id IS NOT NULL AND rfq_combo_id IS NULL) OR (rfq_group_id IS NULL AND rfq_combo_id IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "rfqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"claim_id" uuid,
	"job_id" uuid,
	"quote_id" uuid,
	"vendor_id" uuid,
	"rfq_number" text,
	"name" text,
	"note" text,
	"status_lookup_id" uuid,
	"sent_date" timestamp with time zone,
	"due_date" timestamp with time zone,
	"received_date" timestamp with time zone,
	"include_pricing" boolean DEFAULT false NOT NULL,
	"include_quantities" boolean DEFAULT true NOT NULL,
	"rfq_to" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rfq_from" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rfq_to_email" text,
	"rfq_to_name" text,
	"rfq_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_rfq_parent" CHECK (claim_id IS NOT NULL OR job_id IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "work_order_combos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"work_order_group_id" uuid NOT NULL,
	"catalog_combo_id" uuid,
	"name" text,
	"description" text,
	"category" text,
	"sub_category" text,
	"quantity" numeric(14, 4),
	"sort_index" integer DEFAULT 0 NOT NULL,
	"totals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"combo_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "work_order_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"work_order_id" uuid NOT NULL,
	"group_label_lookup_id" uuid,
	"description" text,
	"dimensions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_index" integer DEFAULT 0 NOT NULL,
	"totals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"group_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "work_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"work_order_group_id" uuid,
	"work_order_combo_id" uuid,
	"catalog_item_id" uuid,
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
	"sort_index" integer DEFAULT 0 NOT NULL,
	"note" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"totals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"item_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_wo_item_parent" CHECK ((work_order_group_id IS NOT NULL AND work_order_combo_id IS NULL) OR (work_order_group_id IS NULL AND work_order_combo_id IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "work_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"claim_id" uuid,
	"job_id" uuid,
	"vendor_id" uuid,
	"source_tenant_id" uuid,
	"source_external_reference" text,
	"external_id" text,
	"work_order_number" text,
	"name" text,
	"status_lookup_id" uuid,
	"work_order_type_lookup_id" uuid,
	"start_date" date,
	"end_date" date,
	"start_time" time,
	"end_time" time,
	"note" text,
	"scope_of_work" text,
	"wo_to" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"wo_for" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"wo_from" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"service_window" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"wo_to_email" text,
	"wo_for_name" text,
	"total_amount" numeric(14, 2),
	"adjusted_total" numeric(14, 2),
	"work_order_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "chk_task_parent";--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "related_entity_type" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "related_entity_id" uuid;--> statement-breakpoint
UPDATE "tasks" SET
  "related_entity_type" = CASE WHEN "job_id" IS NOT NULL THEN 'Job' ELSE 'Claim' END,
  "related_entity_id"   = COALESCE("job_id", "claim_id")
WHERE "related_entity_type" IS NULL;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "related_entity_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "related_entity_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_status_lookup_id_lookup_values_id_fk" FOREIGN KEY ("status_lookup_id") REFERENCES "public"."lookup_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_payment_status_lookup_id_lookup_values_id_fk" FOREIGN KEY ("payment_status_lookup_id") REFERENCES "public"."lookup_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_combos" ADD CONSTRAINT "proposal_combos_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "proposal_combos" ADD CONSTRAINT "proposal_combos_proposal_group_id_proposal_groups_id_fk" FOREIGN KEY ("proposal_group_id") REFERENCES "public"."proposal_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_combos" ADD CONSTRAINT "proposal_combos_source_rfq_combo_id_rfq_combos_id_fk" FOREIGN KEY ("source_rfq_combo_id") REFERENCES "public"."rfq_combos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_groups" ADD CONSTRAINT "proposal_groups_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "proposal_groups" ADD CONSTRAINT "proposal_groups_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_groups" ADD CONSTRAINT "proposal_groups_source_rfq_group_id_rfq_groups_id_fk" FOREIGN KEY ("source_rfq_group_id") REFERENCES "public"."rfq_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_groups" ADD CONSTRAINT "proposal_groups_group_label_lookup_id_lookup_values_id_fk" FOREIGN KEY ("group_label_lookup_id") REFERENCES "public"."lookup_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_items" ADD CONSTRAINT "proposal_items_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "proposal_items" ADD CONSTRAINT "proposal_items_proposal_group_id_proposal_groups_id_fk" FOREIGN KEY ("proposal_group_id") REFERENCES "public"."proposal_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_items" ADD CONSTRAINT "proposal_items_proposal_combo_id_proposal_combos_id_fk" FOREIGN KEY ("proposal_combo_id") REFERENCES "public"."proposal_combos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_items" ADD CONSTRAINT "proposal_items_source_rfq_item_id_rfq_items_id_fk" FOREIGN KEY ("source_rfq_item_id") REFERENCES "public"."rfq_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_status_lookup_id_lookup_values_id_fk" FOREIGN KEY ("status_lookup_id") REFERENCES "public"."lookup_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_proposal_type_lookup_id_lookup_values_id_fk" FOREIGN KEY ("proposal_type_lookup_id") REFERENCES "public"."lookup_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_combos" ADD CONSTRAINT "rfq_combos_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "rfq_combos" ADD CONSTRAINT "rfq_combos_rfq_group_id_rfq_groups_id_fk" FOREIGN KEY ("rfq_group_id") REFERENCES "public"."rfq_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_combos" ADD CONSTRAINT "rfq_combos_source_quote_combo_id_quote_combos_id_fk" FOREIGN KEY ("source_quote_combo_id") REFERENCES "public"."quote_combos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_groups" ADD CONSTRAINT "rfq_groups_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "rfq_groups" ADD CONSTRAINT "rfq_groups_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_groups" ADD CONSTRAINT "rfq_groups_source_quote_group_id_quote_groups_id_fk" FOREIGN KEY ("source_quote_group_id") REFERENCES "public"."quote_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_groups" ADD CONSTRAINT "rfq_groups_group_label_lookup_id_lookup_values_id_fk" FOREIGN KEY ("group_label_lookup_id") REFERENCES "public"."lookup_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_items" ADD CONSTRAINT "rfq_items_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "rfq_items" ADD CONSTRAINT "rfq_items_rfq_group_id_rfq_groups_id_fk" FOREIGN KEY ("rfq_group_id") REFERENCES "public"."rfq_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_items" ADD CONSTRAINT "rfq_items_rfq_combo_id_rfq_combos_id_fk" FOREIGN KEY ("rfq_combo_id") REFERENCES "public"."rfq_combos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_items" ADD CONSTRAINT "rfq_items_source_quote_item_id_quote_items_id_fk" FOREIGN KEY ("source_quote_item_id") REFERENCES "public"."quote_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_status_lookup_id_lookup_values_id_fk" FOREIGN KEY ("status_lookup_id") REFERENCES "public"."lookup_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_combos" ADD CONSTRAINT "work_order_combos_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "work_order_combos" ADD CONSTRAINT "work_order_combos_work_order_group_id_work_order_groups_id_fk" FOREIGN KEY ("work_order_group_id") REFERENCES "public"."work_order_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_groups" ADD CONSTRAINT "work_order_groups_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "work_order_groups" ADD CONSTRAINT "work_order_groups_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_work_order_group_id_work_order_groups_id_fk" FOREIGN KEY ("work_order_group_id") REFERENCES "public"."work_order_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_work_order_combo_id_work_order_combos_id_fk" FOREIGN KEY ("work_order_combo_id") REFERENCES "public"."work_order_combos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_status_lookup_id_lookup_values_id_fk" FOREIGN KEY ("status_lookup_id") REFERENCES "public"."lookup_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_work_order_type_lookup_id_lookup_values_id_fk" FOREIGN KEY ("work_order_type_lookup_id") REFERENCES "public"."lookup_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bills_invoice" ON "bills" USING btree ("tenant_id","invoice_id");--> statement-breakpoint
CREATE INDEX "idx_bills_po" ON "bills" USING btree ("tenant_id","purchase_order_id");--> statement-breakpoint
CREATE INDEX "idx_bills_job" ON "bills" USING btree ("tenant_id","job_id");--> statement-breakpoint
CREATE INDEX "idx_bills_claim" ON "bills" USING btree ("tenant_id","claim_id");--> statement-breakpoint
CREATE INDEX "idx_bills_vendor" ON "bills" USING btree ("tenant_id","vendor_id");--> statement-breakpoint
CREATE INDEX "idx_bills_number" ON "bills" USING btree ("tenant_id","bill_number");--> statement-breakpoint
CREATE INDEX "idx_bills_status" ON "bills" USING btree ("tenant_id","status_lookup_id");--> statement-breakpoint
CREATE INDEX "idx_bills_due_date" ON "bills" USING btree ("tenant_id","due_date");--> statement-breakpoint
CREATE INDEX "idx_bills_payment_status" ON "bills" USING btree ("tenant_id","payment_status_lookup_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_combos_group" ON "proposal_combos" USING btree ("tenant_id","proposal_group_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_groups_proposal" ON "proposal_groups" USING btree ("tenant_id","proposal_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_items_group" ON "proposal_items" USING btree ("tenant_id","proposal_group_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_items_combo" ON "proposal_items" USING btree ("tenant_id","proposal_combo_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_quote" ON "proposals" USING btree ("tenant_id","quote_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_job" ON "proposals" USING btree ("tenant_id","job_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_claim" ON "proposals" USING btree ("tenant_id","claim_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_rfq" ON "proposals" USING btree ("tenant_id","rfq_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_vendor" ON "proposals" USING btree ("tenant_id","vendor_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_number" ON "proposals" USING btree ("tenant_id","proposal_number");--> statement-breakpoint
CREATE INDEX "idx_rfq_combos_group" ON "rfq_combos" USING btree ("tenant_id","rfq_group_id");--> statement-breakpoint
CREATE INDEX "idx_rfq_groups_rfq" ON "rfq_groups" USING btree ("tenant_id","rfq_id");--> statement-breakpoint
CREATE INDEX "idx_rfq_items_group" ON "rfq_items" USING btree ("tenant_id","rfq_group_id");--> statement-breakpoint
CREATE INDEX "idx_rfq_items_combo" ON "rfq_items" USING btree ("tenant_id","rfq_combo_id");--> statement-breakpoint
CREATE INDEX "idx_rfq_job" ON "rfqs" USING btree ("tenant_id","job_id");--> statement-breakpoint
CREATE INDEX "idx_rfq_claim" ON "rfqs" USING btree ("tenant_id","claim_id");--> statement-breakpoint
CREATE INDEX "idx_rfq_quote" ON "rfqs" USING btree ("tenant_id","quote_id");--> statement-breakpoint
CREATE INDEX "idx_rfq_vendor" ON "rfqs" USING btree ("tenant_id","vendor_id");--> statement-breakpoint
CREATE INDEX "idx_rfq_number" ON "rfqs" USING btree ("tenant_id","rfq_number");--> statement-breakpoint
CREATE INDEX "idx_wo_combos_group" ON "work_order_combos" USING btree ("tenant_id","work_order_group_id");--> statement-breakpoint
CREATE INDEX "idx_wo_groups_wo" ON "work_order_groups" USING btree ("tenant_id","work_order_id");--> statement-breakpoint
CREATE INDEX "idx_wo_items_group" ON "work_order_items" USING btree ("tenant_id","work_order_group_id");--> statement-breakpoint
CREATE INDEX "idx_wo_items_combo" ON "work_order_items" USING btree ("tenant_id","work_order_combo_id");--> statement-breakpoint
CREATE INDEX "idx_wo_po" ON "work_orders" USING btree ("tenant_id","purchase_order_id");--> statement-breakpoint
CREATE INDEX "idx_wo_job" ON "work_orders" USING btree ("tenant_id","job_id");--> statement-breakpoint
CREATE INDEX "idx_wo_claim" ON "work_orders" USING btree ("tenant_id","claim_id");--> statement-breakpoint
CREATE INDEX "idx_wo_number" ON "work_orders" USING btree ("tenant_id","work_order_number");--> statement-breakpoint
CREATE INDEX "idx_tasks_entity" ON "tasks" USING btree ("tenant_id","related_entity_type","related_entity_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_due_date" ON "tasks" USING btree ("tenant_id","due_date");--> statement-breakpoint
CREATE INDEX "idx_tasks_assigned" ON "tasks" USING btree ("tenant_id","assigned_to_user_id");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "chk_task_entity_type" CHECK (related_entity_type IN (
        'Job', 'Claim', 'Quote', 'WorkOrder', 'Invoice',
        'RFQ', 'Proposal', 'PurchaseOrder', 'Bill',
        'Appointment', 'Contact'
      ));