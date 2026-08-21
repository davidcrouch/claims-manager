import { Module } from '@nestjs/common';
import { AttendanceDateScheduler } from './attendance-date.scheduler';

@Module({
  providers: [AttendanceDateScheduler],
  exports: [AttendanceDateScheduler],
})
export class WorkflowSchedulerModule {}
