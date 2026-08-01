# 39 — Filesystem Module

> Virtual folder/category hierarchy backed by GCP Cloud Storage (native `@google-cloud/storage` SDK with ADC)
> Modelled after `data_cloud/apps/mortgage-ui` filesystem implementation

## Overview

Add a **document filesystem** to Claims Manager — a virtual category tree (per-tenant) that organises uploaded documents. File bytes are stored in GCS via the native `@google-cloud/storage` SDK using Application Default Credentials (ADC); metadata and folder structure live in PostgreSQL via Drizzle.

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Storage SDK | `@google-cloud/storage` (native GCS) | Matches data_cloud pattern; resumable uploads; no HMAC keys |
| Auth | Application Default Credentials (ADC) | `gcloud auth application-default login` locally; Workload Identity in prod |
| Folder model | Virtual tree in DB (`filesystem_category`) | Decouples logical organisation from physical storage |
| Upload strategy | GCS resumable upload URLs (direct-to-GCS) | Eliminates API as file proxy; supports large files; built-in retry |
| Tenant isolation | GCS key prefix per `tenant_id` + DB FK scoping | Consistent with existing multi-tenant patterns |
| Template system | Tenant-scoped blueprints copied to org instances | Enables consistent folder structures across tenants |

---

## Phase 1 — Database Schema & Migration

### 1.1 New Tables

```sql
-- Filesystem templates (admin-defined blueprints)
CREATE TABLE filesystem_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Template category tree
CREATE TABLE filesystem_template_category (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES filesystem_template(id) ON DELETE CASCADE,
  parent_category_id UUID REFERENCES filesystem_template_category(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  slug TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-tenant filesystem instance (one per org)
CREATE TABLE filesystem (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES organizations(id),
  name TEXT NOT NULL DEFAULT 'Documents',
  source_template_id UUID REFERENCES filesystem_template(id),
  copied_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Category tree for the org filesystem
CREATE TABLE filesystem_category (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filesystem_id UUID NOT NULL REFERENCES filesystem(id) ON DELETE CASCADE,
  parent_category_id UUID REFERENCES filesystem_category(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  slug TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Document metadata
CREATE TABLE document (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES organizations(id),
  filesystem_category_id UUID REFERENCES filesystem_category(id) ON SET NULL,
  related_record_type TEXT,
  related_record_id UUID,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT,
  gcs_bucket TEXT NOT NULL,
  gcs_object_path TEXT NOT NULL,
  uri TEXT,
  thumbnail_uri TEXT,
  upload_status TEXT NOT NULL DEFAULT 'pending',
  source_system TEXT NOT NULL DEFAULT 'claims-manager',
  uploaded_by_user_id TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_tenant ON document(tenant_id);
CREATE INDEX idx_document_category ON document(filesystem_category_id);
CREATE INDEX idx_document_related ON document(tenant_id, related_record_type, related_record_id);
CREATE INDEX idx_document_status ON document(tenant_id, upload_status);
```

### 1.2 Category Config JSON Schema

```typescript
interface CategoryConfig {
  color?: string | null;    // hex or tailwind colour token
  icon?: string | null;     // lucide icon name
  retentionDays?: number | null;
  allowedMimeTypes?: string[] | null;
}
```

### 1.3 Drizzle Schema Additions

File: `apps/api/src/database/schema/index.ts`

Add Drizzle table definitions mirroring the SQL above, following existing patterns (`uuid().primaryKey().defaultRandom()`, tenant FK, timestamps).

### 1.4 Migration File

Generate via `pnpm --filter api db:generate` → produces sequential migration in `migrations-drizzle/`.

---

## Phase 2 — API Module (NestJS)

### 2.1 Module Structure

