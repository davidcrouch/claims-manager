import { Module } from '@nestjs/common';
import { TenantModule } from '../../tenant/tenant.module';
import { CommunicationsModule } from '../communications/communications.module';
import { FilesystemModule } from '../filesystem/filesystem.module';
import { PoIssuesController } from './po-issues.controller';
import { PoIssuesService } from './po-issues.service';

@Module({
  imports: [TenantModule, CommunicationsModule, FilesystemModule],
  controllers: [PoIssuesController],
  providers: [PoIssuesService],
  exports: [PoIssuesService],
})
export class PoIssuesModule {}
