# 53b — Date Calculation

**Gap addressed:** G3 (calculatedDates context never populated)

## Problem

ASL states `CalculateAttendanceDueDate` and `CalculateSubmissionDueDate` write `$.calculatedDates.attendanceDueDate` and `$.calculatedDates.submissionDueDate` to the job via `update_job`, but these JSONPath references resolve to `undefined` because nothing ever populates `$.calculatedDates` in the run context.

Current ASL:
```json
"CalculateAttendanceDueDate": {
  "Type": "Task",
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
  }
}
```

## Solution: Add a `calculate_dates` MCP Tool

Add a new MCP tool to claims-mcp that accepts a job ID, fetches the job's context (insurer SLA config, contact date, attendance date), and returns calculated dates. The ASL will call this tool before using the dates.

### 1. New MCP tool in claims-mcp

**File:** `apps/claims-mcp/src/tools/workflow.tool.ts`

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { toolError, toolResult } from '../server.js';
import { categoryDesc } from '../categories.js';

const CAT = 'operations' as const;

export function registerWorkflowTools(server: McpServer, api: ClaimsApiClient): void {
  server.tool(
    'calculate_dates',
    categoryDesc(CAT, 'Calculate SLA-based workflow dates for a job (attendanceDueDate, submissionDueDate).'),
    {
      jobId: z.string().describe('Job UUID'),
      contactDate: z.string().optional().describe('ISO date when customer was contacted (for attendanceDueDate)'),
      attendanceDate: z.string().optional().describe('ISO date of site attendance (for submissionDueDate)'),
    },
    async (args) => {
      try {
        const result = await api.request<Record<string, unknown>>(
          `/jobs/${args.jobId}/calculate-dates`,
          {
            method: 'POST',
            body: {
              contactDate: args.contactDate,
              attendanceDate: args.attendanceDate,
            },
          },
        );
        return toolResult(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
```

Register in `server.ts`:
```typescript
import { registerWorkflowTools } from './tools/workflow.tool.js';

// Add to the operations category compose():
operations: compose(
  // ... existing registrations ...
  registerWorkflowTools,
),
```

### 2. New API endpoint in claims-manager

**File:** `apps/api/src/modules/jobs/jobs.controller.ts`

Add a `POST /jobs/:id/calculate-dates` endpoint:

```typescript
@Post(':id/calculate-dates')
async calculateDates(
  @Param('id') id: string,
  @Body() body: { contactDate?: string; attendanceDate?: string },
) {
  return this.jobsService.calculateWorkflowDates({ id, ...body });
}
```

**File:** `apps/api/src/modules/jobs/jobs.service.ts`

```typescript
async calculateWorkflowDates(params: {
  id: string;
  contactDate?: string;
  attendanceDate?: string;
}): Promise<{ attendanceDueDate: string | null; submissionDueDate: string | null }> {
  const tenantId = this.tenantContext.getTenantId();
  const job = await this.jobsRepo.findOne({ id: params.id, tenantId });
  if (!job) throw new BadRequestException('Job not found');

  // Default SLA: 5 business days for attendance, 10 business days for submission.
  // These could later be loaded from insurer configuration.
  const ATTENDANCE_SLA_DAYS = 5;
  const SUBMISSION_SLA_DAYS = 10;

  let attendanceDueDate: string | null = null;
  let submissionDueDate: string | null = null;

  const contactDate = params.contactDate
    ?? (job.customData as Record<string, unknown>)?.contactDate as string | undefined;

  const attendanceDate = params.attendanceDate
    ?? (job.customData as Record<string, unknown>)?.attendanceDate as string | undefined;

  if (contactDate) {
    attendanceDueDate = this.addBusinessDays(new Date(contactDate), ATTENDANCE_SLA_DAYS).toISOString();
  }

  if (attendanceDate) {
    submissionDueDate = this.addBusinessDays(new Date(attendanceDate), SUBMISSION_SLA_DAYS).toISOString();
  }

  return { attendanceDueDate, submissionDueDate };
}

private addBusinessDays(start: Date, days: number): Date {
  const result = new Date(start);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}
```

### 3. Rework ASL date calculation states

**File:** `more0-ensure/definitions/workflows/job/assessment/asl.json`

Replace the current `CalculateAttendanceDueDate` and `CalculateSubmissionDueDate` states. Each now calls `calculate_dates` first, stores the result, then writes to the job.

#### CalculateAttendanceDueDate

Replace:
```json
"CalculateAttendanceDueDate": {
  "Type": "Task",
  "Resource": "tool.claims.update_job",
  "Parameters": { ... "attendanceDueDate.$": "$.calculatedDates.attendanceDueDate" ... },
  "Next": "CreateBookSiteAttendanceTask"
}
```

With two states:
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

#### CalculateSubmissionDueDate

Replace similarly with two states:
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

Also update the `CreateBookSiteTaskAndComplete` state (early appointment path) to call `CalculateSubmissionDueDate` with the correct attendanceDate source — in that path it's `$.event.payload.appointmentDate`.

### 4. Handle the early-appointment shortcut path

The `CreateBookSiteTaskAndComplete` state flows directly to `CalculateSubmissionDueDate`. In this path, the `$.event.payload.appointmentDate` is set by the preceding `OnAppointmentScheduledEarly` state. The `CalculateSubmissionDueDate` state reads `$.event.payload.appointmentDate` which will still be present in context.

If `$.event.payload.appointmentDate` might not be present in all paths, store the attendance date in a stable context path:
```json
"OnAppointmentScheduled": {
  ...
  "Parameters": {
    "params": {
      "id.$": "$.jobId",
      "data": {
        "customData": {
          "bookedDate.$": "$.event.payload.scheduledAt",
          "attendanceDate.$": "$.event.payload.appointmentDate",
          "workflowPhase": "scheduled"
        }
      }
    }
  },
  "ResultPath": "$.jobUpdate",
  "Next": "StoreAttendanceDateForCalculation"
}
```

Add a Pass state to stash the date:
```json
"StoreAttendanceDateForCalculation": {
  "Type": "Pass",
  "Parameters": {
    "attendanceDateForCalc.$": "$.event.payload.appointmentDate"
  },
  "ResultPath": "$.scheduling",
  "Next": "CalculateSubmissionDueDate"
}
```

Then `CalculateSubmissionDueDate` reads `$.scheduling.attendanceDateForCalc` (or keep using `$.event.payload.appointmentDate` if context is still intact).

## Files Changed

| File | Repo | Change |
|------|------|--------|
| `apps/claims-mcp/src/tools/workflow.tool.ts` | claims-manager | New file — calculate_dates MCP tool |
| `apps/claims-mcp/src/server.ts` | claims-manager | Register workflow tools |
| `apps/api/src/modules/jobs/jobs.controller.ts` | claims-manager | Add POST /jobs/:id/calculate-dates |
| `apps/api/src/modules/jobs/jobs.service.ts` | claims-manager | Add calculateWorkflowDates + addBusinessDays |
| `definitions/workflows/job/assessment/asl.json` | more0-ensure | Split date states, call calculate_dates |

## Testing

1. Call `calculate_dates` with a contactDate → verify attendanceDueDate is 5 business days later.
2. Call `calculate_dates` with an attendanceDate → verify submissionDueDate is 10 business days later.
3. Run the assessment ASL through the contact phase → verify attendanceDueDate is written to the job.
4. Run through the scheduling phase → verify submissionDueDate is written to the job.
5. Test weekend boundary cases (Friday + 5 → next Friday).

## Future Enhancement

The hardcoded SLA days (5/10) should eventually be configurable per insurer. This would involve:
- A new `sla_config` table or config section on the insurer's account
- The `calculate_dates` endpoint reading the insurer's SLA from the job's account relationship
- Supporting different SLA types (business days vs calendar days, priority-based escalation)