```
apps/api/src/modules/filesystem/
├── filesystem.module.ts
├── filesystem.controller.ts          # /api/v1/filesystems
├── filesystem.service.ts
├── filesystem-templates.controller.ts # /api/v1/filesystem-templates
├── filesystem-templates.service.ts
├── documents.controller.ts           # /api/v1/documents
├── documents.service.ts
└── dto/
    ├── create-filesystem-template.dto.ts
    ├── update-filesystem-template.dto.ts
    ├── setup-filesystem.dto.ts
    ├── update-category.dto.ts
    ├── create-document-upload-url.dto.ts
    ├── upload-complete.dto.ts
    └── index.ts
```

### 2.2 Filesystem Templates Controller

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/filesystem-templates` | List templates for tenant |
| POST | `/filesystem-templates` | Create template |
| GET | `/filesystem-templates/:id` | Get template with categories |
| PUT | `/filesystem-templates/:id` | Update template metadata |
| DELETE | `/filesystem-templates/:id` | Archive template |
| PUT | `/filesystem-templates/:id/categories` | Replace full category tree |

### 2.3 Filesystem Controller

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/filesystems` | Get org filesystem + category tree |
| POST | `/filesystems/setup` | Create org filesystem from template |
| PUT | `/filesystems/:id` | Update filesystem name |
| PUT | `/filesystems/:id/categories` | Replace full category tree |
| POST | `/filesystems/:id/categories` | Add single category |
| PATCH | `/filesystems/:id/categories/:categoryId` | Update category |
| DELETE | `/filesystems/:id/categories/:categoryId` | Archive category |

### 2.4 Documents Controller

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/documents` | List documents (pagination, filter by category/uncategorised/search) |
| GET | `/documents/:id` | Get single document |
| POST | `/documents/upload-url` | Generate presigned upload URL (single) |
| POST | `/documents/upload-urls` | Generate batch presigned upload URLs |
| POST | `/documents/upload-complete` | Mark upload as complete |
| POST | `/documents/upload-failed` | Mark upload as failed |
| PATCH | `/documents/:id/category` | Assign document to category |
| POST | `/documents/bulk-category` | Bulk assign documents to category |
| GET | `/documents/:id/download-url` | Get presigned download URL |
| GET | `/documents/:id/thumbnail` | Get thumbnail URL or proxy |
| POST | `/documents/:id/archive` | Soft delete (archive) |
| DELETE | `/documents/:id` | Hard delete (GCS + DB) |

### 2.5 Document Service — Upload Flow

```
1. Client → POST /documents/upload-url
   Body: { fileName, mimeType, fileSizeBytes, relatedRecordType?, relatedRecordId?, categoryId? }

2. Service:
   a. Validate MIME type against allowlist
   b. Generate documentId (UUID)
   c. Build GCS key: `tenants/{tenantId}/documents/{documentId}/{safeFileName}`
   d. Create presigned PUT URL (S3Service.getSignedUploadUrl)
   e. Insert document row with upload_status='pending'
   f. Return { documentId, uploadUrl, key }

3. Client uploads directly to GCS via PUT to presigned URL

4. Client → POST /documents/upload-complete
   Body: { documentId }

5. Service:
   a. Update upload_status to 'completed'
   b. Optionally verify object exists in GCS (HEAD request)
   c. Return updated document
