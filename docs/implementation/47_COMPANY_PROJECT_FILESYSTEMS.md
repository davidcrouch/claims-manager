# 47 — Company & Project Filesystems

> Extends the Filesystem Module ([39_FILESYSTEM_MODULE.md](./39_FILESYSTEM_MODULE.md)) so organisations have a **company** filesystem and each job has its own **project** filesystem, selected from typed templates.

**Status:** Implemented (initial)  
**Depends on:** 39 (filesystem module — shipped), template `kind` company/project (shipped)  
**Supersedes (behaviour):** single-filesystem-per-tenant assumption in doc 39 §1.1 / provisioning auto-setup

### Phase 0 decisions (locked)

1. Job create without template UI falls back to org default project template, then platform project default.
2. Cross-filesystem document moves are forbidden.
3. Project node label: job `name` → `externalReference` → short id.
4. Deleted jobs are omitted from the Projects overview list.
5. No feature flag for overview UI.

---

## Objective

Implement the product model:

| Context | Documents behaviour |
|---------|---------------------|
| **No active job** | Overview tree: **Company** node (org company filesystem) + **Projects** node (all job project filesystems) |
| **Active job** (`?jobId=` / sidebar job context) | That job’s **project filesystem only** |

Lifecycle:

1. **Org provisioning** — user selects a **company** template *and* a **default project** template. Company filesystem is instantiated immediately; default project template is stored for later job creates.
2. **Job create** — user selects a **project** filesystem template (defaulted from org preference). A project filesystem instance is created and linked to the job.
3. **GCS unchanged in principle** — database remains source of truth for hierarchy; object keys stay ID-based under the shared env documents bucket (`tenants/{tenantId}/documents/{documentId}/…`). Folder moves remain DB-only.

---

## Current State (baseline)

| Area | Today |
|------|--------|
| Template `kind` | `'company' \| 'project'` — schema, seeds, admin UI |
| Instance model | **One** `filesystem` row per tenant (`UNIQUE(tenant_id)`); no `kind`, no `job_id` |
| Provisioning | `setupFromDefault()` → platform company default only; no template pickers |
| Job create | No filesystem creation or template selection |
| Documents UI | Flat category tree for the single org FS; `?jobId=` is header chrome only |
| Soft job link | `document.related_record_type/id` can tag a Job — **not** a substitute for project FS instances |

Platform seeds already define distinct Company and Project category trees (`seeded-filesystem-templates.ts`).

---

## Domain Model

### Terminology

| Term | Meaning |
|------|---------|
| **Company filesystem** | One per organisation. Holds org-level documents. Instantiated from a `kind=company` template at provisioning (or admin setup). |
| **Project filesystem** | One per job. Holds that job’s documents. Instantiated from a `kind=project` template when the job is created. |
| **Filesystem template** | Blueprint (`filesystem_template`) with `kind` and category tree; platform or tenant-scoped. |
| **Default project template** | Org preference used to pre-select the template on job create. |

### Relationships

```
Organization
  │
  ├── filesystem (kind=company, job_id NULL)     ── exactly one active
  ├── default_project_template_id (preference)
  │
  └── Job
        └── filesystem (kind=project, job_id=job.id)  ── exactly one active per job
              └── filesystem_category (tree)
                    └── document (via filesystem_category_id)
```

### Documents overview (no job)

```
Documents
├── Company
│     └── <company category tree>
└── Projects
      ├── Job A — <display name>
      │     └── <project category tree>
      └── Job B — <display name>
            └── <project category tree>
```

### Documents with active job

```
Documents  (scoped to Job X)
└── <Job X project category tree>
```

---

## Scope & Exclusions

### In scope

- Schema: multi-filesystem instances per tenant; company vs project typing; job linkage; org template defaults
- Data migration for existing single-FS tenants
- APIs: list/resolve filesystems by context; create project FS; dual-template provisioning
- Provisioning UI: company + default project template selection
- Job create: project template selection + FS instantiation
- Documents UI: Company / Projects overview; job-scoped view when job selected
- Backfill / reconcile helpers for jobs missing a project FS
- Update doc 39 assumptions; keep GCS key strategy (optional small path polish only if needed)

### Out of scope (defer)

