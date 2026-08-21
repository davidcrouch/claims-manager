# 54 — Builder Make Safe End-to-End Automation

## Goal

Close every gap between the existing Builder Make Safe workflow definition (26-state ASL in more0-ensure) and the claims-manager / claims-mcp services so that a Builder Make Safe job can run fully automated from allocation through to job completion — including the cancellation path when make safe is no longer required.

The Builder Assessment E2E automation (doc 53) has already been implemented. The make-safe workflow shares significant infrastructure with assessment, so many event emitters, MCP tools, and scheduling components are already in place. This plan focuses on the make-safe-specific gaps.

## Architecture Recap

```
claims-manager (NestJS API, port 5001)
  ├── domain services: jobs, tasks, appointments, quotes, invoices, POs
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

**Note:** The more0-ensure MCP client has been improved to manage tenant context. MCP tool calls made by the ASL engine now pass the tenant's MCP server URL resolved from the workflow run's tenant connection, so `tool.claims.*` resources route correctly in multi-tenant environments.

## Current State

| Area | Status |
|------|--------|
| ASL workflow definition (26 states) | Present — gaps in date calculation |
| Workflow invocation on make-safe job create | Working — `'Builder Make Safe': 'workflow.job.make-safe'` mapped |
| Shared event surface (12 event types) | Implemented via doc 53 work |
| Call to Schedule / Book Site Attendance task lifecycle | Shared with assessment — working |
| Attendance date scheduler | Shared with assessment — working |
| Quote auto-approval context | Shared with assessment — working |
| MCP tools (create_task, update_task, update_job, create_job, approve_quote, calculate_dates) | All present |
| Cancellation path in ASL (CancelMakeSafe) | Present — event trigger has gaps |

## Gaps Requiring Implementation

| # | Gap | Severity | Step |
|---|-----|----------|------|
| G1 | Make-safe ASL skips `CalculateAttendanceDueDate` + `WriteAttendanceDueDate` after customer contact | Critical | [Step 01](54a_MAKE_SAFE_DATE_CALCULATION.md) |
| G2 | Make-safe ASL skips `CalculateSubmissionDueDate` + `WriteSubmissionDueDate` after appointment | Critical | [Step 01](54a_MAKE_SAFE_DATE_CALCULATION.md) |
| G3 | `field.updated` not emitted when top-level `makeSafeRequired` column changes (only `customData` path fires) | Critical | [Step 02](54b_MAKE_SAFE_REQUIRED_EVENT.md) |
| G4 | `quote.published` not emitted for direct-provider jobs (blocks E2E testing) | High | [Step 03](54c_DIRECT_PROVIDER_QUOTE_EVENT.md) |
| G5 | `quoteType` not passed in `quote.published` event payload (ASL variation filter fails) | High | [Step 04](54d_QUOTE_TYPE_IN_EVENT.md) |
| G6 | Inbound invoice approval projection does not emit `invoice.approved` | Medium | [Step 05](54e_INBOUND_INVOICE_APPROVAL.md) |
| G7 | `dateMakeSafeCompleted` not tracked or enforced in workflow | Medium | [Step 06](54f_MAKE_SAFE_COMPLETION_DATE.md) |

## Implementation Steps (sequential)

| Step | Document | Scope | Repo | Effort |
|------|----------|-------|------|--------|
| 01 | [54a — Make Safe Date Calculation](54a_MAKE_SAFE_DATE_CALCULATION.md) | Add 4 date calc/write states to make-safe ASL | more0-ensure | 1 h |
| 02 | [54b — Make Safe Required Event](54b_MAKE_SAFE_REQUIRED_EVENT.md) | Emit `field.updated` for top-level column changes | claims-manager | 1 h |
| 03 | [54c — Direct Provider Quote Event](54c_DIRECT_PROVIDER_QUOTE_EVENT.md) | Emit `quote.published` on direct-provider publish | claims-manager | 0.5 h |
| 04 | [54d — Quote Type in Event](54d_QUOTE_TYPE_IN_EVENT.md) | Pass `quoteType` in `quote.published` payload | claims-manager | 0.5 h |
| 05 | [54e — Inbound Invoice Approval](54e_INBOUND_INVOICE_APPROVAL.md) | Emit `invoice.approved` from inbound webhook projection | claims-manager | 1 h |
| 06 | [54f — Make Safe Completion Date](54f_MAKE_SAFE_COMPLETION_DATE.md) | Track `dateMakeSafeCompleted` field + optional ASL gate | both repos | 1 h |
| 07 | [54g — Make Safe E2E Tests](54g_MAKE_SAFE_E2E_TESTS.md) | E2E test scenarios for happy path + cancellation | both repos | 2 h |
| **Total** | | | | **7 h** |

## Dependency Graph

```
Step 01 (ASL date calc)  ──┐
Step 02 (field.updated)  ──┤
Step 03 (direct quote)   ──┤
Step 04 (quoteType)      ──┼──→ Step 07 (E2E tests)
Step 05 (inbound invoice)──┤
Step 06 (completion date)──┘
```

Steps 01–06 are independent and can be parallelised. Step 07 depends on all prior steps.

Steps 03 and 04 also benefit the assessment and works workflows (shared gaps). Steps 05 benefits all three workflows.

## Make-Safe vs Assessment: Workflow Differences

| Stage | Assessment | Make Safe |
|-------|-----------|-----------|
| Job setup | Waits for inbound Crunchwork task sync (30s timeout) | Creates task directly — no inbound race |
| Customer contact | Same: `OnCustomerContacted` → date calc → `CreateBookSiteAttendanceTask` | **Gap:** skips date calc, jumps straight to task creation |
| Appointment | Same: `OnAppointmentScheduled` → date calc → `WaitForAttendanceDatePassed` | **Gap:** skips date calc, jumps straight to wait |
| Post-attendance | Creates Submission Required task | Same |
| Quote review outcomes | Approved, Resubmission, Cash Settled, Declined, Cancelled | Approved, Resubmission, Declined, Cancelled (no Cash Settled) |
| Auto-approve action | Spawns Builder Works job | Creates PO only (no child job) |
| Variation handling | Not present | Handles variation quotes via `WaitForVariationOutcome` |
| Completion | `WaitForInvoice` → `WaitForPOCompletion` | `WaitForCompletionAndInvoice` (single wait with variation loop) |
| Cancellation | Not present | `CancelMakeSafe` → `MakeSafeCancelled` at every wait state |

## Affected Files Summary

### claims-manager (apps/api)
- `src/modules/jobs/jobs.service.ts` — emit `field.updated` for top-level `makeSafeRequired` (02), track `dateMakeSafeCompleted` (06)
- `src/modules/quotes/quotes.service.ts` — emit `quote.published` on direct publish (03), pass `quoteType` (04)
- Webhook projection handler — emit `invoice.approved` on inbound approval (05)

### more0-ensure (definitions)
- `definitions/workflows/job/make-safe/asl.json` — add 4+ date calculation states (01), add completion date wait (06)

### Test harness
- `apps/api/test/e2e/builder-make-safe-workflow.e2e-spec.ts` — E2E test script (07)

## Verification Criteria

A successful implementation allows the following end-to-end flows to complete without manual workflow intervention:

### Happy path
1. Job created → workflow starts, `Call to Schedule` task created, `claimRecommendation` set to Accept
2. User completes `Call to Schedule` → `contactDate` set, **`attendanceDueDate` calculated**, `Book Site Attendance` task created
3. User schedules appointment → `bookedDate` + `attendanceDate` set, status → Scheduled
4. Attendance date passes → status → Awaiting Submission, `Submission Required` task created
5. User publishes quote → auto-approval evaluated
   - Auto-approved → PO created, invoice phase begins
   - Manual review → waits for insurer decision
6. Variation quote submitted → variation approval loop
7. Invoice approved + PO completed → status → Complete

### Cancellation path
1. At any wait state, user sets `makeSafeRequired = false`
2. `field.updated` event fires with `{ field: "makeSafeRequired", value: false }`
3. ASL transitions to `CancelMakeSafe` → job phase set to `cancelled`
4. Workflow terminates (Succeed)

### Early appointment path
1. Appointment scheduled before `Call to Schedule` completed
2. Task auto-completed, dates populated, workflow advances to scheduled state
