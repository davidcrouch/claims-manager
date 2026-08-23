INSERT INTO "tenant_record_sequences" ("tenant_id", "sequence_key", "next_value")
SELECT
  j."tenant_id",
  'job',
  GREATEST(
    COALESCE(
      MAX(
        CASE
          WHEN j."external_reference" ~* '^job-[0-9]+$'
            THEN (substring(j."external_reference" from '[0-9]+$'))::integer + 1
          ELSE NULL
        END
      ),
      200001
    ),
    200001
  )
FROM "jobs" j
WHERE j."deleted_at" IS NULL
  AND j."external_reference" IS NOT NULL
GROUP BY j."tenant_id"
ON CONFLICT ("tenant_id", "sequence_key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "tenant_record_sequences" ("tenant_id", "sequence_key", "next_value")
SELECT
  q."tenant_id",
  'estimate',
  GREATEST(
    COALESCE(
      MAX(
        CASE
          WHEN q."quote_number" ~* '^est-[0-9]+$'
            THEN (substring(q."quote_number" from '[0-9]+$'))::integer + 1
          ELSE NULL
        END
      ),
      200001
    ),
    200001
  )
FROM "quotes" q
WHERE q."deleted_at" IS NULL
  AND q."quote_number" IS NOT NULL
GROUP BY q."tenant_id"
ON CONFLICT ("tenant_id", "sequence_key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "tenant_record_sequences" ("tenant_id", "sequence_key", "next_value")
SELECT
  wo."tenant_id",
  'work_order',
  GREATEST(
    COALESCE(
      MAX(
        CASE
          WHEN wo."work_order_number" ~* '^wo-[0-9]+$'
            THEN (substring(wo."work_order_number" from '[0-9]+$'))::integer + 1
          ELSE NULL
        END
      ),
      200001
    ),
    200001
  )
FROM "work_orders" wo
WHERE wo."deleted_at" IS NULL
  AND wo."work_order_number" IS NOT NULL
GROUP BY wo."tenant_id"
ON CONFLICT ("tenant_id", "sequence_key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "tenant_record_sequences" ("tenant_id", "sequence_key", "next_value")
SELECT
  i."tenant_id",
  'invoice',
  GREATEST(
    COALESCE(
      MAX(
        CASE
          WHEN i."invoice_number" ~* '^inv-[0-9]+$'
            THEN (substring(i."invoice_number" from '[0-9]+$'))::integer + 1
          ELSE NULL
        END
      ),
      200001
    ),
    200001
  )
FROM "invoices" i
WHERE i."invoice_number" IS NOT NULL
GROUP BY i."tenant_id"
ON CONFLICT ("tenant_id", "sequence_key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "tenant_record_sequences" ("tenant_id", "sequence_key", "next_value")
SELECT
  po."tenant_id",
  'purchase_order',
  GREATEST(
    COALESCE(
      MAX(
        CASE
          WHEN po."purchase_order_number" ~* '^po-[0-9]+$'
            THEN (substring(po."purchase_order_number" from '[0-9]+$'))::integer + 1
          ELSE NULL
        END
      ),
      200001
    ),
    200001
  )
FROM "purchase_orders" po
WHERE po."deleted_at" IS NULL
  AND po."purchase_order_number" IS NOT NULL
GROUP BY po."tenant_id"
ON CONFLICT ("tenant_id", "sequence_key") DO NOTHING;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_work_orders_tenant_number"
  ON "work_orders" USING btree ("tenant_id", "work_order_number")
  WHERE work_order_number ~* '^wo-[0-9]+$' AND deleted_at IS NULL;