- Application-level blob `FileVersion` entities / versioned GCS keys (separate design)
- Per-organisation dedicated GCS buckets / `StorageLocation` abstraction
- Removing filename from GCS object path (optional follow-up; not required for this feature)
- Folder-level ACLs beyond existing tenant JWT scoping
- Auto-creating project FS for jobs imported via webhook/sync without an interactive template choice (see Phase 5 — use org default project template)
- Changing journal / generated-doc / chat-attachment key layouts

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Multiple FS per tenant | Drop `UNIQUE(tenant_id)`; constrain by kind/job | Required for company + many projects |
| Project link | `filesystem.job_id` → `jobs.id` (nullable) | Direct, queryable; one FS per job via unique partial index |
| Company uniqueness | Partial unique: one non-archived company FS per tenant | Matches product rule |
| Template kind enforcement | Reject wrong `kind` when instantiating | Prevents applying a project template as company FS |
| Org defaults | Columns (or `organizations.config`) for company + default project template IDs | Needed at provision and job create |
| Documents with job | Resolve FS by `job_id`; do not show Company/Projects overview | Matches nav intent |
| Documents without job | Aggregate Company + Projects nodes in API or compose client-side from list endpoints | Prefer one overview DTO to keep UI simple |
| Existing docs | Migrate current tenant FS → `kind=company`; leave `related_record_*` as-is | Non-breaking; project FS starts empty for new jobs |
| Jobs without FS | Lazy create from org default on first Documents open **or** backfill job — prefer create-on-job + backfill script | Avoid silent empty state for historical jobs |
| GCS keys | Unchanged (`tenants/{tenantId}/documents/{documentId}/…`) | Hierarchy stays in DB; FS id not required in path |
| Pipelines | Continue copying template pipelines onto the target filesystem instance | Same as today, per FS |

---

## Phases

| Phase | Description | Schema | Effort (guide) |
|-------|-------------|--------|----------------|
| 0 | Spec lock + inventory of call sites assuming one FS | — | 0.5 d |
| 1 | Schema & migration (multi-FS + defaults) | Yes | 1–2 d |
| 2 | Repository & service APIs | — | 2–3 d |
| 3 | Provisioning: dual template selection | Org defaults | 1–2 d |
| 4 | Job create: project FS instantiation | — | 1–2 d |
| 5 | Backfill / webhook job path | — | 0.5–1 d |
| 6 | Documents UI (overview + job-scoped) | — | 2–3 d |
| 7 | Admin / settings polish + docs | — | 0.5–1 d |

---

## Phase 0 — Spec Lock & Call-Site Inventory

### 0.1 Confirm product rules

- [ ] Exactly one **active** company filesystem per organisation.
- [ ] Exactly one **active** project filesystem per job (when FS has been set up).
- [ ] Changing templates after instantiation does **not** rebuild trees automatically (same as today for company setup).
- [ ] Archiving a job does **not** hard-delete GCS objects; soft-archive FS optional (follow existing `archived_at` patterns).
- [ ] Upload into a category always belongs to that category’s filesystem (implicit); when job-scoped, set `related_record_type='Job'` + `related_record_id` for convenience filters/search.

### 0.2 Inventory (update or break these)

Search and list touchpoints that assume a single filesystem:

| Area | Paths (indicative) |
|------|---------------------|
| API | `FilesystemService.getFilesystem`, `setupFromDefault`, `copyTemplateToTenantFilesystem` |
| Repo | `FilesystemsRepository.findByTenant` |
| Provisioning | `ProvisioningService.stepFilesystemSetup` |
| Documents | `DocumentsService` category validation; list filters |
| Frontend | `getFilesystem()`, `/documents`, `FilesystemView`, `FilesystemBrowser`, admin Document Categories |
| BFF | `apps/frontend/src/app/api/filesystems/*` |

Deliverable: checklist in this doc or a short appendix PR comment before coding Phase 1.

---

## Phase 1 — Schema & Migration

### 1.1 Alter `filesystem`

Add columns:

