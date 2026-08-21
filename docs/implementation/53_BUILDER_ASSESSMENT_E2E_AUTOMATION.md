# 53 — Builder Assessment End-to-End Automation

## Goal

Close every gap between the existing Builder Assessment workflow definition (37-state ASL in more0-ensure) and the claims-manager / claims-mcp services so that a Builder Assessment job can run fully automated from allocation through to job completion — without manual intervention beyond the user actions documented in the Crunchwork workflow guide.

## Architecture Recap

```
claims-manager (NestJS API, port 5001)
  ├── domain services: jobs, tasks, appointments, quotes, invoices, POs, assessments
  ├── outbound events → more0-ensure webhooks
  └── outbound sync → Crunchwork API

claims-mcp (MCP server, port 4601)
  └── proxies tool calls from more0-ensure → claims-manager REST API

more0-ensure (NestJS workflow engine, port 4510)
  ├── ASL state machine definitions (assessment, make-safe, works)
  ├── MCP client → claims-mcp for side effects (create_task, update_job, etc.)
  ├── webhook receiver ← claims-manager domain events
  └── scheduler → time-based triggers (wait timeouts)
```

## Current State

| Area | Status |
|------|--------|
| ASL workflow definition (37 states) | Complete |
| MCP tools (5/5: create_task, update_task, update_job, create_job, approve_quote) | All present in claims-mcp |
| Domain event emission (9/12 events) | Mostly wired; 3 gaps |
| Workflow engine handlers (Task, Choice, Wait, WaitForEvent, Pass, Succeed/Fail) | Implemented |
| Workflow invocation from job create | Implemented |
| Run persistence + scheduled triggers | Implemented |
| E2E tests (mocked MCP) | Passing |

## Gaps Requiring Implementation

| # | Gap | Severity | Step |
|---|-----|----------|------|
| G1 | `attendance_date_passed` event has no producer | Critical | [Step 03](53c_ATTENDANCE_DATE_SCHEDULER.md) |
| G2 | `invoice.approved` event not emitted | Critical | [Step 04](53d_INVOICE_EVENT_WIRING.md) |
| G3 | `calculatedDates` context never populated (attendanceDueDate, submissionDueDate) | Critical | [Step 02](53b_DATE_CALCULATION.md) |
| G4 | `claimId` not set in workflow context (SetupJob discards it) | Major | [Step 01](53a_WORKFLOW_CONTEXT_ENRICHMENT.md) |
| G5 | `lookups.makeSafeJobType` / `lookups.worksJobType` not populated | Major | [Step 01](53a_WORKFLOW_CONTEXT_ENRICHMENT.md) |
| G6 | Quote publish event missing auto-approval context fields | Major | [Step 05](53e_QUOTE_PUBLISH_CONTEXT.md) |
| G7 | `document.uploaded` event defined but never called | Minor | [Step 06](53f_DOCUMENT_EVENT_WIRING.md) |
| G8 | Assessment publish does not emit outbound event | Major | [Step 06](53f_DOCUMENT_EVENT_WIRING.md) |
| G9 | Webhook/invoke endpoints bypass JWT validation | Major | [Step 07](53g_AUTH_HARDENING.md) |
| G10 | Checkpoints table unused; no crash recovery | Minor | [Step 08](53h_ENGINE_RESILIENCE.md) |
| G11 | Parallel/Retry ASL features not implemented | Minor | [Step 08](53h_ENGINE_RESILIENCE.md) |

## Implementation Steps (sequential)

| Step | Document | Scope | Effort |
|------|----------|-------|--------|
| 01 | [53a — Workflow Context Enrichment](53a_WORKFLOW_CONTEXT_ENRICHMENT.md) | claims-manager + more0-ensure | 1 h |
| 02 | [53b — Date Calculation](53b_DATE_CALCULATION.md) | claims-mcp + more0-ensure | 2 h |
| 03 | [53c — Attendance Date Scheduler](53c_ATTENDANCE_DATE_SCHEDULER.md) | claims-manager | 2 h |
| 04 | [53d — Invoice Event Wiring](53d_INVOICE_EVENT_WIRING.md) | claims-manager | 1 h |
| 05 | [53e — Quote Publish Context](53e_QUOTE_PUBLISH_CONTEXT.md) | claims-manager | 1 h |
| 06 | [53f — Document Event Wiring](53f_DOCUMENT_EVENT_WIRING.md) | claims-manager | 0.5 h |
| 07 | [53g — Auth Hardening](53g_AUTH_HARDENING.md) | more0-ensure | 1 h |
| 08 | [53h — Engine Resilience](53h_ENGINE_RESILIENCE.md) | more0-ensure | 3 h |
| 09 | [53i — E2E Integration Tests](53i_E2E_INTEGRATION_TESTS.md) | both repos | 3 h |
| **Total** | | | **14.5 h** |

## Dependency Graph

```
Step 01 (context) ─┐
                   ├──→ Step 02 (dates) ──→ Step 03 (attendance scheduler)
Step 05 (quote)  ──┤
Step 04 (invoice)──┤
Step 06 (docs)   ──┤
                   └──→ Step 09 (E2E tests)
Step 07 (auth)   ──────→ Step 09 (E2E tests)
Step 08 (resilience) ──→ Step 09 (E2E tests)
```

Steps 01, 04, 05, 06, and 07 are independent and can be parallelised. Steps 02 and 03 are sequential (dates must be calculable before the scheduler can use them). Step 09 depends on all prior steps.

## Affected Files Summary

### claims-manager (apps/api)
- `src/modules/jobs/jobs.service.ts` — enrich workflow invoke params (01)
- `src/modules/outbound-events/outbound-events.service.ts` — add `emitInvoiceApproved` (04)
- `src/modules/invoices/invoices.service.ts` — wire invoice status events (04)
- `src/modules/quotes/quotes.service.ts` — pass auto-approval context on publish (05)
- `src/modules/assessments/assessments.service.ts` — emit document.uploaded on publish (06)
- New: `src/modules/scheduler/attendance-date.scheduler.ts` — cron job for attendance_date_passed (03)

### claims-mcp (apps/claims-mcp)
- New: `src/tools/workflow.tool.ts` — `calculate_dates` tool for SLA-based date computation (02)

### more0-ensure
- `definitions/workflows/job/assessment/workflow.json` — add claimId, lookups to input schema (01)
- `definitions/workflows/job/assessment/asl.json` — fix SetupJob, rework date states (01, 02)
- `src/gateway/webhook.controller.ts` — remove @Public (07)
- `src/gateway/invoke.controller.ts` — remove @Public (07)
- `src/engine/state/run-store.service.ts` — checkpoint writes (08)
- `src/engine/handlers/task.handler.ts` — Retry support (08)

## Verification Criteria

A successful implementation allows the following end-to-end flow to complete without manual workflow intervention:

1. Insurer allocates a Builder Assessment job → workflow starts, Call to Schedule task created
2. User completes Call to Schedule task → Contact Date set, Attendance Due Date calculated, Book Site Attendance task created
3. User schedules appointment → Booked Date set, Attendance Date set, Submission Due Date calculated, status → Scheduled
4. Attendance date passes → status → Awaiting Submission, Submission Required task created
5. User publishes quote → First/Last Submission Date set, auto-approval evaluated
   - Auto-approved → Builder Works job spawned, invoice phase begins
   - Manual review → waits for insurer decision
6. Invoice approved + PO completed → status → Complete
