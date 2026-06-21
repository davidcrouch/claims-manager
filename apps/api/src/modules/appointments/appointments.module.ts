import { Module } from '@nestjs/common';
import { TenantModule } from '../../tenant/tenant.module';
import { CrunchworkModule } from '../../crunchwork/crunchwork.module';
import { ExternalModule } from '../external/external.module';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

@Module({
  imports: [TenantModule, CrunchworkModule, ExternalModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
