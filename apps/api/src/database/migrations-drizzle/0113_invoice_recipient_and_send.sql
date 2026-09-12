ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "recipient_type" text;
--> statement-breakpoint
ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "recipient_contact_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "invoices"
    ADD CONSTRAINT "invoices_recipient_contact_id_contacts_id_fk"
    FOREIGN KEY ("recipient_contact_id") REFERENCES "public"."contacts"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invoices_recipient_contact"
  ON "invoices" ("tenant_id", "recipient_contact_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoice_send_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "invoice_id" uuid NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "initiated_by" text,
  "generated_doc_id" uuid,
  "email_subject" text NOT NULL,
  "email_body_html" text NOT NULL,
  "email_body_text" text,
  "reply_to" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "invoice_send_requests"
    ADD CONSTRAINT "invoice_send_requests_tenant_id_organizations_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "invoice_send_requests"
    ADD CONSTRAINT "invoice_send_requests_invoice_id_invoices_id_fk"
    FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invoice_send_requests_invoice"
  ON "invoice_send_requests" ("tenant_id", "invoice_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invoice_send_requests_status"
  ON "invoice_send_requests" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoice_send_recipients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "send_request_id" uuid NOT NULL,
  "contact_id" uuid,
  "recipient_name" text NOT NULL,
  "recipient_email" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "error_message" text,
  "resend_message_id" text,
  "sent_at" timestamp with time zone,
  "retry_count" integer DEFAULT 0 NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "invoice_send_recipients"
    ADD CONSTRAINT "invoice_send_recipients_send_request_id_invoice_send_requests_id_fk"
    FOREIGN KEY ("send_request_id") REFERENCES "public"."invoice_send_requests"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "invoice_send_recipients"
    ADD CONSTRAINT "invoice_send_recipients_contact_id_contacts_id_fk"
    FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invoice_send_recipients_request"
  ON "invoice_send_recipients" ("send_request_id");
