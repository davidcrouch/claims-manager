-- Allow a tenant-wide default template used when a scenario has no dedicated assignment

ALTER TABLE "document_templates"
  DROP CONSTRAINT IF EXISTS "chk_doc_template_type";
--> statement-breakpoint
ALTER TABLE "document_templates"
  ADD CONSTRAINT "chk_doc_template_type"
  CHECK (document_type IN (
    'default',
    'quote','invoice','purchase_order','work_order','proposal','report','bill','rfq',
    'job_details','scope_of_work',
    'claim','contact','task','appointment','message','journal','vendor','assessment',
    'jobs_list','quotes_list','invoices_list','bills_list','work_orders_list',
    'purchase_orders_list','proposals_list','rfqs_list','reports_list',
    'claims_list','contacts_list','tasks_list','appointments_list',
    'messages_list','journals_list','vendors_list'
  ));
