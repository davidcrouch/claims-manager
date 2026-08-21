# 54g — Make Safe E2E Integration Tests

**Scope:** Verify the full Builder Make Safe workflow runs end-to-end after all gaps are closed (Steps 01–06).

## Approach

Follows the same test architecture established in [53i](53i_E2E_INTEGRATION_TESTS.md) for Builder Assessment. The make-safe test harness drives the workflow through API calls, simulating user actions and verifying state transitions.

### Test Levels

| Level | What | Where |
|-------|------|-------|
| Unit | Individual methods (field event emission, quote type resolution, etc.) | claims-manager — each step doc has unit test guidance |
| Service integration | more0-ensure ASL + mocked MCP | more0-ensure test suite |
| Full E2E | claims-manager + claims-mcp + more0-ensure (all running) | New test harness |

## Prerequisites

- claims-manager running on port 5001
- claims-mcp running on port 4601
- more0-ensure running on port 4510
- PostgreSQL databases seeded with test data (tenant, lookups, job types)
- more0-ensure connection configured for the test tenant (with MCP server URL)

## Test Scenarios

### Scenario 1: Happy Path — Full E2E with Auto-Approval

```
1. POST /jobs — create a Builder Make Safe job
   ✓ Workflow started (check more0-ensure /runs endpoint)
   ✓ claimRecommendation set to "Accept" (SetDefaultClaimRecommendation)
   ✓ Call to Schedule task created
   ✓ Job workflowPhase: allocated

2. PUT /tasks/:callToScheduleTaskId — complete the task
   ✓ task.completed event emitted
   ✓ Job updated with contactDate
   ✓ attendanceDueDate calculated (Step 01) and written to job
   ✓ Book Site Attendance task created
   ✓ Job workflowPhase: contacted

3. POST /appointments — schedule an appointment
   ✓ appointment.scheduled event emitted
   ✓ Job updated with bookedDate, attendanceDate
   ✓ submissionDueDate calculated (Step 01) and written to job
   ✓ Job workflowPhase: scheduled

4. [Wait for attendance scheduler or trigger manually]
   ✓ attendance_date_passed event emitted
   ✓ Submission Required task created
   ✓ Job workflowPhase: awaiting_submission

5. POST /quotes/:id/publish — publish the make-safe quote
   ✓ quote.published event emitted with auto-approval context
   ✓ quoteType included in payload (Step 04)
   ✓ Job workflowPhase: awaiting_review

6a. [Auto-approval path — all criteria met]
   ✓ Quote auto-approved (approve_quote MCP tool called)
   ✓ PO created (via quote approval hook)
   ✓ Workflow proceeds to WaitForCompletionAndInvoice

7. PUT /invoices/:id — approve the invoice
   ✓ invoice.approved event emitted
   ✓ PO value tracked

8. PUT /purchase-orders/:id — complete the PO
   ✓ purchase_order.completed event emitted
   ✓ Job workflowPhase: complete
   ✓ Workflow: Succeed (JobComplete)
```

### Scenario 2: Manual Review Path

Same as steps 1–5 above, but with auto-approval criteria not met:

```
6b. [Manual review path — criteria not met]
   ✓ Workflow enters WaitForQuoteOutcome
   ✓ Job workflowPhase: awaiting_review

7b. Simulate quote.status_changed with status=Approved
   ✓ Workflow proceeds to WaitForCompletionAndInvoice

8b. Continue to invoice + PO completion
   ✓ Job workflowPhase: complete
```

### Scenario 3: Cancellation at Contact Stage

```
1. Create make-safe job → workflow starts
2. PUT /jobs/:id { makeSafeRequired: false }  (top-level field)
   ✓ field.updated event emitted (Step 02)
   ✓ ASL transitions WaitForContactOrSchedule → CancelMakeSafe
   ✓ Job workflowPhase: cancelled
   ✓ Workflow: Succeed (MakeSafeCancelled)
```

### Scenario 4: Cancellation at Appointment Stage

```
1. Create make-safe job → complete Call to Schedule → Book Site Attendance task created
2. PUT /jobs/:id { makeSafeRequired: false }
   ✓ field.updated event emitted
   ✓ ASL transitions WaitForAppointmentScheduled → CancelMakeSafe
   ✓ Job workflowPhase: cancelled
```

### Scenario 5: Cancellation After Scheduling (at Attendance Wait)

```
1. Create make-safe job → contact → schedule appointment
2. PUT /jobs/:id { makeSafeRequired: false }
   ✓ ASL transitions WaitForAttendanceDatePassed → CancelMakeSafe
   ✓ Job workflowPhase: cancelled
```

### Scenario 6: Early Appointment Scheduling

```
After step 1 (job created, Call to Schedule task open):

2'. POST /appointments — schedule appointment before completing Call to Schedule
   ✓ appointment.scheduled event emitted
   ✓ OnAppointmentScheduledEarly fires
   ✓ Call to Schedule task auto-completed
   ✓ contactDate, bookedDate, attendanceDate set
   ✓ submissionDueDate calculated (Step 01 early path)
   ✓ Job workflowPhase: scheduled
   ✓ Workflow proceeds to WaitForAttendanceDatePassed
```

