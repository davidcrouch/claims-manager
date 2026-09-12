import { Module } from '@nestjs/common';
import { TenantModule } from '../../tenant/tenant.module';
import { CommunicationsModule } from '../communications/communications.module';
import { FilesystemModule } from '../filesystem/filesystem.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { InvoiceIssuesController } from './invoice-issues.controller';
import { InvoiceIssuesService } from './invoice-issues.service';

@Module({
  imports: [TenantModule, CommunicationsModule, FilesystemModule, InvoicesModule],
  controllers: [InvoiceIssuesController],
  providers: [InvoiceIssuesService],
  exports: [InvoiceIssuesService],
})
export class InvoiceIssuesModule {}
