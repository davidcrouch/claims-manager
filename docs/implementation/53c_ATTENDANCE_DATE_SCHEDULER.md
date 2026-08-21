# 53c — Attendance Date Scheduler

**Gap addressed:** G1 (no `attendance_date_passed` event producer)

## Problem

The ASL state `WaitForAttendanceDatePassed` listens for an `attendance_date_passed` event, but nothing in either codebase produces it. Without this event, the workflow permanently stalls after the appointment is scheduled — it never transitions to `Awaiting Submission`.

The Crunchwork documentation says:
> Once the Attendance Date passes, the system will automatically update the job status to Awaiting Submission and create a Submission Required task.

## Solution Options

### Option A: Scheduler in claims-manager (recommended)

Add a scheduled job in claims-manager that periodically checks for jobs where:
1. The job has `customData.attendanceDate` set
2. The `attendanceDate` has passed (is before now)
3. The job's `customData.workflowPhase` is `scheduled` (not yet advanced)

When found, emit `attendance_date_passed` via `OutboundEventsService`.

### Option B: Scheduled trigger in more0-ensure

Use more0-ensure's existing `scheduled_triggers` table. When the ASL reaches `WaitForAttendanceDatePassed`, create a trigger row with `triggerAt` set to the attendance date. The scheduler service would fire it when due.

**Limitation:** The ASL `WaitForEvent` state doesn't currently support dynamically scheduling a trigger from context data. The existing mechanism only handles `TimeoutSeconds` (relative) and `Wait` states (absolute), not "wait for event OR fire at context-derived time."

### Option C: Hybrid — more0-ensure schedules, claims-manager is backup

We go with **Option A** because:
- It's simpler — no ASL engine changes needed
- It works even if more0-ensure is temporarily down
- The WaitForEvent pattern naturally resumes when the event arrives
- It's consistent with how Crunchwork triggers this (time-based check)

## Implementation

### 1. Create the scheduler service

**File:** `apps/api/src/modules/scheduler/attendance-date.scheduler.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { JobsRepository } from '../../database/repositories';
import { OutboundEventsService } from '../outbound-events/outbound-events.service';

@Injectable()
export class AttendanceDateScheduler {
  private readonly logger = new Logger('AttendanceDateScheduler');

  constructor(
    private readonly jobsRepo: JobsRepository,
    private readonly outboundEvents: OutboundEventsService,
  ) {}

  /**
   * Runs every 15 minutes. Finds jobs where:
   * - customData.attendanceDate has passed
   * - customData.workflowPhase = 'scheduled'
   * - customData.attendanceDateEventEmitted is not true (idempotency guard)
   *
   * Emits attendance_date_passed for each and marks them as emitted.
   */
  @Cron('0 */15 * * * *')
  async checkAttendanceDates(): Promise<void> {
    const logPrefix = 'AttendanceDateScheduler.checkAttendanceDates';

    try {
      const now = new Date();
      const jobs = await this.jobsRepo.findJobsWithPassedAttendanceDate({ now });

      if (jobs.length === 0) return;

      this.logger.log(`${logPrefix} — found ${jobs.length} job(s) with passed attendance date`);

      for (const job of jobs) {
        try {
          await this.outboundEvents.emit({
            eventType: 'attendance_date_passed',
            entityType: 'job',
            entityId: job.id,
            tenantId: job.tenantId,
            payload: {
              jobId: job.id,
              attendanceDate: job.attendanceDate,
            },
          });

          // Mark as emitted to prevent duplicate emissions
          await this.jobsRepo.update({
            id: job.id,
            data: {
              customData: {
                ...(job.customData ?? {}),
                attendanceDateEventEmitted: true,
              },
            },
          });

          this.logger.log(`${logPrefix} — emitted attendance_date_passed for job=${job.id}`);
        } catch (err) {
          this.logger.warn(
            `${logPrefix} — failed for job=${job.id}: ${(err as Error).message}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(`${logPrefix} — error: ${(err as Error).message}`);
    }
  }
}
```

### 2. Add repository query

**File:** `apps/api/src/database/repositories/jobs.repository.ts`

Add a method to find jobs with passed attendance dates:

```typescript
async findJobsWithPassedAttendanceDate(params: {
  now: Date;
}): Promise<Array<{
  id: string;
  tenantId: string;
  attendanceDate: string;
  customData: Record<string, unknown>;
}>> {
  // Query jobs where:
  // - customData->>'workflowPhase' = 'scheduled'
  // - customData->>'attendanceDate' IS NOT NULL
  // - customData->>'attendanceDate' <= now (as timestamp)
  // - customData->>'attendanceDateEventEmitted' IS NULL or != 'true'
  const rows = await this.db
    .select({
      id: jobs.id,
      tenantId: jobs.tenantId,
      customData: jobs.customData,
    })
    .from(jobs)
    .where(
      and(
        sql`${jobs.customData}->>'workflowPhase' = 'scheduled'`,
        sql`${jobs.customData}->>'attendanceDate' IS NOT NULL`,
        sql`(${jobs.customData}->>'attendanceDate')::timestamptz <= ${params.now}`,
        sql`(${jobs.customData}->>'attendanceDateEventEmitted') IS NULL`,
      ),
    );

  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenantId,
    attendanceDate: (r.customData as Record<string, unknown>)?.attendanceDate as string,
    customData: (r.customData ?? {}) as Record<string, unknown>,
  }));
}
```

### 3. Register the scheduler

**File:** `apps/api/src/modules/scheduler/scheduler.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AttendanceDateScheduler } from './attendance-date.scheduler';
import { OutboundEventsModule } from '../outbound-events/outbound-events.module';