```

### 2.6 GCS Object Key Convention

```
tenants/{tenantId}/documents/{documentId}/{safeFileName}
tenants/{tenantId}/documents/{documentId}/thumbnail.png
```

### 2.7 S3 Service Enhancements

Extend existing `S3Service` (or create a dedicated `DocumentStorageService`) with:

- `generateUploadUrl(bucket, key, contentType, expiresIn)` — presigned PUT
- `generateDownloadUrl(bucket, key, expiresIn)` — presigned GET
- `deleteObject(bucket, key)` — for hard delete
- `deletePrefix(bucket, prefix)` — delete all objects under a document prefix
- `headObject(bucket, key)` — verify upload exists

A separate config namespace (`s3.documentsBucket`) will allow using a different bucket from the payload archive bucket.

### 2.8 Config Additions

```env
# Document storage (GCS via S3-compatible HMAC)
S3_DOCUMENTS_BUCKET=claims-manager-documents
S3_UPLOAD_URL_EXPIRY=600
S3_DOWNLOAD_URL_EXPIRY=900
```

Add to `apps/api/src/config/s3.config.ts`:
```typescript
documentsBucket: process.env.S3_DOCUMENTS_BUCKET || 'claims-manager-documents',
uploadUrlExpiry: parseInt(process.env.S3_UPLOAD_URL_EXPIRY || '600', 10),
downloadUrlExpiry: parseInt(process.env.S3_DOWNLOAD_URL_EXPIRY || '900', 10),
```

### 2.9 Repository Layer

```
apps/api/src/database/repositories/
├── filesystem.repository.ts
├── filesystem-template.repository.ts
└── document.repository.ts
```

Each repository:
- Injects `DRIZZLE` token
- Scopes all queries by `tenantId`
- Follows existing patterns in `journals.repository.ts`

---

## Phase 3 — Frontend (Next.js)

### 3.1 Pages

```
apps/frontend/src/app/(app)/
├── documents/
│   └── page.tsx                    # Main documents page with filesystem view
└── admin/
    └── filesystems/
        └── page.tsx                # Filesystem settings (templates, categories)
```

### 3.2 Components

```
apps/frontend/src/components/filesystem/
├── FilesystemView.tsx              # Main layout: tree sidebar + document grid
├── FilesystemBrowser.tsx           # Category tree with drag-and-drop
├── CategoryTreeEditor.tsx          # Editable category tree (settings)
├── FilesystemSettingsPanel.tsx     # Setup/manage filesystem
└── FilesystemTemplateDrawer.tsx    # Create/edit templates

apps/frontend/src/components/documents/
├── DocumentsGrid.tsx               # Tile/list view of documents
├── DocumentUploadDrawer.tsx        # Upload UI with drop zone
├── DocumentDropZone.tsx            # Drag-and-drop upload area
├── DocumentCard.tsx                # Document tile with thumbnail
└── DocumentsToolbar.tsx            # Search, filter, layout toggle
```

### 3.3 Upload Library

```
apps/frontend/src/lib/upload/
├── upload-engine.ts                # Queue-based upload orchestrator
├── resumable-upload.ts             # Chunked upload with retry (8MB chunks)
├── use-document-upload.ts          # React hook wrapping upload engine
├── validation.ts                   # MIME type + size validation
├── thumbnail-generator.ts          # Client-side thumbnail from images/PDFs
└── types.ts                        # Upload state types
```

**Upload flow:**
1. User drops files → validate (type, size)
2. Generate client-side thumbnail (for images)
3. Call `POST /api/documents/upload-urls` (Next.js BFF route)
4. BFF forwards to NestJS API with auth token
5. Upload directly to GCS via presigned URL (chunked/resumable for large files)
6. On success → call `POST /api/documents/upload-complete`
7. Refresh document list

### 3.4 BFF API Routes (Next.js)

```
apps/frontend/src/app/api/documents/
├── upload-url/route.ts             # Single upload URL proxy
├── upload-urls/route.ts            # Batch upload URLs proxy
├── upload-complete/route.ts        # Mark upload complete
├── [id]/route.ts                   # Archive (soft delete)
├── [id]/download/route.ts          # Redirect to signed download URL
├── [id]/permanent-delete/route.ts  # Hard delete
└── thumbnail/route.ts              # Thumbnail proxy/redirect
```

### 3.5 API Client Additions

Add to `apps/frontend/src/lib/api-client.ts`:

```typescript
// Filesystem
getFilesystem(): Promise<Filesystem>
setupFilesystem(templateId: string): Promise<Filesystem>
updateCategory(fsId: string, categoryId: string, data: UpdateCategoryDto): Promise<Category>
// ... template methods

