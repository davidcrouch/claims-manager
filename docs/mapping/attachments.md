# Attachment — CW ↔ internal mapping

**Internal table:** `attachments` (see `apps/api/src/database/schema/index.ts`)
**Transformer:** `apps/api/src/modules/domain/transformers/attachment.transformer.ts`

---

## 1. Destination categories

| Category | Target | Notes |
|---|---|---|
| Promoted column | explicit column on `attachments` | Queryable |
| Lookup FK | `document_type_lookup_id` | Resolved via lookup domain |
| JSONB bucket | `attachment_meta` | Category, tags, uploadedAt |
| `api_payload` | full CW response | Always stored; lossless fallback |

---

## 2. Scalar fields

| CW field | Internal column | Notes |
|---|---|---|
| `title` / `fileName` (fallback) | `title` | |
| `description` | `description` | |
| `fileName` | `file_name` | |
| `mimeType` | `mime_type` | |
| `fileSize` | `file_size` | `bigint` |
| `downloadUrl` / `fileUrl` | `file_url` | `downloadUrl` preferred |
| `createdBy.externalReference` | `created_by_user_id` | User who uploaded |
| `scope` / `relatedRecordType` | `related_record_type` | Normalised to PascalCase enum |

---

## 3. Lookup references

| CW field | Internal column | Lookup domain | If unresolved |
|---|---|---|---|
| `documentType` / `documentCategory` | `document_type_lookup_id` | `document_type` | Auto-create stub |

Object form: `{ id, name, externalReference }`.
String form: treated as both `externalReference` and `name`.

---

## 4. JSONB: `attachment_meta`

| CW field | JSONB key | Notes |
|---|---|---|
| `uploadedAt` | `attachment_meta.uploadedAt` | No dedicated column |
| `category` | `attachment_meta.category` | String category label |
| `tags` | `attachment_meta.tags` | `string[]` |

---

## 5. Parent references

| CW field | Entity type | Notes |
|---|---|---|
| `scopeId` / `relatedRecordId` | Derived from `scope` | Maps scope to entity type |

---

## 6. `api_payload`

The **entire** CW attachment response is stored in `attachments.api_payload` as the lossless fallback.

---

## 7. Gaps / not yet mapped

| CW field | Notes |
|---|---|
| `storageKey` | Set by storage layer, not transformer |
| `updatedByUserId` | Column exists but not yet extracted from CW payload |
| Thumbnail/preview URLs | Remain in `api_payload` only |