@Module({
  imports: [ScheduleModule.forRoot(), OutboundEventsModule],
  providers: [AttendanceDateScheduler],
})
export class WorkflowSchedulerModule {}
```

Import in `app.module.ts`:
```typescript
import { WorkflowSchedulerModule } from './modules/scheduler/scheduler.module';

@Module({
  imports: [
    // ... existing modules
    WorkflowSchedulerModule,
  ],
})
export class AppModule {}
```

### 4. Ensure `@nestjs/schedule` is installed

```bash
pnpm add @nestjs/schedule
```

If already present (check `package.json`), skip.

## Idempotency

The `attendanceDateEventEmitted` flag on `customData` ensures:
- The event is emitted only once per job
- If more0-ensure is temporarily down, the event won't re-emit on the next scheduler run (the workflow will resume when it comes back online via the original event stored in more0-ensure's run state)
- If a re-emit is needed (e.g. after a bugfix), the flag can be manually cleared

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Appointment rescheduled to a later date | The `attendanceDate` in customData is updated by the workflow's `OnAppointmentScheduled` state via `update_job`. The scheduler checks the latest value. |
| more0-ensure is down when event emits | The event is POSTed but fails. The `attendanceDateEventEmitted` flag is set regardless (fire-and-forget). On recovery, the workflow will still be `waiting` — a manual re-emit or sweep would be needed. Consider adding retry logic to `OutboundEventsService.emit`. |
| Job cancelled before attendance date | The `workflowPhase` would have been updated away from `scheduled`, so the query won't match. |

## Files Changed

| File | Repo | Change |
|------|------|--------|
| `apps/api/src/modules/scheduler/attendance-date.scheduler.ts` | claims-manager | New — cron job |
| `apps/api/src/modules/scheduler/scheduler.module.ts` | claims-manager | New — module |
| `apps/api/src/app.module.ts` | claims-manager | Import WorkflowSchedulerModule |
| `apps/api/src/database/repositories/jobs.repository.ts` | claims-manager | Add findJobsWithPassedAttendanceDate |
| `apps/api/package.json` | claims-manager | Add @nestjs/schedule (if missing) |

## Testing

1. Create a job with `customData.attendanceDate` in the past and `workflowPhase = 'scheduled'`.
2. Run the scheduler tick manually — verify `attendance_date_passed` event is emitted.
3. Run again — verify the event is NOT re-emitted (idempotency check).
4. Create a job with future `attendanceDate` — verify it's skipped.
5. Integration: run the full flow through scheduling, wait for the scheduler to fire, verify the workflow transitions to `OnAttendanceDatePassed`.
