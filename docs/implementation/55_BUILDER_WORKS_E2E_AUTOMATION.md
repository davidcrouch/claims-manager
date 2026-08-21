# 55 — Builder Works End-to-End Automation

## Goal

Close every gap between the existing Builder Works workflow definition (~45-state ASL in more0-ensure) and the claims-manager / claims-mcp services so that a Builder Works job can run fully automated from allocation through to job completion — including scope/contract signing, excess collection (when required), repair scheduling, completion certification, variation handling, and invoicing.

The Builder Assessment E2E automation (doc 53) and Builder Make Safe E2E automation (doc 54) have already been implemented. The works workflow shares significant infrastructure with both, so most event emitters, MCP tools, and scheduling components are already in place. This plan focuses on the works-specific gaps.

## Architecture Recap

```
claims-manager (NestJS API, port 5001)
  ├── domain services: jobs, tasks, appointments, quotes, invoices, POs, documents
  ├── outbound events → more0-ensure webhooks
  └── outbound sync → Crunchwork API

claims-mcp (MCP server, port 4601)
  └── proxies tool calls from more0-ensure → claims-manager REST API

more0-ensure (NestJS workflow engine, port 4510)
  ├── ASL state machine definitions (assessment, make-safe, works)
  ├── MCP client → claims-mcp for side effects (create_task, update_job, etc.)
  │   └── tenant-aware: resolves MCP server URL per tenant connection
  ├── webhook receiver ← claims-manager domain events
  └── scheduler → time-based triggers (wait timeouts)
```

## Current State

| Area | Status |
|------|--------|
| ASL workflow definition (~45 states) | Present — fully modelled |
| Workflow invocation on works job create | Working — `'Builder - Scope of Works': 'workflow.job.works'` mapped |
| Shared event surface (13 event types) | Implemented via docs 53 + 54 work |
| Scope / excess / repair task lifecycle | ASL states present |
| Quote publish + variation handling | ASL states present, events wired |
| Purchase order completion | Event wired |
| Invoice approval | Event wired (local + inbound projection) |
| MCP tools (create_task, update_task, update_job, create_job, approve_quote, calculate_dates) | All present |
| `collectExcess` + `claimRecommendation` in workflow invoke | **Gap** — not passed |
| `document.uploaded` for Completion Certificate | **Gap** — only wired for Assessment Report |
| `estimatedDatesSet` auto-detection | **Gap** — no auto-trigger |

## Gaps Requiring Implementation

| # | Gap | Severity | Step |
|---|-----|----------|------|
| W1 | `collectExcess` not passed in workflow invoke params | Critical | [Step 01](55a_WORKFLOW_INVOKE_ENRICHMENT.md) |
| W2 | `claimRecommendation` not passed in workflow invoke params | Critical | [Step 01](55a_WORKFLOW_INVOKE_ENRICHMENT.md) |
| W3 | Assessment `SpawnBuilderWorksJob` doesn't pass `collectExcess` from parent claim | Major | [Step 02](55b_ASSESSMENT_WORKS_SPAWN.md) |
| W4 | `document.uploaded` not emitted on general document upload (Completion Certificate) | Critical | [Step 03](55c_DOCUMENT_UPLOAD_EVENT.md) |
| W5 | `estimatedDatesSet` has no auto-detection when both dates are populated | Medium | [Step 04](55d_ESTIMATED_DATES_DETECTION.md) |
| W6 | Repair Update task lacks 5-business-day due date | Medium | [Step 05](55e_REPAIR_UPDATE_DUE_DATE.md) |
| W7 | `workflowPhase` not mapped to Crunchwork job status lookups | Medium | [Step 06](55f_WORKFLOW_PHASE_STATUS_SYNC.md) |

## Implementation Steps