```sql
ALTER TABLE filesystem
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'company',
  ADD COLUMN job_id UUID REFERENCES jobs(id) ON DELETE RESTRICT;

-- Drop one-FS-per-tenant uniqueness
ALTER TABLE filesystem DROP CONSTRAINT filesystem_tenant_id_unique;
-- (actual constraint name may differ — verify in migration 0026)

-- Kind check
ALTER TABLE filesystem ADD CONSTRAINT chk_filesystem_kind
  CHECK (kind IN ('company', 'project'));

-- One active company FS per tenant
CREATE UNIQUE INDEX filesystem_tenant_company_unique
  ON filesystem (tenant_id)
  WHERE kind = 'company' AND archived_at IS NULL;

-- One active project FS per job
CREATE UNIQUE INDEX filesystem_job_project_unique
  ON filesystem (job_id)
  WHERE kind = 'project' AND job_id IS NOT NULL AND archived_at IS NULL;

-- Integrity: company ⇒ job_id NULL; project ⇒ job_id NOT NULL
ALTER TABLE filesystem ADD CONSTRAINT chk_filesystem_kind_job
  CHECK (
    (kind = 'company' AND job_id IS NULL)
    OR (kind = 'project' AND job_id IS NOT NULL)
  );

CREATE INDEX idx_filesystem_tenant_kind ON filesystem (tenant_id, kind);
CREATE INDEX idx_filesystem_job ON filesystem (job_id);
```

Drizzle: update `filesystems` table in `apps/api/src/database/schema/index.ts`; remove `.unique()` on `tenantId`; add `kind`, `jobId`.

### 1.2 Organisation template defaults

Prefer explicit columns for clarity and FK integrity:

```sql
ALTER TABLE organizations
  ADD COLUMN default_company_filesystem_template_id UUID
    REFERENCES filesystem_template(id) ON DELETE SET NULL,
  ADD COLUMN default_project_filesystem_template_id UUID
    REFERENCES filesystem_template(id) ON DELETE SET NULL;
```

Alternatively store under `organizations.config.filesystem` JSON if the team prefers config bags — if so, document shape:

```ts
config.filesystem = {
  defaultCompanyTemplateId: string;
  defaultProjectTemplateId: string;
}
```

**Recommendation:** FK columns (enforce template existence; easier queries).

### 1.3 Data migration

For each tenant with an existing `filesystem` row:

1. Set `kind = 'company'`, `job_id = NULL`.
2. If `source_template_id` is set and that template’s kind is `project`, leave instance as company but log a warning (should not happen in prod).
3. Set `organizations.default_company_filesystem_template_id` from `source_template_id` when present, else platform company default.
4. Set `organizations.default_project_filesystem_template_id` to platform project template (`kind=project`, prefer `is_default` if we add a project default flag — see 1.4).

### 1.4 Template default flags

Today only the company seed has `is_default = true`. Options:

- **A (minimal):** Resolve “platform project default” as the single platform `kind=project` template (or first by name).
- **B:** Add `is_default` semantics **per kind** — unique partial index `(kind) WHERE is_default AND tenant_id IS NULL`.

**Recommendation:** B — clearer for seeds and admin.

```sql
-- Drop any global unique on is_default if present; replace with per-kind platform default
CREATE UNIQUE INDEX filesystem_template_platform_default_per_kind
  ON filesystem_template (kind)
  WHERE is_default = true AND tenant_id IS NULL AND archived_at IS NULL;
```

Update Project seed: `isDefault: true` for the platform project template (or keep false and use A).

### 1.5 Jobs table (optional denormalisation)

**Do not** add `jobs.filesystem_id` unless list performance requires it — prefer `filesystem.job_id` as source of truth. Add later only if profiling demands it.

---

## Phase 2 — Repository & Service APIs

### 2.1 Repository changes

`FilesystemsRepository` (`apps/api/src/database/repositories/filesystems.repository.ts`):

| Method | Behaviour |
|--------|-----------|
| `findCompanyByTenant(tenantId)` | `kind=company`, not archived |
| `findByJob(tenantId, jobId)` | `kind=project`, `job_id`, not archived |
| `listProjectFilesystems(tenantId)` | All project FS for tenant (+ optional join job display fields) |
| `create(params)` | Accept `kind`, `jobId`, `name`, `sourceTemplateId` |
| `findByTenant` | **Deprecate** — replace call sites; or make it alias `findCompanyByTenant` with logged deprecation |

Category tree methods stay keyed by `filesystemId` (already correct).

### 2.2 Service: instantiation helpers

Refactor `copyTemplateToTenantFilesystem` into something like:

