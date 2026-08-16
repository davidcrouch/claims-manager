-- RFQ Send Requests (batch records)
CREATE TABLE IF NOT EXISTS "rfq_send_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "rfq_id" uuid NOT NULL REFERENCES "rfqs"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'pending',
  "initiated_by" text,
  "generated_doc_id" uuid,
  "email_subject" text NOT NULL,
  "email_body_html" text NOT NULL,
  "email_body_text" text,
  "reply_to" text,
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_rfq_send_requests_rfq" ON "rfq_send_requests" ("tenant_id", "rfq_id");
CREATE INDEX IF NOT EXISTS "idx_rfq_send_requests_status" ON "rfq_send_requests" ("status");

-- RFQ Send Recipients (per-recipient tracking)
CREATE TABLE IF NOT EXISTS "rfq_send_recipients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "send_request_id" uuid NOT NULL REFERENCES "rfq_send_requests"("id") ON DELETE CASCADE,
  "contact_id" uuid REFERENCES "contacts"("id") ON DELETE SET NULL,
  "recipient_name" text NOT NULL,
  "recipient_email" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "error_message" text,
  "resend_message_id" text,
  "sent_at" timestamptz,
  "retry_count" integer NOT NULL DEFAULT 0,
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_rfq_send_recipients_request" ON "rfq_send_recipients" ("send_request_id");

-- Email Templates (configurable per tenant)
CREATE TABLE IF NOT EXISTS "email_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "template_type" text NOT NULL,
  "subject" text NOT NULL,
  "body_html" text NOT NULL,
  "body_text" text,
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_templates_tenant_type_uidx" ON "email_templates" ("tenant_id", "template_type");
