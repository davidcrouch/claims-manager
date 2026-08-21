# 54f — Make Safe Completion Date Tracking

**Gap addressed:** G7 (`dateMakeSafeCompleted` not tracked or enforced in workflow)

## Problem

The Crunchwork guide (Step 7: "Record Make Safe Completion") states:

> Once the make safe works are finished, you must record the completion. Populate the Completed Date field with the date the make safe works were completed.

The `dateMakeSafeCompleted` field exists in the schema (assessment `makeSafe` JSONB section and potentially as a `customData` field on the job), but:

1. It is not in the `trackedFields` list for `field.updated` event emission in `JobsService.update`.
2. The make-safe ASL does not wait for or react to this field being set.
3. The workflow proceeds from quote approval → PO completion → job complete without gating on completion date recording.

## Decision Required

This is a **design decision** with two valid approaches:

### Option A: Data-quality only (recommended for initial release)

Track the field change via `field.updated` but do not gate the workflow on it. The completion date is recorded for reporting purposes; the user is expected to populate it but the workflow does not block if they forget.

**Rationale:** The Crunchwork guide says "you must record the completion" but the flow diagram does not show this as a workflow gate — the PO completion triggers job completion regardless. Adding a gate would introduce a stall risk if users forget.

### Option B: Workflow gate

Add a `WaitForCompletionDate` state in the ASL between `WaitForCompletionAndInvoice` and `CheckJobCompletion`. The workflow would wait for `field.updated` with `field: "dateMakeSafeCompleted"` before allowing job completion.

**Risk:** Users may forget to record the date, causing the workflow to stall.

## Solution (Option A — recommended)

### 1. Add `dateMakeSafeCompleted` to tracked fields

**File:** `apps/api/src/modules/jobs/jobs.service.ts`
**Method:** `update` (line 414)

Add the field to the `trackedFields` array:

```typescript
const trackedFields = [
  'makeSafeRequired', 'scopeSignedDate', 'excessPaymentCollected',
  'workflowPhase', 'estimatedDatesSet', 'dateCustomerConfirmedCompletion',
  'dateMakeSafeCompleted',  // ← NEW
];
```

This ensures that when the user (or MCP tool) sets `customData.dateMakeSafeCompleted`, a `field.updated` event is emitted. The event can be used for:
- Reporting dashboards
- Future workflow gates (Option B)
- Audit trail

### 2. Also track top-level field changes (if applicable)

If `dateMakeSafeCompleted` can also be set as a top-level job field (not just `customData`), apply the same pattern as [Step 02](54b_MAKE_SAFE_REQUIRED_EVENT.md) to emit `field.updated` for the column change.

### 3. (Optional, future) Add ASL gate state

If Option B is chosen later, add the following to the make-safe ASL between the quote approval and job completion stages:

```json
"WaitForCompletionDateRecorded": {
  "Type": "WaitForEvent",
  "Comment": "Wait for the user to record the make-safe completion date.",
  "EventPatterns": [
    {
      "eventType": "field.updated",
      "filter": { "field": "dateMakeSafeCompleted" },
      "Next": "WaitForCompletionAndInvoice"
    }
  ]
}
```

This would be inserted as a new state that leads into `WaitForCompletionAndInvoice`, reachable after the quote is approved and PO is created.

## Files Changed

| File | Repo | Change |
|------|------|--------|
| `apps/api/src/modules/jobs/jobs.service.ts` | claims-manager | Add `dateMakeSafeCompleted` to `trackedFields` |

## Testing

1. Update a make-safe job with `customData.dateMakeSafeCompleted = "2026-08-19"` → verify `field.updated` event is emitted.
2. Verify the event payload contains `{ field: "dateMakeSafeCompleted", value: "2026-08-19" }`.
3. Verify no `field.updated` fires when the field is not present in the update.
4. (If Option B is implemented) Verify the ASL waits at `WaitForCompletionDateRecorded` and advances when the event arrives.