```ts
instantiateFromTemplate(params: {
  tenantId: string;
  templateId: string;
  kind: 'company' | 'project';
  jobId?: string;
  name?: string;
}): Promise<FilesystemWithCategories>
```

Rules:

- Load template via `findAccessible`; **require** `template.kind === params.kind`.
- Company: ensure no existing active company FS (or support “already set up” idempotent skip like today).
- Project: require `jobId`; ensure job belongs to tenant; ensure no existing project FS for that job.
- Copy categories + template pipelines onto the new instance (reuse existing copy logic).
- Set `source_template_id`, `copied_at`.

### 2.3 Service: resolution APIs

| Endpoint (Nest) | Purpose |
|-----------------|--------|
| `GET /filesystems/company` | Company FS + categories |
| `GET /filesystems/jobs/:jobId` | Project FS for job (+ 404 if missing) |
| `GET /filesystems/overview` | `{ company, projects: [{ jobId, jobLabel, filesystem }] }` for Documents with no job |
| `GET /filesystems` | **Change:** return company only **or** deprecate in favour of explicit routes (avoid ambiguous “the” filesystem) |
| `POST /filesystems/setup` | Company setup only; require `kind=company` template; persist org `default_company_*` if provided |
| `POST /filesystems/jobs/:jobId/setup` | Create project FS from `{ templateId? }` (default org default project template) |
| `PATCH /organizations/me/filesystem-defaults` (or under settings) | Update default company/project template IDs |

Keep `POST /filesystems/setup-default` as “use platform company default” for automation; provisioning will pass explicit IDs after Phase 3.

### 2.4 Documents service alignment

- When validating `categoryId`, ensure category’s `filesystem_id` matches the intended FS context.
- List documents:
  - Overview: filter by categories belonging to company FS **or** any project FS for tenant (or return separate lists).
  - Job context: filter by categories of that job’s project FS (and/or `related_record` Job — prefer category ownership as source of truth).
- Upload URL DTO: accept optional `jobId`; if present, require category ∈ that job’s FS; set `related_record_type/id` automatically.
- `assignCategory`: reject cross-filesystem moves (category must belong to same FS as document’s current category / owning FS). Document which FS a document “belongs” to: derive from `filesystem_category.filesystem_id` (nullable category → policy TBD: disallow uncategorised cross-FS or track `filesystem_id` on `document`).

**Recommendation:** Add nullable `document.filesystem_id` FK for unambiguous ownership when `filesystem_category_id` is null (uncategorised). Backfill from category; for null category rows, assign to company FS.

```sql
ALTER TABLE document
  ADD COLUMN filesystem_id UUID REFERENCES filesystem(id) ON DELETE SET NULL;

CREATE INDEX idx_document_filesystem ON document (filesystem_id);
-- Backfill from category; then company fallback
```

### 2.5 Permissions

Retain JWT + tenant scoping. Optionally add `@RequirePermission` later; not blocking.

### 2.6 Frontend API client & BFF

Update `apps/frontend` API client + route handlers under `app/api/filesystems/` to match new Nest routes. Replace `getFilesystem()` usages with `getCompanyFilesystem()` / `getJobFilesystem(jobId)` / `getFilesystemOverview()`.

---

## Phase 3 — Provisioning: Dual Template Selection

### 3.1 Backend provisioning step

Replace blind `setupFromDefault()` in `ProvisioningService.stepFilesystemSetup`:

1. Ensure platform templates exist (existing `ensurePlatformFilesystemTemplates`).
2. Resolve templates:
   - Company: from provisioning payload / org defaults / platform company default.
   - Project default: from payload / platform project default — **store only**, do not instantiate project FS.
3. Instantiate **company** FS from company template.
4. Persist `default_company_filesystem_template_id` and `default_project_filesystem_template_id` on the organisation.

Extend provisioning state/payload (however provisioning currently stores step inputs) to accept:

```ts
{
  companyFilesystemTemplateId?: string;
  defaultProjectFilesystemTemplateId?: string;
}
```

If the auto-provision path has no UI yet, defaults to platform company + platform project defaults (non-regressive).

### 3.2 Provisioning UI

`ProvisioningScreen.tsx` (and any step components):

- Step **Document structure** (or extend filesystem step):
  - Dropdown/list: **Company templates** (`kind=company`)
  - Dropdown/list: **Default project templates** (`kind=project`)
  - Short help text: company applies now; project template is used when creating jobs.
