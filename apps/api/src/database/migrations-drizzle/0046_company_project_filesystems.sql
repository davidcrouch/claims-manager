-- 0046: Company & project filesystem instances (doc 47)

-- Organisation template defaults
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "default_company_filesystem_template_id" uuid;
--> statement-breakpoint
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "default_project_filesystem_template_id" uuid;
--> statement-breakpoint

-- Filesystem instance typing + job linkage
ALTER TABLE "filesystem"
  ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'company';
--> statement-breakpoint
ALTER TABLE "filesystem"
  ADD COLUMN IF NOT EXISTS "job_id" uuid;
--> statement-breakpoint

ALTER TABLE "filesystem" DROP CONSTRAINT IF EXISTS "filesystem_tenant_id_unique";
--> statement-breakpoint

ALTER TABLE "filesystem" DROP CONSTRAINT IF EXISTS "chk_filesystem_kind";
--> statement-breakpoint
ALTER TABLE "filesystem"
  ADD CONSTRAINT "chk_filesystem_kind" CHECK (kind IN ('company', 'project'));
--> statement-breakpoint

ALTER TABLE "filesystem" DROP CONSTRAINT IF EXISTS "chk_filesystem_kind_job";
--> statement-breakpoint
ALTER TABLE "filesystem"
  ADD CONSTRAINT "chk_filesystem_kind_job" CHECK (
    (kind = 'company' AND job_id IS NULL)
    OR (kind = 'project' AND job_id IS NOT NULL)
  );
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "filesystem"
    ADD CONSTRAINT "filesystem_job_id_jobs_id_fk"
    FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_filesystem_tenant_kind" ON "filesystem" USING btree ("tenant_id", "kind");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_filesystem_job" ON "filesystem" USING btree ("job_id");
--> statement-breakpoint

DROP INDEX IF EXISTS "filesystem_tenant_company_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "filesystem_tenant_company_unique"
  ON "filesystem" ("tenant_id")
  WHERE kind = 'company' AND archived_at IS NULL;
--> statement-breakpoint

DROP INDEX IF EXISTS "filesystem_job_project_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "filesystem_job_project_unique"
  ON "filesystem" ("job_id")
  WHERE kind = 'project' AND job_id IS NOT NULL AND archived_at IS NULL;
--> statement-breakpoint

-- Document ownership of a filesystem (uncategorised-safe)
ALTER TABLE "document"
  ADD COLUMN IF NOT EXISTS "filesystem_id" uuid;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "document"
    ADD CONSTRAINT "document_filesystem_id_filesystem_id_fk"
    FOREIGN KEY ("filesystem_id") REFERENCES "public"."filesystem"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_document_filesystem" ON "document" USING btree ("filesystem_id");
--> statement-breakpoint

-- Backfill: existing rows are company filesystems
UPDATE "filesystem"
SET kind = 'company', job_id = NULL
WHERE kind IS DISTINCT FROM 'company' OR job_id IS NOT NULL;
--> statement-breakpoint

-- Backfill document.filesystem_id from category, else company FS for tenant
UPDATE "document" d
SET filesystem_id = c.filesystem_id
FROM "filesystem_category" c
WHERE d.filesystem_category_id = c.id
  AND d.filesystem_id IS NULL;
--> statement-breakpoint

UPDATE "document" d
SET filesystem_id = fs.id
FROM "filesystem" fs
WHERE d.filesystem_id IS NULL
  AND fs.tenant_id = d.tenant_id
  AND fs.kind = 'company'
  AND fs.archived_at IS NULL;
--> statement-breakpoint

-- Org defaults from existing company FS source template / platform defaults
UPDATE "organizations" o
SET default_company_filesystem_template_id = fs.source_template_id
FROM "filesystem" fs
WHERE fs.tenant_id = o.id
  AND fs.kind = 'company'
  AND fs.archived_at IS NULL
  AND fs.source_template_id IS NOT NULL
  AND o.default_company_filesystem_template_id IS NULL;
--> statement-breakpoint

UPDATE "organizations" o
SET default_company_filesystem_template_id = t.id
FROM "filesystem_template" t
WHERE o.default_company_filesystem_template_id IS NULL
  AND t.tenant_id IS NULL
  AND t.kind = 'company'
  AND t.is_default = true
  AND t.archived_at IS NULL;
--> statement-breakpoint

-- Mark platform Project template as default for its kind (company already is)
UPDATE "filesystem_template"
SET is_default = true, updated_at = now()
WHERE tenant_id IS NULL
  AND kind = 'project'
  AND name = 'Project'
  AND archived_at IS NULL;
--> statement-breakpoint

-- Platform default uniqueness per kind
DROP INDEX IF EXISTS "filesystem_template_platform_default_per_kind";
--> statement-breakpoint
CREATE UNIQUE INDEX "filesystem_template_platform_default_per_kind"
  ON "filesystem_template" ("kind")
  WHERE is_default = true AND tenant_id IS NULL AND archived_at IS NULL;
--> statement-breakpoint

UPDATE "organizations" o
SET default_project_filesystem_template_id = t.id
FROM "filesystem_template" t
WHERE o.default_project_filesystem_template_id IS NULL
  AND t.tenant_id IS NULL
  AND t.kind = 'project'
  AND t.is_default = true
  AND t.archived_at IS NULL;
--> statement-breakpoint

UPDATE "organizations" o
SET default_project_filesystem_template_id = t.id
FROM "filesystem_template" t
WHERE o.default_project_filesystem_template_id IS NULL
  AND t.tenant_id IS NULL
  AND t.kind = 'project'
  AND t.archived_at IS NULL;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "organizations"
    ADD CONSTRAINT "organizations_default_company_filesystem_template_id_filesystem_template_id_fk"
    FOREIGN KEY ("default_company_filesystem_template_id")
    REFERENCES "public"."filesystem_template"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "organizations"
    ADD CONSTRAINT "organizations_default_project_filesystem_template_id_filesystem_template_id_fk"
    FOREIGN KEY ("default_project_filesystem_template_id")
    REFERENCES "public"."filesystem_template"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
