# 55f — Workflow Phase to Status Sync

**Gap addressed:** W7 (`workflowPhase` not mapped to Crunchwork job status lookups)

## Problem

The works ASL (like assessment and make-safe) updates `customData.workflowPhase` to track lifecycle state. Crunchwork expects job status updates via specific status lookup names:

| `workflowPhase` | Crunchwork Status |
|------------------|-------------------|
| `allocated` | Allocated |
| `awaiting_scope` | Awaiting Scope |
| `scope_signed` | Scope Signed |
| `awaiting_excess` | Awaiting Excess |
| `excess_collected` | Excess Collected |
| `scheduled` | Scheduled |
| `repairs_in_progress` | Repairs In Progress |
| `repairs_complete` | Repairs Complete |
| `certificate_uploaded` | Repairs Complete |
| `completion_confirmed` | Repairs Complete |
| `complete` | Job Complete |

Currently, `workflowPhase` changes emit `field.updated` events but do not update the job's `statusLookupId`. The internal workflow engine's `syncStatusLookup` hook handles status translation for standard jobs, but ASL-driven jobs bypass this.

## Solution

This is the same architectural pattern as assessment and make-safe. Rather than adding status sync to the more0-ensure ASL (which would require additional `update_job` calls with `statusLookupId`), the preferred approach is to handle the translation in claims-manager when `workflowPhase` changes.

### Option A: Translate in `JobsService.update` (recommended)

When `customData.workflowPhase` is set, resolve the corresponding status lookup and set `statusLookupId` in the same update:

```typescript
if (custom.workflowPhase !== undefined) {
  const statusName = WORKFLOW_PHASE_STATUS_MAP[custom.workflowPhase as string];
  if (statusName) {
    const statusId = await this.lookupResolver.resolveByName({
      tenantId,
      domain: 'job_status',
      name: statusName,
    });
    if (statusId) {
      await this.jobsRepo.update({ id: params.id, data: { statusLookupId: statusId } });
    }
  }
}
```

### Option B: Translate in outbound sync adapter

Add `workflowPhase → status` mapping in the Crunchwork outbound adapter so the status is translated at sync time rather than at storage time.

### Phase-to-status map

```typescript
const WORKFLOW_PHASE_STATUS_MAP: Record<string, string> = {
  'allocated': 'Allocated',
  'awaiting_scope': 'Awaiting Scope',
  'scope_signed': 'Scope Signed',
  'awaiting_excess': 'Awaiting Excess',
  'excess_collected': 'Excess Collected',
  'scheduled': 'Scheduled',
  'repairs_in_progress': 'Repairs In Progress',
  'repairs_complete': 'Repairs Complete',
  'certificate_uploaded': 'Repairs Complete',
  'completion_confirmed': 'Repairs Complete',
  'complete': 'Job Complete',
};
```

## Scope Note

This gap is shared across all three workflow types (assessment, make-safe, works). The implementation should be generic so it works for all `workflowPhase` values. Assessment and make-safe statuses should be mapped at the same time.

This is a **medium-priority enhancement** — the workflow completes correctly without it, but the Crunchwork job status won't reflect the workflow phase until the outbound sync handles the translation.

## Files Changed

| File | Repo | Change |
|------|------|--------|
| `apps/api/src/modules/jobs/jobs.service.ts` | claims-manager | Map `workflowPhase` to `statusLookupId` on update |

## Status: Implemented

Option A was implemented: `WORKFLOW_PHASE_STATUS_MAP` added as a static map in `JobsService`, with a lookup in the `update` method after tracked-field emission. The map covers all three workflow types (assessment, make-safe, works). Additional phases `contacted`, `awaiting_resubmission`, `quote_finalized`, and `cancelled` are also mapped.

## Testing

1. Set `customData.workflowPhase = 'awaiting_scope'` → verify `statusLookupId` resolves to "Awaiting Scope".
2. Verify Crunchwork outbound sync sends the correct status name.
3. Verify assessment and make-safe phase changes also translate correctly.
