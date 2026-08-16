import { Module } from '@nestjs/common';
import { TenantModule } from '../../tenant/tenant.module';
import { CommunicationsModule } from '../communications/communications.module';
import { FilesystemModule } from '../filesystem/filesystem.module';
import { RfqRequestsController } from './rfq-requests.controller';
import { RfqRequestsService } from './rfq-requests.service';

@Module({
  imports: [TenantModule, CommunicationsModule, FilesystemModule],
  controllers: [RfqRequestsController],
  providers: [RfqRequestsService],
  exports: [RfqRequestsService],
})
export class RfqRequestsModule {}
