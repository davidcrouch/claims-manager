import { Module } from '@nestjs/common';
import { TenantModule } from '../../tenant/tenant.module';
import { CrunchworkModule } from '../../crunchwork/crunchwork.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TaskTypeMappingsController } from './task-type-mappings.controller';
import { TaskTypeMappingsService } from './task-type-mappings.service';

@Module({
  imports: [TenantModule, CrunchworkModule],
  controllers: [TasksController, TaskTypeMappingsController],
  providers: [TasksService, TaskTypeMappingsService],
  exports: [TasksService, TaskTypeMappingsService],
})
export class TasksModule {}