- Submit selected IDs into provisioning API before/during `filesystem_setup` step.

### 3.3 Admin Document Categories

`FilesystemSettingsPanel` / admin documents:

- Continues to manage **company** filesystem categories.
- Show/edit org default **project** template preference.
- Do not allow selecting a project template for company setup.

---

## Phase 4 — Job Create: Project Filesystem

### 4.1 API

Extend `CreateJobDto` (and provider body mapping as needed):

```ts
filesystemTemplateId?: string; // kind=project; optional → org default
```

In `JobsService.create`, after successful job insert (same transaction if possible):

1. Resolve template: DTO → org `default_project_filesystem_template_id` → platform project default.
2. Call `FilesystemService.instantiateFromTemplate({ kind: 'project', jobId, templateId })`.
3. On template failure: fail the job create **or** create job and surface FS error — **Recommendation:** fail closed in the same transaction so jobs never exist without a project FS for interactive creates.

### 4.2 Frontend job create form

- Load project templates (`GET /filesystem-templates?kind=project`).
- Prefill from org defaults endpoint.
- Allow override before submit.
- Pass `filesystemTemplateId` in create payload.

### 4.3 Job detail / empty state

If somehow FS missing: show “Set up document folders” CTA calling `POST /filesystems/jobs/:jobId/setup`.

---

## Phase 5 — Backfill & Non-Interactive Job Creation

### 5.1 Existing jobs

Script or admin endpoint:

- For each job without a project filesystem, instantiate from org default project template (or platform project default).
- Idempotent; log tenants/jobs processed.
- Run once per environment after Phase 1–2 deploy.

### 5.2 Webhook / sync-created jobs

When jobs are created outside the UI (`JobsService` sync paths, webhooks):

- After local job upsert, if no project FS exists, instantiate from org default project template.
- Guard with try/catch + metric/log so sync is not permanently blocked; retry via backfill if needed.

### 5.3 Company FS missing

If a tenant has no company FS (partial provision), Documents overview should prompt setup (existing admin setup flow) rather than crashing.

---

## Phase 6 — Documents UI

### 6.1 Routing / context

Sidebar already appends `?jobId=` when a job is selected (`AppSidebar` `jobFilterable`). Keep that.

| URL | View mode |
|-----|-----------|
| `/documents` | Overview: Company + Projects |
| `/documents?jobId=<id>` | Job project filesystem only |

### 6.2 Overview mode (no job)

Update `documents/page.tsx` + `FilesystemView` / `FilesystemBrowser`:

- Fetch `GET /filesystems/overview` (and documents scoped accordingly, or lazy-load per node).
- Tree roots:
  - **Company** — expands to company categories (read-only root label, not a real category row).
  - **Projects** — children are jobs that have a project FS (job number/title); expand to that FS’s categories.
- Selecting a project job node may either expand in-place or navigate to `/documents?jobId=…` — **Recommendation:** navigate to job-scoped URL for parity with sidebar job context and simpler upload scoping.
- Uploads from overview: only allowed when a concrete category (under Company or a project) is selected; pass `filesystemId` / `jobId` as required by Phase 2 DTOs.

### 6.3 Job-scoped mode

- Fetch `GET /filesystems/jobs/:jobId` + documents for that FS.
- Render existing single-tree browser (categories of that FS only).
- Header: keep job/claim chrome (`EntityPageHeader`).
- Upload: always attach `related_record` Job + enforce categories in that FS.
- If FS 404: empty state + setup CTA (Phase 4.3).

### 6.4 Component refactor

- `FilesystemBrowser`: support `mode: 'overview' | 'single'` (or split `FilesystemOverviewBrowser` vs existing browser).
- Avoid loading all project category trees at once if tenants have many jobs — overview can list project nodes and fetch a tree on expand (`GET /filesystems/jobs/:jobId`).

### 6.5 Admin vs ops

- Ops `/documents` — overview / job-scoped as above.
- Admin Document Categories — company FS editor only (unchanged purpose).
- Optional later: per-job category admin from job Documents view (out of scope unless needed).

---

## Phase 7 — Polish, Tests, Documentation

### 7.1 Tests

