# 65b — More0 Ensure: Attach `action` to Workflow Task Creation

**Parent plan:** 65 (Task Actions Design)  
**Scope:** `more0-ensure/definitions/workflows` (ASL JSON files only)  
**Status:** Plan  
**Depends on:** 65a (API must accept and persist `action`)

---

## Objective

Update every `tool.claims.create_task` call in the three job workflow ASLs to include an `action` descriptor. This is a **data-only change** — no More0 Ensure code changes, only ASL JSON edits.

---

## Approach

Each `create_task` state's `Parameters.params.data` gains an `action` object. The structure follows the `TaskAction` contract from plan 65. The `context.jobId` is resolved from the workflow's `$.jobId` via ASL JsonPath.

### Pattern

Before:
```json
{
  "name": "Schedule Repairs",
  "relatedEntityType": "Job",
  "relatedEntityId.$": "$.jobId",
  "jobId.$": "$.jobId",
  "priority": "High",
  "status": "Open",
  "originType": "automation"
}
```

After:
```json
{
  "name": "Schedule Repairs",
  "relatedEntityType": "Job",
  "relatedEntityId.$": "$.jobId",
  "jobId.$": "$.jobId",
  "priority": "High",
  "status": "Open",
  "originType": "automation",
  "action": {
    "actionKey": "create_appointment",
    "label": "Schedule repairs",
    "context": {
      "entityType": "Appointment",
      "jobId.$": "$.jobId"
    }
  }
}
```

Note: `"jobId.$": "$.jobId"` uses ASL JsonPath resolution, so the actual UUID is injected at runtime.

---

## 1. Assessment Workflow

### File: `definitions/workflows/job/assessment/asl.json`

| ASL State | Task Name | `actionKey` | `label` |
|-----------|-----------|-------------|---------|
| `CreateCallToScheduleTask` | Call to Schedule | `create_appointment` | Schedule appointment |
| `CreateBookSiteAttendanceTask` | Book Site Attendance | `create_appointment` | Book site attendance |
| `CreateSubmissionRequiredTask` | Submission Required | `publish_quote` | Submit estimate |
| `CreateResubmissionTask` | Submission Required | `publish_quote` | Resubmit estimate |

Context for all: `{ "entityType": "<target>", "jobId.$": "$.jobId" }`

Where `<target>` is:
- `Appointment` for `create_appointment`
- `Quote` for `publish_quote`

### Specific additions

**CreateCallToScheduleTask** — add to `data`:
```json
"action": {
  "actionKey": "create_appointment",
  "label": "Schedule appointment",
  "context": { "entityType": "Appointment", "jobId.$": "$.jobId" }
}
```

**CreateBookSiteAttendanceTask** — add to `data`:
```json
"action": {
  "actionKey": "create_appointment",
  "label": "Book site attendance",
  "context": { "entityType": "Appointment", "jobId.$": "$.jobId" }
}
```

**CreateSubmissionRequiredTask** — add to `data`:
```json
"action": {
  "actionKey": "publish_quote",
  "label": "Submit estimate",
  "context": { "entityType": "Quote", "jobId.$": "$.jobId" }
}
```

**CreateResubmissionTask** — add to `data`:
```json
"action": {
  "actionKey": "publish_quote",
  "label": "Resubmit estimate",
  "context": { "entityType": "Quote", "jobId.$": "$.jobId" }
}
```

---

## 2. Make Safe Workflow

### File: `definitions/workflows/job/make-safe/asl.json`

| ASL State | Task Name | `actionKey` | `label` |
|-----------|-----------|-------------|---------|
| `CreateCallToScheduleTask` | Call to Schedule | `create_appointment` | Schedule appointment |
| `OnCallToScheduleFailed` | Call to Schedule #2 | `create_appointment` | Schedule appointment |
| `CreateBookSiteAttendanceTask` | Book Site Attendance | `create_appointment` | Book site attendance |
| `CreateSubmissionRequiredTask` | Submission Required | `publish_quote` | Submit estimate |
| `CreateResubmissionTask` | Submission Required | `publish_quote` | Resubmit estimate |

Same `action` structures as assessment — identical task names, identical action descriptors.

---

## 3. Works Workflow

### File: `definitions/workflows/job/works/asl.json`

