import { Module } from '@nestjs/common';
import { TenantModule } from '../../tenant/tenant.module';
import { ExternalModule } from '../external/external.module';
import { BillsController } from './bills.controller';
import { BillsService } from './bills.service';

@Module({
  imports: [TenantModule, ExternalModule],
  controllers: [BillsController],
  providers: [BillsService],
  exports: [BillsService],
})
export class BillsModule {}
