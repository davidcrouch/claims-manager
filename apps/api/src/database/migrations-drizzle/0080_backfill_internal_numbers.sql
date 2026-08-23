-- Backfill internal_number for existing rows (oldest first per tenant), then sync sequences.

-- Jobs
UPDATE "jobs" j
SET "internal_number" = 'JOB-' || (em.max_num + n.rn)::text
FROM (
  SELECT "id", "tenant_id",
    ROW_NUMBER() OVER (PARTITION BY "tenant_id" ORDER BY "created_at", "id") AS rn
  FROM "jobs"
  WHERE "internal_number" IS NULL AND "deleted_at" IS NULL
) n
JOIN (
  SELECT "tenant_id",
    COALESCE(MAX(
      CASE WHEN "internal_number" ~ '^JOB-[0-9]+$'
        THEN (substring("internal_number" from '[0-9]+$'))::integer
      END
    ), 200000) AS max_num
  FROM "jobs"
  WHERE "deleted_at" IS NULL
  GROUP BY "tenant_id"
) em ON em."tenant_id" = n."tenant_id"
WHERE j."id" = n."id";
--> statement-breakpoint

-- Estimates (quotes)
UPDATE "quotes" q
SET "internal_number" = 'EST-' || (em.max_num + n.rn)::text
FROM (
  SELECT "id", "tenant_id",
    ROW_NUMBER() OVER (PARTITION BY "tenant_id" ORDER BY "created_at", "id") AS rn
  FROM "quotes"
  WHERE "internal_number" IS NULL AND "deleted_at" IS NULL
) n
JOIN (
  SELECT "tenant_id",
    COALESCE(MAX(
      CASE WHEN "internal_number" ~ '^EST-[0-9]+$'
        THEN (substring("internal_number" from '[0-9]+$'))::integer
      END
    ), 200000) AS max_num
  FROM "quotes"
  WHERE "deleted_at" IS NULL
  GROUP BY "tenant_id"
) em ON em."tenant_id" = n."tenant_id"
WHERE q."id" = n."id";
--> statement-breakpoint

-- RFQs
UPDATE "rfqs" r
SET "internal_number" = 'RFQ-' || (em.max_num + n.rn)::text
FROM (
  SELECT "id", "tenant_id",
    ROW_NUMBER() OVER (PARTITION BY "tenant_id" ORDER BY "created_at", "id") AS rn
  FROM "rfqs"
  WHERE "internal_number" IS NULL AND "deleted_at" IS NULL
) n
JOIN (
  SELECT "tenant_id",
    COALESCE(MAX(
      CASE WHEN "internal_number" ~ '^RFQ-[0-9]+$'
        THEN (substring("internal_number" from '[0-9]+$'))::integer
      END
    ), 200000) AS max_num
  FROM "rfqs"
  WHERE "deleted_at" IS NULL
  GROUP BY "tenant_id"
) em ON em."tenant_id" = n."tenant_id"
WHERE r."id" = n."id";
--> statement-breakpoint

-- Work orders
UPDATE "work_orders" wo
SET "internal_number" = 'WO-' || (em.max_num + n.rn)::text
FROM (
  SELECT "id", "tenant_id",
    ROW_NUMBER() OVER (PARTITION BY "tenant_id" ORDER BY "created_at", "id") AS rn
  FROM "work_orders"
  WHERE "internal_number" IS NULL AND "deleted_at" IS NULL
) n
JOIN (
  SELECT "tenant_id",
    COALESCE(MAX(
      CASE WHEN "internal_number" ~ '^WO-[0-9]+$'
        THEN (substring("internal_number" from '[0-9]+$'))::integer
      END
    ), 200000) AS max_num
  FROM "work_orders"
  WHERE "deleted_at" IS NULL
  GROUP BY "tenant_id"
) em ON em."tenant_id" = n."tenant_id"
WHERE wo."id" = n."id";
--> statement-breakpoint

-- Purchase orders
UPDATE "purchase_orders" po
SET "internal_number" = 'PO-' || (em.max_num + n.rn)::text
FROM (
  SELECT "id", "tenant_id",
    ROW_NUMBER() OVER (PARTITION BY "tenant_id" ORDER BY "created_at", "id") AS rn
  FROM "purchase_orders"
  WHERE "internal_number" IS NULL AND "deleted_at" IS NULL
) n
JOIN (
  SELECT "tenant_id",
    COALESCE(MAX(
      CASE WHEN "internal_number" ~ '^PO-[0-9]+$'
        THEN (substring("internal_number" from '[0-9]+$'))::integer
      END
    ), 200000) AS max_num
  FROM "purchase_orders"
  WHERE "deleted_at" IS NULL
  GROUP BY "tenant_id"
) em ON em."tenant_id" = n."tenant_id"
WHERE po."id" = n."id";
--> statement-breakpoint

