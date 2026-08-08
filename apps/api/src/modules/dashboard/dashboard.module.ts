import { Module } from '@nestjs/common';
import { TenantModule } from '../../tenant/tenant.module';
import { FinanceModule } from '../finance/finance.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TenantModule, FinanceModule, ScheduleModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
