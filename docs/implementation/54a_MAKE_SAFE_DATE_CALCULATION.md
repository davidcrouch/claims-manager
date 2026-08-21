# 54a — Make Safe Date Calculation

**Gaps addressed:** G1 (missing `CalculateAttendanceDueDate` + `WriteAttendanceDueDate`), G2 (missing `CalculateSubmissionDueDate` + `WriteSubmissionDueDate`)

## Problem

The make-safe ASL skips SLA date calculation after both the customer contact and appointment scheduling stages. The assessment ASL has these states; the make-safe ASL does not.

**Current make-safe flow (broken):**
```
OnCustomerContacted → CreateBookSiteAttendanceTask  (skips date calc)
OnAppointmentScheduled → WaitForAttendanceDatePassed  (skips date calc)
CompleteCallToScheduleTask → WaitForAttendanceDatePassed  (early path — skips date calc)
```

**Required make-safe flow (matching Crunchwork guide):**
```
OnCustomerContacted → CalculateAttendanceDueDate → WriteAttendanceDueDate → CreateBookSiteAttendanceTask
OnAppointmentScheduled → CalculateSubmissionDueDate → WriteSubmissionDueDate → WaitForAttendanceDatePassed
CompleteCallToScheduleTask → CalculateSubmissionDueDateEarly → WriteSubmissionDueDateEarly → WaitForAttendanceDatePassed
```

The Crunchwork "Builder Make Safe Workflow" guide explicitly lists:
- **Attendance Due Date** is automatically calculated when Call to Schedule is completed
- **Submission Due Date** is implied by the `WaitForAttendanceDatePassed` transition (scheduler needs correct phase data)

## Solution

### 1. Add date calculation states to make-safe ASL

**File:** `more0-ensure/definitions/workflows/job/make-safe/asl.json`

The `calculate_dates` MCP tool and `POST /jobs/:id/calculate-dates` API endpoint already exist (implemented in doc 53b). We just need to add the ASL states that call them.

#### After `OnCustomerContacted`: add 2 states

Change `OnCustomerContacted.Next` from `"CreateBookSiteAttendanceTask"` to `"CalculateAttendanceDueDate"`.

Add new states:

```json
"CalculateAttendanceDueDate": {
  "Type": "Task",
  "Comment": "Call calculate_dates to compute attendanceDueDate from contactDate.",
  "Resource": "tool.claims.calculate_dates",
  "Parameters": {
    "params": {
      "jobId.$": "$.jobId",
      "contactDate.$": "$.event.payload.completedAt"
    }
  },
  "ResultPath": "$.calculatedDates",
  "Next": "WriteAttendanceDueDate"
},

"WriteAttendanceDueDate": {
  "Type": "Task",
  "Comment": "Persist the computed attendanceDueDate to the job.",
  "Resource": "tool.claims.update_job",
  "Parameters": {
    "params": {
      "id.$": "$.jobId",
      "data": {
        "customData": {
          "attendanceDueDate.$": "$.calculatedDates.attendanceDueDate"
        }
      }
    }
  },
  "ResultPath": "$.dateUpdate",
  "Next": "CreateBookSiteAttendanceTask"
}
```

#### After `OnAppointmentScheduled`: add 2 states

Change `OnAppointmentScheduled.Next` from `"WaitForAttendanceDatePassed"` to `"CalculateSubmissionDueDate"`.

Add new states:

```json
"CalculateSubmissionDueDate": {
  "Type": "Task",
  "Comment": "Call calculate_dates to compute submissionDueDate from attendanceDate.",
  "Resource": "tool.claims.calculate_dates",
  "Parameters": {
    "params": {
      "jobId.$": "$.jobId",
      "attendanceDate.$": "$.event.payload.appointmentDate"
    }
  },
  "ResultPath": "$.calculatedDates",
  "Next": "WriteSubmissionDueDate"
},

"WriteSubmissionDueDate": {
  "Type": "Task",
  "Comment": "Persist the computed submissionDueDate to the job.",
  "Resource": "tool.claims.update_job",
  "Parameters": {
    "params": {
      "id.$": "$.jobId",
      "data": {
        "customData": {
          "submissionDueDate.$": "$.calculatedDates.submissionDueDate"
        }
      }
    }
  },
  "ResultPath": "$.dateUpdate",
  "Next": "WaitForAttendanceDatePassed"
}
```

#### Early appointment path: update `CompleteCallToScheduleTask`

Change `CompleteCallToScheduleTask.Next` and `CompleteCallToScheduleTask.Catch[0].Next` from `"WaitForAttendanceDatePassed"` to `"CalculateSubmissionDueDate"`.

In the early appointment path, `$.event.payload.appointmentDate` is still in context from the preceding `OnAppointmentScheduledEarly` state, so `CalculateSubmissionDueDate` can read it directly. This mirrors the assessment ASL's `CreateBookSiteTaskAndComplete` → `CalculateSubmissionDueDate` flow.

### 2. Verify tenant-aware MCP routing

The more0-ensure MCP client now resolves the MCP server URL per tenant. The `tool.claims.calculate_dates` resource will route to the correct claims-mcp instance for the tenant. No additional work is needed — the existing assessment date calculation uses the same tool and routing.

## State count change

Before: 26 states
After: 30 states (+4 date calculation/write states)

## Modified flow diagram

```
SetupMakeSafeJob → SetDefaultClaimRecommendation → CreateCallToScheduleTask
  → WaitForContactOrSchedule
    → [task.completed] OnCustomerContacted
        → CalculateAttendanceDueDate (NEW)
        → WriteAttendanceDueDate (NEW)
        → CreateBookSiteAttendanceTask
        → WaitForAppointmentScheduled
            → OnAppointmentScheduled
                → CalculateSubmissionDueDate (NEW)
                → WriteSubmissionDueDate (NEW)
                → WaitForAttendanceDatePassed
    → [appointment.scheduled] OnAppointmentScheduledEarly
        → CompleteCallToScheduleTask
            → CalculateSubmissionDueDate (reused, NEW routing)
            → WriteSubmissionDueDate (reused)
            → WaitForAttendanceDatePassed
    → [field.updated:makeSafeRequired=false] CancelMakeSafe
  ...remainder unchanged...
```

## Files Changed

| File | Repo | Change |
|------|------|--------|
| `definitions/workflows/job/make-safe/asl.json` | more0-ensure | Add 4 states, update 3 `Next` pointers |

## Testing

1. Complete Call to Schedule task on a make-safe job → verify `attendanceDueDate` is written to `job.customData` (5 business days from `contactDate`).
2. Schedule an appointment → verify `submissionDueDate` is written (10 business days from `attendanceDate`).
3. Schedule appointment before completing Call to Schedule (early path) → verify `submissionDueDate` is still calculated.
4. Weekend boundary test: contact on Friday → `attendanceDueDate` should be next Friday.
5. Verify the attendance scheduler picks up the job after dates are populated (same mechanism as assessment).