### Scenario 7: Variation Quote

```
After quote approved and PO created (step 6a):

7'. POST /quotes — create a variation quote, then publish
   ✓ quote.published event with quoteType: "variation" (Step 04)
   ✓ ASL enters WaitForVariationOutcome
   ✓ Simulate quote.status_changed with status=Approved
   ✓ Variation items added to PO
   ✓ ASL returns to WaitForCompletionAndInvoice
```

### Scenario 8: Resubmission Required

```
After quote published but not auto-approved (step 6b):

7'. Simulate quote.status_changed with status="Resubmission Required"
   ✓ Job workflowPhase: awaiting_resubmission
   ✓ New Submission Required task created
   ✓ Workflow loops back to WaitForQuotePublished

8'. Publish revised quote
   ✓ Workflow re-enters EvaluateAutoApproval
```

### Scenario 9: Direct Provider E2E (no Crunchwork)

```
Same as Scenario 1, but with provider=direct:

5'. POST /quotes/:id/publish (direct provider)
   ✓ quote.published event emitted (Step 03)
   ✓ Auto-approval context present
   ✓ Workflow advances from WaitForQuotePublished
```

## Assertions at Each Step

For each step, verify:
1. **Workflow run state** — query more0-ensure `/api/v1/runs/:runId` to check `currentState` and `context`
2. **Job state** — query claims-manager `GET /jobs/:id` to check `customData` fields (workflowPhase, dates, etc.)
3. **Task state** — query claims-manager `GET /tasks?jobId=:id` to check task existence and status
4. **Event delivery** — check more0-ensure logs or run history for event processing

## Test Data Setup

```typescript
const testSetup = {
  tenant: { id: 'test-tenant-001', name: 'Test Builder Co' },
  lookups: {
    jobTypes: {
      'Builder Assessment': 'lookup-ba-001',
      'Builder Make Safe': 'lookup-bms-001',
      'Builder - Scope of Works': 'lookup-bsow-001',
    },
    jobStatuses: {
      'Allocated': 'lookup-status-allocated',
      'Scheduled': 'lookup-status-scheduled',
      'Awaiting Submission': 'lookup-status-awaiting',
      'Awaiting Review': 'lookup-status-review',
      'Awaiting Resubmission': 'lookup-status-resubmission',
      'Complete': 'lookup-status-complete',
      'Cancelled': 'lookup-status-cancelled',
    },
  },
  claim: { id: 'claim-ms-001' },
  connection: {
    id: 'conn-001',
    provider: 'more0-ensure',
    // or provider: 'direct' for Scenario 9
  },
  jobDefaults: {
    customData: {
      claimRecommendation: 'Accept',
      autoApprovalApplies: true,
      claimDecision: 'Accept',
      delegateAuthorityLimit: 5000,
    },
  },
};
```

## Expected Make-Safe State Transition Diagram

```
SetupMakeSafeJob → SetDefaultClaimRecommendation → CreateCallToScheduleTask
  → WaitForContactOrSchedule
    → [task.completed] OnCustomerContacted
      → CalculateAttendanceDueDate → WriteAttendanceDueDate
      → CreateBookSiteAttendanceTask → WaitForAppointmentScheduled
        → OnAppointmentScheduled → CalculateSubmissionDueDate → WriteSubmissionDueDate
        → WaitForAttendanceDatePassed → OnAttendanceDatePassed
        → CreateSubmissionRequiredTask → WaitForQuotePublished
        → OnQuotePublished → EvaluateAutoApproval
          → [auto] AutoApproveAndCreatePO → WaitForCompletionAndInvoice
          → [manual] WaitForQuoteOutcome
            → [Approved] WaitForCompletionAndInvoice
            → [Resubmission] OnResubmissionRequired → CreateResubmissionTask → WaitForQuotePublished
            → [Declined/Cancelled] JobFinalOutcome → JobComplete
        → WaitForCompletionAndInvoice
          → [purchase_order.completed] CheckJobCompletion → JobComplete
          → [quote.published:variation] WaitForVariationOutcome → WaitForCompletionAndInvoice
    → [appointment.scheduled early] OnAppointmentScheduledEarly
      → CompleteCallToScheduleTask
      → CalculateSubmissionDueDate → WriteSubmissionDueDate
      → WaitForAttendanceDatePassed → ...
    → [task.failed] OnCallToScheduleFailed → WaitForContactOrScheduleRetry → ...
    → [field.updated:makeSafeRequired=false] CancelMakeSafe → MakeSafeCancelled

Cancellation available at: WaitForContactOrSchedule, WaitForContactOrScheduleRetry,
                           WaitForAppointmentScheduled, WaitForAttendanceDatePassed
```

## Files Changed

| File | Repo | Change |
|------|------|--------|
| `apps/api/test/e2e/builder-make-safe-workflow.e2e-spec.ts` | claims-manager | New — E2E test script |

## Running

```bash
# Start all services
pnpm --filter api run dev         # claims-manager on :5001
pnpm --filter claims-mcp run dev  # claims-mcp on :4601
cd ../more0-ensure && pnpm run dev  # more0-ensure on :4510

# Run E2E tests
pnpm --filter api run test:e2e --grep "builder-make-safe"
```
