# 55d — Estimated Dates Auto-Detection

**Gap addressed:** W5 (`estimatedDatesSet` has no auto-detection)

## Problem

The works ASL's `WaitForRepairsScheduled` state listens for:
```json
{
  "eventType": "field.updated",
  "filter": { "field": "estimatedDatesSet" }
}
```

The `estimatedDatesSet` field is tracked in `JobsService.update`'s `trackedFields` array, so changes to `customData.estimatedDatesSet` will emit `field.updated`. However, nothing **automatically sets** this flag when the user populates both `estimatedStartDate` and `estimatedCompletionDate`.

The Crunchwork workflow says: "Once both Estimated Start Date and Estimated Completion Date are populated → Works Scheduled Date is populated, Schedule Repairs task is completed."

Currently, the user/frontend must explicitly set `customData.estimatedDatesSet = true` as a separate step. This should be auto-detected.

## Solution

### 1. Auto-detect in `JobsService.update`

**File:** `apps/api/src/modules/jobs/jobs.service.ts`
**Method:** `update`

After the database transaction (where customData is merged), check if the update included either `estimatedStartDate` or `estimatedCompletionDate` in `customData`. If both are now populated, auto-set `estimatedDatesSet = true` and emit the event.

```typescript
if (this.outboundEvents && params.body.customData) {
  const custom = params.body.customData as Record<string, unknown>;

  // Auto-detect: both estimated dates populated → estimatedDatesSet
  if (
    (custom.estimatedStartDate || custom.estimatedCompletionDate) &&
    !custom.estimatedDatesSet
  ) {
    const refreshed = await this.jobsRepo.findOne({ id: params.id, tenantId });
    const merged = (refreshed?.customData ?? {}) as Record<string, unknown>;
    if (merged.estimatedStartDate && merged.estimatedCompletionDate && !merged.estimatedDatesSet) {
      await this.jobsRepo.update({
        id: params.id,
        data: {
          customData: { ...merged, estimatedDatesSet: true },
        },
      });

      this.outboundEvents.emitFieldUpdated({
        entityType: 'job',
        entityId: params.id,
        tenantId,
        field: 'estimatedDatesSet',
        value: true,
      }).catch(() => {});
    }
  }
}
```

### 2. Include schedule info in the event payload

The works ASL's `OnRepairsScheduled` state reads `$.event.payload.estimatedStartDate` and `$.event.payload.estimatedCompletionDate`. Extend the `emitFieldUpdated` call to include these in the payload:

```typescript
this.outboundEvents.emitFieldUpdated({
  entityType: 'job',
  entityId: params.id,
  tenantId,
  field: 'estimatedDatesSet',
  value: true,
  estimatedStartDate: merged.estimatedStartDate,
  estimatedCompletionDate: merged.estimatedCompletionDate,
  scheduledAt: new Date().toISOString(),
}).catch(() => {});
```

This requires extending `emitFieldUpdated` to accept extra payload fields, or using the raw `emit()` method.

## Files Changed

| File | Repo | Change |
|------|------|--------|
| `apps/api/src/modules/jobs/jobs.service.ts` | claims-manager | Auto-detect estimated dates, emit with schedule info |

## Testing

1. Set `customData.estimatedStartDate` only → verify no `estimatedDatesSet` event.
2. Set `customData.estimatedCompletionDate` only → verify no event.
3. Set both in a single update → verify `estimatedDatesSet` auto-set and event emitted.
4. Set one, then the other in a subsequent update → verify event emits on the second update.
5. Integration: works workflow at `WaitForRepairsScheduled` → set both dates → verify transition to `OnRepairsScheduled`.
