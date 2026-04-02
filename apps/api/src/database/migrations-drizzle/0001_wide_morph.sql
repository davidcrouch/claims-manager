ALTER TABLE "appointment_attendees" DROP CONSTRAINT IF EXISTS "appointment_attendees_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "appointments" DROP CONSTRAINT IF EXISTS "appointments_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "attachments" DROP CONSTRAINT IF EXISTS "attachments_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "claim_assignees" DROP CONSTRAINT IF EXISTS "claim_assignees_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "claim_contacts" DROP CONSTRAINT IF EXISTS "claim_contacts_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "claims" DROP CONSTRAINT IF EXISTS "claims_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "contacts" DROP CONSTRAINT IF EXISTS "contacts_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "external_reference_resolution_log" DROP CONSTRAINT IF EXISTS "external_reference_resolution_log_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "job_contacts" DROP CONSTRAINT IF EXISTS "job_contacts_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "jobs" DROP CONSTRAINT IF EXISTS "jobs_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "lookup_values" DROP CONSTRAINT IF EXISTS "lookup_values_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "purchase_order_combos" DROP CONSTRAINT IF EXISTS "purchase_order_combos_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "purchase_order_groups" DROP CONSTRAINT IF EXISTS "purchase_order_groups_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "purchase_order_items" DROP CONSTRAINT IF EXISTS "purchase_order_items_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP CONSTRAINT IF EXISTS "purchase_orders_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "quote_combos" DROP CONSTRAINT IF EXISTS "quote_combos_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "quote_groups" DROP CONSTRAINT IF EXISTS "quote_groups_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "quote_items" DROP CONSTRAINT IF EXISTS "quote_items_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "quotes" DROP CONSTRAINT IF EXISTS "quotes_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "reports" DROP CONSTRAINT IF EXISTS "reports_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "vendors" DROP CONSTRAINT IF EXISTS "vendors_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "appointment_attendees" ALTER COLUMN "tenant_id" SET DATA TYPE text USING "tenant_id"::text;
--> statement-breakpoint
ALTER TABLE "appointment_attendees" ALTER COLUMN "user_id" SET DATA TYPE text USING "user_id"::text;
--> statement-breakpoint
ALTER TABLE "appointments" ALTER COLUMN "tenant_id" SET DATA TYPE text USING "tenant_id"::text;
--> statement-breakpoint
ALTER TABLE "attachments" ALTER COLUMN "tenant_id" SET DATA TYPE text USING "tenant_id"::text;
--> statement-breakpoint
ALTER TABLE "attachments" ALTER COLUMN "created_by_user_id" SET DATA TYPE text USING "created_by_user_id"::text;
--> statement-breakpoint
ALTER TABLE "attachments" ALTER COLUMN "updated_by_user_id" SET DATA TYPE text USING "updated_by_user_id"::text;
--> statement-breakpoint
ALTER TABLE "claim_assignees" ALTER COLUMN "tenant_id" SET DATA TYPE text USING "tenant_id"::text;
--> statement-breakpoint
ALTER TABLE "claim_assignees" ALTER COLUMN "user_id" SET DATA TYPE text USING "user_id"::text;
--> statement-breakpoint
ALTER TABLE "claim_contacts" ALTER COLUMN "tenant_id" SET DATA TYPE text USING "tenant_id"::text;
--> statement-breakpoint
ALTER TABLE "claims" ALTER COLUMN "tenant_id" SET DATA TYPE text USING "tenant_id"::text;
--> statement-breakpoint
ALTER TABLE "contacts" ALTER COLUMN "tenant_id" SET DATA TYPE text USING "tenant_id"::text;
--> statement-breakpoint
ALTER TABLE "external_reference_resolution_log" ALTER COLUMN "tenant_id" SET DATA TYPE text USING "tenant_id"::text;
--> statement-breakpoint
ALTER TABLE "inbound_webhook_events" ALTER COLUMN "tenant_id" SET DATA TYPE text USING "tenant_id"::text;
--> statement-breakpoint
ALTER TABLE "inbound_webhook_events" ALTER COLUMN "payload_tenant_id" SET DATA TYPE text USING "payload_tenant_id"::text;
--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "tenant_id" SET DATA TYPE text USING "tenant_id"::text;
--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "created_by_user_id" SET DATA TYPE text USING "created_by_user_id"::text;
--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "updated_by_user_id" SET DATA TYPE text USING "updated_by_user_id"::text;
--> statement-breakpoint
ALTER TABLE "job_contacts" ALTER COLUMN "tenant_id" SET DATA TYPE text USING "tenant_id"::text;
--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "tenant_id" SET DATA TYPE text USING "tenant_id"::text;
--> statement-breakpoint
ALTER TABLE "lookup_values" ALTER COLUMN "tenant_id" SET DATA TYPE text USING "tenant_id"::text;
--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "tenant_id" SET DATA TYPE text USING "tenant_id"::text;
--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "to_user_id" SET DATA TYPE text USING "to_user_id"::text;
--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "acknowledged_by_user_id" SET DATA TYPE text USING "acknowledged_by_user_id"::text;
--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "created_by_user_id" SET DATA TYPE text USING "created_by_user_id"::text;
--> statement-breakpoint
ALTER TABLE "purchase_order_combos" ALTER COLUMN "tenant_id" SET DATA TYPE text USING "tenant_id"::text;
--> statement-breakpoint
ALTER TABLE "purchase_order_groups" ALTER COLUMN "tenant_id" SET DATA TYPE text USING "tenant_id"::text;
--> statement-breakpoint
ALTER TABLE "purchase_order_items" ALTER COLUMN "tenant_id" SET DATA TYPE text USING "tenant_id"::text;
--> statement-breakpoint
ALTER TABLE "purchase_orders" ALTER COLUMN "tenant_id" SET DATA TYPE text USING "tenant_id"::text;
--> statement-breakpoint
ALTER TABLE "purchase_orders" ALTER COLUMN "created_by_user_id" SET DATA TYPE text USING "created_by_user_id"::text;
--> statement-breakpoint
ALTER TABLE "purchase_orders" ALTER COLUMN "updated_by_user_id" SET DATA TYPE text USING "updated_by_user_id"::text;
--> statement-breakpoint
ALTER TABLE "quote_combos" ALTER COLUMN "tenant_id" SET DATA TYPE text USING "tenant_id"::text;
--> statement-breakpoint
ALTER TABLE "quote_groups" ALTER COLUMN "tenant_id" SET DATA TYPE text USING "tenant_id"::text;
--> statement-breakpoint
ALTER TABLE "quote_items" ALTER COLUMN "tenant_id" SET DATA TYPE text USING "tenant_id"::text;
--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "tenant_id" SET DATA TYPE text USING "tenant_id"::text;
--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "created_by_user_id" SET DATA TYPE text USING "created_by_user_id"::text;
--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "updated_by_user_id" SET DATA TYPE text USING "updated_by_user_id"::text;
--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "tenant_id" SET DATA TYPE text USING "tenant_id"::text;
--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "created_by_user_id" SET DATA TYPE text USING "created_by_user_id"::text;
--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "updated_by_user_id" SET DATA TYPE text USING "updated_by_user_id"::text;
--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "tenant_id" SET DATA TYPE text USING "tenant_id"::text;
--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "assigned_to_user_id" SET DATA TYPE text USING "assigned_to_user_id"::text;
--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "created_by_user_id" SET DATA TYPE text USING "created_by_user_id"::text;
--> statement-breakpoint
ALTER TABLE "vendors" ALTER COLUMN "tenant_id" SET DATA TYPE text USING "tenant_id"::text;
--> statement-breakpoint
DROP TABLE IF EXISTS "users" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "tenants" CASCADE;