| Step | Document | Scope | Repo | Effort |
|------|----------|-------|------|--------|
| 01 | [55a — Workflow Invoke Enrichment](55a_WORKFLOW_INVOKE_ENRICHMENT.md) | Pass `collectExcess`, `claimRecommendation`, `excess` from job row to invoke | claims-manager | 0.5 h |
| 02 | [55b — Assessment Works Spawn](55b_ASSESSMENT_WORKS_SPAWN.md) | Include `collectExcess` + `excess` when assessment creates works job | more0-ensure | 0.5 h |
| 03 | [55c — Document Upload Event](55c_DOCUMENT_UPLOAD_EVENT.md) | Emit `document.uploaded` from DocumentsService on upload complete | claims-manager | 1.5 h |
| 04 | [55d — Estimated Dates Detection](55d_ESTIMATED_DATES_DETECTION.md) | Auto-set `estimatedDatesSet` when both date fields are populated | claims-manager | 0.5 h |
| 05 | [55e — Repair Update Due Date](55e_REPAIR_UPDATE_DUE_DATE.md) | Add 5-business-day `startDate` to Repair Update task creation | more0-ensure | 0.5 h |
| 06 | [55f — Workflow Phase Status Sync](55f_WORKFLOW_PHASE_STATUS_SYNC.md) | Map `workflowPhase` to Crunchwork status names in outbound sync | claims-manager | 1 h |
| 07 | [55g — Builder Works E2E Tests](55g_WORKS_E2E_TESTS.md) | E2E test scenarios for happy path + excess + variation | both repos | 2.5 h |
| **Total** | | | | **7 h** |

## Dependency Graph

```
Step 01 (invoke enrichment) ──┐
Step 02 (spawn enrichment)  ──┤
Step 03 (document events)   ──┤
Step 04 (estimated dates)   ──┼──→ Step 07 (E2E tests)
Step 05 (repair update due) ──┤
Step 06 (status sync)       ──┘
```

Steps 01–06 are independent and can be parallelised. Step 07 depends on all prior steps.

## Builder Works vs Assessment vs Make Safe: Key Differences

| Stage | Assessment | Make Safe | Works |
|-------|-----------|-----------|-------|
| Job setup | Waits for inbound task sync (30s) | Creates task directly | Creates Scope + Repair Update tasks |
| Pre-repair gates | None | None | Scope signed AND excess collected |
| Core lifecycle | Contact → Schedule → Attend → Submit → Review | Same as assessment + cancellation | Scope → Excess → Schedule → Repair → Certificate |
| Quote flow | Original quote → auto-approval → works spawn | Original quote → auto-approval → PO | Variation quotes only (during repairs) |
| Repair tracking | Not applicable | Not applicable | Recurring Repair Update tasks |
| Completion proof | Invoice approved + PO completed | PO completed | Completion Certificate + PO completed |
| Child job spawning | Creates Make Safe + Works | None | None |
| Cancellation | Not present | makeSafeRequired=false | Not present |

## Affected Files Summary

### claims-manager (apps/api)
- `src/modules/jobs/jobs.service.ts` — enrich workflow invoke params (01), auto-detect estimated dates (04)
- `src/modules/filesystem/documents.service.ts` — emit `document.uploaded` on upload complete (03)

### more0-ensure (definitions)
- `definitions/workflows/job/assessment/asl.json` — pass `collectExcess` + `excess` in SpawnBuilderWorksJob (02)
- `definitions/workflows/job/works/asl.json` — add `startDate` to Repair Update tasks (05)

## Verification Criteria

A successful implementation allows the following end-to-end flows to complete without manual workflow intervention:

### Happy path (no excess)
1. Assessment quote approved → Builder Works job created, workflow starts
2. "Send Scope / Contract" task created → user completes → `scopeSentDate` set, "Signed Scope / Contract" task created
3. User completes signed scope task → `scopeSignedDate` set → "Schedule Repairs" task created
4. User sets Estimated Start + Completion Dates → `estimatedDatesSet` fires → status Scheduled, "Commence Repairs" task created
5. User completes Commence Repairs → `worksCommencementDate` set, "Upload Completion Certificate" task created
6. User marks repairs complete → `worksCompletionDate` set
7. User uploads Completion Certificate → `document.uploaded` fires → certificate date set
8. User submits invoice → PO completed → job status → Complete

### Happy path (with excess)
1–2 as above, plus:
3. "Send Excess" task created → user completes → `excessSentDate` set, "Collect Excess" task created
4. User completes Collect Excess → `excessCollectedDate` set
5. Gate: both scope signed AND excess collected → "Schedule Repairs" task created
6–8 as above

### Variation path
1. During repairs, user submits variation quote → `quote.published` with `quoteType: variation`
2. Insurer approves/declines → workflow returns to repair wait
3. Approved items added to PO → normal completion flow

### Repair Update recurrence
1. "Repair Update" task created at job start
2. User completes → new "Repair Update" task created (due 5 business days later)
3. Repeats at every workflow wait state until repairs complete
