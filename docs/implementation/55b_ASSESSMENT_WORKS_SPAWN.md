# 55b — Assessment Works Spawn Enrichment

**Gap addressed:** W3 (assessment doesn't pass `collectExcess` when spawning works job)

## Problem

When the assessment ASL auto-approves a quote (or receives insurer approval), it spawns a Builder Works job via `create_job`. The current `SpawnBuilderWorksJob` and `OnQuoteApproved` states pass:

```json
{
  "claimId.$": "$.claimId",
  "jobTypeLookupId.$": "$.lookups.worksJobType",
  "parentJobId.$": "$.jobId",
  "customData": {
    "workflowPhase": "allocated",
    "claimRecommendation.$": "$.event.payload.claimRecommendation",
    "sourceAssessmentJobId.$": "$.jobId"
  }
}
```

Missing from the `create_job` payload:
- `collectExcess` — determines whether the works workflow runs the excess collection branch
- `excess` — the excess dollar amount

Without these, the works job is created with `collectExcess = null` and the works ASL's `CheckExcessRequired` always takes the no-excess path.

The `collectExcess` and `excess` values originate from the insurer's job allocation and are stored on the **assessment job row**. They need to be threaded through the ASL context so they can be forwarded when spawning the works job.

## Solution

### 1. Preserve `collectExcess` and `excess` in assessment `SetupJob`

**File:** `more0-ensure/definitions/workflows/job/assessment/asl.json`

The `SetupJob` Pass state must preserve `collectExcess` and `excess` from the invocation params:

```json
"SetupJob": {
  "Parameters": {
    "jobId.$": "$.jobId",
    "tenantId.$": "$.tenantId",
    "entityType": "job",
    "entityId.$": "$.jobId",
    "phase": "allocated",
    "callToScheduleTaskId.$": "$.callToScheduleTaskId",
    "claimId.$": "$.claimId",
    "lookups.$": "$.lookups",
    "collectExcess.$": "$.collectExcess",
    "excess.$": "$.excess"
  }
}
```

### 2. Include `collectExcess` and `excess` in `SpawnBuilderWorksJob`

```json
"SpawnBuilderWorksJob": {
  "Resource": "tool.claims.create_job",
  "Parameters": {
    "params": {
      "data": {
        "claimId.$": "$.claimId",
        "jobTypeLookupId.$": "$.lookups.worksJobType",
        "parentJobId.$": "$.jobId",
        "collectExcess.$": "$.collectExcess",
        "excess.$": "$.excess",
        "customData": {
          "workflowPhase": "allocated",
          "claimRecommendation.$": "$.event.payload.claimRecommendation",
          "sourceAssessmentJobId.$": "$.jobId"
        }
      }
    }
  }
}
```

### 3. Same change in `OnQuoteApproved`

Apply the same `collectExcess.$` and `excess.$` additions to the `OnQuoteApproved` state's `create_job` call.

## Files Changed

| File | Repo | Change |
|------|------|--------|
| `definitions/workflows/job/assessment/asl.json` | more0-ensure | Add `collectExcess.$`, `excess.$` to SetupJob, SpawnBuilderWorksJob, OnQuoteApproved |

## Testing

1. Start assessment workflow with `collectExcess: true, excess: "500"` → auto-approve → verify created works job has `collectExcess: true, excess: "500"`.
2. Start assessment workflow with `collectExcess: false` → verify works job has `collectExcess: false`.
3. Manual approve path (`OnQuoteApproved`) → verify same enrichment.
