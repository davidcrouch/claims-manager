# 55c — Document Upload Event Wiring

**Gap addressed:** W4 (`document.uploaded` not emitted on general document upload)

## Problem

The works ASL's `WaitForCompletionCertificate` state listens for:
```json
{
  "eventType": "document.uploaded",
  "filter": { "documentType": "Completion Certificate" }
}
```

`OutboundEventsService.emitDocumentUploaded()` exists and accepts `documentType`, but it is **only called from `AssessmentsService.publish()`** for "Assessment Report" documents.

The general document upload flow (`DocumentsService.markUploadComplete()`) has no event emission. When a user uploads a Completion Certificate via the standard document upload path, the works workflow's `WaitForCompletionCertificate` state will never receive the event — the workflow blocks permanently.

## Solution

### 1. Emit `document.uploaded` from `DocumentsService.markUploadComplete()`

**File:** `apps/api/src/modules/filesystem/documents.service.ts`
**Method:** `markUploadComplete`

After the upload is verified and the document record updated, resolve the document's category name and emit the event if the document is related to a job.

The `documentType` for the event payload is derived from the document's filesystem category name (e.g. "Completion Certificate", "Invoice", "Report"). Documents without a category or without a job relation are skipped.

```typescript
async markUploadComplete(documentId: string, thumbnailObjectPath?: string) {
  // ... existing verification and update logic ...

  // Emit document.uploaded event for workflow automation
  if (this.outboundEvents && doc.relatedRecordType === 'Job' && doc.relatedRecordId) {
    const documentType = await this.resolveCategoryName(doc.filesystemCategoryId);
    if (documentType) {
      this.outboundEvents.emitDocumentUploaded({
        documentId,
        jobId: doc.relatedRecordId,
        tenantId,
        documentType,
        uploadedAt: new Date().toISOString(),
      }).catch(() => {});
    }
  }

  return withPipeline ?? updated;
}
```

### 2. Also emit on category assignment

When a document is uploaded without a category and later assigned one (via `assignCategory`), the event should also fire.

**Method:** `assignCategory`

```typescript
async assignCategory(documentId: string, categoryId: string | null) {
  // ... existing logic ...

  // Emit document.uploaded if this assignment gives the doc a workflow-relevant type
  if (this.outboundEvents && categoryId && doc.relatedRecordType === 'Job' && doc.relatedRecordId) {
    const documentType = await this.resolveCategoryName(categoryId);
    if (documentType) {
      this.outboundEvents.emitDocumentUploaded({
        documentId,
        jobId: doc.relatedRecordId,
        tenantId,
        documentType,
        uploadedAt: new Date().toISOString(),
      }).catch(() => {});
    }
  }
}
```

### 3. Helper: resolve category name

```typescript
private async resolveCategoryName(categoryId: string | null | undefined): Promise<string | null> {
  if (!categoryId) return null;
  const cat = await this.filesystemsRepo.findCategoryById(categoryId);
  return cat?.name ?? null;
}
```

### 4. Inject `OutboundEventsService`

Add `OutboundEventsService` as an `@Optional()` dependency to `DocumentsService`.

## Files Changed

| File | Repo | Change |
|------|------|--------|
| `apps/api/src/modules/filesystem/documents.service.ts` | claims-manager | Emit `document.uploaded` on markUploadComplete + assignCategory |
| `apps/api/src/modules/filesystem/filesystem.module.ts` | claims-manager | Add OutboundEventsService to providers/imports if needed |

## Testing

1. Upload a document to a job with category "Completion Certificate" → verify `document.uploaded` event emitted with `documentType: "Completion Certificate"`.
2. Upload a document without category → verify no event. Then assign category "Completion Certificate" → verify event emits.
3. Upload a document to a non-job context → verify no event.
4. Integration: works workflow at `WaitForCompletionCertificate` → upload doc with "Completion Certificate" category → verify ASL transitions to `OnCertificateUploaded`.
