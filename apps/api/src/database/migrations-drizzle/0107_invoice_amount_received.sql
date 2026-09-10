ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "amount_received" numeric(14, 2);
--> statement-breakpoint
INSERT INTO lookup_values (id, tenant_id, domain, provider_code, name, external_reference, metadata, is_active)
SELECT gen_random_uuid(), o.id, 'invoice_status', NULL, 'Partially Paid', 'seed-invoice-status-partially-paid', '{}'::jsonb, true
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1
  FROM lookup_values lv
  WHERE lv.tenant_id = o.id
    AND lv.domain = 'invoice_status'
    AND (
      lv.external_reference = 'seed-invoice-status-partially-paid'
      OR lower(lv.name) = 'partially paid'
    )
);
