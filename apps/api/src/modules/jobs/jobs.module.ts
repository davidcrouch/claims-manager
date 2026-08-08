import { Module, forwardRef } from '@nestjs/common';
import { TenantModule } from '../../tenant/tenant.module';
import { ExternalModule } from '../external/external.module';
import { OutboundModule } from '../domain/outbound/outbound.module';
import { FilesystemModule } from '../filesystem/filesystem.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  imports: [TenantModule, ExternalModule, OutboundModule, forwardRef(() => FilesystemModule)],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
