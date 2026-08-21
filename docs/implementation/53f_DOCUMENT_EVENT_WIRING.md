# 53f — Document Event Wiring

**Gaps addressed:** G7 (document.uploaded never called), G8 (assessment publish no outbound event)

## Problem

1. `emitDocumentUploaded` exists on `OutboundEventsService` but is never called from any service.
2. When an assessment is published (via `AssessmentsService.publish`), it calls Crunchwork to create/update a report but does not emit any event to more0-ensure.

While the current ASL doesn't block on `document.uploaded`, wiring it completes the event surface and enables future workflow steps that validate document upload before allowing quote submission.

## Solution

### 1. Emit `document.uploaded` on assessment publish

**File:** `apps/api/src/modules/assessments/assessments.service.ts`

After successfully publishing the assessment to Crunchwork, emit the event:

```typescript
async publish(params: { id: string; userId?: string }) {
  // ... existing publish logic that creates/updates the CW report ...

  // After successful CW publish and local DB update:
  if (this.outboundEvents && assessment.jobId) {
    this.outboundEvents.emitDocumentUploaded({
      documentId: params.id,
      jobId: assessment.jobId,
      tenantId,
      documentType: 'Assessment Report',
      uploadedAt: new Date().toISOString(),
    }).catch(() => {});
  }

  return updated;
}
```

### 2. Inject `OutboundEventsService` into `AssessmentsService`

```typescript
import { OutboundEventsService } from '../outbound-events/outbound-events.service';

@Injectable()
export class AssessmentsService {
  constructor(
    // ... existing deps
    @Optional() private readonly outboundEvents?: OutboundEventsService,
  ) {}
}
```

### 3. Update `AssessmentsModule` imports

```typescript
import { OutboundEventsModule } from '../outbound-events/outbound-events.module';

@Module({
  imports: [/* existing */, OutboundEventsModule],
  // ...
})
export class AssessmentsModule {}
```

### 4. (Optional) Emit on generic attachment upload

If there's a general attachment upload service, also wire `document.uploaded` there for non-assessment document types. This is lower priority but completes the event coverage.

**File:** `apps/api/src/modules/attachments/attachments.service.ts` (if it exists)

```typescript
if (this.outboundEvents && attachment.jobId) {
  this.outboundEvents.emitDocumentUploaded({
    documentId: attachment.id,
    jobId: attachment.jobId,
    tenantId,
    documentType: attachment.documentType ?? 'Attachment',
    uploadedAt: new Date().toISOString(),
  }).catch(() => {});
}
```

## Files Changed

| File | Repo | Change |
|------|------|--------|
| `apps/api/src/modules/assessments/assessments.service.ts` | claims-manager | Inject OutboundEventsService, emit on publish |
| `apps/api/src/modules/assessments/assessments.module.ts` | claims-manager | Import OutboundEventsModule |

## Testing

1. Publish an assessment → verify `document.uploaded` event emitted with `documentType: 'Assessment Report'`.
2. Verify the event payload contains `jobId`, `documentId`, `uploadedAt`.
3. Verify existing assessment publish flow still works (no regressions in Crunchwork sync).