-- Invoices
UPDATE "invoices" i
SET "internal_number" = 'INV-' || (em.max_num + n.rn)::text
FROM (
  SELECT "id", "tenant_id",
    ROW_NUMBER() OVER (PARTITION BY "tenant_id" ORDER BY "created_at", "id") AS rn
  FROM "invoices"
  WHERE "internal_number" IS NULL AND "is_deleted" = false
) n
JOIN (
  SELECT "tenant_id",
    COALESCE(MAX(
      CASE WHEN "internal_number" ~ '^INV-[0-9]+$'
        THEN (substring("internal_number" from '[0-9]+$'))::integer
      END
    ), 200000) AS max_num
  FROM "invoices"
  WHERE "is_deleted" = false
  GROUP BY "tenant_id"
) em ON em."tenant_id" = n."tenant_id"
WHERE i."id" = n."id";
--> statement-breakpoint

-- Sync tenant_record_sequences from backfilled maxima
INSERT INTO "tenant_record_sequences" ("tenant_id", "sequence_key", "next_value")
SELECT "tenant_id", 'job',
  GREATEST(COALESCE(MAX((substring("internal_number" from '[0-9]+$'))::integer), 0) + 1, 200001)
FROM "jobs"
WHERE "internal_number" ~ '^JOB-[0-9]+$' AND "deleted_at" IS NULL
GROUP BY "tenant_id"
ON CONFLICT ("tenant_id", "sequence_key") DO UPDATE
SET "next_value" = GREATEST("tenant_record_sequences"."next_value", EXCLUDED."next_value"),
    "updated_at" = now();
--> statement-breakpoint
INSERT INTO "tenant_record_sequences" ("tenant_id", "sequence_key", "next_value")
SELECT "tenant_id", 'estimate',
  GREATEST(COALESCE(MAX((substring("internal_number" from '[0-9]+$'))::integer), 0) + 1, 200001)
FROM "quotes"
WHERE "internal_number" ~ '^EST-[0-9]+$' AND "deleted_at" IS NULL
GROUP BY "tenant_id"
ON CONFLICT ("tenant_id", "sequence_key") DO UPDATE
SET "next_value" = GREATEST("tenant_record_sequences"."next_value", EXCLUDED."next_value"),
    "updated_at" = now();
--> statement-breakpoint
INSERT INTO "tenant_record_sequences" ("tenant_id", "sequence_key", "next_value")
SELECT "tenant_id", 'rfq',
  GREATEST(COALESCE(MAX((substring("internal_number" from '[0-9]+$'))::integer), 0) + 1, 200001)
FROM "rfqs"
WHERE "internal_number" ~ '^RFQ-[0-9]+$' AND "deleted_at" IS NULL
GROUP BY "tenant_id"
ON CONFLICT ("tenant_id", "sequence_key") DO UPDATE
SET "next_value" = GREATEST("tenant_record_sequences"."next_value", EXCLUDED."next_value"),
    "updated_at" = now();
--> statement-breakpoint
INSERT INTO "tenant_record_sequences" ("tenant_id", "sequence_key", "next_value")
SELECT "tenant_id", 'work_order',
  GREATEST(COALESCE(MAX((substring("internal_number" from '[0-9]+$'))::integer), 0) + 1, 200001)
FROM "work_orders"
WHERE "internal_number" ~ '^WO-[0-9]+$' AND "deleted_at" IS NULL
GROUP BY "tenant_id"
ON CONFLICT ("tenant_id", "sequence_key") DO UPDATE
SET "next_value" = GREATEST("tenant_record_sequences"."next_value", EXCLUDED."next_value"),
    "updated_at" = now();
--> statement-breakpoint
INSERT INTO "tenant_record_sequences" ("tenant_id", "sequence_key", "next_value")
SELECT "tenant_id", 'purchase_order',
  GREATEST(COALESCE(MAX((substring("internal_number" from '[0-9]+$'))::integer), 0) + 1, 200001)
FROM "purchase_orders"
WHERE "internal_number" ~ '^PO-[0-9]+$' AND "deleted_at" IS NULL
GROUP BY "tenant_id"
ON CONFLICT ("tenant_id", "sequence_key") DO UPDATE
SET "next_value" = GREATEST("tenant_record_sequences"."next_value", EXCLUDED."next_value"),
    "updated_at" = now();
--> statement-breakpoint
INSERT INTO "tenant_record_sequences" ("tenant_id", "sequence_key", "next_value")
SELECT "tenant_id", 'invoice',
  GREATEST(COALESCE(MAX((substring("internal_number" from '[0-9]+$'))::integer), 0) + 1, 200001)
FROM "invoices"
WHERE "internal_number" ~ '^INV-[0-9]+$' AND "is_deleted" = false
GROUP BY "tenant_id"
ON CONFLICT ("tenant_id", "sequence_key") DO UPDATE
SET "next_value" = GREATEST("tenant_record_sequences"."next_value", EXCLUDED."next_value"),
    "updated_at" = now();