| Layer | Cases |
|-------|--------|
| Unit / integration | Kind/job check constraints; cannot create second company FS; cannot create second project FS for same job; wrong template kind rejected |
| Service | Instantiate company/project; overview assembly; document upload scoped to FS |
| Job create | Template default cascade; transactional FS create |
| Migration | Existing tenant → company kind; defaults populated |

### 7.2 Docs

- Update [39_FILESYSTEM_MODULE.md](./39_FILESYSTEM_MODULE.md) overview: strike “one filesystem per org”; link here.
- Seed README: document company vs project default flags.
- Operator note: backfill command for Phase 5.

### 7.3 Observability

Log prefix pattern: `[FilesystemService.<method>]`, `[JobsService.create]`, `[ProvisioningService.stepFilesystemSetup]` with `tenantId`, `jobId`, `filesystemId`, `templateId`.

---

## API Contract Summary (target)

```http
GET  /filesystems/company
GET  /filesystems/jobs/:jobId
GET  /filesystems/overview
POST /filesystems/setup                    # company; body: { templateId }
POST /filesystems/setup-default            # platform company default
POST /filesystems/jobs/:jobId/setup        # body: { templateId? }

GET  /filesystem-templates?kind=company|project

PATCH /organizations/filesystem-defaults   # { defaultCompanyTemplateId?, defaultProjectTemplateId? }

POST /jobs                                 # body includes filesystemTemplateId?
GET  /documents?filesystemId=… | jobId=…
POST /documents/upload-url                 # categoryId + optional jobId / filesystemId
```

Exact path nesting should follow existing Nest module conventions under `filesystem` / `organizations` / `jobs` controllers.

---

## Frontend Surfaces Checklist

| Surface | Change |
|---------|--------|
| Provisioning | Dual template pickers |
| Job create form | Project template picker |
| `/documents` | Overview vs job-scoped |
| Sidebar Documents link | Already passes `jobId` — ensure page respects it |
| Admin Document Categories | Company-only; show project default preference |
| Admin Filesystem Templates | Already split company/project — verify copy matches behaviour |
| API client + BFF routes | New endpoints |

---

## Migration & Rollout Plan

1. Deploy Phase 1 migration (expand schema; backfill company kind + org defaults). **Compatible** with old API briefly if `GET /filesystems` still returns company FS.
2. Deploy Phase 2 API; keep deprecated `GET /filesystems` → company for one release.
3. Deploy Phase 3–4 (provisioning + job create).
4. Run Phase 5 backfill for existing jobs **before** or **with** Phase 6 UI (so Projects node is populated).
5. Deploy Phase 6 UI.
6. Remove deprecated single-FS helpers once unused.

Rollback: schema additive + relaxed unique is hard to reverse after project FS rows exist; prefer feature-flag the overview UI if needed (`FILESYSTEM_MULTI_INSTANCE=true`) while API supports both.

---

## GCS / Storage Notes (unchanged principles)

Aligned with shared-bucket multi-tenant design:

1. One documents bucket per environment.
2. Keys: `tenants/{tenantId}/documents/{documentId}/…` (no folder-name mirroring).
3. AuthZ in API before signed/resumable URLs.
4. Soft archive via `archived_at`; hard delete remains explicit.
5. Optional later: include `filesystemId` in object metadata (not path) for ops debugging.

---

## Success Criteria

- [ ] New org can select company + default project templates during provisioning; company FS exists afterward; defaults stored.
- [ ] New job prompts for (or defaults) a project template and creates a linked project FS with categories/pipelines.
- [ ] `/documents` without job shows Company + Projects.
- [ ] `/documents?jobId=` shows only that job’s project filesystem.
- [ ] Category rename/move still does not touch GCS objects.
- [ ] Existing tenants keep their current folders as the company filesystem after migration.
- [ ] Historical jobs get a project FS via backfill or first-open setup.

---

## Open Questions (resolve in Phase 0)

1. **Job create without template UI on mobile/API-only clients** — always fall back to org default?
2. **Cross-FS document move** — forbidden (recommended) or copy metadata + keep GCS object?
3. **Project node label** — job number, claim ref, or custom FS `name`?
4. **Archived jobs** — hide under Projects, show muted, or omit until unarchived?
5. **Feature flag** for overview UI during rollout?

Record decisions in this doc’s Phase 0 checklist when answered.
