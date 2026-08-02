import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TenantModule } from '../../tenant/tenant.module';
import { SystemAgentsModule } from '../system-agents/system-agents.module';
import { PipelineService } from './pipeline.service';
import { PipelineRunnerService } from './pipeline-runner.service';
import { PipelineController } from './pipeline.controller';

@Module({
  imports: [ConfigModule, TenantModule, SystemAgentsModule],
  controllers: [PipelineController],
  providers: [PipelineRunnerService, PipelineService],
  exports: [PipelineService, PipelineRunnerService],
})
export class PipelineModule {}
