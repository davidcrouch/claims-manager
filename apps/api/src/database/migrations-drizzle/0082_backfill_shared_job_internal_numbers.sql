-- One-off: align internal_number for jobs that share the same insurer reference
-- (external_job_id), e.g. CW Make Safe + Builder Works under cc:223554.
-- Canonical number = oldest job in the group (matches ProjectJobUseCase reuse).

-- Ensure external_job_id is populated where insurer ref lives in JSON only.
UPDATE "jobs"
SET
  "external_job_id" = COALESCE(
    NULLIF(btrim("custom_data"->>'insurerExternalReference'), ''),
    NULLIF(btrim("api_payload"->>'externalReference'), '')
  ),
  "updated_at" = now()
WHERE "deleted_at" IS NULL
  AND ("external_job_id" IS NULL OR btrim("external_job_id") = '')
  AND (
    NULLIF(btrim("custom_data"->>'insurerExternalReference'), '') IS NOT NULL
    OR NULLIF(btrim("api_payload"->>'externalReference'), '') IS NOT NULL
  );
--> statement-breakpoint
WITH "ranked" AS (
  SELECT
    "id",
    "tenant_id",
    "external_job_id",
    "internal_number",
    ROW_NUMBER() OVER (
      PARTITION BY "tenant_id", "external_job_id"
      ORDER BY
        CASE WHEN "internal_number" IS NOT NULL THEN 0 ELSE 1 END,
        "created_at" ASC,
        "id" ASC
    ) AS "rn"
  FROM "jobs"
  WHERE "deleted_at" IS NULL
    AND "external_job_id" IS NOT NULL
    AND btrim("external_job_id") <> ''
),
"canonical" AS (
  SELECT
    "tenant_id",
    "external_job_id",
    "internal_number" AS "canonical_internal_number"
  FROM "ranked"
  WHERE "rn" = 1
    AND "internal_number" IS NOT NULL
)
UPDATE "jobs" AS "j"
SET
  "internal_number" = "c"."canonical_internal_number",
  "updated_at" = now()
FROM "canonical" AS "c"
WHERE "j"."tenant_id" = "c"."tenant_id"
  AND "j"."external_job_id" = "c"."external_job_id"
  AND "j"."deleted_at" IS NULL
  AND "j"."internal_number" IS DISTINCT FROM "c"."canonical_internal_number";
