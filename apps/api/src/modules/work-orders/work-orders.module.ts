import { Module } from '@nestjs/common';
import { TenantModule } from '../../tenant/tenant.module';
import { CatalogModule } from '../catalog/catalog.module';
import { WorkOrdersController } from './work-orders.controller';
import { WorkOrdersService } from './work-orders.service';

@Module({
  imports: [TenantModule, CatalogModule],
  controllers: [WorkOrdersController],
  providers: [WorkOrdersService],
  exports: [WorkOrdersService],
})
export class WorkOrdersModule {}
