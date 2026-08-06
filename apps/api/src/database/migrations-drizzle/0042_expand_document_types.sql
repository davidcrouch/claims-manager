-- Widen document_type check constraints to allow new singular + list types

ALTER TABLE "document_templates"
  DROP CONSTRAINT IF EXISTS "chk_doc_template_type";
--> statement-breakpoint
ALTER TABLE "document_templates"
  ADD CONSTRAINT "chk_doc_template_type"
  CHECK (document_type IN (
    'quote','invoice','purchase_order','work_order','proposal','report','bill','rfq',
    'job_details','scope_of_work',
    'claim','contact','task','appointment','message','journal','vendor',
    'jobs_list','quotes_list','invoices_list','bills_list','work_orders_list',
    'purchase_orders_list','proposals_list','rfqs_list','reports_list',
    'claims_list','contacts_list','tasks_list','appointments_list',
    'messages_list','journals_list','vendors_list'
  ));
--> statement-breakpoint

ALTER TABLE "generated_documents"
  DROP CONSTRAINT IF EXISTS "chk_gen_doc_type";
--> statement-breakpoint
ALTER TABLE "generated_documents"
  ADD CONSTRAINT "chk_gen_doc_type"
  CHECK (document_type IN (
    'quote','invoice','purchase_order','work_order','proposal','report','bill','rfq',
    'job_details','scope_of_work',
    'claim','contact','task','appointment','message','journal','vendor',
    'jobs_list','quotes_list','invoices_list','bills_list','work_orders_list',
    'purchase_orders_list','proposals_list','rfqs_list','reports_list',
    'claims_list','contacts_list','tasks_list','appointments_list',
    'messages_list','journals_list','vendors_list'
  ));

-- Also drop the old unique constraint on document_templates (name was removed, tenant+type is now unique)
ALTER TABLE "document_templates"
  DROP CONSTRAINT IF EXISTS "UQ_doc_template_tenant_type_name";