// Documents
getDocuments(params: DocumentListParams): Promise<PaginatedResponse<Document>>
getDocumentUploadUrl(data: UploadUrlRequest): Promise<UploadUrlResponse>
getDocumentUploadUrls(data: BatchUploadUrlRequest): Promise<BatchUploadUrlResponse>
markUploadComplete(documentId: string): Promise<Document>
assignDocumentCategory(documentId: string, categoryId: string | null): Promise<Document>
bulkAssignCategory(documentIds: string[], categoryId: string | null): Promise<void>
getDocumentDownloadUrl(documentId: string): Promise<{ url: string }>
archiveDocument(documentId: string): Promise<void>
deleteDocument(documentId: string): Promise<void>
```

### 3.6 UI Features

| Feature | Component | Description |
|---------|-----------|-------------|
| Category tree sidebar | `FilesystemBrowser` | Expandable tree, click to filter, drag-drop to assign |
| Document grid | `DocumentsGrid` | Tile/list toggle, shows filename + thumbnail + metadata |
| Drag-and-drop upload | `DocumentDropZone` | Full-page drop target + click-to-browse |
| Upload progress | `DocumentUploadDrawer` | Queued uploads with progress bars |
| Category management | `CategoryTreeEditor` | Add/rename/reorder/delete categories in settings |
| Bulk operations | `DocumentsToolbar` | Multi-select → move to category / delete |
| Search & filter | `DocumentsToolbar` | Full-text search + MIME type filter + date range |

---

## Phase 4 — Infrastructure & DevOps

### 4.1 GCS Bucket Provisioning

Add to `deploy/terraform/modules/gcs/`:

```hcl
resource "google_storage_bucket" "documents" {
  name          = "${var.project_id}-documents"
  location      = var.region
  storage_class = "STANDARD"
  uniform_bucket_level_access = true

  cors {
    origin          = var.upload_cors_origins
    method          = ["GET", "PUT", "HEAD", "OPTIONS"]
    response_header = ["Content-Type", "Content-Length", "Content-Range"]
    max_age_seconds = 3600
  }

  lifecycle_rule {
    condition { age = 1 }
    action { type = "AbortIncompleteMultipartUpload" }
  }
}

resource "google_storage_hmac_key" "documents" {
  service_account_email = var.api_service_account_email
}
```

### 4.2 CORS Configuration

GCS bucket CORS must allow:
- Origins: frontend URL(s)
- Methods: `PUT`, `GET`, `HEAD`, `OPTIONS`
- Headers: `Content-Type`, `Content-Length`, `x-goog-content-length-range`

### 4.3 Local Dev (MinIO)

Already available via `docker-compose.yml` — add a `documents` bucket to MinIO initialization:

```yaml
minio-init:
  entrypoint: >
    /bin/sh -c "
    mc alias set local http://minio:9000 sail password;
    mc mb --ignore-existing local/claims-manager;
    mc mb --ignore-existing local/claims-manager-documents;
    "
```

### 4.4 Kubernetes Config

Add environment variables to API deployment:
```yaml
- name: S3_DOCUMENTS_BUCKET
  value: "claims-manager-documents"
- name: S3_ENDPOINT
  value: "https://storage.googleapis.com"
- name: S3_FORCE_PATH_STYLE
  value: "false"
