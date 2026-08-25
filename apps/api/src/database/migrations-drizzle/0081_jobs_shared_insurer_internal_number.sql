-- Allow multiple CW jobs (e.g. Make Safe + Builder Works) to share the same
-- internal number when they use the same insurer reference (external_job_id).
-- Manual jobs without an insurer ref keep unique internal numbers per tenant.
DROP INDEX IF EXISTS "UQ_jobs_tenant_internal_number";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_jobs_tenant_internal_number"
  ON "jobs" USING btree ("tenant_id", "internal_number")
  WHERE internal_number IS NOT NULL
    AND deleted_at IS NULL
    AND external_job_id IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_tenant_external_job_id"
  ON "jobs" USING btree ("tenant_id", "external_job_id")
  WHERE external_job_id IS NOT NULL AND deleted_at IS NULL;
