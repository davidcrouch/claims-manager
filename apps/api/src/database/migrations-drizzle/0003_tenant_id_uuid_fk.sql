-- Pre-migration: rebind rows that still carry the external provider's tenant
-- id (legacy artifact from before the webhook tenant fix) to the internal
-- Kiama Harvest organization. Must run before the column is typed as uuid
-- and FK'd to organizations, otherwise the FK check would fail.
UPDATE "lookup_values"
   SET "tenant_id" = 'dfa498c7-668d-4cec-87ff-5911685c713e'
 WHERE "tenant_id" = '1b179daa-ea62-47ef-9dc6-68c72812d3b6';--> statement-breakpoint
UPDATE "external_reference_resolution_log"
   SET "tenant_id" = 'dfa498c7-668d-4cec-87ff-5911685c713e'
 WHERE "tenant_id" = '1b179daa-ea62-47ef-9dc6-68c72812d3b6';--> statement-breakpoint

ALTER TABLE "appointment_attendees" ALTER COLUMN "tenant_id" SET DATA TYPE uuid USING "tenant_id"::uuid;--> statement-breakpoint
ALTER TABLE "appointments" ALTER COLUMN "tenant_id" SET DATA TYPE uuid USING "tenant_id"::uuid;--> statement-breakpoint
ALTER TABLE "attachments" ALTER COLUMN "tenant_id" SET DATA TYPE uuid USING "tenant_id"::uuid;--> statement-breakpoint
ALTER TABLE "claim_assignees" ALTER COLUMN "tenant_id" SET DATA TYPE uuid USING "tenant_id"::uuid;--> statement-breakpoint
ALTER TABLE "claim_contacts" ALTER COLUMN "tenant_id" SET DATA TYPE uuid USING "tenant_id"::uuid;--> statement-breakpoint
ALTER TABLE "claims" ALTER COLUMN "tenant_id" SET DATA TYPE uuid USING "tenant_id"::uuid;--> statement-breakpoint
ALTER TABLE "contacts" ALTER COLUMN "tenant_id" SET DATA TYPE uuid USING "tenant_id"::uuid;--> statement-breakpoint
ALTER TABLE "external_links" ALTER COLUMN "tenant_id" SET DATA TYPE uuid USING "tenant_id"::uuid;--> statement-breakpoint
ALTER TABLE "external_objects" ALTER COLUMN "tenant_id" SET DATA TYPE uuid USING "tenant_id"::uuid;--> statement-breakpoint
ALTER TABLE "external_processing_log" ALTER COLUMN "tenant_id" SET DATA TYPE uuid USING "tenant_id"::uuid;--> statement-breakpoint
ALTER TABLE "external_reference_resolution_log" ALTER COLUMN "tenant_id" SET DATA TYPE uuid USING "tenant_id"::uuid;--> statement-breakpoint
ALTER TABLE "inbound_webhook_events" ALTER COLUMN "tenant_id" SET DATA TYPE uuid USING "tenant_id"::uuid;--> statement-breakpoint
ALTER TABLE "integration_connections" ALTER COLUMN "tenant_id" SET DATA TYPE uuid USING "tenant_id"::uuid;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "tenant_id" SET DATA TYPE uuid USING "tenant_id"::uuid;--> statement-breakpoint
ALTER TABLE "job_contacts" ALTER COLUMN "tenant_id" SET DATA TYPE uuid USING "tenant_id"::uuid;--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "tenant_id" SET DATA TYPE uuid USING "tenant_id"::uuid;--> statement-breakpoint
ALTER TABLE "lookup_values" ALTER COLUMN "tenant_id" SET DATA TYPE uuid USING "tenant_id"::uuid;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "tenant_id" SET DATA TYPE uuid USING "tenant_id"::uuid;--> statement-breakpoint
ALTER TABLE "purchase_order_combos" ALTER COLUMN "tenant_id" SET DATA TYPE uuid USING "tenant_id"::uuid;--> statement-breakpoint
ALTER TABLE "purchase_order_groups" ALTER COLUMN "tenant_id" SET DATA TYPE uuid USING "tenant_id"::uuid;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ALTER COLUMN "tenant_id" SET DATA TYPE uuid USING "tenant_id"::uuid;--> statement-breakpoint
ALTER TABLE "purchase_orders" ALTER COLUMN "tenant_id" SET DATA TYPE uuid USING "tenant_id"::uuid;--> statement-breakpoint
ALTER TABLE "quote_combos" ALTER COLUMN "tenant_id" SET DATA TYPE uuid USING "tenant_id"::uuid;--> statement-breakpoint
ALTER TABLE "quote_groups" ALTER COLUMN "tenant_id" SET DATA TYPE uuid USING "tenant_id"::uuid;--> statement-breakpoint
ALTER TABLE "quote_items" ALTER COLUMN "tenant_id" SET DATA TYPE uuid USING "tenant_id"::uuid;--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "tenant_id" SET DATA TYPE uuid USING "tenant_id"::uuid;--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "tenant_id" SET DATA TYPE uuid USING "tenant_id"::uuid;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "tenant_id" SET DATA TYPE uuid USING "tenant_id"::uuid;--> statement-breakpoint
ALTER TABLE "vendors" ALTER COLUMN "tenant_id" SET DATA TYPE uuid USING "tenant_id"::uuid;--> statement-breakpoint
ALTER TABLE "appointment_attendees" ADD CONSTRAINT "appointment_attendees_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "claim_assignees" ADD CONSTRAINT "claim_assignees_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "claim_contacts" ADD CONSTRAINT "claim_contacts_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "external_links" ADD CONSTRAINT "external_links_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "external_objects" ADD CONSTRAINT "external_objects_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "external_processing_log" ADD CONSTRAINT "external_processing_log_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "external_reference_resolution_log" ADD CONSTRAINT "external_reference_resolution_log_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inbound_webhook_events" ADD CONSTRAINT "inbound_webhook_events_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "job_contacts" ADD CONSTRAINT "job_contacts_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lookup_values" ADD CONSTRAINT "lookup_values_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "purchase_order_combos" ADD CONSTRAINT "purchase_order_combos_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "purchase_order_groups" ADD CONSTRAINT "purchase_order_groups_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quote_combos" ADD CONSTRAINT "quote_combos_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quote_groups" ADD CONSTRAINT "quote_groups_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;