```

---

## Phase 5 — Permissions & Security

### 5.1 Permission Constants

Add to auth permission constants:

```typescript
filesystems: {
  read: 'filesystems.read',
  manage: 'filesystems.manage',
},
documents: {
  read: 'documents.read',
  create: 'documents.create',
  update: 'documents.update',
  delete: 'documents.delete',
},
```

### 5.2 Upload Validation

- **MIME type allowlist**: images (`image/*`), PDFs, MS Office, common document types
- **File size limit**: configurable per-category or global (default 50MB)
- **Filename sanitisation**: strip path separators, control chars, limit length

### 5.3 Presigned URL Security

- Upload URLs expire after 10 minutes (configurable)
- Download URLs expire after 15 minutes (configurable)
- URLs are single-use (PUT/GET only, scoped to exact key)
- Tenant isolation enforced by key prefix (`tenants/{tenantId}/...`)

---

## Phase 6 — Entity Integration

### 6.1 Polymorphic Document Linking

Documents can be associated with any entity via `related_record_type` + `related_record_id`:
- Claims, Jobs, Quotes, Purchase Orders, Invoices, etc.
- Enables "Attached Documents" section on any entity detail page

### 6.2 Entity Detail Panels

Add a `DocumentsPanel` component that:
- Receives `relatedRecordType` and `relatedRecordId` as props
- Fetches documents filtered by those params
- Supports upload (auto-associates with entity)
- Allows drag-drop to/from filesystem categories

### 6.3 Attachment Migration Path

Existing `attachments` table (Crunchwork-proxied) remains unchanged. The new `document` table is for tenant-owned files stored in GCS. A future migration can link or merge the two.

---

## Implementation Order

| Step | Phase | Effort | Dependencies |
|------|-------|--------|--------------|
| 1 | Schema + migration | 1 day | None |
| 2 | Repository layer | 0.5 day | Step 1 |
| 3 | Documents service + controller | 1 day | Step 2 |
| 4 | S3Service enhancements | 0.5 day | None (parallel with 1-2) |
| 5 | Filesystem service + controller | 1 day | Step 2 |
| 6 | Template service + controller | 0.5 day | Step 2 |
| 7 | Config + local dev (MinIO bucket) | 0.5 day | Step 4 |
| 8 | Frontend upload library | 1.5 days | Step 3 |
| 9 | BFF routes (Next.js) | 0.5 day | Step 3 |
| 10 | Documents page + grid | 1 day | Steps 8, 9 |
| 11 | Filesystem browser (tree UI) | 1 day | Steps 5, 10 |
| 12 | Settings/admin UI | 0.5 day | Steps 5, 6 |
| 13 | Entity integration panels | 1 day | Step 10 |
| 14 | Terraform + K8s config | 0.5 day | Step 7 |
| 15 | Permissions integration | 0.5 day | Steps 3, 5 |

**Total estimated effort: ~11 days**

---

## File Checklist

### API (`apps/api/`)
- [ ] `src/database/schema/index.ts` — add filesystem/document tables
- [ ] `src/database/migrations-drizzle/00XX_filesystem_module.sql`
- [ ] `src/database/repositories/filesystem.repository.ts`
- [ ] `src/database/repositories/filesystem-template.repository.ts`
- [ ] `src/database/repositories/document.repository.ts`
- [ ] `src/modules/filesystem/filesystem.module.ts`
- [ ] `src/modules/filesystem/filesystem.controller.ts`
- [ ] `src/modules/filesystem/filesystem.service.ts`
- [ ] `src/modules/filesystem/filesystem-templates.controller.ts`
- [ ] `src/modules/filesystem/filesystem-templates.service.ts`
- [ ] `src/modules/filesystem/documents.controller.ts`
- [ ] `src/modules/filesystem/documents.service.ts`
- [ ] `src/modules/filesystem/dto/*.ts`
- [ ] `src/common/s3/s3.service.ts` — extend with delete, head, documents bucket
- [ ] `src/config/s3.config.ts` — add documents bucket config

### Frontend (`apps/frontend/`)
- [ ] `src/app/(app)/documents/page.tsx`
- [ ] `src/app/(app)/admin/filesystems/page.tsx`
- [ ] `src/app/api/documents/upload-url/route.ts`
- [ ] `src/app/api/documents/upload-urls/route.ts`
- [ ] `src/app/api/documents/upload-complete/route.ts`
- [ ] `src/app/api/documents/[id]/route.ts`
- [ ] `src/app/api/documents/[id]/download/route.ts`
- [ ] `src/app/api/documents/[id]/permanent-delete/route.ts`
- [ ] `src/app/api/documents/thumbnail/route.ts`
- [ ] `src/components/filesystem/FilesystemView.tsx`
- [ ] `src/components/filesystem/FilesystemBrowser.tsx`
- [ ] `src/components/filesystem/CategoryTreeEditor.tsx`
- [ ] `src/components/filesystem/FilesystemSettingsPanel.tsx`
- [ ] `src/components/filesystem/FilesystemTemplateDrawer.tsx`
- [ ] `src/components/documents/DocumentsGrid.tsx`
- [ ] `src/components/documents/DocumentUploadDrawer.tsx`
- [ ] `src/components/documents/DocumentDropZone.tsx`
- [ ] `src/components/documents/DocumentCard.tsx`
- [ ] `src/components/documents/DocumentsToolbar.tsx`
- [ ] `src/lib/upload/upload-engine.ts`
- [ ] `src/lib/upload/resumable-upload.ts`
- [ ] `src/lib/upload/use-document-upload.ts`
- [ ] `src/lib/upload/validation.ts`
- [ ] `src/lib/upload/thumbnail-generator.ts`
- [ ] `src/lib/upload/types.ts`
- [ ] `src/lib/api-client.ts` — extend with filesystem/document methods

### Infrastructure (`deploy/`)
- [ ] `deploy/terraform/modules/gcs/documents.tf`
- [ ] `deploy/k8s/base/api-server/deployment.yaml` — env vars
- [ ] `docker-compose.yml` — MinIO documents bucket init

---

## Dev Environment Setup (GCS)

### Prerequisites

1. **GCP CLI** — install `gcloud` from https://cloud.google.com/sdk/docs/install
2. **Terraform** >= 1.3.0

### One-time GCP project setup

```bash
# Create the dev project (skip if already exists)
gcloud projects create claims-manager-dev-493807 \
  --name="Claims Manager Dev"

# Enable Cloud Storage API
gcloud services enable storage.googleapis.com \
  --project=claims-manager-dev-493807

# Link a billing account (required for GCS)
gcloud billing projects link claims-manager-dev-493807 \
  --billing-account=YOUR_BILLING_ACCOUNT_ID

# Authenticate for local development (ADC)
gcloud auth application-default login
```

### Provision GCS bucket via Terraform

```bash
cd deploy/terraform/environments/dev
terraform init
terraform plan
terraform apply
```

This creates `claims-manager-dev-documents` with CORS configured for `http://localhost:5002`.

### API environment variables

Copy `apps/api/.env.example` to `apps/api/.env` and ensure these are set:

```env
GCP_PROJECT_ID=claims-manager-dev-493807
GCS_DOCUMENTS_BUCKET=claims-manager-dev-documents
GCS_UPLOAD_CORS_ORIGIN=http://localhost:5002
GCS_DOWNLOAD_URL_EXPIRY=900
```

### ADC signed URL limitation

Application Default Credentials (user account) cannot sign URLs because there is no `client_email` / private key. The API handles this gracefully:
- **Uploads** work normally (resumable upload URLs are created server-side, not signed)
- **Downloads** fall back to a stream proxy through the API instead of a signed URL redirect

In production (Workload Identity / service account), signed download URLs work natively.

### Refreshing credentials

If you see `credentials expired` errors, re-run:

```bash
gcloud auth application-default login
```

Then restart the API server.

---

## Open Questions

1. **Max file size** — What's the upper bound? Resumable upload handles arbitrary sizes, but we should cap for cost control (50MB? 200MB?).
2. **Thumbnail generation** — Client-side only (images/PDFs) or server-side pipeline for other formats?
3. **Retention policies** — Auto-delete archived documents from GCS after N days?
4. **Template scope** — Templates per-tenant or globally shared (admin-defined)?
5. **Existing attachments** — Should Crunchwork-sourced attachments appear in the filesystem browser (read-only) or remain separate?
