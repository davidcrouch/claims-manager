CREATE TABLE IF NOT EXISTS "po_send_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "purchase_order_id" uuid NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "initiated_by" text,
  "generated_doc_id" uuid,
  "email_subject" text NOT NULL,
  "email_body_html" text NOT NULL,
  "email_body_text" text,
  "reply_to" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "po_send_recipients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "send_request_id" uuid NOT NULL,
  "contact_id" uuid,
  "recipient_name" text NOT NULL,
  "recipient_email" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "error_message" text,
  "resend_message_id" text,
  "sent_at" timestamptz,
  "retry_count" integer DEFAULT 0 NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "po_send_requests" ADD CONSTRAINT "po_send_requests_tenant_id_organizations_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "po_send_requests" ADD CONSTRAINT "po_send_requests_purchase_order_id_purchase_orders_id_fk"
    FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "po_send_recipients" ADD CONSTRAINT "po_send_recipients_send_request_id_po_send_requests_id_fk"
    FOREIGN KEY ("send_request_id") REFERENCES "public"."po_send_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "po_send_recipients" ADD CONSTRAINT "po_send_recipients_contact_id_contacts_id_fk"
    FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_po_send_requests_po" ON "po_send_requests" ("tenant_id", "purchase_order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_po_send_requests_status" ON "po_send_requests" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_po_send_recipients_request" ON "po_send_recipients" ("send_request_id");
