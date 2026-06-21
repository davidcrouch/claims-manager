import { Module } from '@nestjs/common';
import { TenantModule } from '../../tenant/tenant.module';
import { ExternalModule } from '../external/external.module';
import { OutboundModule } from '../domain/outbound/outbound.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  imports: [TenantModule, ExternalModule, OutboundModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
