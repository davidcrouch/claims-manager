# 53i — E2E Integration Tests

**Scope:** Verify the full Builder Assessment workflow runs end-to-end after all gaps are closed.

## Approach

The existing more0-ensure test suite uses a mocked MCP tool invoker. The integration test described here verifies the full flow across both services in a local development environment.

### Test Levels

| Level | What | Where |
|-------|------|-------|
| Unit | Individual methods (date calc, event emission, etc.) | Both repos — each step doc has unit test guidance |
| Service integration | more0-ensure ASL + mocked MCP | more0-ensure test suite |
| Full E2E | claims-manager + claims-mcp + more0-ensure (all running) | New test harness |

## Full E2E Test Plan

### Prerequisites

- claims-manager running on port 5001
- claims-mcp running on port 4601
- more0-ensure running on port 4510
- PostgreSQL databases seeded with test data (tenant, lookups, job types)

### Test Harness

Create a test script that drives the workflow through API calls, simulating user actions and verifying state transitions.

**File:** `apps/api/test/e2e/builder-assessment-workflow.e2e-spec.ts` (or standalone script)

### Test Scenarios

#### Scenario 1: Happy Path — Full E2E with Auto-Approval

```
1. POST /jobs — create a Builder Assessment job
   ✓ Workflow started (check more0-ensure /runs endpoint)
   ✓ Call to Schedule task created
   ✓ Job status: Allocated

2. PUT /tasks/:callToScheduleTaskId — complete the task
   ✓ task.completed event emitted
   ✓ Job updated with contactDate
   ✓ attendanceDueDate calculated and written to job
   ✓ Book Site Attendance task created
   ✓ Job status: Customer Contacted

3. POST /appointments — schedule an appointment
   ✓ appointment.scheduled event emitted
   ✓ Job updated with bookedDate, attendanceDate
   ✓ submissionDueDate calculated and written to job
   ✓ Book Site Attendance task completed
   ✓ Job status: Scheduled

4. [Wait for scheduler or manually trigger]
   ✓ attendance_date_passed event emitted
   ✓ Submission Required task created
   ✓ Job status: Awaiting Submission

5. POST /quotes/:id/publish — publish the quote
   ✓ quote.published event emitted with auto-approval context
   ✓ First Submission Date set

6a. [Auto-approval path — all criteria met]
   ✓ Quote auto-approved
   ✓ Builder Works job spawned
   ✓ Workflow proceeds to invoice phase

7. PUT /invoices/:id — approve the invoice
   ✓ invoice.approved event emitted
   ✓ Workflow waits for PO completion

8. PUT /purchase-orders/:id — complete the PO
   ✓ purchase_order.completed event emitted
   ✓ Job status: Complete
   ✓ Workflow: Succeed state
```

#### Scenario 2: Manual Review Path

Same as steps 1-5 above, but with auto-approval criteria not met:

```
6b. [Manual review path — criteria not met]
   ✓ Workflow enters WaitForQuoteOutcome

7b. Emit quote.status_changed with status=Approved
   ✓ Workflow proceeds to CheckMakeSafe

8b. [makeSafeRequired = false]
   ✓ Workflow skips to invoice phase
   ✓ Continue to invoice/PO completion
```

#### Scenario 3: Make Safe Required

```
After quote approval with makeSafeRequired = true:
   ✓ Make Safe job spawned with correct claimId and jobType
   ✓ Workflow continues to invoice phase
```

#### Scenario 4: Early Appointment Scheduling

```
After step 1, before completing Call to Schedule:
2'. POST /appointments — schedule appointment before task completion
   ✓ appointment.scheduled event emitted
   ✓ Book Site Attendance task autocompleted
   ✓ submissionDueDate calculated
   ✓ Job status: Scheduled
   ✓ Workflow skips to WaitForAttendanceDatePassed
```

#### Scenario 5: Scheduler Idempotency

```
1. Create job with past attendanceDate and workflowPhase = 'scheduled'
2. Run scheduler — event emitted, flag set
3. Run scheduler again — no duplicate event
4. Update attendanceDate to future — new attendance date respected
```

### Assertions at Each Step

For each step, verify:
1. **Workflow run state** — query more0-ensure `/api/v1/runs/:runId` to check `currentState` and `context`
2. **Job state** — query claims-manager `GET /jobs/:id` to check `customData` fields
3. **Task state** — query claims-manager `GET /tasks?jobId=:id` to check task existence and status
4. **Event delivery** — check more0-ensure logs or run history for event processing

### Test Data Setup

```typescript
const testSetup = {
  tenant: { id: 'test-tenant-001', name: 'Test Builder Co' },
  lookups: {
    jobTypes: {
      'Builder Assessment': 'lookup-ba-001',
      'Builder Make Safe': 'lookup-bms-001',
      'Builder - Scope of Works': 'lookup-bsow-001',
    },
    taskTypes: {
      'Call to Schedule': 'lookup-cts-001',
      'Book Site Attendance': 'lookup-bsa-001',
      'Submission Required': 'lookup-sr-001',
    },
    jobStatuses: {
      'Allocated': 'lookup-status-allocated',
      'Customer Contacted': 'lookup-status-contacted',
      'Scheduled': 'lookup-status-scheduled',
      'Awaiting Submission': 'lookup-status-awaiting',
      'Complete': 'lookup-status-complete',
    },
  },
  claim: { id: 'claim-001' },
  connection: { id: 'conn-001', provider: 'more0-ensure' },
};
```

## Workflow State Transition Diagram (expected)

```
SetupJob → CheckInboundTaskExists → CreateCallToScheduleTask → WaitForContactTask
  → OnContactTaskCompleted → SetContactDate → CalculateAttendanceDueDate
  → WriteAttendanceDueDate → CreateBookSiteAttendanceTask → WaitForAppointment
  → OnAppointmentScheduled → CalculateSubmissionDueDate → WriteSubmissionDueDate
  → WaitForAttendanceDatePassed → OnAttendanceDatePassed → CreateSubmissionTask
  → WaitForQuotePublished → OnQuotePublished → SetFirstSubmissionDate
  → EvaluateAutoApproval
    → [auto] AutoApproveQuote → SpawnBuilderWorksJob
    → [manual] WaitForQuoteOutcome → OnQuoteApprovalDecision
  → CheckMakeSafe → OnMakeSafeRequired (if yes) → WaitForInvoice
  → WaitForPOCompletion → CheckJobCompletion → MarkJobComplete → JobComplete
```

## Files Changed

| File | Repo | Change |
|------|------|--------|
| `apps/api/test/e2e/builder-assessment-workflow.e2e-spec.ts` | claims-manager | New — E2E test script |

## Running

```bash
# Start all services
pnpm --filter api run dev         # claims-manager on :5001
pnpm --filter claims-mcp run dev  # claims-mcp on :4601
cd ../more0-ensure && pnpm run dev  # more0-ensure on :4510

# Run E2E tests
pnpm --filter api run test:e2e --grep "builder-assessment"
```
