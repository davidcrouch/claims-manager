import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobsRepository } from '../../database/repositories';
import { OutboundEventsService } from '../outbound-events/outbound-events.service';

/**
 * Polls for jobs whose attendanceDate has passed while still in the
 * "scheduled" workflow phase, then emits attendance_date_passed to
 * more0-ensure so the workflow can advance to Awaiting Submission.
 */
@Injectable()
export class AttendanceDateScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('AttendanceDateScheduler');
  private interval: ReturnType<typeof setInterval> | null = null;
  private readonly enabled: boolean;
  private readonly intervalMs: number;

  constructor(
    private readonly config: ConfigService,
    private readonly jobsRepo: JobsRepository,
    private readonly outboundEvents: OutboundEventsService,
  ) {
    this.enabled = config.get<boolean>('ATTENDANCE_SCHEDULER_ENABLED', true);
    const minutes = config.get<number>('ATTENDANCE_SCHEDULER_INTERVAL_MINUTES', 15);
    this.intervalMs = minutes * 60 * 1000;
  }

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.log('AttendanceDateScheduler — disabled');
      return;
    }
    this.logger.log(
      `AttendanceDateScheduler — starting with interval ${this.intervalMs / 60_000}m`,
    );
    this.interval = setInterval(() => {
      void this.tick().catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`AttendanceDateScheduler.tick — unexpected error: ${message}`);
      });
    }, this.intervalMs);
  }

  onModuleDestroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async tick(): Promise<void> {
    const logPrefix = 'AttendanceDateScheduler.tick';
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

          await this.jobsRepo.update({
            id: job.id,
            data: {
              customData: {
                ...job.customData,
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
