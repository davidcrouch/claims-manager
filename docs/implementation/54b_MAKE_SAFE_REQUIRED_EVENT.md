# 54b — Make Safe Required Field Event

**Gap addressed:** G3 (`field.updated` not emitted for top-level `makeSafeRequired` column changes)

## Problem

The make-safe ASL's cancellation path listens for:
```json
{
  "eventType": "field.updated",
  "filter": { "field": "makeSafeRequired", "value": false }
}
```

This event is emitted by `JobsService.update` — but only when `makeSafeRequired` is set via `params.body.customData`:

```typescript
// jobs.service.ts lines 412–428
if (this.outboundEvents && params.body.customData) {
  const custom = params.body.customData as Record<string, unknown>;
  const trackedFields = [
    'makeSafeRequired', 'scopeSignedDate', 'excessPaymentCollected',
    'workflowPhase', 'estimatedDatesSet', 'dateCustomerConfirmedCompletion',
  ];
  for (const field of trackedFields) {
    if (custom[field] !== undefined) {
      this.outboundEvents.emitFieldUpdated({ ... }).catch(() => {});
    }
  }
}
```

However, `makeSafeRequired` also exists as a **top-level column** on the `jobs` table (mapped in `buildUpdateFromBody` at line 737):
```typescript
if (body.makeSafeRequired !== undefined)
  data.makeSafeRequired = body.makeSafeRequired as boolean;
```

When a user or Crunchwork sync sets the top-level `makeSafeRequired = false` (not via `customData`), **no `field.updated` event is emitted**. The ASL cancellation path never triggers and the workflow is stuck.

## Solution

### 1. Detect top-level `makeSafeRequired` changes in `JobsService.update`

**File:** `apps/api/src/modules/jobs/jobs.service.ts`
**Method:** `update`

After the database transaction, compare the old and new values of the top-level `makeSafeRequired` field and emit `field.updated` if it changed.

Add the following block after the existing `customData` field tracking (after line 429):

```typescript
// Emit field.updated for top-level makeSafeRequired column changes
if (this.outboundEvents && params.body.makeSafeRequired !== undefined) {
  const oldValue = existing.makeSafeRequired;
  const newValue = params.body.makeSafeRequired as boolean;

  if (oldValue !== newValue) {
    const tenantId = this.tenantContext.getTenantId();
    this.outboundEvents.emitFieldUpdated({
      entityType: 'job',
      entityId: params.id,
      tenantId,
      field: 'makeSafeRequired',
      value: newValue,
      previousValue: oldValue,
    }).catch(() => {});
  }
}
```

### 2. Guard against double emission

When both `params.body.makeSafeRequired` and `params.body.customData.makeSafeRequired` are set in the same update call, the event could fire twice. Add a dedup guard:

```typescript
// Track whether field.updated was already emitted for this field
const emittedFields = new Set<string>();

// Existing customData tracking (lines 412-428)
if (this.outboundEvents && params.body.customData) {
  const custom = params.body.customData as Record<string, unknown>;
  const trackedFields = [ ... ];
  for (const field of trackedFields) {
    if (custom[field] !== undefined) {
      emittedFields.add(field);
      this.outboundEvents.emitFieldUpdated({ ... }).catch(() => {});
    }
  }
}

// Top-level column tracking — only if not already emitted via customData
if (
  this.outboundEvents &&
  params.body.makeSafeRequired !== undefined &&
  !emittedFields.has('makeSafeRequired')
) {
  const oldValue = existing.makeSafeRequired;
  const newValue = params.body.makeSafeRequired as boolean;
  if (oldValue !== newValue) {
    this.outboundEvents.emitFieldUpdated({
      entityType: 'job',
      entityId: params.id,
      tenantId,
      field: 'makeSafeRequired',
      value: newValue,
      previousValue: oldValue,
    }).catch(() => {});
  }
}
```

### 3. Verify Crunchwork inbound sync path

When Crunchwork updates a job via the inbound webhook projection, the `makeSafeRequired` field may be updated through the projection pipeline rather than the REST `update` endpoint. Verify that this path also flows through `JobsService.update` (or an equivalent method that emits the event).

If the projection pipeline bypasses `JobsService.update` and writes directly to the repository, add the same event emission in the projection handler.

## Files Changed

| File | Repo | Change |
|------|------|--------|
| `apps/api/src/modules/jobs/jobs.service.ts` | claims-manager | Emit `field.updated` for top-level `makeSafeRequired` changes, dedup guard |

## Testing

1. Update a job's top-level `makeSafeRequired` to `false` via `PUT /jobs/:id { makeSafeRequired: false }` → verify `field.updated` event emitted with `{ field: "makeSafeRequired", value: false }`.
2. Update via `customData` path → verify event still emits (existing behavior preserved).
3. Update both paths simultaneously → verify only one event fires (dedup guard).
4. Set `makeSafeRequired` to same value it already has → verify no event emits.
5. Integration: start a make-safe workflow, then set `makeSafeRequired = false` via top-level field → verify ASL transitions to `CancelMakeSafe` → `MakeSafeCancelled`.
6. Test at each wait state: `WaitForContactOrSchedule`, `WaitForContactOrScheduleRetry`, `WaitForAppointmentScheduled`, `WaitForAttendanceDatePassed`.
