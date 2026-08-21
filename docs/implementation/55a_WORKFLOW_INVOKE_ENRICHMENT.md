# 55a — Workflow Invoke Enrichment

**Gaps addressed:** W1 (`collectExcess` not in invoke params), W2 (`claimRecommendation` not in invoke params)

## Problem

The works ASL's `SetupWorksJob` state reads `$.collectExcess` and `$.claimRecommendation` from the invocation input:

```json
"SetupWorksJob": {
  "Parameters": {
    "collectExcess.$": "$.collectExcess",
    "claimRecommendation.$": "$.claimRecommendation"
  }
}
```

`JobsService.startWorkflowForJob` currently passes only generic fields (jobId, entityType, requestDate, claimId, lookups). It does **not** read the job's `collectExcess` column or `customData.claimRecommendation` and forward them.

Without `collectExcess`, the `CheckExcessRequired` Choice always falls through to the no-excess path — even when excess collection is required. Without `claimRecommendation`, the value is undefined in the ASL context.

## Solution

### 1. Read works-specific fields from the job row in `startWorkflowForJob`

**File:** `apps/api/src/modules/jobs/jobs.service.ts`
**Method:** `startWorkflowForJob`

The method already fetches the job row (for `claimId`). Extend the workflow params to include `collectExcess`, `excess`, and `claimRecommendation`:

```typescript
await this.outboundEvents.invokeWorkflow({
  cap,
  tenantId,
  workflowParams: {
    jobId,
    entityType: 'job',
    entityId: jobId,
    requestDate: new Date().toISOString(),
    claimId: job?.claimId ?? null,
    collectExcess: job?.collectExcess ?? false,
    excess: job?.excess ?? null,
    claimRecommendation: customData?.claimRecommendation ?? null,
    lookups: { ... },
  },
});
```

These fields are safe to include for all workflow types — assessment and make-safe ASLs will simply ignore them.

## Files Changed

| File | Repo | Change |
|------|------|--------|
| `apps/api/src/modules/jobs/jobs.service.ts` | claims-manager | Pass `collectExcess`, `excess`, `claimRecommendation` in invoke params |

## Testing

1. Create a works job with `collectExcess: true` → verify workflow invoke includes `collectExcess: true`.
2. Create a works job with `collectExcess: false` → verify workflow invoke includes `collectExcess: false`.
3. Create a works job with `customData.claimRecommendation: "Accept"` → verify it is forwarded.
4. Create an assessment job → verify the extra fields don't break the assessment workflow.