| ASL State | Task Name | `actionKey` | `label` |
|-----------|-----------|-------------|---------|
| `CreateInitialTasks` | Send Scope / Contract | `view_entity` | View scope |
| `CreateRepairUpdateTask` (and all re-creations) | Repair Update | `view_entity` | Update job |
| `CreateSendExcessTask` | Send Excess | `create_invoice` | Send excess invoice |
| `CreateSignedScopeTask` | Signed Scope / Contract | `view_entity` | View scope |
| `CreateSignedScopeTaskWithExcess` | Signed Scope / Contract | `view_entity` | View scope |
| `CreateCollectExcessTask` | Collect Excess | `create_invoice` | Collect excess |
| `GateReadyToSchedule` | Schedule Repairs | `create_appointment` | Schedule repairs |
| `CreateCommenceRepairsTask` | Commence Repairs | `view_entity` | Go to job |
| `CreateUploadCertificateTask` | Upload Completion Certificate | `upload_document` | Upload certificate |

### Action details per state

**CreateInitialTasks** (Send Scope / Contract):
```json
"action": {
  "actionKey": "view_entity",
  "label": "View scope",
  "context": { "entityType": "Job", "jobId.$": "$.jobId" }
}
```

**CreateRepairUpdateTask** (and all 4 re-creation states):
```json
"action": {
  "actionKey": "view_entity",
  "label": "Update job",
  "context": { "entityType": "Job", "jobId.$": "$.jobId" }
}
```

**CreateSendExcessTask**:
```json
"action": {
  "actionKey": "create_invoice",
  "label": "Send excess invoice",
  "context": { "entityType": "Invoice", "jobId.$": "$.jobId" }
}
```

**CreateSignedScopeTask** / **CreateSignedScopeTaskWithExcess**:
```json
"action": {
  "actionKey": "view_entity",
  "label": "View scope",
  "context": { "entityType": "Job", "jobId.$": "$.jobId" }
}
```

**CreateCollectExcessTask**:
```json
"action": {
  "actionKey": "create_invoice",
  "label": "Collect excess",
  "context": { "entityType": "Invoice", "jobId.$": "$.jobId" }
}
```

**GateReadyToSchedule** (Schedule Repairs):
```json
"action": {
  "actionKey": "create_appointment",
  "label": "Schedule repairs",
  "context": { "entityType": "Appointment", "jobId.$": "$.jobId" }
}
```

**CreateCommenceRepairsTask**:
```json
"action": {
  "actionKey": "view_entity",
  "label": "Go to job",
  "context": { "entityType": "Job", "jobId.$": "$.jobId" }
}
```

**CreateUploadCertificateTask**:
```json
"action": {
  "actionKey": "upload_document",
  "label": "Upload certificate",
  "context": { "entityType": "Document", "jobId.$": "$.jobId" }
}
```

---

## 4. Repair Update Re-Creation States

The Repair Update task is re-created in multiple `WaitForEvent` loops. All of these states need the same action:

**Works ASL states to update:**
- `OnRepairUpdateCompleted_PreScope`
- `OnRepairUpdateCompleted_PreScopeExcess`
- `OnRepairUpdateSchedulePhase`
- `OnRepairUpdateRepairPhase`
- `OnRepairUpdateDuringRepairs`

Each uses `tool.claims.create_task` with `name: "Repair Update"`. Add the same `action` block to all five.

---

## Validation

The `claims-mcp` `create_task` tool uses `z.record(z.unknown())` for the data payload — any new fields pass through without schema changes on the MCP side.

---

## Testing

1. **Local**: Start More0 Ensure + claims-manager locally. Trigger a workflow (e.g. create an assessment job). Verify the created task's `taskPayload` contains `action`.
2. **Unit**: Inspect ASL JSON to verify all `create_task` states include an `action` with valid `actionKey`, `label`, and `context`.
3. **Integration**: End-to-end workflow → dashboard → verify CTA button appears on the task.

---

## Files Changed Summary

| File (in `more0-ensure` repo) | States updated |
|-------------------------------|----------------|
| `definitions/workflows/job/assessment/asl.json` | 4 states |
| `definitions/workflows/job/make-safe/asl.json` | 5 states |
| `definitions/workflows/job/works/asl.json` | 14 states |

Total: **23 `create_task` states** across three ASL files.
