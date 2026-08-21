# 53a — Workflow Context Enrichment

**Gaps addressed:** G4 (claimId not in context), G5 (lookup IDs not populated)

## Problem

The assessment ASL's `SetupJob` state uses `Parameters` (which replaces the entire run context) and only maps `jobId`, `tenantId`, `entityType`, `entityId`, `phase`, and `callToScheduleTaskId`. Downstream states reference `$.claimId` and `$.lookups.makeSafeJobType` / `$.lookups.worksJobType`, but these are never set.

Affected ASL states:
- `OnMakeSafeRequired` → `$.claimId`, `$.lookups.makeSafeJobType`
- `SpawnBuilderWorksJob` → `$.claimId`, `$.lookups.worksJobType`
- `OnQuoteApproved` → `$.claimId`, `$.lookups.worksJobType`

## Solution

### 1. Enrich invoke params in `jobs.service.ts`

**File:** `apps/api/src/modules/jobs/jobs.service.ts`
**Method:** `startWorkflowForJob`

Currently passes:
```typescript
workflowParams: {
  jobId,
  entityType: 'job',
  entityId: jobId,
  requestDate: new Date().toISOString(),
}
```

Change to resolve the job's claimId and the lookup IDs for related job types before invoking:

```typescript
workflowParams: {
  jobId,
  entityType: 'job',
  entityId: jobId,
  requestDate: new Date().toISOString(),
  claimId: job.claimId,                        // from the job row
  lookups: {
    makeSafeJobType: makeSafeJobTypeLookupId,  // resolved from lookups table
    worksJobType: worksJobTypeLookupId,        // resolved from lookups table
  },
}
```

**Resolution logic:**
1. Fetch the job row to get `claimId`.
2. Query the lookups table for `domain = 'job_type'` with names `'Builder Make Safe'` and `'Builder - Scope of Works'`.
3. Pass their IDs as `lookups.makeSafeJobType` and `lookups.worksJobType`.

```typescript
private async startWorkflowForJob(
  tenantId: string,
  jobId: string,
  jobTypeLookupId: string,
): Promise<void> {
  if (!this.outboundEvents || !jobTypeLookupId) return;

  try {
    const lookupMap = await this.lookupsRepo.findByIds({
      ids: [jobTypeLookupId],
      tenantId,
    });
    const lookup = lookupMap.get(jobTypeLookupId);
    if (!lookup || !lookup.name) return;

    const cap = JobsService.WORKFLOW_CAP_MAP[lookup.name];
    if (!cap) return;

    // Fetch job for claimId
    const job = await this.jobsRepo.findOne({ id: jobId, tenantId });

    // Resolve related job type lookup IDs
    const relatedLookups = await this.lookupsRepo.findByDomainAndNames({
      tenantId,
      domain: 'job_type',
      names: ['Builder Make Safe', 'Builder - Scope of Works'],
    });

    this.logger.log(
      `JobsService.startWorkflowForJob — jobId=${jobId} type="${lookup.name}" cap=${cap}`,
    );

    await this.outboundEvents.invokeWorkflow({
      cap,
      tenantId,
      workflowParams: {
        jobId,
        entityType: 'job',
        entityId: jobId,
        requestDate: new Date().toISOString(),
        claimId: job?.claimId ?? null,
        lookups: {
          makeSafeJobType: relatedLookups.get('Builder Make Safe') ?? null,
          worksJobType: relatedLookups.get('Builder - Scope of Works') ?? null,
        },
      },
    });
  } catch (err) {
    this.logger.warn(
      `JobsService.startWorkflowForJob — failed for jobId=${jobId}: ${(err as Error).message}`,
    );
  }
}
```

**Prerequisite:** Add `findByDomainAndNames` to the lookups repository if it doesn't already exist. This should query lookups where `domain = $1 AND name IN ($2, ...)` and return a `Map<name, id>`.

### 2. Update `SetupJob` in the ASL

**File:** `more0-ensure/definitions/workflows/job/assessment/asl.json`

Update `SetupJob` to preserve `claimId` and `lookups` from the invocation input:

```json
"SetupJob": {
  "Type": "Pass",
  "Comment": "Initialize context with job data and set entityId alias.",
  "Parameters": {
    "jobId.$": "$.jobId",
    "tenantId.$": "$.tenantId",
    "entityType": "job",
    "entityId.$": "$.jobId",
    "phase": "allocated",
    "callToScheduleTaskId.$": "$.callToScheduleTaskId",
    "claimId.$": "$.claimId",
    "lookups.$": "$.lookups"
  },
  "Next": "CheckInboundTaskExists"
}
```

### 3. Update `workflow.json` input schema

**File:** `more0-ensure/definitions/workflows/job/assessment/workflow.json`

Add the new fields to the `start` method input schema:

```json
"input": {
  "type": "object",
  "properties": {
    "jobId": { "type": "string", "description": "Job UUID" },
    "tenantId": { "type": "string", "description": "Tenant UUID" },
    "entityType": { "type": "string", "default": "job" },
    "entityId": { "type": "string", "description": "Same as jobId" },
    "claimId": { "type": "string", "description": "Claim UUID for child job spawning" },
    "lookups": {
      "type": "object",
      "description": "Pre-resolved lookup IDs",
      "properties": {
        "makeSafeJobType": { "type": "string" },
        "worksJobType": { "type": "string" }
      }
    }
  },
  "required": ["jobId", "tenantId"]
}
```

## Files Changed

| File | Repo | Change |
|------|------|--------|
| `apps/api/src/modules/jobs/jobs.service.ts` | claims-manager | Enrich workflowParams with claimId + lookups |
| `apps/api/src/database/repositories/lookups.repository.ts` | claims-manager | Add findByDomainAndNames if missing |
| `definitions/workflows/job/assessment/asl.json` | more0-ensure | Add claimId.$, lookups.$ to SetupJob |
| `definitions/workflows/job/assessment/workflow.json` | more0-ensure | Add claimId, lookups to input schema |

## Testing

1. Start a workflow with `claimId` and `lookups` in the invoke params.
2. Verify `$.claimId` and `$.lookups.makeSafeJobType` are accessible in the `OnMakeSafeRequired` state.
3. Verify `$.lookups.worksJobType` is accessible in `SpawnBuilderWorksJob` and `OnQuoteApproved`.
4. Update existing E2E tests to include the new fields in invocation input.
